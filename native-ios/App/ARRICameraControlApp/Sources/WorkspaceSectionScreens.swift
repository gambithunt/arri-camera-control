import SwiftUI
import CameraDiscovery
import CameraDomain
import CameraFeatures
import CameraSession

@MainActor
struct WorkspaceControlDashboardView: View {
    @Environment(\.openURL) private var openURL
    let store: CameraWorkspaceStore

    private let frameRatePresets = [24, 25, 30]
    private let shutterPresets = [172.8, 180.0, 270.0]
    private let exposurePresets = [640, 800, 1280]
    private let whiteBalancePresets = [3_200, 4_300, 5_600]
    private let ndPresets = [0.0, 1.2, 2.4]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                heroCard

                if let banner = store.connectionBanner {
                    WorkspaceConnectionBannerCard(banner: banner)
                }

                if showsDiscoveryState {
                    disconnectedState
                } else {
                    recordCard
                    lensCard
                    exposureSection
                    playbackCard
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 28)
        }
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Control")
        .navigationBarTitleDisplayMode(.large)
    }

    private var heroCard: some View {
        WorkspaceSurfaceCard {
            heroHeader
            heroReadoutGrid
        }
    }

    private var heroHeader: some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .top, spacing: 20) {
                heroIdentity
                Spacer(minLength: 16)
                heroTelemetry
            }

            VStack(alignment: .leading, spacing: 20) {
                heroIdentity
                heroTelemetry
            }
        }
    }

    private var heroIdentity: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text(store.activeCamera?.displayName ?? "No Camera Connected")
                    .font(.largeTitle.weight(.semibold))

                Text(heroSubtitle)
                    .font(.body)
                    .foregroundStyle(.secondary)
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) {
                    connectionPill
                    modePill
                    recordPill
                }

                VStack(alignment: .leading, spacing: 10) {
                    connectionPill
                    modePill
                    recordPill
                }
            }

            if let webUIURL {
                Button {
                    openURL(webUIURL)
                } label: {
                    Label("Open Web UI", systemImage: "safari")
                }
                .buttonStyle(.bordered)
            }
        }
    }

    private var heroTelemetry: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Live Timecode")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text(store.liveState.timecodeDisplay)
                .font(.system(.title, design: .rounded).weight(.semibold))
                .monospacedDigit()
                .contentTransition(.numericText())

            VStack(alignment: .leading, spacing: 8) {
                LabeledContent("Session", value: store.sessionState.label)
                LabeledContent("Keepalive", value: store.sessionHealth.keepaliveDisplay)
            }
            .font(.callout)
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var heroReadoutGrid: some View {
        LazyVGrid(
            columns: [GridItem(.adaptive(minimum: 132, maximum: 180), spacing: 12)],
            alignment: .leading,
            spacing: 12
        ) {
            WorkspaceReadoutTile(
                key: "Last Clip",
                value: store.liveState.currentClipDisplay,
                detail: store.liveState.lastRecordedClipIndex.map { "Clip index \($0)" } ?? "Latest clip ID"
            )
            WorkspaceReadoutTile(
                key: "Media",
                value: store.liveState.remainingRecordTimeDisplay,
                detail: "Remaining rec time"
            )
            WorkspaceReadoutTile(
                key: "RC",
                value: store.liveState.currentCodecDisplay,
                detail: "Recording codec"
            )
            WorkspaceReadoutTile(
                key: "Resolution",
                value: store.liveState.recordingResolutionDisplay,
                detail: "Recording preset"
            )
            WorkspaceReadoutTile(
                key: "TC",
                value: store.liveState.timecodeDisplay,
                detail: store.liveState.timecodeRunMode?.displayName ?? "Live timecode"
            )
            WorkspaceReadoutTile(
                key: "TX",
                value: store.liveState.textureDisplay,
                detail: "Applied texture"
            )
            WorkspaceReadoutTile(
                key: "LK",
                value: store.liveState.currentLookDisplay,
                detail: "Applied LUT"
            )
        }
    }

    private var disconnectedState: some View {
        VStack(alignment: .leading, spacing: 16) {
            WorkspaceSurfaceCard {
                ContentUnavailableView(
                    "Connect a Camera",
                    systemImage: "camera.aperture",
                    description: Text("Use a discovered ARRI camera below to open the operator workspace.")
                )
            }

            WorkspaceDiscoveredCameraList(
                candidates: store.discoveryCandidates,
                canConnect: store.canConnectToDiscoveredCamera
            ) { descriptor in
                Task {
                    await store.connect(
                        to: descriptor,
                        clientName: "ARRI Control",
                        password: nil
                    )
                }
            }
        }
    }

    private var recordCard: some View {
        WorkspaceSurfaceCard {
            Text("Capture")
                .font(.headline)

            ViewThatFits(in: .horizontal) {
                HStack(alignment: .center, spacing: 18) {
                    recordButton
                    secondaryActions
                }

                VStack(alignment: .leading, spacing: 16) {
                    recordButton
                    secondaryActions
                }
            }
        }
    }

    private var recordButton: some View {
        Button {
            Task {
                if store.liveState.isRecording {
                    await store.stopRecording()
                } else {
                    await store.startRecording()
                }
            }
        } label: {
            HStack(spacing: 14) {
                Image(systemName: store.liveState.isRecording ? "record.circle.fill" : "record.circle")
                    .font(.system(size: 24, weight: .semibold))
                    .symbolEffect(.pulse, isActive: store.liveState.isRecording)

                VStack(alignment: .leading, spacing: 4) {
                    Text(store.liveState.isRecording ? "Stop Recording" : "Start Recording")
                        .font(.headline.weight(.semibold))
                    Text(store.liveState.isRecording ? "Camera is rolling." : "Send a direct record command.")
                        .font(.footnote)
                        .foregroundStyle(.white.opacity(0.85))
                }

                Spacer(minLength: 0)
            }
            .frame(maxWidth: 320, minHeight: 60, alignment: .leading)
            .padding(.horizontal, 18)
        }
        .buttonStyle(.borderedProminent)
        .buttonBorderShape(.roundedRectangle(radius: 24))
        .tint(.red)
        .disabled(!store.canRunOperatorCommands)
        .accessibilityLabel(store.liveState.isRecording ? "Stop recording" : "Start recording")
        .accessibilityHint("Sends a direct record control command to the camera.")
    }

    private var secondaryActions: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Frame Grab")
                .font(.headline)

            ViewThatFits(in: .horizontal) {
                ControlGroup {
                    Button("Capture Frame") {
                        Task {
                            await store.captureFrameGrab()
                        }
                    }

                    Button("Save to Photos") {
                        Task {
                            await store.saveFrameGrabToPhotoLibrary()
                        }
                    }
                    .disabled(!store.canSaveFrameGrabToPhotoLibrary)
                }

                VStack(alignment: .leading, spacing: 10) {
                    Button("Capture Frame") {
                        Task {
                            await store.captureFrameGrab()
                        }
                    }
                    .buttonStyle(.bordered)

                    Button("Save to Photos") {
                        Task {
                            await store.saveFrameGrabToPhotoLibrary()
                        }
                    }
                    .buttonStyle(.bordered)
                    .disabled(!store.canSaveFrameGrabToPhotoLibrary)
                }
            }
            .disabled(!store.canRunOperatorCommands)

            Text(frameGrabStatusMessage)
                .font(.footnote)
                .foregroundStyle(.secondary)

            if let assetIdentifier = store.lastSavedPhotoAssetIdentifier {
                Text("Last saved asset: \(assetIdentifier)")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .textSelection(.enabled)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var lensCard: some View {
        WorkspaceSurfaceCard {
            Text("Lens & Monitoring")
                .font(.headline)

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    lensInfoChips
                }

                VStack(alignment: .leading, spacing: 12) {
                    lensInfoChips
                }
            }
        }
    }

    private var lensInfoChips: some View {
        Group {
            WorkspaceStatusMetricChip(
                title: "Lens",
                value: store.liveState.lensModel ?? "No Lens Data",
                systemImage: "camera.metering.center.weighted.average"
            )

            WorkspaceStatusMetricChip(
                title: "Iris",
                value: store.liveState.lensIrisDisplay,
                systemImage: "camera.aperture"
            )

            WorkspaceStatusMetricChip(
                title: "Focal",
                value: store.liveState.lensFocalLengthDisplay,
                systemImage: "viewfinder"
            )

            WorkspaceStatusMetricChip(
                title: "Frameline",
                value: store.liveState.framelineDisplay,
                systemImage: "rectangle.on.rectangle"
            )
        }
    }

    private var exposureSection: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Exposure")
                .font(.title3.weight(.semibold))

            LazyVGrid(
                columns: [GridItem(.adaptive(minimum: 220, maximum: 320), spacing: 16)],
                spacing: 16
            ) {
                WorkspaceSettingCard(
                    title: "FPS",
                    value: store.liveState.frameRate?.displayName ?? "--",
                    detail: "Sensor rate"
                ) {
                    ControlGroup {
                        ForEach(frameRatePresets, id: \.self) { preset in
                            presetButton("\(preset)") {
                                await store.setFrameRate(FrameRate(fps: preset)!)
                            }
                        }
                    }
                }

                WorkspaceSettingCard(
                    title: "Shutter",
                    value: store.liveState.shutterAngle?.displayName ?? "--",
                    detail: "Exposure angle"
                ) {
                    ControlGroup {
                        ForEach(shutterPresets, id: \.self) { preset in
                            presetButton(WorkspaceDisplayFormatter.angleLabel(preset)) {
                                await store.setShutterAngle(ShutterAngle(degrees: preset)!)
                            }
                        }
                    }
                }

                WorkspaceSettingCard(
                    title: "EI / ASA",
                    value: store.liveState.exposureIndex?.displayName ?? "--",
                    detail: "Index presets"
                ) {
                    ControlGroup {
                        ForEach(exposurePresets, id: \.self) { preset in
                            presetButton("\(preset)") {
                                await store.setExposureIndex(ExposureIndex(iso: preset)!)
                            }
                        }
                    }
                }

                WorkspaceSettingCard(
                    title: "White Balance",
                    value: store.liveState.whiteBalance?.displayName ?? "--",
                    detail: store.liveState.whiteBalance?.tintDisplay ?? "Tint --"
                ) {
                    ControlGroup {
                        ForEach(whiteBalancePresets, id: \.self) { preset in
                            presetButton("\(preset)") {
                                await store.setWhiteBalance(WhiteBalance(kelvin: preset, tint: 0)!)
                            }
                        }
                    }
                }

                WorkspaceSettingCard(
                    title: "ND",
                    value: store.liveState.ndFilter?.displayName ?? "--",
                    detail: "Internal filter"
                ) {
                    ControlGroup {
                        ForEach(ndPresets, id: \.self) { preset in
                            presetButton(WorkspaceDisplayFormatter.ndPresetLabel(preset)) {
                                await store.setNDFilter(NDFilter(stop: preset)!)
                            }
                        }
                    }
                }
            }
            .disabled(!store.canRunOperatorCommands)
        }
    }

    private var playbackCard: some View {
        WorkspaceSurfaceCard {
            Text("Playback")
                .font(.headline)

            if recentClipIdentifiers.isEmpty {
                Text("Recent clip IDs populate after the camera reports reel and clip counters.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(recentClipIdentifiers.enumerated()), id: \.offset) { item in
                    HStack(spacing: 12) {
                        Text(item.element)
                            .font(.body.monospaced())

                        Spacer(minLength: 12)

                        Text(item.offset == 0 ? "Latest" : "Recent")
                            .font(.footnote.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }

                    if item.offset < recentClipIdentifiers.count - 1 {
                        Divider()
                    }
                }
            }

            Divider()

            VStack(alignment: .leading, spacing: 10) {
                LabeledContent("Playback Mode", value: store.liveState.mode.displayName)
                LabeledContent("Current Playback Clip", value: store.liveState.playbackClipIndex.map(String.init) ?? "--")
                LabeledContent("Last Recorded Medium", value: store.liveState.lastRecordedMediumID.map(String.init) ?? "--")
            }
            .font(.callout)
        }
    }

    private var heroSubtitle: String {
        if let camera = store.activeCamera {
            return "\(camera.familyDisplayName) • \(camera.endpoint.host)"
        }

        return "Discover compatible cameras on the local network."
    }

    private var showsDiscoveryState: Bool {
        store.activeCamera == nil && !store.canRunOperatorCommands
    }

    private var frameGrabStatusMessage: String {
        if store.frameGrabData == nil {
            return "Capture a frame before saving it to Photos."
        }

        if !store.canSaveFrameGrabToPhotoLibrary {
            return "Photos export is currently unavailable."
        }

        return "The latest captured frame is ready to save."
    }

    private var recentClipIdentifiers: [String] {
        guard let reel = store.liveState.currentReel, let clipNumber = store.liveState.clipNumber else {
            return []
        }

        return (0..<3).compactMap { offset in
            let current = clipNumber - offset
            guard current > 0 else {
                return nil
            }

            return WorkspaceDisplayFormatter.clipIdentifier(reel: reel, clipNumber: current)
        }
    }

    private var webUIURL: URL? {
        guard let host = store.activeCamera?.endpoint.host else {
            return nil
        }

        return URL(string: "http://\(host)")
    }

    private var connectionPill: some View {
        WorkspaceStatusPill(
            title: store.liveState.connectionState.operatorLabel,
            systemImage: store.liveState.connectionState.symbolName,
            tint: store.liveState.connectionState.tintColor
        )
    }

    private var modePill: some View {
        WorkspaceStatusPill(
            title: store.liveState.mode.displayName,
            systemImage: store.liveState.mode.symbolName,
            tint: store.liveState.mode.tintColor
        )
    }

    private var recordPill: some View {
        WorkspaceStatusPill(
            title: store.liveState.isRecording ? "REC" : "Ready",
            systemImage: store.liveState.isRecording ? "record.circle.fill" : "stop.circle",
            tint: store.liveState.isRecording ? .red : .yellow
        )
    }

    private func presetButton(
        _ title: String,
        action: @escaping @MainActor () async -> Void
    ) -> some View {
        Button(title) {
            Task {
                await action()
            }
        }
        .buttonStyle(.bordered)
        .controlSize(.small)
    }
}

