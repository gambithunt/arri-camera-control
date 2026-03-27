# ARRI Camera Control iOS Plan

## Goal

Build a native iPad application for direct local-network control of ARRI LF and ARRI 35 cameras with:

- Discovery on the local network
- Direct camera connection with no companion computer
- Full camera control
- Frame grab support
- Playback browsing and transport control
- Timecode control and sync workflows
- CDL, LUT, and look management
- High reliability for on-set use
- TestFlight/App Store viable implementation

## Non-Negotiables

- Native Apple codebase from this point onward
- iPad-first product decisions
- Support both landscape and portrait
- Red/green TDD for every feature and bug fix
- Direct TCP communication to camera from the iPad
- Discovery must be built in
- UI direction follows [$ui-design](/Users/delon/Documents/code/guide/ai-design-system/skills/ui-design/SKILL.md)

## Dominant UI Problem

The current product concept is fragmented into web-style pages. A real on-set iPad app needs to behave like a calm, direct control surface where camera state, connection health, and critical actions are obvious at a glance.

## UI Direction

### 1. Structure

- Make the app a persistent camera workspace, not a route-hopping app.
- Use one primary control workspace with persistent state visibility.
- Keep top-level areas limited to:
  - Control
  - Playback
  - Timecode
  - Look
  - Diagnostics
- Keep connection, camera identity, health, media state, and warnings visible from every major workspace.

### 2. Hierarchy

- Make camera connection state and record state the strongest visual elements after the current primary controls.
- Group controls by operator task, not by protocol command category.
- Prioritize direct camera actions above metadata and secondary utilities.
- Use spacing, size, and weight before adding color.

### 3. Components And States

- Prefer native SwiftUI patterns unless a custom control is required for speed or precision.
- Define explicit states for every control:
  - disconnected
  - connecting
  - connected
  - syncing
  - applying
  - failed
  - unavailable on current camera mode
- Do not hide critical actions behind gestures.
- Require visible confirmation states for record, playback mode transitions, LUT apply, and timecode sync.

### 4. Copy And Labels

- Use operator language, not protocol language.
- Prefer labels like `White Balance`, `Frame Rate`, `Record`, `Sync Timecode`, `Apply Look`, `Enter Playback`.
- Reserve CAP/protocol details for diagnostics only.

### 5. Motion And Polish

- Keep motion restrained.
- Use quick state transitions and subtle progress indication.
- Never delay interaction feedback.
- Avoid decorative animation.

## UI Review Loop

### Initial Score

- Clarity: 5
- Hierarchy: 5
- Simplicity: 4
- Consistency: 4
- Accessibility: 4

### What Should Be Removed

- Web-style page fragmentation for core control workflows
- Decorative chrome
- Duplicate status surfaces
- Hidden or ambiguous operator actions

### What Should Be Simplified

- Camera setup flow
- Mode switching between control, playback, and look workflows
- Error presentation
- Discovery and reconnect flows

### What Is Still Unclear

- Exact discovery behavior exposed by LF and 35 in the field
- Exact frame grab command behavior and timing expectations on both camera families
- Final App Store policy fit for all discovery and local-network workflows

## Definition Of Done

The project is complete when all of the following are true:

- The iPad app discovers LF and 35 cameras on the local network
- The app can connect, authenticate if needed, and maintain a stable session
- The app shows reliable live camera state with reconnect behavior
- The app supports all required controls and workflows
- Frame grab works reliably on supported cameras
- Playback, timecode, and look workflows are functional end to end
- Test suites are green at unit, integration, and hardware validation levels
- UX works well in both landscape and portrait on iPad
- The app is stable enough for TestFlight and ready for App Store review

## Engineering Rules

### Red/Green TDD Rule

Every work item follows this sequence:

1. Red
   Write or extend a failing test that proves the requirement or bug.
2. Green
   Implement the smallest passing solution.
3. Refactor
   Improve names, structure, and reuse while keeping tests green.
4. Verify
   Run the smallest relevant suite, then the broader package or app suite.

### Test Pyramid

- Unit tests for protocol framing, parsing, state mapping, validation, and reducers
- Integration tests for session management, discovery, reconnect, and command flows
- Contract tests against a fake CAP camera server
- Hardware acceptance tests against real LF and 35 bodies
- UI tests for major operator workflows
- Soak tests for connection stability and repeated command use

## Proposed Codebase Shape

```text
arri-camera-control-ios/
  App/
    ARRICameraControlApp/
  Packages/
    ARRICAPKit/
    CameraDiscovery/
    CameraDomain/
    CameraSession/
    CameraFeatures/
    CameraDiagnostics/
    CameraMocks/
  docs/
    ios-plan.md
```

