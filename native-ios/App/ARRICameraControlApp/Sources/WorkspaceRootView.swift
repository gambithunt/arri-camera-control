import SwiftUI
import CameraDiagnostics
import CameraFeatures
import CameraDomain
import CameraSession
#if canImport(UIKit)
import UIKit
#endif

struct WorkspaceRootView: View {
    @State private var store = WorkspaceEnvironment.makeStore()

    var body: some View {
        NavigationSplitView(columnVisibility: .constant(.all)) {
            sidebar
        } detail: {
            detail
        }
        .task {
            await store.start()
        }
    }

    private var sidebar: some View {
        List(selection: $store.selectedSection) {
            Section("Workspace") {
                ForEach(store.layout.sections, id: \.self) { section in
                    Label(section.title, systemImage: section.symbolName)
                        .tag(section)
                }
            }

            Section("Discovered Cameras") {
                if store.discoveryCandidates.isEmpty {
                    LabeledContent("Status", value: "Searching local network")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(store.discoveryCandidates, id: \.descriptor.identifier) { candidate in
                        Button {
                            Task {
                                await store.connect(to: candidate.descriptor, clientName: "ARRI Control", password: nil)
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(candidate.descriptor.displayName)
                                    .font(.headline)
                                Text("\(candidate.descriptor.endpoint.host):\(candidate.descriptor.endpoint.port)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }
                }
            }

            Section("Connection") {
                LabeledContent("Session", value: store.sessionState.label)
                LabeledContent("Camera", value: store.activeCamera?.displayName ?? "None")
                LabeledContent("Health", value: store.sessionState.isHealthy ? "Stable" : "Attention")
            }
        }
        .navigationTitle("ARRI Control")
    }

    @ViewBuilder
    private var detail: some View {
        if store.activeCamera == nil, store.sessionState == .idle || store.sessionState == .discovering {
            DisconnectedWorkspacePlaceholder()
                .navigationTitle("Workspace")
        } else {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    WorkspaceHero(store: store)
                    PersistentStatusGrid(store: store)
                    PrimaryWorkspacePanel(store: store)
                }
                .padding(24)
            }
            .background(Color(uiColor: .secondarySystemBackground))
            .navigationTitle(store.selectedSection.title)
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

private struct DisconnectedWorkspacePlaceholder: View {
    var body: some View {
        VStack(spacing: 18) {
            Image(systemName: "dot.radiowaves.left.and.right")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(.secondary)
            Text("Choose a Camera")
                .font(.system(.largeTitle, design: .rounded, weight: .semibold))
            Text("Discovery runs automatically. Pick an LF or 35 from the sidebar to open the operator workspace.")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
                .frame(maxWidth: 420)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .secondarySystemBackground))
    }
}

private struct WorkspaceHero: View {
    let store: CameraWorkspaceStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 8) {
                    Text(store.activeCamera?.displayName ?? "No Camera Connected")
                        .font(.system(.largeTitle, design: .rounded, weight: .semibold))
                    Text(store.selectedSection.subtitle)
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }

                Spacer(minLength: 16)

                ConnectionBadge(sessionState: store.sessionState)
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    MetricPill(title: "Record", value: store.liveState.isRecording ? "Rolling" : "Ready", tint: .red)
                    MetricPill(title: "Mode", value: store.liveState.mode.displayName, tint: .blue)
                    MetricPill(title: "FPS", value: store.liveState.frameRate?.displayName ?? "--", tint: .green)
                    MetricPill(title: "Look", value: store.liveState.lookName ?? "None", tint: .orange)
                    MetricPill(title: "Clip", value: store.liveState.playbackClipIndex.map(String.init) ?? "--", tint: .indigo)
                }

                VStack(alignment: .leading, spacing: 12) {
                    MetricPill(title: "Record", value: store.liveState.isRecording ? "Rolling" : "Ready", tint: .red)
                    MetricPill(title: "Mode", value: store.liveState.mode.displayName, tint: .blue)
                    MetricPill(title: "FPS", value: store.liveState.frameRate?.displayName ?? "--", tint: .green)
                    MetricPill(title: "Look", value: store.liveState.lookName ?? "None", tint: .orange)
                    MetricPill(title: "Clip", value: store.liveState.playbackClipIndex.map(String.init) ?? "--", tint: .indigo)
                }
            }
        }
        .padding(24)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 28, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color(uiColor: .systemBackground),
                            Color(uiColor: .tertiarySystemBackground)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
        )
    }
}

