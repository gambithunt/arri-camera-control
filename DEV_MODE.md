# Development Mode System

The ARRI Camera Control app includes a comprehensive development mode system that allows easy switching between development and production modes.

## Quick Start

### Development Mode (with mocks)
```bash
npm run dev          # Default development mode with mocks
npm run dev:mock     # Explicit development mode with mocks
```

### Production Mode (real camera)
```bash
npm run dev:prod     # Development server with production settings
npm run build        # Production build
npm run preview      # Preview production build
```

## Development Panel

When in development mode, you'll see a **🎭 DEV** indicator in the top-right corner. Click it to open the development panel where you can:

- **Toggle Dev/Production Mode** - Switch between modes instantly
- **Enable/Disable Mock Stores** - Use mock data vs real camera data
- **Enable/Disable Mock API** - Use mock API vs real camera API
- **Toggle Debug Logs** - Show/hide detailed console logs
- **View Environment Info** - See current configuration
- **Save/Reset Configuration** - Persist settings or reset to defaults

### Keyboard Shortcut
Press **Ctrl+Shift+D** (or **Cmd+Shift+D** on Mac) to toggle the development panel.

### Secret Activation Methods

For production environments where you need hidden access to development tools:

#### Secret Key Sequence
Type **`arridev`** (without any modifier keys) to toggle development mode on/off. The sequence must be completed within 2 seconds. A subtle notification will appear confirming the mode change.

#### Secret Click Pattern
Perform this click sequence anywhere on the page: **Triple-click → Double-click → Single-click → Triple-click** (within 3 seconds) to force-show the development panel, even in production mode.

These secret methods allow developers to access development tools in production builds without exposing them to end users.

## URL Parameters

You can override the mode using URL parameters:

```
http://localhost:5173/?dev=true   # Force development mode
http://localhost:5173/?dev=false  # Force production mode
```

## Configuration

The app uses a centralized configuration system in `src/lib/config/appConfig.ts`:

```typescript
import { enableDevMode, enableProductionMode, isDevMode } from '$lib/config/appConfig';

// Force development mode
enableDevMode();

// Force production mode  
enableProductionMode();

// Check current mode
if (isDevMode()) {
  console.log('Running in development mode');
}
```

## Environment Variables

Create `.env.local` to override default settings:

```bash
# .env.local
VITE_DEV_MODE=true
VITE_USE_MOCK_STORES=true
VITE_USE_MOCK_API=false  # Use real API but mock stores
VITE_SHOW_DEV_INDICATOR=true
VITE_ENABLE_DEBUG_LOGS=true
```

## Production Deployment

For production deployment, the system automatically:

- Disables all mock data
- Hides development indicators
- Disables debug logging
- Enables error reporting
- Uses real camera APIs and stores

```bash
npm run build        # Production build
npm run preview      # Test production build locally
```

## Mock vs Real Data

### Development Mode Features:
- ✅ **Mock Camera Data** - Simulated ARRI camera responses
- ✅ **Mock Playback** - Sample clips and playback controls
- ✅ **Mock Settings** - All camera settings work with fake data
- ✅ **UI Testing** - Full interface testing without hardware
- ✅ **Debug Logs** - Detailed console output
- ✅ **Dev Panel** - Configuration and debugging tools

### Production Mode Features:
- 🚀 **Real Camera API** - Connects to actual ARRI cameras
- 🚀 **Live Data** - Real camera status and settings
- 🚀 **Hardware Control** - Actual camera parameter changes
- 🚀 **Error Reporting** - Production error tracking
- 🚀 **Performance Optimized** - Minimal overhead

## Troubleshooting

### Stuck in Development Mode?
1. Open the dev panel (🎭 DEV button or Ctrl+Shift+D)
2. Toggle to Production Mode
3. Click "Save Config"
4. Refresh the page

### Can't Access Real Camera?
1. Ensure you're in Production Mode
2. Check camera IP and network connection
3. Verify CAP protocol settings
4. Check browser console for connection errors

### Reset Everything?
1. Open dev panel
2. Click "Reset & Reload"
3. Or manually clear localStorage: `localStorage.clear()`

## Development Workflow

### UI Design & Testing
```bash
npm run dev          # Start with mocks
# Make UI changes, see them instantly
# All controls work with mock data
```

### Camera Integration Testing
```bash
npm run dev:prod     # Start in production mode
# Connect to real camera
# Test actual hardware integration
```

### Production Build Testing
```bash
npm run build        # Build for production
npm run preview      # Test production build
```

This system ensures you can develop and test the UI without needing an ARRI camera, while easily switching to production mode for real hardware testing.