## Architecture Decisions

### App Layer

- SwiftUI app shell
- iPad-first layouts using NavigationSplitView or a custom workspace shell where appropriate
- Shared observable app state only at the composition edge
- Feature-level view models or presenters for each workflow

### Transport Layer

- `Network.framework` for direct TCP communication
- One dedicated CAP transport implementation
- No embedded Node runtime
- No WebView runtime for core functionality

### Concurrency Model

- Use Swift concurrency
- Use `actor`s for session, socket, discovery coordination, and command queue ownership
- Keep UI updates on main actor only at the boundary

### Discovery Layer

- Use Bonjour and local-network APIs first
- Add a fallback subnet scan and handshake verification path if Bonjour is incomplete in the field
- Never trust discovery result alone; always verify camera identity and capabilities

### Session Layer

- Single active camera session at first
- Explicit state machine for:
  - idle
  - discovering
  - connecting
  - authenticating
  - subscribing
  - connected
  - degraded
  - reconnecting
  - failed

### Persistence

- Persist recent cameras, app settings, presets, LUT metadata, diagnostics, and operator preferences
- Do not persist stale live state as truth
- Store logs and protocol traces with privacy-safe export support

## Phase Status

- [x] Phase 1: Native Workspace Bootstrap
- [x] Phase 2: Domain Model And Capability Map
- [x] Phase 3: CAP Framing And Binary Protocol Core
- [x] Phase 4: TCP Transport And Session State Machine
- [x] Phase 5: Discovery
- [x] Phase 6: Live State Subscription And Camera Store
- [x] Phase 7: Core Control Features
- [x] Phase 8: Frame Grab
- [x] Phase 9: Playback
- [x] Phase 10: Timecode
- [x] Phase 11: CDL, LUT, And Look Features
- [x] Phase 12: Diagnostics, Logging, And Supportability
- [x] Phase 13: iPad UX Implementation
- [ ] Phase 14: Accessibility And Input Quality
- [ ] Phase 15: Performance And Reliability Hardening
- [ ] Phase 16: Hardware Validation Matrix
- [ ] Phase 17: Release Preparation

### Current Implementation Snapshot

- CAP framing, typed command encoding, variable decoding, and message ID sequencing are implemented and covered by tests.
- The transport/client/session foundation is implemented with test-driven handshake and subscription flows.
- Discovery candidate merging, Bonjour browsing, and CAP-based camera verification are implemented.
- Live state subscription, session update streaming, and an observable camera workspace store are implemented.
- Operator-facing services for core control, playback, timecode, look, frame grab, Photos export, and diagnostics export are implemented.
- The SwiftUI workspace now uses section-focused operator panels with persistent connection and camera health visibility across control, playback, timecode, look, and diagnostics.
- The app shell now wires a concrete Photos exporter and baseline accessibility/input-quality improvements for major operator actions.
- Session reliability now includes idempotent workspace start/stop, explicit event-stream failure detection, bounded reconnect attempts, and tested receive-loop restart behavior.
- The operator workspace now surfaces explicit connection-health banners, disables unsafe controls during reconnect/auth phases, and resets cleanly to idle on stop/background.
- The app runtime now enables session keepalive polling, surfaces keepalive health in the operator workspace, and records per-command timing diagnostics for control, playback, timecode, look, and frame-grab actions.
- Hardware validation and release-readiness documents now define the remaining execution gates for LF and 35 sign-off.

## Execution Plan

## Phase 0: Reference And Requirements Lock

### Objective

Convert the current repo from implementation source into reference material and freeze the native scope.

### Steps

1. Inventory every required feature from the current repo and your stated scope.
2. Build a feature matrix covering:
   - Discovery
   - Connection/auth
   - Live state subscriptions
   - Frame rate
   - White balance
   - EI/ISO
   - ND
   - Shutter
   - Record start/stop
   - Playback mode enter/exit
   - Clip list
   - Playback transport
   - Timecode display and control
   - Timecode sync workflows
   - CDL controls
   - LUT load/save/apply
   - Look management
   - Frame grab
   - Diagnostics and logging
3. Verify exact CAP support differences between LF and 35.
4. Extract protocol notes from the current repo into native-facing docs.
5. Decide what from the old repo is reference-only versus reusable logic.

### Red

- Add failing documentation tests or checklist assertions for missing requirements coverage.

### Green

- Produce a complete feature/camera matrix with no undefined scope gaps.

### Refactor

- Collapse duplicate requirements and normalize naming.