private struct PersistentStatusGrid: View {
    let store: CameraWorkspaceStore

    private let columns = [
        GridItem(.adaptive(minimum: 220), spacing: 16)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 16) {
            WorkspaceCard(title: "Connection", subtitle: "Transport and identity stay visible everywhere.") {
                HStack(spacing: 12) {
                    StatusKeyValue(label: "Session", value: store.sessionState.label)
                    StatusKeyValue(label: "Family", value: store.activeCamera?.family.rawValue ?? "--")
                    StatusKeyValue(label: "Endpoint", value: store.activeCamera.map { "\($0.endpoint.host):\($0.endpoint.port)" } ?? "--")
                }
            }

            WorkspaceCard(title: "Timecode", subtitle: "Clock state should be readable in one glance.") {
                HStack(spacing: 12) {
                    StatusKeyValue(label: "Frames", value: store.liveState.timecodeFrames.map(String.init) ?? "--")
                    StatusKeyValue(label: "Run Mode", value: store.liveState.timecodeRunMode?.displayLabel ?? "--")
                    StatusKeyValue(label: "Health", value: store.sessionState.isHealthy ? "Stable" : "Attention")
                }
            }

            WorkspaceCard(title: "Latest Error", subtitle: "Operator feedback stays immediate and calm.") {
                Text(store.lastError ?? "None")
                    .font(.body)
                    .foregroundStyle(store.lastError == nil ? .secondary : .primary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }
}

private struct PrimaryWorkspacePanel: View {
    let store: CameraWorkspaceStore

    var body: some View {
        switch store.selectedSection {
        case .control:
            ControlWorkspacePanel(store: store)
        case .playback:
            PlaybackWorkspacePanel(store: store)
        case .timecode:
            TimecodeWorkspacePanel(store: store)
        case .look:
            LookWorkspacePanel(store: store)
        case .diagnostics:
            DiagnosticsWorkspacePanel(store: store)
        }
    }
}

private struct ControlWorkspacePanel: View {
    let store: CameraWorkspaceStore

    private let columns = [
        GridItem(.adaptive(minimum: 280), spacing: 18)
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: 18) {
            WorkspaceCard(title: "Primary Control", subtitle: "Recording stays dominant and obvious.") {
                VStack(alignment: .leading, spacing: 16) {
                    Button(store.liveState.isRecording ? "Stop Recording" : "Record") {
                        Task {
                            if store.liveState.isRecording {
                                await store.stopRecording()
                            } else {
                                await store.startRecording()
                            }
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.red)
                    .accessibilityLabel(store.liveState.isRecording ? "Stop recording" : "Start recording")

                    HStack(spacing: 12) {
                        Button("Capture Frame Grab") {
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
                        .disabled(store.frameGrabData == nil)
                    }
                }
            }

            WorkspaceCard(title: "Exposure", subtitle: "Use direct menus for the settings operators change most.") {
                VStack(spacing: 12) {
                    SelectionMenuRow(label: "Frame Rate", value: store.liveState.frameRate?.displayName ?? "--") {
                        ForEach(frameRateOptions, id: \.fps) { option in
                            Button(option.displayName) {
                                Task {
                                    await store.setFrameRate(option)
                                }
                            }
                        }
                    }

                    SelectionMenuRow(
                        label: "White Balance",
                        value: store.liveState.whiteBalance?.displayName ?? "--"
                    ) {
                        ForEach(whiteBalanceOptions, id: \.displayName) { option in
                            Button(option.displayName) {
                                Task {
                                    await store.setWhiteBalance(option)
                                }
                            }
                        }
                    }

                    SelectionMenuRow(label: "EI", value: store.liveState.exposureIndex?.displayName ?? "--") {
                        ForEach(exposureOptions, id: \.iso) { option in
                            Button(option.displayName) {
                                Task {
                                    await store.setExposureIndex(option)
                                }
                            }
                        }
                    }

                    SelectionMenuRow(label: "ND", value: store.liveState.ndFilter?.displayName ?? "--") {
                        ForEach(ndOptions, id: \.stop) { option in
                            Button(option.displayName) {
                                Task {
                                    await store.setNDFilter(option)
                                }
                            }
                        }
                    }

                    SelectionMenuRow(label: "Shutter", value: store.liveState.shutterAngle?.displayName ?? "--") {
                        ForEach(shutterOptions, id: \.degrees) { option in
                            Button(option.displayName) {
                                Task {
                                    await store.setShutterAngle(option)
                                }
                            }
                        }
                    }
                }
            }

            WorkspaceCard(title: "Frame Grab", subtitle: "Preview stays visible before export.") {
                FrameGrabPreview(data: store.frameGrabData)

                if let lastSavedPhotoAssetIdentifier = store.lastSavedPhotoAssetIdentifier {
                    Text("Saved to Photos: \(lastSavedPhotoAssetIdentifier)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct PlaybackWorkspacePanel: View {
    let store: CameraWorkspaceStore

    var body: some View {
        VStack(spacing: 18) {
            WorkspaceCard(title: "Playback Mode", subtitle: "Mode transitions should be explicit and reversible.") {
                HStack(spacing: 12) {
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

                    Button("Play") {
                        Task {
                            await store.startPlayback()
                        }
                    }
                    .buttonStyle(.bordered)

                    Button("Pause") {
                        Task {
                            await store.pausePlayback()
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }

            WorkspaceCard(title: "Clip Browser", subtitle: "Browse by clip index when the camera exposes transport state.") {
                HStack(spacing: 12) {
                    Button("Previous Clip") {
                        Task {
                            await store.selectPlaybackClip(index: max((store.liveState.playbackClipIndex ?? 0) - 1, 0))
                        }
                    }
                    .buttonStyle(.bordered)

                    StatusKeyValue(label: "Current Clip", value: store.liveState.playbackClipIndex.map(String.init) ?? "--")

                    Button("Next Clip") {
                        Task {
                            await store.selectPlaybackClip(index: (store.liveState.playbackClipIndex ?? 0) + 1)
                        }
                    }
                    .buttonStyle(.bordered)
                }
            }
        }
    }
}

private struct TimecodeWorkspacePanel: View {
    let store: CameraWorkspaceStore
    @State private var draft = "01:00:00:00"

    var body: some View {
        VStack(spacing: 18) {
            WorkspaceCard(title: "Timecode Run Mode", subtitle: "Choose the clock behavior first, then jam.") {
                Picker("Run Mode", selection: Binding(
                    get: { store.liveState.timecodeRunMode ?? .recordRun },
                    set: { newValue in
                        Task {
                            await store.setTimecodeRunMode(newValue)
                        }
                    }
                )) {
                    Text("Record Run").tag(TimecodeRunMode.recordRun)
                    Text("Free Run").tag(TimecodeRunMode.freeRun)
                }
                .pickerStyle(.segmented)
            }

            WorkspaceCard(title: "Jam Sync", subtitle: "Keep the primary action singular and obvious.") {
                VStack(alignment: .leading, spacing: 14) {
                    TextField("HH:MM:SS:FF", text: $draft)
                        .textFieldStyle(.roundedBorder)
                        .font(.system(.title3, design: .monospaced))
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)

                    Button("Jam Timecode") {
                        Task {
                            guard
                                let timecode = TimecodeParser.parse(draft),
                                let frameRate = store.liveState.frameRate ?? frameRateOptions.first
                            else {
                                return
                            }

                            await store.setTimecode(timecode, frameRate: frameRate)
                        }
                    }
                    .buttonStyle(.borderedProminent)

                    Text("Current: \(store.liveState.timecodeFrames.map(String.init) ?? "--") frames")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

private struct LookWorkspacePanel: View {
    let store: CameraWorkspaceStore
    @State private var lookName = "Show LUT"

    var body: some View {
        VStack(spacing: 18) {
            WorkspaceCard(title: "Active Look", subtitle: "Confirm the current LUT or CDL before applying changes.") {
                VStack(alignment: .leading, spacing: 14) {
                    TextField("Look name", text: $lookName)
                        .textFieldStyle(.roundedBorder)
                        .autocorrectionDisabled()

                    Button("Apply Look") {
                        Task {
                            await store.applyLook(named: lookName)
                        }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.orange)

                    HStack(spacing: 10) {
                        ForEach(["Show LUT", "Rec709", "Dailies"], id: \.self) { preset in
                            Button(preset) {
                                lookName = preset
                            }
                            .buttonStyle(.bordered)
                        }
                    }
                }
            }
        }
    }
}

private struct DiagnosticsWorkspacePanel: View {
    let store: CameraWorkspaceStore

    var body: some View {
        VStack(spacing: 18) {
            WorkspaceCard(title: "Support Report", subtitle: "Technical detail stays available without taking over the app.") {
                VStack(alignment: .leading, spacing: 14) {
                    if let report = store.exportedDiagnosticsReport {
                        ShareLink(item: report) {
                            Label("Share Diagnostics", systemImage: "square.and.arrow.up")
                        }
                        .buttonStyle(.borderedProminent)
                    }

                    Text("Events captured: \(store.diagnosticEvents.count)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
            }

            WorkspaceCard(title: "Recent Events", subtitle: "Keep the latest transport and operator events close at hand.") {
                if store.diagnosticEvents.isEmpty {
                    Text("No diagnostic events recorded yet.")
                        .foregroundStyle(.secondary)
                } else {
                    VStack(alignment: .leading, spacing: 10) {
                        ForEach(Array(store.diagnosticEvents.suffix(8).reversed().enumerated()), id: \.offset) { _, event in
                            VStack(alignment: .leading, spacing: 4) {
                                Text(event.severity.rawValue.uppercased())
                                    .font(.caption.weight(.semibold))
                                    .foregroundStyle(event.severity.tint)
                                Text(event.message)
                                    .font(.body)
                                Text(event.timestamp.formatted(date: .omitted, time: .standard))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 4)
                        }
                    }
                }
            }
        }
    }
}

private struct ConnectionBadge: View {
    let sessionState: CameraSessionState

    var body: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(sessionTint)
                .frame(width: 10, height: 10)
            VStack(alignment: .leading, spacing: 2) {
                Text(sessionTitle)
                    .font(.headline)
                Text("Local network")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.thinMaterial, in: Capsule())
    }

    private var sessionTitle: String {
        sessionState.label
    }

    private var sessionTint: Color {
        switch sessionState {
        case .connected:
            .green
        case .failed:
            .red
        case .discovering, .connecting, .authenticating, .subscribing, .reconnecting:
            .orange
        case .degraded:
            .yellow
        default:
            .gray
        }
    }
}

private struct MetricPill: View {
    let title: String
    let value: String
    let tint: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline.weight(.semibold))
                .foregroundStyle(.primary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(tint.opacity(0.12), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

private struct WorkspaceCard<Content: View>: View {
    let title: String
    let subtitle: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.title3.weight(.semibold))
                Text(subtitle)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            content
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous))
    }
}

private struct SelectionMenuRow<MenuContent: View>: View {
    let label: String
    let value: String
    @ViewBuilder let menuContent: MenuContent

    var body: some View {
        Menu {
            menuContent
        } label: {
            HStack {
                Text(label)
                    .foregroundStyle(.secondary)
                Spacer()
                Text(value)
                    .fontWeight(.semibold)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
        .padding(.vertical, 4)
    }
}

private struct StatusKeyValue: View {
    let label: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.headline)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct FrameGrabPreview: View {
    let data: Data?

    var body: some View {
#if canImport(UIKit)
        if let data, let image = UIImage(data: data) {
            Image(uiImage: image)
                .resizable()
                .scaledToFit()
                .frame(maxWidth: .infinity, minHeight: 180, maxHeight: 220)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        } else {
            placeholder
        }
#else
        placeholder
#endif
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: 18, style: .continuous)
            .fill(Color(uiColor: .tertiarySystemFill))
            .frame(maxWidth: .infinity, minHeight: 180, maxHeight: 220)
            .overlay {
                VStack(spacing: 10) {
                    Image(systemName: "photo")
                        .font(.title2)
                    Text("Capture a frame grab to preview it here.")
                        .font(.subheadline)
                }
                .foregroundStyle(.secondary)
            }
    }
}

private enum TimecodeParser {
    static func parse(_ string: String) -> Timecode? {
        let parts = string.split(separator: ":")
        guard parts.count == 4 else {
            return nil
        }

        let integers = parts.compactMap { Int($0) }
        guard integers.count == 4 else {
            return nil
        }

        return Timecode(hours: integers[0], minutes: integers[1], seconds: integers[2], frames: integers[3])
    }
}

private let frameRateOptions: [FrameRate] = [24, 25, 30, 48, 50, 60].compactMap(FrameRate.init)
private let whiteBalanceOptions: [WhiteBalance] = [
    (3_200, 0),
    (4_300, 0),
    (5_600, 0),
    (6_500, 5)
].compactMap { WhiteBalance(kelvin: $0.0, tint: $0.1) }
private let exposureOptions: [ExposureIndex] = [400, 800, 1280, 1600, 3200].compactMap(ExposureIndex.init)
private let ndOptions: [NDFilter] = [0.0, 0.6, 1.2, 1.8, 2.4].compactMap(NDFilter.init)
private let shutterOptions: [ShutterAngle] = [144.0, 172.8, 180.0, 216.0].compactMap(ShutterAngle.init)

private extension WorkspaceSection {
    var title: String {
        rawValue.capitalized
    }

    var symbolName: String {
        switch self {
        case .control:
            "slider.horizontal.3"
        case .playback:
            "play.rectangle"
        case .timecode:
            "clock"
        case .look:
            "camera.filters"
        case .diagnostics:
            "waveform.path.ecg"
        }
    }

    var subtitle: String {
        switch self {
        case .control:
            "Exposure, recording, frame grab, and live state."
        case .playback:
            "Clip browse and transport without leaving the workspace."
        case .timecode:
            "Run mode, jam sync, and clock health."
        case .look:
            "Look confirmation and LUT application."
        case .diagnostics:
            "Session health, errors, and support export."
        }
    }
}

private extension CameraMode {
    var displayName: String {
        switch self {
        case .liveControl:
            "Live"
        case .playback:
            "Playback"
        case .recording:
            "Recording"
        case .unavailable:
            "Unavailable"
        }
    }
}

private extension FrameRate {
    var displayName: String {
        "\(fps) fps"
    }
}

private extension WhiteBalance {
    var displayName: String {
        "\(kelvin) K / \(tint)"
    }
}

private extension ExposureIndex {
    var displayName: String {
        "EI \(iso)"
    }
}

private extension NDFilter {
    var displayName: String {
        String(format: "%.1f ND", stop)
    }
}

private extension ShutterAngle {
    var displayName: String {
        String(format: "%.1f°", degrees)
    }
}

private extension TimecodeRunMode {
    var displayLabel: String {
        switch self {
        case .recordRun:
            "Record Run"
        case .freeRun:
            "Free Run"
        }
    }
}

private extension CameraSessionState {
    var label: String {
        switch self {
        case .idle:
            "Idle"
        case .discovering:
            "Discovering"
        case .connecting:
            "Connecting"
        case .authenticating:
            "Authenticating"
        case .subscribing:
            "Subscribing"
        case .connected:
            "Connected"
        case .degraded:
            "Degraded"
        case .reconnecting:
            "Reconnecting"
        case .failed:
            "Failed"
        }
    }

    var isHealthy: Bool {
        switch self {
        case .connected:
            true
        default:
            false
        }
    }
}

private extension DiagnosticSeverity {
    var tint: Color {
        switch self {
        case .debug:
            .gray
        case .info:
            .blue
        case .warning:
            .orange
        case .error:
            .red
        }
    }
}
