# Hardware Validation Matrix

## Purpose

Define the acceptance coverage required before TestFlight and App Store submission for direct-control workflows on ARRI LF and ARRI 35.

## Camera Coverage

### ARRI ALEXA LF

- Validate on production firmware currently used by the target cameras
- Validate direct local-network discovery
- Validate connect and reconnect after Wi-Fi interruption
- Validate full control workflow:
  - frame rate
  - white balance
  - EI
  - ND
  - shutter
  - record start and stop
- Validate playback workflow:
  - enter playback
  - clip step
  - play
  - pause
  - exit playback
- Validate timecode workflow:
  - record run
  - free run
  - jam timecode
- Validate look workflow:
  - apply look by filename
  - verify look state reflects live camera state
- Validate frame grab:
  - capture succeeds repeatedly
  - preview renders
  - export to Photos succeeds

### ARRI 35

- Repeat the same matrix as LF
- Record any behavior differences in discovery timing, timecode, playback clip stepping, or frame grab latency

## Network Conditions

- Stable access point
- Camera-hosted Wi-Fi if available
- Congested Wi-Fi with competing traffic
- Network drop for 5 seconds, 15 seconds, and 60 seconds
- App background and foreground transitions during an active session

## Soak Tests

- 30-minute connected idle soak with live state subscriptions enabled
- 30-minute operator soak with repeated control changes
- 100 repeated frame grab captures and Photos exports
- 100 repeated playback enter and exit transitions
- 100 repeated record start and stop cycles with operator pacing

## Acceptance Notes

- Every failed action logs a diagnostic event
- No control may appear successful if the camera rejects it
- Reconnect must preserve clear operator state and avoid duplicate actions
- Any family-specific behavior difference must be documented before release