## Phase 1: Native Workspace Bootstrap

### Objective

Create the new iOS workspace and baseline project structure.

### Steps

1. Create the Xcode app target for iPad.
2. Set deployment target to iPadOS 26.
3. Create Swift packages:
   - ARRICAPKit
   - CameraDiscovery
   - CameraDomain
   - CameraSession
   - CameraFeatures
   - CameraDiagnostics
   - CameraMocks
4. Set up test targets for app and all packages.
5. Add formatting and linting.
6. Add CI for build and tests.
7. Add a basic docs structure.

### Red

- Add failing CI/build checks for missing package targets and test targets.

### Green

- Build succeeds with empty package scaffolds and baseline tests.

### Refactor

- Clean module boundaries before features start landing.

## Phase 2: Domain Model And Capability Map

### Objective

Define a strongly typed camera domain before transport logic leaks everywhere.

### Steps

1. Define camera models and families:
   - LF
   - 35
2. Define connection state types.
3. Define camera mode types:
   - live control
   - playback
   - recording
   - unavailable
4. Define typed values for exposure, WB, ND, shutter, frame rate, timecode, clips, LUTs, CDL, and frame grab metadata.
5. Define camera capability structures per family and firmware where needed.
6. Define user-facing errors and diagnostics categories.

### Red

- Unit tests for value parsing, validation, capability constraints, and unavailable-state handling.

### Green

- All domain types and validation pass tests.

### Refactor

- Remove primitive obsession and standardize names.

## Phase 3: CAP Framing And Binary Protocol Core

### Objective

Build the real binary CAP implementation as the foundation of the app.

### Steps

1. Implement CAP frame encode/decode.
2. Implement message identifiers and reply correlation.
3. Implement command builders.
4. Implement reply parsers.
5. Implement event parsers.
6. Implement variable serialization/deserialization.
7. Build protocol trace logging hooks.
8. Validate against LF and 35 command expectations.

### Red

- Unit tests for framing, parsing, invalid payloads, variable decoding, and reply matching.

### Green

- CAP core passes deterministic unit tests.

### Refactor

- Separate low-level binary parsing from higher-level command semantics.

## Phase 4: TCP Transport And Session State Machine

### Objective

Create a reliable direct transport layer over the local network.

### Steps

1. Build TCP client with `Network.framework`.
2. Implement connect and disconnect handling.
3. Implement socket read loop.
4. Implement keepalive behavior.
5. Implement handshake flow.
6. Implement authentication flow if camera requires it.
7. Implement reconnect strategy with bounded retries and backoff.
8. Implement degraded-state handling when connection is alive but stale.
9. Implement safe shutdown when app backgrounds or session changes.

### Red

- Integration tests for connect, disconnect, timeout, malformed replies, and reconnect.

### Green

- Session state machine behaves correctly under simulated transport conditions.

### Refactor

- Make state transitions explicit and testable.

## Phase 5: Discovery

### Objective

Discover LF and 35 cameras on the local network reliably.

### Steps

1. Add local-network permission strings and entitlement configuration.
2. Implement Bonjour discovery using `NWBrowser`.
3. Verify discovered services by opening a lightweight identity handshake.
4. Build a fallback manual IP path.
5. Build a fallback subnet scan plus handshake path if Bonjour is inconsistent.
6. Persist recent and favorite cameras.
7. Expose discovery status and errors to UI.
8. Build diagnostics for discovery failures.

### Red

- Integration tests with fake discovery services and handshake verification.
- Tests for duplicate devices, disappearing devices, and invalid services.

### Green

- Discovery returns verified, typed camera candidates.

### Refactor

- Keep discovery source, verification, and presentation separated.

## Phase 6: Live State Subscription And Camera Store

### Objective

Maintain a reliable source of truth for current camera state.

### Steps

1. Implement variable subscription requests.
2. Map CAP events to domain state.
3. Create a camera session store that merges transport state and camera state.
4. Track freshness timestamps for every major state group.
5. Detect stale values and partial state.
6. Support mode-specific state availability.
7. Build state replay for reconnect.

### Red

- Tests for subscription setup, event mapping, stale state detection, and reconnect recovery.

### Green

- Session store updates correctly from simulated CAP events.

### Refactor

- Split low-level event parsing from high-level feature state mapping.

## Phase 7: Core Control Features

### Objective

Ship the core operator controls first.

### Steps

1. Implement frame rate read/write.
2. Implement white balance and tint read/write.
3. Implement EI/ISO read/write.
4. Implement ND read/write.
5. Implement shutter read/write.
6. Implement record start/stop.
7. Implement operation availability checks based on camera mode.
8. Implement optimistic UI only where safe.
9. Add clear applying/success/failure states.

