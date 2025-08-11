# ARRI Camera Control - iOS Deployment Guide

## Overview
This guide covers deploying the ARRI Camera Control app as a self-contained iOS application that runs completely offline on iPhone and iPad devices.

## Architecture
- **Frontend**: SvelteKit web app packaged with Capacitor
- **Backend**: Embedded Node.js-like server running locally on device
- **Protocol**: CAP (Camera Access Protocol) over WiFi to ARRI cameras
- **Storage**: Local device storage for settings, LUTs, and app data
- **Offline**: Complete functionality without internet connection

## Build Process

### 1. Prerequisites
- macOS with Xcode installed
- iOS Developer Account (for device deployment)
- Node.js and npm

### 2. Build Commands
```bash
# Build for iOS development
npm run mobile:ios

# Build and run on iOS device
npm run mobile:run:ios

# Just sync changes
npm run mobile:sync
```

### 3. Manual Build Steps
```bash
# 1. Build the web app
npm run build

# 2. Build mobile package
npm run build:mobile

# 3. Open in Xcode
npx cap open ios
```

## iOS-Specific Features

### Device Capabilities
- **Network Access**: Required for CAP protocol communication with cameras
- **Local Storage**: For offline data persistence
- **Background Processing**: To maintain camera connections
- **Landscape Orientation**: Optimized for professional camera operation

### Performance Optimizations
- **Touch Responsiveness**: <100ms response time for all controls
- **Memory Management**: Efficient handling of video metadata and LUTs
- **Battery Optimization**: Minimal background processing when not in use

### Security & Permissions
- **Network Usage**: Access to local WiFi networks for camera communication
- **File Storage**: Local document storage for LUTs and settings
- **Camera Access**: Not required (app controls external cameras, not device camera)

## Deployment Options

### 1. Development Deployment
- Install directly from Xcode to connected device
- Requires iOS Developer Account
- Good for testing and development

### 2. TestFlight Distribution
- Upload to App Store Connect
- Distribute to beta testers
- Good for pre-production testing

### 3. Enterprise Distribution
- iOS Developer Enterprise Program
- Internal distribution within organization
- Good for professional film crews

### 4. App Store Distribution
- Full App Store review process
- Public availability
- Good for wide distribution

## Testing Checklist

### Offline Functionality
- [ ] App launches without internet connection
- [ ] All camera controls work offline
- [ ] Settings persist between app launches
- [ ] LUTs can be saved and loaded locally

### Camera Integration
- [ ] CAP protocol connection to ARRI cameras
- [ ] Frame rate control (1-120 fps)
- [ ] White balance adjustment (2000K-11000K)
- [ ] ISO control (100-6400)
- [ ] ND filter control
- [ ] Playback functionality
- [ ] Timecode synchronization
- [ ] Color grading with CDL

### Mobile Experience
- [ ] Touch controls responsive (<100ms)
- [ ] Haptic feedback on supported devices
- [ ] Landscape orientation optimized
- [ ] Works on iPhone and iPad
- [ ] Battery usage optimized
- [ ] Memory usage within limits

## Troubleshooting

### Common Issues
1. **Build Failures**: Ensure all dependencies installed
2. **Xcode Errors**: Check iOS deployment target compatibility
3. **Network Issues**: Verify WiFi permissions in iOS settings
4. **Performance**: Monitor memory usage in Xcode Instruments

### Debug Mode
- Enable debug logging in app settings
- View CAP protocol messages
- Monitor connection status
- Export logs for troubleshooting

## File Structure
```
arri-camera-control/
├── ios/                    # iOS native project (generated)
├── src/lib/mobile/         # Mobile-specific code
├── resources/              # App icons and splash screens
├── scripts/build-mobile.js # Mobile build script
└── capacitor.config.ts     # Capacitor configuration
```

## Next Steps
1. Complete mobile backend implementation
2. Test with actual ARRI cameras
3. Optimize for production deployment
4. Submit for App Store review (if needed)