import SwiftUI
import CameraFeatures
#if DEBUG
import CameraMocks
#endif

@MainActor
struct WorkspaceRootView: View {
    @Environment(\.scenePhase) private var scenePhase
    @State private var store: CameraWorkspaceStore
    @State private var timecodeDraft = "01:00:00:00"
    @State private var lookDraft = "Show LUT"

    init(store: CameraWorkspaceStore = WorkspaceEnvironment.makeStore()) {
        _store = State(initialValue: store)
    }

    var body: some View {
        TabView(selection: selectedSection) {
            ForEach(store.layout.sections, id: \.self) { section in
                NavigationStack {
                    workspace(for: section)
                }
                .tabItem {
                    Label(section.title, systemImage: section.symbolName)
                }
                .tag(section)
            }
        }
        .tint(.orange)
        .task {
            await store.start()
        }
        .onChange(of: scenePhase) { _, newPhase in
            Task {
                switch newPhase {
                case .active:
                    await store.start()
                case .background:
                    await store.stop()
                case .inactive:
                    break
                @unknown default:
                    break
                }
            }
        }
        .onChange(of: store.liveState.lookName) { _, newValue in
            guard
                let newValue,
                trimmedLookDraft == "Show LUT" || trimmedLookDraft.isEmpty
            else {
                return
            }

            lookDraft = newValue
        }
    }

    private var selectedSection: Binding<WorkspaceSection> {
        Binding(
            get: { store.selectedSection },
            set: { store.selectedSection = $0 }
        )
    }

    @ViewBuilder
    private func workspace(for section: WorkspaceSection) -> some View {
        switch section {
        case .control:
            WorkspaceControlDashboardView(store: store)
        case .playback:
            WorkspacePlaybackView(store: store)
        case .timecode:
            WorkspaceTimecodeView(store: store, timecodeDraft: $timecodeDraft)
        case .look:
            WorkspaceLookView(store: store, lookDraft: $lookDraft)
        case .diagnostics:
            WorkspaceDiagnosticsView(store: store)
        }
    }

    private var trimmedLookDraft: String {
        lookDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

#if DEBUG
@MainActor
private struct WorkspacePreviewHarness: View {
    let scenario: WorkspacePreviewScenario
    @State private var store = SimulatorWorkspaceStoreFactory.makeStore()

    var body: some View {
        WorkspaceRootView(store: store)
            .task(id: scenario) {
                await scenario.prepare(store: store)
            }
    }
}

private enum WorkspacePreviewScenario: String {
    case discovery
    case connected
    case recording
    case playback
    case degraded

    func prepare(store: CameraWorkspaceStore) async {
        await store.start()
        store.selectedSection = section

        guard self != .discovery else {
            return
        }

        guard let descriptor = store.discoveryCandidates.first?.descriptor else {
            return
        }

        await store.connect(
            to: descriptor,
            clientName: "ARRI Control",
            password: nil
        )

        switch self {
        case .discovery:
            break
        case .connected:
            break
        case .recording:
            await store.startRecording()
        case .playback:
            await store.enterPlayback()
        case .degraded:
            store.sessionState = .degraded(camera: descriptor, reason: "keepaliveFailed")
            store.liveState.connectionState = .degraded(reason: "keepaliveFailed")
        }
    }

    private var section: WorkspaceSection {
        switch self {
        case .playback:
            .playback
        default:
            .control
        }
    }
}

#Preview("Discovery") {
    WorkspacePreviewHarness(scenario: .discovery)
}

#Preview("Connected") {
    WorkspacePreviewHarness(scenario: .connected)
}

#Preview("Recording") {
    WorkspacePreviewHarness(scenario: .recording)
}

#Preview("Playback") {
    WorkspacePreviewHarness(scenario: .playback)
}

#Preview("Degraded") {
    WorkspacePreviewHarness(scenario: .degraded)
}
#endif