### Red

- Integration tests per command.
- UI tests for control state transitions.
- Hardware acceptance tests on LF and 35.

### Green

- Controls work end to end against fake server and real cameras.

### Refactor

- Normalize command execution and error presentation.

## Phase 8: Frame Grab

### Objective

Support frame grab as a first-class workflow.

### Steps

1. Confirm exact CAP frame-grab commands and supported response format for LF and 35.
2. Implement frame-grab request path.
3. Parse image payload metadata.
4. Decode image safely for display.
5. Build throttling and cancellation so repeated grabs do not clog the session.
6. Cache recent grabs in memory.
7. Allow save/share/export as required by product policy.
8. Show frame-grab progress and failure states.
9. Validate latency and stability on real hardware.

### Red

- Tests for frame-grab request/response parsing, invalid payloads, throttling, and cancellation.
- UI tests for capture flow and empty/error states.

### Green

- Frame grabs render reliably in app and survive repeated use.

### Refactor

- Separate image transport, decoding, cache, and UI presentation.

## Phase 9: Playback

### Objective

Support playback entry, clip browsing, and transport controls.

### Steps

1. Implement enter playback mode.
2. Implement exit playback mode.
3. Implement clip list retrieval.
4. Parse clip metadata into domain models.
5. Implement play, pause, stop, seek, clip skip, and speed controls as supported.
6. Surface playback-only availability states.
7. Build empty/error/loading states.
8. Build clip browser optimized for iPad.
9. Verify transition safety between control mode and playback mode.

### Red

- Integration tests for mode entry/exit and clip commands.
- UI tests for playback browser and transport.
- Hardware acceptance tests on LF and 35.

### Green

- Playback workflow is usable end to end.

### Refactor

- Decouple playback transport state from clip list loading.

## Phase 10: Timecode

### Objective

Support reliable timecode display and control workflows.

### Steps

1. Implement current timecode read.
2. Implement run-mode read/write.
3. Implement initialization-mode read/write.
4. Implement user bits read/write if supported.
5. Implement sync-to-time-of-day workflow if required and supported.
6. Implement manual set workflow if supported.
7. Track sync health and freshness.
8. Make timecode state visible from the main control workspace.

### Red

- Tests for timecode parsing, formatting, drift indicators, and control flows.
- Hardware acceptance tests for mode changes and sync behavior.

### Green

- Timecode display and changes work correctly on real cameras.

### Refactor

- Keep display formatting separate from camera state values.

## Phase 11: CDL, LUT, And Look Features

### Objective

Implement look-related controls without polluting the core control flow.

### Steps

1. Implement current look state read.
2. Implement CDL read/write.
3. Implement LUT list/load/apply workflows as supported.
4. Implement look file operations where required.
5. Distinguish in-camera state from local preset metadata.
6. Add preview state and apply confirmation.
7. Add failure recovery for invalid look operations.

### Red

- Tests for CDL serialization, LUT selection, look application, and unsupported-state behavior.
- UI tests for color/look screens and apply states.

### Green

- Look workflows complete successfully end to end.

### Refactor

- Separate local preset storage from camera mutation commands.

## Phase 12: Diagnostics, Logging, And Supportability

### Objective

Make failures debuggable on set.

### Steps

1. Build connection diagnostics view.
2. Build discovery diagnostics view.
3. Build protocol log capture with privacy-safe export.
4. Build event timeline for connection, reconnect, and command failures.
5. Build quick health indicators for connection, camera session, and media state.
6. Add log retention and export controls.
7. Add app-side crash and non-fatal telemetry strategy appropriate for release.

### Red

- Tests for log retention, export formatting, and diagnostics state mapping.

### Green

- Diagnostics surfaces are usable and stable.

### Refactor

- Keep diagnostics read-only from the main control path.

## Phase 13: iPad UX Implementation

### Objective

Translate the native capabilities into a product-quality iPad experience.

### Steps

1. Build app shell and primary workspace layout.
2. Build persistent connection and camera status rail.
3. Build Control workspace first.
4. Build Playback workspace.
5. Build Timecode workspace.
6. Build Look workspace.
7. Build Diagnostics workspace.
8. Build adaptive behavior for landscape and portrait.
9. Build precision controls for fast operator use.
10. Add tactile and visual feedback for critical actions.
11. Add empty, loading, degraded, and error states everywhere.

### Red

- UI tests for all major navigation and operator workflows.
- Snapshot or visual regression tests where useful.

