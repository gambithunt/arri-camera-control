# ARRI Camera Control iOS

Native iPad-first ARRI camera control app for LF and 35.

This workspace is being built phase by phase from `docs/ios-plan.md` using strict red/green TDD.

## Simulator Mode

By default, Simulator runs use the built-in mock runtime.

That means:
- two fake discovered cameras appear automatically: `ARRI ALEXA LF` and `ARRI ALEXA 35`
- you can move through control, playback, timecode, look, diagnostics, and frame-grab flows without hardware

## Live Camera Override

If you want the Simulator to use the real networking stack instead of the mock runtime, launch with:

```bash
ARRI_FORCE_LIVE_CAMERA=1
```

Example:

```bash
ARRI_FORCE_LIVE_CAMERA=1 xcodebuild \
  -project "/Users/delon/Documents/code/projects/tonal/arri-camera-control/native-ios/ARRICameraControlApp.xcodeproj" \
  -scheme "ARRICameraControlApp" \
  -destination "platform=iOS Simulator,name=iPad Pro 13-inch (M5),OS=26.4" \
  build
```

Or set `ARRI_FORCE_LIVE_CAMERA=1` in the Xcode scheme environment variables before running.