@MainActor
struct WorkspacePlaybackView: View {
    let store: CameraWorkspaceStore

    var body: some View {
        Form {
            if let banner = store.connectionBanner {
                Section {
                    WorkspaceConnectionBannerCard(banner: banner)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }

            if showsUnavailableState {
                Section {
                    WorkspaceConnectionRequiredState(
                        title: "Playback Requires a Camera",
                        message: "Connect a camera in the Control tab before using playback transport."
                    )
                }
            } else {
                Section("Mode") {
                    LabeledContent("Current Mode", value: store.liveState.mode.displayName)

                    Button(store.liveState.mode == .playback ? "Exit Playback" : "Enter Playback") {
                        Task {
                            if store.liveState.mode == .playback {
                                await store.exitPlayback()
                            } else {
                                await store.enterPlayback()
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                }

                Section("Transport") {
                    ControlGroup {
                        Button("Play") {
                            Task {
                                await store.startPlayback()
                            }
                        }

                        Button("Pause") {
                            Task {
                                await store.pausePlayback()
                            }
                        }
                    }
                    .disabled(!store.canRunOperatorCommands)
                }

                Section("Clip Selection") {
                    HStack {
                        Button("Previous") {
                            Task {
                                await store.selectPlaybackClip(index: max((store.liveState.playbackClipIndex ?? 0) - 1, 0))
                            }
                        }
                        .disabled(!store.canRunOperatorCommands)

                        Spacer()

                        Text(store.liveState.playbackClipIndex.map { "Clip \($0)" } ?? "No Clip")
                            .font(.headline)

                        Spacer()

                        Button("Next") {
                            Task {
                                await store.selectPlaybackClip(index: (store.liveState.playbackClipIndex ?? 0) + 1)
                            }
                        }
                        .disabled(!store.canRunOperatorCommands)
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Playback")
    }

    private var showsUnavailableState: Bool {
        store.activeCamera == nil
    }
}

@MainActor
struct WorkspaceTimecodeView: View {
    let store: CameraWorkspaceStore
    @Binding var timecodeDraft: String
    @FocusState private var focusedField: Bool

    var body: some View {
        Form {
            if let banner = store.connectionBanner {
                Section {
                    WorkspaceConnectionBannerCard(banner: banner)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }

            if store.activeCamera == nil {
                Section {
                    WorkspaceConnectionRequiredState(
                        title: "Timecode Requires a Camera",
                        message: "Connect a camera in the Control tab before jamming timecode."
                    )
                }
            } else {
                Section("Current") {
                    Text(store.liveState.timecodeDisplay)
                        .font(.system(.title2, design: .rounded).weight(.semibold))
                        .monospacedDigit()
                        .contentTransition(.numericText())

                    Picker("Run Mode", selection: Binding(
                        get: { store.liveState.timecodeRunMode ?? .recordRun },
                        set: { newMode in
                            Task {
                                await store.setTimecodeRunMode(newMode)
                            }
                        }
                    )) {
                        Text(TimecodeRunMode.recordRun.displayName).tag(TimecodeRunMode.recordRun)
                        Text(TimecodeRunMode.freeRun.displayName).tag(TimecodeRunMode.freeRun)
                    }
                    .pickerStyle(.segmented)
                    .disabled(!store.canRunOperatorCommands)
                }

                Section("Jam Sync") {
                    TextField("HH:MM:SS:FF", text: $timecodeDraft)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.numbersAndPunctuation)
                        .font(.body.monospaced())
                        .focused($focusedField)

                    if parsedTimecodeDraft == nil {
                        Text("Use the format HH:MM:SS:FF.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    Button("Jam Timecode") {
                        Task {
                            guard let timecode = parsedTimecodeDraft else {
                                return
                            }

                            let frameRate = store.liveState.frameRate ?? FrameRate(fps: 24)!
                            focusedField = false
                            await store.setTimecode(timecode, frameRate: frameRate)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(parsedTimecodeDraft == nil || !store.canRunOperatorCommands)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Timecode")
    }

    private var parsedTimecodeDraft: Timecode? {
        let parts = timecodeDraft.split(separator: ":")
        guard parts.count == 4 else {
            return nil
        }

        let values = parts.compactMap { Int($0) }
        guard values.count == 4 else {
            return nil
        }

        return Timecode(
            hours: values[0],
            minutes: values[1],
            seconds: values[2],
            frames: values[3]
        )
    }
}

@MainActor
struct WorkspaceLookView: View {
    let store: CameraWorkspaceStore
    @Binding var lookDraft: String
    @FocusState private var focusedField: Bool

    var body: some View {
        Form {
            if let banner = store.connectionBanner {
                Section {
                    WorkspaceConnectionBannerCard(banner: banner)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
            }

            if store.activeCamera == nil {
                Section {
                    WorkspaceConnectionRequiredState(
                        title: "Look Control Requires a Camera",
                        message: "Connect a camera in the Control tab before applying a look."
                    )
                }
            } else {
                Section("Current Look") {
                    LabeledContent("Active", value: store.liveState.currentLookDisplay)
                }

                Section("Apply Look") {
                    TextField("Look name", text: $lookDraft)
                        .textInputAutocapitalization(.words)
                        .autocorrectionDisabled()
                        .focused($focusedField)

                    Button("Apply Look") {
                        Task {
                            focusedField = false
                            await store.applyLook(named: trimmedLookDraft)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)
                    .disabled(trimmedLookDraft.isEmpty || !store.canRunOperatorCommands)
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color(uiColor: .systemGroupedBackground))
        .navigationTitle("Look")
    }

    private var trimmedLookDraft: String {
        lookDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

@MainActor
struct WorkspaceDiagnosticsView: View {
    let store: CameraWorkspaceStore

    var body: some View {
        List {
            Section("Session") {
                LabeledContent("State", value: store.sessionState.label)
                LabeledContent("Transport", value: store.liveState.connectionState.operatorLabel)
                LabeledContent("Keepalive", value: store.sessionHealth.keepaliveDisplay)
                LabeledContent("Failures", value: "\(store.sessionHealth.consecutiveKeepaliveFailures)")
                LabeledContent("Last Error", value: store.lastError ?? "None")
            }

            Section("Recent Events") {
                if store.diagnosticEvents.isEmpty {
                    Text("No events recorded.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(Array(store.diagnosticEvents.suffix(8).enumerated()), id: \.offset) { item in
                        let event = item.element
                        VStack(alignment: .leading, spacing: 4) {
                            Text(event.message)
                            Text(event.timestamp.formatted(date: .omitted, time: .standard))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .padding(.vertical, 2)
                    }
                }
            }

            Section("Exported Report") {
                if let report = store.exportedDiagnosticsReport {
                    Text(report)
                        .font(.footnote.monospaced())
                        .textSelection(.enabled)
                } else {
                    Text("No diagnostics report available.")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Diagnostics")
    }
}