### Green

- Core operator workflows are obvious and fast.

### Refactor

- Remove non-essential chrome and duplicate controls.

## Phase 14: Accessibility And Input Quality

### Objective

Ensure the app remains usable under stress and accessible by design.

### Steps

1. Add Dynamic Type support where compatible with dense control surfaces.
2. Add VoiceOver labels and hints.
3. Add focus order and keyboard support where helpful.
4. Add contrast and reduced-motion support.
5. Ensure hit targets remain large enough in both orientations.
6. Ensure state changes are announced accessibly.

### Red

- Accessibility audits and UI tests for labels, focus, and contrast assumptions.

### Green

- Accessibility baselines pass.

### Refactor

- Simplify dense areas that fight accessibility.

## Phase 15: Performance And Reliability Hardening

### Objective

Make the app safe for repeated professional use.

### Steps

1. Measure command latency.
2. Measure frame-grab latency and memory cost.
3. Stress-test rapid repeated control changes.
4. Stress-test reconnect during active operation.
5. Test app foreground/background transitions.
6. Test network loss and recovery.
7. Run long soak sessions.
8. Tune logs, retries, buffering, and queue behavior.

### Red

- Performance and soak tests with explicit thresholds.

### Green

- App stays stable under repeated on-set workflows.

### Refactor

- Remove hot-path allocations and clean up state churn.

## Phase 16: Hardware Validation Matrix

### Objective

Validate every required feature on real LF and 35 hardware.

### Steps

1. Build a camera/firmware test matrix.
2. Validate discovery on real production networks.
3. Validate connect/auth behavior.
4. Validate live state accuracy.
5. Validate every control command.
6. Validate frame grab repeatedly.
7. Validate playback workflows.
8. Validate timecode workflows.
9. Validate CDL/LUT/look workflows.
10. Capture deviations by camera family and firmware.
11. Add capability gating where behavior differs.

### Red

- Hardware acceptance checklist initially fails for unimplemented or unverified features.

### Green

- Every required item is verified or explicitly gated with a documented reason.

### Refactor

- Simplify feature flags and camera capability branching.

## Phase 17: Release Preparation

### Objective

Make the app distributable and supportable.

### Steps

1. Finalize app permissions and local-network disclosures.
2. Finalize branding, icons, and launch assets.
3. Add privacy manifest and required store metadata.
4. Review export/compliance requirements for any networking or file features.
5. Finalize crash/error reporting strategy.
6. Prepare TestFlight build process.
7. Run beta cycle with production-like networks.
8. Fix blockers from field feedback.
9. Prepare App Store submission package.

### Red

- Release readiness checklist fails until all metadata, permissions, and review assets are complete.

### Green

- TestFlight and App Store submission package are ready.

### Refactor

- Remove development-only UI and logging before release.

## Cross-Cutting Workstreams

### Documentation

- Maintain protocol notes
- Maintain camera capability matrix
- Maintain operator workflow docs
- Maintain QA checklists
- Maintain release runbooks

### Mocking And Test Infrastructure

- Build fake CAP server for deterministic integration tests
- Build discovery simulator
- Build image payload fixtures for frame grab tests
- Build camera family fixtures for LF and 35

### Security And Safety

- Validate all input sent to camera
- Prevent unsafe concurrent command collisions
- Protect against stale state writes
- Avoid silent failure on critical operations

## Suggested Implementation Order

1. Phase 0 through Phase 4
2. Phase 5 discovery
3. Phase 6 live state
4. Phase 7 core control
5. Phase 8 frame grab
6. Phase 9 playback
7. Phase 10 timecode
8. Phase 11 look features
9. Phase 12 diagnostics
10. Phase 13 UI implementation and polish
11. Phase 14 accessibility
12. Phase 15 performance and reliability
13. Phase 16 hardware validation
14. Phase 17 release preparation

## Immediate Next Steps

1. Create the native Xcode workspace and Swift package structure.
2. Build the feature matrix for LF and 35.
3. Confirm exact discovery behavior exposed by real cameras.
4. Confirm frame-grab command behavior and payload format on LF and 35.
5. Start Phase 1 with red/green tests for project bootstrap and package boundaries.

## Open Questions To Resolve Early

- What exact Bonjour service names, if any, do LF and 35 advertise in real-world setups?
- Are there firmware-specific differences in frame-grab behavior?
- Are there any workflows that should be intentionally deferred from v1 despite being in final scope?
- Do you need exported stills/frame grabs saved into Photos, Files, both, or neither?
- Do you want operator authentication, app lock, or restricted modes for set environments?
