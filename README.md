# ARRI Camera Control App

A Progressive Web Application for remote control and monitoring of ARRI cameras via the Camera Access Protocol (CAP).

**Status:** Development - Core protocol implemented, production mode fixed, iOS architecture decision needed

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [Development Modes](#development-modes)
5. [How It Works](#how-it-works)
6. [CAP Protocol Implementation](#cap-protocol-implementation)
7. [iOS Deployment](#ios-deployment)
8. [Testing](#testing)
9. [Current Status](#current-status)
10. [Next Steps](#next-steps)

---

## Overview

This app provides remote control of ARRI cameras (ALEXA Mini, Mini LF, 35, etc.) through a mobile-optimized web interface. It connects to cameras using ARRI's Camera Access Protocol (CAP) v1.12 over TCP/IP.

### Key Features

- **Camera Control**: Frame rate, white balance, ISO, ND filters, shutter angle
- **Playback**: Browse clips, playback controls, clip metadata
- **Timecode Management**: Sync, mode selection, user bits
- **Color Grading**: CDL controls (lift/gamma/gain), LUT management
- **Live Monitoring**: Real-time camera state updates via WebSocket
- **Offline Support**: PWA capabilities for offline iPad usage
- **Mobile Optimized**: Touch-friendly with responsive design

### System Requirements

- **Frontend**: Node.js 18+, Modern browser (Chrome/Safari/Firefox)
- **Backend**: Node.js 18+ (for development/testing)
- **iOS**: iOS 14+, Xcode 14+ (for mobile builds)
- **Camera**: ARRI ALEXA SXT/LF/65, Mini/Mini LF, 35 with CAP enabled

---

## Architecture

The app uses a **three-tier architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (SvelteKit)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │   Camera     │  │   Playback   │  │   Color Grading     │   │
│  │   Controls   │  │   Controls   │  │   (CDL/LUTs)        │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │  Timecode    │  │  Connection  │  │  Settings/Config    │   │
│  │  Management  │  │   Status     │  │                     │   │
│  └──────────────┘  └──────────────┘  └─────────────────────┘   │
└───────────────────────────┬────────────────────────────────────┘
                            │ WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND (Node.js)                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              WebSocket Server (Socket.io)              │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                  │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │              CAP Protocol Handler                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │  │   Message    │  │   Variable   │  │   Command    │  │   │
│  │  │   Parser     │  │   Manager    │  │   Queue      │  │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │ TCP Socket                       │
└─────────────────────────────┼──────────────────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ARRI CAMERA                            │
│                    (CAP Protocol v1.12)                        │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Frontend:**

- **Framework**: SvelteKit 5 (Svelte 5 runes)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + custom components
- **State**: Svelte stores (reactive)
- **Mobile**: Capacitor 7 (for iOS/Android builds)

**Backend:**

- **Runtime**: Node.js 18+
- **Server**: Express + Socket.io
- **Protocol**: Raw TCP sockets for CAP
- **Testing**: Vitest + Playwright

**Protocol:**

- **CAP v1.12**: Binary protocol over TCP port 7777
- **WebSocket**: For frontend-backend communication
- **Message Format**: Binary serialization with length-prefixed frames

---

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd arri-camera-control
npm install
```

### 2. Development Mode (with Mocks)

This mode uses mock data so you can develop the UI without a camera:

```bash
npm run dev
```

**What happens:**

- Frontend loads with mock stores (fake camera data)
- Backend is not required
- All UI controls work with simulated responses
- Camera appears connected with mock ALEXA Mini LF

**Access:** http://localhost:5173

### 3. Production Mode (Real Camera)

This mode connects to real camera hardware:

```bash
# Terminal 1: Start backend
cd backend
npm install
npm run dev

# Terminal 2: Start frontend in production mode
npm run dev:prod
```

**What happens:**

- Frontend loads real stores
- Connects to backend via WebSocket
- Backend attempts CAP connection to camera
- Shows real connection status

### 4. Build for Production

```bash
npm run build
```

This creates a static build in the `build/` directory.

---

## Development Modes

The app has two distinct operating modes controlled by configuration:

### Development Mode

**Purpose:** UI development without camera hardware  
**Trigger:** `npm run dev` or URL param `?dev=true`  
**Stores:** Mock stores with simulated data  
**Backend:** Not required

**Features:**

- Mock camera always appears connected
- All controls work with console logging
- Fast iteration without hardware
- Dev panel accessible (Ctrl+Shift+D or type "arridev")

### Production Mode

**Purpose:** Connect to real camera hardware  
**Trigger:** `npm run dev:prod` or default  
**Stores:** Real stores with WebSocket connection  
**Backend:** Required

**Features:**

- Real connection status
- WebSocket communication with backend
- Actual CAP protocol messages
- Error handling for real failures

### Switching Modes

**Via URL:**

```
http://localhost:5173/?dev=true   # Force dev mode
http://localhost:5173/?dev=false  # Force production mode
```

**Via Keyboard:**

- Press `Ctrl+Shift+D` (or `Cmd+Shift+D` on Mac) to toggle dev panel
- Type `arridev` (within 2 seconds) to toggle dev mode

**Programmatically:**

```typescript
import { enableDevMode, enableProductionMode } from '$lib/config/appConfig';

enableDevMode(); // Switch to dev mode
enableProductionMode(); // Switch to production mode
```

---

## How It Works

### Store System

The app uses a **dual-store architecture** that switches based on mode:

```typescript
// src/lib/dev/mockStores.ts
export const mockStores = {
	cameraStore: createMockCameraStore(), // Simulated camera state
	connectionStore: createMockConnectionStore(), // Simulated connection
	playbackStore: createMockPlaybackStore() // Simulated clips
	// ... etc
};

// src/lib/stores/ (real stores)
export { cameraStore } from './cameraStore'; // Real WebSocket connection
export { connectionStore } from './connectionStore';
export { playbackStore } from './playbackStore';
// ... etc
```

**Store Loading Logic (src/routes/+page.svelte):**

```typescript
onMount(async () => {
	const useMocks = shouldUseMockStores();

	if (useMocks) {
		// Load mock stores for development
		const { mockStores } = await import('$lib/dev/mockStores');
		cameraStore = mockStores.cameraStore;
	} else {
		// Load real stores for production
		const stores = await import('$lib/stores');
		cameraStore = stores.cameraStore;
	}

	// Subscribe to store changes
	unsubscribeCamera = cameraStore.subscribe((state) => {
		cameraState = state;
	});
});
```

### Camera API

The `CameraApiClient` (src/lib/api/cameraApi.ts) provides a high-level interface:

```typescript
class CameraApiClient {
	// Reactive stores
	cameraState: Writable<CameraState>;
	playbackState: Writable<PlaybackState>;

	// Methods
	async connect(cameraIP?: string): Promise<ApiResponse>;
	async setFrameRate(frameRate: number): Promise<ApiResponse>;
	async setWhiteBalance(kelvin: number, tint?: number): Promise<ApiResponse>;
	async setISO(iso: number): Promise<ApiResponse>;
	async enterPlaybackMode(): Promise<ApiResponse>;
	async setCDL(cdlValues: CDLValues): Promise<ApiResponse>;
	// ... etc
}
```

**Usage:**

```typescript
import { cameraApi } from '$lib/api/cameraApi';

// Connect to camera
await cameraApi.connect('192.168.1.100');

// Change settings
await cameraApi.setFrameRate(24);
await cameraApi.setWhiteBalance(5600, 0);
await cameraApi.setISO(800);

// Listen for state changes
cameraApi.cameraState.subscribe((state) => {
	console.log('Current FPS:', state.frameRate);
});
```

### Configuration System

Configuration is managed in `src/lib/config/appConfig.ts`:

```typescript
// Default configuration
const defaultConfig: AppConfig = {
	development: {
		enabled: false, // Start in production mode
		useMockStores: false, // Use real stores
		useMockApi: false, // Use real API
		showDevIndicator: false,
		enableDebugLogs: false
	},
	production: {
		strictMode: true,
		enableAnalytics: true,
		enableErrorReporting: true
	},
	features: {
		offlineMode: true,
		mobileOptimizations: true,
		advancedControls: true
	}
};
```

**Configuration Priority (highest to lowest):**

1. URL parameters (`?dev=true`)
2. localStorage (saved user preference)
3. Default values

---

## CAP Protocol Implementation

### Protocol Overview

The Camera Access Protocol (CAP) v1.12 uses a **binary message format** over TCP:

```
Message Structure:
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Length  │  Type   │   ID    │ Command │  Data   │
│ 2 bytes │ 1 byte  │ 2 bytes │ 2 bytes │ variable│
└─────────┴─────────┴─────────┴─────────┴─────────┘
```

**Message Types:**

- `0x01` - Command (client → camera)
- `0x02` - Reply (camera → client)
- `0x03` - Event (camera → client, async)

### Implementation Files

**Core Protocol (backend/src/cap/):**

- `types.js` - CAP constants, command codes, variable IDs
- `message.js` - Binary serialization/deserialization
- `connection.js` - TCP socket management
- `protocol.js` - High-level protocol handler

**Example: Sending a Command**

```javascript
// backend/src/cap/protocol.js
async setVariable(variableId, value) {
  const data = this.serializeVariableData(variableId, value);
  const response = await this.connection.sendCommand(
    CAP_COMMANDS.SET_VARIABLE,
    data
  );

  if (response.cmdCode !== CAP_RESULT_CODES.OK) {
    throw new Error(`Failed to set variable: ${response.cmdCode}`);
  }
}
```

**Example: Subscribing to Updates**

```javascript
async subscribeToVariables(variableIds) {
  const response = await this.connection.sendCommand(
    CAP_COMMANDS.REQUEST_VARIABLES,
    variableIds
  );

  // Camera will now send EVENT messages when variables change
  this.connection.on('message', (message) => {
    if (message.msgType === CAP_MESSAGE_TYPES.EVENT) {
      this.handleVariableUpdate(message);
    }
  });
}
```

### Key CAP Commands

| Command           | Code   | Description                          |
| ----------------- | ------ | ------------------------------------ |
| LIVE              | 0x0080 | Keep-alive (required every 1 second) |
| CLIENT_NAME       | 0x0083 | Identify client to camera            |
| REQUEST_VARIABLES | 0x0084 | Subscribe to variable updates        |
| SET_VARIABLE      | 0x0086 | Change camera settings               |
| RECORD_START      | 0x00a0 | Start recording                      |
| RECORD_STOP       | 0x00a1 | Stop recording                       |
| PLAYBACK_ENTER    | 0x00a8 | Enter playback mode                  |
| GET_CLIP_LIST     | 0x00a4 | Retrieve recorded clips              |

### Supported Camera Variables

The implementation supports **232 CAP variables** including:

**Settings:**

- `SENSOR_FPS` (0x0061) - Frame rate
- `COLOR_TEMPERATURE` (0x0051) - White balance Kelvin
- `TINT` (0x0052) - White balance tint
- `EXPOSURE_INDEX` (0x0053) - ISO
- `ND_FILTER` (0x0068) - ND filter stops
- `SHUTTER_ANGLE` (0x0063) - Shutter angle

**Status:**

- `CAMERA_STATE` (0x0040) - Recording, playback, standby
- `TIMECODE` (0x0078) - Current timecode
- `BATTERY_VOLTAGE` (0x0011) - Battery level
- `MEDIA_STATUS` (0x006d) - Card status

**Color:**

- `CDL_VALUES` (0x0050) - CDL lift/gamma/gain
- `LOOK_FILENAME` (0x0041) - Current LUT

---

## iOS Deployment

### Current Architecture Decision

**⚠️ IMPORTANT:** You must choose an iOS architecture approach before deploying.

### Option A: Network Backend (Recommended for Quick Start)

**Architecture:**

```
iOS App (Capacitor) → WebSocket → Backend Server (laptop/device) → TCP → Camera
```

**Pros:**

- ✅ Works with current code
- ✅ Quick to implement (1-2 weeks)
- ✅ Backend can be shared among multiple iOS devices

**Cons:**

- ❌ Requires separate device running backend
- ❌ Not truly offline
- ❌ Network dependency

**Setup:**

1. Run backend on laptop/Raspberry Pi on same WiFi
2. Build iOS app: `npm run mobile:ios`
3. iOS app connects to backend via WebSocket
4. Backend connects to camera via TCP

### Option B: Capacitor TCP Plugin (Recommended for Production)

**Architecture:**

```
iOS App (Capacitor) → TCP Plugin (Swift) → TCP → Camera
```

**Pros:**

- ✅ True offline operation
- ✅ No backend server needed
- ✅ Professional solution
- ✅ Better performance

**Cons:**

- ❌ Requires native iOS development
- ❌ Must implement CAP protocol in Swift
- ❌ Longer development time (4-6 weeks)

**Implementation:**

```swift
// Capacitor TCP Plugin (pseudocode)
@objc func connect(_ call: CAPPluginCall) {
    let host = call.getString("host") ?? ""
    let port = call.getInt("port") ?? 7777

    // Create TCP socket
    socket = TCPConnection(host: host, port: port)
    socket.connect()

    call.resolve(["connected": true])
}

@objc func sendCommand(_ call: CAPPluginCall) {
    let cmdCode = call.getInt("command") ?? 0
    let data = call.getArray("data", String.self) ?? []

    // Serialize CAP message
    let message = CAPMessage(cmdCode: cmdCode, data: data)
    socket.send(data: message.serialize())

    call.resolve(["sent": true])
}
```

### Option C: Node.js on iOS (Not Recommended)

Attempting to embed Node.js runtime in iOS is **not recommended** due to:

- Complexity and maintenance burden
- Performance issues
- App Store rejection risk
- Large bundle size

### Recommended Approach

**Phase 1:** Use Option A to get basic functionality working quickly  
**Phase 2:** Implement Option B for professional production use

### Building for iOS

```bash
# Build web app
npm run build

# Sync to iOS project
npm run mobile:sync

# Open in Xcode
npm run mobile:ios

# Or run on connected device
npm run mobile:run:ios
```

### iOS Configuration

The app is configured in `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
	appId: 'com.arri.cameracontrol',
	appName: 'ARRI Camera Control',
	webDir: 'build',
	server: {
		iosScheme: 'https'
	},
	ios: {
		backgroundColor: '#1a1a1a',
		scrollEnabled: true,
		preferredContentMode: 'mobile'
	}
};
```

---

## Testing

### Frontend Tests

```bash
# Run unit tests
npm run test

# Run with UI
npm run test:ui

# Run with coverage
npm run test:coverage
```

### Backend Tests

```bash
cd backend
npm test
```

### E2E Tests

```bash
# Run Playwright tests
npm run test:e2e
```

### Manual Testing Checklist

**Development Mode:**

- [ ] App loads without errors
- [ ] Mock camera appears connected
- [ ] All UI controls are accessible
- [ ] Settings changes log to console
- [ ] Dev panel opens with Ctrl+Shift+D

**Production Mode:**

- [ ] Backend starts without errors
- [ ] Frontend connects to backend
- [ ] Camera shows as disconnected initially
- [ ] Can enter camera IP in settings
- [ ] Connection establishes successfully
- [ ] Real-time updates work
- [ ] All controls affect camera

**iOS Build:**

- [ ] App launches on iOS device
- [ ] UI is responsive
- [ ] Connection works (depending on architecture choice)

---

## Current Status

### ✅ Working

- **CAP Protocol**: Complete implementation of v1.12
- **Backend**: Full protocol handler with TCP socket management
- **Frontend**: Responsive UI with all screens
- **Stores**: Both mock and real store implementations
- **Development Mode**: Full mock system for UI development
- **Production Mode**: Fixed and working with real stores
- **Build System**: Capacitor configured for iOS/Android

### ⚠️ Partial / Needs Work

- **Mock Server**: Uses JSON instead of binary CAP (minor issue)
- **TypeScript**: Various `any` types need proper typing
- **Tests**: Need more integration tests

### ✅ Recent Fixes (Feb 3, 2026)

- **Production Mode**: Fixed hardcoded mock data in `+page.svelte`, now properly loads real stores in production mode
- **AppShell CSS**: Fixed tab indentation and invalid CSS properties causing preprocessing errors
- **mockStores.ts**: Added proper TypeScript interface for AppState to fix type errors
- **devMode.ts**: Fixed missing `isDevelopmentMode` export
- **Store System**: Implemented dynamic store loading (mock vs real) based on configuration

**What this means:**

- Development mode (`npm run dev`): Uses mock stores with simulated camera data
- Production mode (`npm run dev:prod`): Uses real stores, connects to actual backend and camera
- No more hardcoded "always connected" state

### ❌ Not Implemented / Decision Needed

- **iOS Architecture**: Must choose Option A or B (see iOS Deployment section)
- **Camera Hardware Testing**: Not yet tested with real ARRI camera
- **Offline Storage**: Caching for true offline mode
- **Enterprise Distribution**: MDM setup for production crews

---

## Next Steps

### Immediate (This Week) ✅ MOSTLY COMPLETE

1. **~~Test Production Mode~~** ✅ DONE

   Production mode now works correctly:

   ```bash
   npm run dev:prod
   ```

   - ✅ Real stores load properly
   - ✅ Camera shows disconnected (ready for real connection)
   - ✅ Configuration switching works via URL params and keyboard shortcuts

2. **Test Development Mode** ✅ DONE

   ```bash
   npm run dev
   ```

   - ✅ Mock stores load correctly
   - ✅ Camera appears connected with simulated data
   - ✅ All UI controls work for development

3. **Decide iOS Architecture** ⏳ NEXT PRIORITY
   - Review Option A vs Option B above
   - Consider timeline and requirements
   - Document decision

### Short Term (Next 2 Weeks)

4. **Implement Chosen iOS Architecture**
   - If Option A: Set up backend device and test
   - If Option B: Create Capacitor TCP plugin

5. **Test with Real Camera**
   - Connect to actual ARRI hardware
   - Verify all CAP commands work
   - Test error scenarios

6. **Fix Remaining Issues**
   - Add proper TypeScript types (reduce `any` usage)
   - Update mock server to binary protocol
   - Add more integration tests

### Before Production Release

6. **Comprehensive Testing**
   - Field test with production workflows
   - Test all camera models you need to support
   - Performance testing on iPad

7. **Documentation**
   - Update iOS deployment guide
   - Create user manual
   - Document troubleshooting steps

8. **Distribution**
   - Set up TestFlight (if App Store)
   - Or configure Enterprise distribution
   - Create deployment packages

---

## Troubleshooting

### App Always Shows "Disconnected"

**Cause:** In production mode without backend  
**Solution:** Start backend server:

```bash
cd backend && npm run dev
```

### Camera Connection Fails

**Check:**

1. Camera and device on same network
2. Camera IP address is correct
3. CAP protocol enabled on camera
4. Camera not at connection limit (max 4 clients)
5. Firewall not blocking port 7777

### iOS Build Fails

**Check:**

1. Xcode is installed and updated
2. iOS deployment target matches (iOS 14+)
3. Capacitor sync ran: `npm run mobile:sync`
4. CocoaPods installed: `cd ios/App && pod install`

### Development Mode Not Working

**Force dev mode:**

```
http://localhost:5173/?dev=true
```

Or type `arridev` quickly on keyboard.

---

## Documentation Files

- `README.md` - This file (overview and quick start)
- `DEV_MODE.md` - Detailed development mode documentation
- `ios-deployment.md` - iOS-specific deployment guide
- `caps-instructions.md` - CAP protocol reference (from ARRI)
- `kimi-thoughts.md` - Code review and architecture analysis
- `PRODUCTION_MODE_FIX.md` - Details of recent production mode fixes

---

## Support

For issues or questions:

1. Check this README first
2. Review the specific markdown files above
3. Check browser console for errors
4. Enable debug logging in dev panel (Ctrl+Shift+D)

---

## License

[Your License Here]

---

**Last Updated:** February 3, 2026  
**Version:** 0.0.1  
**Status:** Development - Core Implementation Complete
