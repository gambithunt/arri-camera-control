# Release Readiness

## App Store And TestFlight Gate

- Local network permission strings reviewed
- Bonjour service list reviewed against final discovery behavior
- Photos add-only usage text reviewed
- iPad-only orientations verified in portrait and landscape
- App icon, launch assets, and display name finalized
- Privacy review completed for diagnostics export behavior

## Product Readiness

- Discovery works on LF and 35 without companion hardware
- Core control workflow verified end to end
- Playback workflow verified end to end
- Timecode workflow verified end to end
- Look workflow verified end to end
- Frame grab capture, preview, and Photos export verified end to end
- Diagnostics share output reviewed for operator usefulness

## Engineering Readiness

- Package tests green
- App target builds cleanly in Xcode
- No known crashers in startup, discovery, connect, or reconnect paths
- Diagnostics report includes camera identity, session label, and recent events
- Hardware validation matrix completed and signed off

## Submission Checks

- TestFlight smoke pass on release build
- Release notes drafted
- Support contact and troubleshooting copy drafted
- Internal rollback plan documented
