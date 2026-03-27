import Foundation
import Observation
import ARRICAPKit
import CameraDiagnostics
import CameraDiscovery
import CameraDomain
import CameraSession

public enum WorkspaceSection: String, CaseIterable, Sendable {
    case control
    case playback
    case timecode
    case look
    case diagnostics
}

public struct WorkspaceLayout: Equatable, Sendable {
    public let sections: [WorkspaceSection]

    public init(sections: [WorkspaceSection] = WorkspaceSection.allCases) {
        self.sections = sections
    }
}

public struct CameraStateReducer: Sendable {
    public init() {}

    public func apply(_ update: CAPVariableUpdate, to state: CameraLiveState) -> CameraLiveState {
        var next = state

        switch (update.variableID, update.value) {
        case let (.codecList, .opaque(value)):
            next.codecOptions = decodeCodecNames(from: value) ?? next.codecOptions

        case let (.codec, .uInt16(value)):
            next.codecIndex = Int(value)

        case let (.recordingResolution, .uInt16(value)):
            next.recordingResolutionIndex = Int(value)

        case let (.sensorFPS, .float32(value)):
            next.frameRate = FrameRate(fps: Int(value.rounded()))

        case let (.colorTemperature, .uInt32(value)):
            let tint = next.whiteBalance?.tint ?? 0
            next.whiteBalance = WhiteBalance(kelvin: Int(value), tint: tint)

        case let (.tint, .float32(value)):
            let kelvin = next.whiteBalance?.kelvin ?? 5_600
            next.whiteBalance = WhiteBalance(kelvin: kelvin, tint: Int(value.rounded()))

        case let (.exposureIndex, .uInt32(value)):
            next.exposureIndex = ExposureIndex(iso: Int(value))

        case let (.ndFilter, .uInt16(value)):
            let index = Int(value)
            if NDFilter.available.indices.contains(index) {
                next.ndFilter = NDFilter.available[index]
            }

        case let (.shutterAngle, .float32(value)):
            next.shutterAngle = ShutterAngle(degrees: Double(value))

        case let (.timecode, .uInt32(value)):
            next.timecodeFrames = value

        case let (.timecodeRunMode, .uInt16(value)):
            next.timecodeRunMode = TimecodeRunMode(rawValue: value)

        case let (.lookFilename, .string(value)):
            next.lookName = value

        case let (.currentReel, .uInt16(value)):
            next.currentReel = Int(value)

        case let (.clipNumber, .uInt16(value)):
            next.clipNumber = Int(value)

        case let (.remainingRecTime, .uInt32(value)):
            next.remainingRecordSeconds = value

        case let (.lastRecMedium, .uInt16(value)):
            next.lastRecordedMediumID = Int(value)

        case let (.lastRecClipIndex, .uInt16(value)):
            next.lastRecordedClipIndex = Int(value)

        case let (.lensModel, .string(value)):
            next.lensModel = value

        case let (.lensIris, .int32(value)):
            next.lensIrisTStopMillistops = Int(value)

        case let (.lensFocalLength, .int32(value)):
            next.lensFocalLengthMillimetersTimesOneThousand = Int(value)

        case let (.frameline, .string(value)):
            next.framelineName = value

        case let (.texture, .string(value)):
            next.textureName = value

        case let (.playbackClipIndex, .uInt16(value)):
            next.playbackClipIndex = Int(value)

        case let (.cameraState, .uInt16(flags)):
            next.isRecording = flags & 0x0001 != 0
            next.mode = if flags & 0x0002 != 0 {
                .playback
            } else if next.isRecording {
                .recording
            } else {
                .liveControl
            }

        default:
            break
        }

        return next
    }
}

public protocol CameraControlServicing: Sendable {
    func setFrameRate(_ frameRate: FrameRate) async throws
    func setWhiteBalance(_ whiteBalance: WhiteBalance) async throws
    func setExposureIndex(_ exposureIndex: ExposureIndex) async throws
    func setNDFilter(_ filter: NDFilter) async throws
    func setShutterAngle(_ shutterAngle: ShutterAngle) async throws
    func startRecording() async throws
    func stopRecording() async throws
}

public protocol PlaybackControlServicing: Sendable {
    func enterPlayback() async throws
    func exitPlayback() async throws
    func start() async throws
    func pause() async throws
    func selectClip(index: Int) async throws
}

public protocol TimecodeServicing: Sendable {
    func setRunMode(_ mode: TimecodeRunMode) async throws
    func setTimecode(_ timecode: Timecode, frameRate: FrameRate) async throws
}

public protocol LookServicing: Sendable {
    func applyLook(named name: String) async throws
}

public protocol FrameGrabServicing: Sendable {
    func captureFrameGrab() async throws -> Data
}

public protocol CameraMetadataServicing: Sendable {
    func fetchUpdates() async -> [CAPVariableUpdate]
}

public protocol FrameGrabExporting: Sendable {
    func saveImageData(_ data: Data) async throws -> String
}

public enum FrameGrabExportError: Error, Equatable, Sendable {
    case missingFrameGrab
    case exporterUnavailable
}

public enum WorkspaceConnectionBannerTone: String, Equatable, Sendable {
    case neutral
    case caution
    case critical
}

public struct WorkspaceConnectionBanner: Equatable, Sendable {
    public let title: String
    public let message: String
    public let tone: WorkspaceConnectionBannerTone

    public init(title: String, message: String, tone: WorkspaceConnectionBannerTone) {
        self.title = title
        self.message = message
        self.tone = tone
    }
}

@MainActor
@Observable
public final class CameraWorkspaceStore {
    public var layout: WorkspaceLayout
    public var selectedSection: WorkspaceSection
    public var discoveryCandidates: [DiscoveryCandidate]
    public var sessionState: CameraSessionState
    public var sessionHealth: CameraSessionHealth
    public var liveState: CameraLiveState
    public var activeCamera: CameraDescriptor?
    public var frameGrabData: Data?
    public var activeLookName: String?
    public var lastSavedPhotoAssetIdentifier: String?
    public var diagnosticEvents: [DiagnosticEvent]
    public var exportedDiagnosticsReport: String?
    public var lastError: String?
    public var canSaveFrameGrabToPhotoLibrary: Bool {
        frameGrabData != nil && frameGrabExporter != nil
    }
    public var canConnectToDiscoveredCamera: Bool {
        switch sessionState {
        case .idle, .discovering, .failed:
            true
        case .connecting, .authenticating, .subscribing, .connected, .degraded, .reconnecting:
            false
        }
    }
    public var canRunOperatorCommands: Bool {
        switch sessionState {
        case .connected, .degraded:
            true
        case .idle, .discovering, .connecting, .authenticating, .subscribing, .reconnecting, .failed:
            false
        }
    }
    public var connectionBanner: WorkspaceConnectionBanner? {
        banner(for: sessionState)
    }

    private let session: any CameraSessionControlling
    private let discovery: any CameraDiscoveryCoordinating
    private let controlService: any CameraControlServicing
    private let playbackService: any PlaybackControlServicing
    private let timecodeService: any TimecodeServicing
    private let lookService: any LookServicing
    private let frameGrabService: any FrameGrabServicing
    private let metadataService: (any CameraMetadataServicing)?
    private let frameGrabExporter: (any FrameGrabExporting)?
    private let diagnosticLogger: (any DiagnosticLogging)?
    private let diagnosticsProvider: (any DiagnosticProviding)?
    private let diagnosticReportBuilder = DiagnosticReportBuilder()
    private let reducer = CameraStateReducer()
    private var discoveryTask: Task<Void, Never>?
    private var stateTask: Task<Void, Never>?
    private var healthTask: Task<Void, Never>?
    private var variableTask: Task<Void, Never>?
    private var isStarted = false

    public init(
        session: any CameraSessionControlling,
        discovery: any CameraDiscoveryCoordinating,
        controlService: any CameraControlServicing,
        playbackService: any PlaybackControlServicing,
        timecodeService: any TimecodeServicing,
        lookService: any LookServicing,
        frameGrabService: any FrameGrabServicing,
        metadataService: (any CameraMetadataServicing)? = nil,
        frameGrabExporter: (any FrameGrabExporting)? = nil,
        diagnosticLogger: (any DiagnosticLogging)? = nil,
        diagnosticsProvider: (any DiagnosticProviding)? = nil,
        layout: WorkspaceLayout = WorkspaceLayout()
    ) {
        self.session = session
        self.discovery = discovery
        self.controlService = controlService
        self.playbackService = playbackService
        self.timecodeService = timecodeService
        self.lookService = lookService
        self.frameGrabService = frameGrabService
        self.metadataService = metadataService
        self.frameGrabExporter = frameGrabExporter
        self.diagnosticLogger = diagnosticLogger
        self.diagnosticsProvider = diagnosticsProvider
        self.layout = layout
        self.selectedSection = .control
        self.discoveryCandidates = []
        self.sessionState = .idle
        self.sessionHealth = CameraSessionHealth()
        self.liveState = CameraLiveState()
        self.diagnosticEvents = []
        self.exportedDiagnosticsReport = nil
    }

    public func start() async {
        guard !isStarted else {
            return
        }

        let discoveryUpdates = await discovery.updates()
        let sessionStateUpdates = await session.stateUpdates()
        let sessionHealthUpdates = await session.healthUpdates()
        let sessionVariableUpdates = await session.variableUpdates()

        observeDiscovery(discoveryUpdates)
        observeSessionState(sessionStateUpdates)
        observeSessionHealth(sessionHealthUpdates)
        observeVariableUpdates(sessionVariableUpdates)

        sessionState = await session.currentState()
        sessionHealth = await session.currentHealth()
        discoveryCandidates = await discovery.candidates()
        refreshDiagnosticsReport()
        await discovery.start()
        await session.beginDiscovery()
        isStarted = true
    }

    public func stop() async {
        guard isStarted else {
            return
        }

        discoveryTask?.cancel()
        stateTask?.cancel()
        healthTask?.cancel()
        variableTask?.cancel()
        discoveryTask = nil
        stateTask = nil
        healthTask = nil
        variableTask = nil
        await discovery.stop()
        await session.disconnect()
        sessionState = .idle
        sessionHealth = CameraSessionHealth()
        liveState = CameraLiveState(connectionState: .idle)
        isStarted = false
    }

    public func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async {
        do {
            try await session.connect(to: descriptor, clientName: clientName, password: password)
            activeCamera = descriptor
            await refreshMetadata()
            lastError = nil
            recordDiagnostic(.info, "Connected operator workspace to \(descriptor.displayName).")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Connection request failed: \(error)")
        }
    }

    public func applyLook(named name: String) async {
        do {
            try await lookService.applyLook(named: name)
            activeLookName = name
            liveState.lookName = name
            lastError = nil
            recordDiagnostic(.info, "Applied look \(name).")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Look apply failed: \(error)")
        }
    }

    public func captureFrameGrab() async {
        do {
            frameGrabData = try await frameGrabService.captureFrameGrab()
            lastError = nil
            recordDiagnostic(.info, "Captured frame grab.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Frame grab failed: \(error)")
        }
    }

    public func saveFrameGrabToPhotoLibrary() async {
        guard let frameGrabData else {
            lastError = String(describing: FrameGrabExportError.missingFrameGrab)
            recordDiagnostic(.warning, "Attempted to save frame grab before capture.")
            return
        }

        guard let frameGrabExporter else {
            lastError = String(describing: FrameGrabExportError.exporterUnavailable)
            recordDiagnostic(.error, "Frame grab exporter is unavailable.")
            return
        }

        do {
            lastSavedPhotoAssetIdentifier = try await frameGrabExporter.saveImageData(frameGrabData)
            lastError = nil
            recordDiagnostic(.info, "Saved frame grab to Photos.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Saving frame grab failed: \(error)")
        }
    }

    public func setFrameRate(_ frameRate: FrameRate) async {
        do {
            try await controlService.setFrameRate(frameRate)
            liveState.frameRate = frameRate
            lastError = nil
            recordDiagnostic(.info, "Set frame rate to \(frameRate.fps) fps.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Frame rate change failed: \(error)")
        }
    }

    public func setWhiteBalance(_ whiteBalance: WhiteBalance) async {
        do {
            try await controlService.setWhiteBalance(whiteBalance)
            liveState.whiteBalance = whiteBalance
            lastError = nil
            recordDiagnostic(.info, "Set white balance to \(whiteBalance.kelvin) K / \(whiteBalance.tint).")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "White balance change failed: \(error)")
        }
    }

    public func setExposureIndex(_ exposureIndex: ExposureIndex) async {
        do {
            try await controlService.setExposureIndex(exposureIndex)
            liveState.exposureIndex = exposureIndex
            lastError = nil
            recordDiagnostic(.info, "Set exposure index to \(exposureIndex.iso).")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Exposure index change failed: \(error)")
        }
    }

    public func setNDFilter(_ filter: NDFilter) async {
        do {
            try await controlService.setNDFilter(filter)
            liveState.ndFilter = filter
            lastError = nil
            recordDiagnostic(.info, "Set ND filter to \(filter.stop) stops.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "ND filter change failed: \(error)")
        }
    }

    public func setShutterAngle(_ shutterAngle: ShutterAngle) async {
        do {
            try await controlService.setShutterAngle(shutterAngle)
            liveState.shutterAngle = shutterAngle
            lastError = nil
            recordDiagnostic(.info, "Set shutter angle to \(shutterAngle.degrees) degrees.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Shutter angle change failed: \(error)")
        }
    }

    public func startRecording() async {
        do {
            try await controlService.startRecording()
            liveState.isRecording = true
            liveState.mode = .recording
            lastError = nil
            recordDiagnostic(.info, "Started recording.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Record start failed: \(error)")
        }
    }

    public func stopRecording() async {
        do {
            try await controlService.stopRecording()
            liveState.isRecording = false
            liveState.mode = .liveControl
            await refreshMetadata()
            lastError = nil
            recordDiagnostic(.info, "Stopped recording.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Record stop failed: \(error)")
        }
    }

    public func enterPlayback() async {
        do {
            try await playbackService.enterPlayback()
            liveState.mode = .playback
            selectedSection = .playback
            await refreshMetadata()
            lastError = nil
            recordDiagnostic(.info, "Entered playback mode.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Entering playback failed: \(error)")
        }
    }

    public func exitPlayback() async {
        do {
            try await playbackService.exitPlayback()
            liveState.mode = .liveControl
            await refreshMetadata()
            lastError = nil
            recordDiagnostic(.info, "Exited playback mode.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Exiting playback failed: \(error)")
        }
    }

    public func startPlayback() async {
        do {
            try await playbackService.start()
            lastError = nil
            recordDiagnostic(.info, "Started playback transport.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Playback start failed: \(error)")
        }
    }

    public func pausePlayback() async {
        do {
            try await playbackService.pause()
            lastError = nil
            recordDiagnostic(.info, "Paused playback transport.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Playback pause failed: \(error)")
        }
    }

    public func selectPlaybackClip(index: Int) async {
        do {
            try await playbackService.selectClip(index: index)
            liveState.playbackClipIndex = index
            await refreshMetadata()
            lastError = nil
            recordDiagnostic(.info, "Selected playback clip \(index).")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Selecting playback clip failed: \(error)")
        }
    }

    public func setTimecodeRunMode(_ mode: TimecodeRunMode) async {
        do {
            try await timecodeService.setRunMode(mode)
            liveState.timecodeRunMode = mode
            lastError = nil
            recordDiagnostic(.info, "Set timecode run mode to \(mode.operatorLabel).")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Timecode run mode change failed: \(error)")
        }
    }

    public func setTimecode(_ timecode: Timecode, frameRate: FrameRate) async {
        do {
            try await timecodeService.setTimecode(timecode, frameRate: frameRate)
            liveState.timecodeFrames = timecode.totalFrames(at: frameRate)
            lastError = nil
            recordDiagnostic(.info, "Jammed timecode to \(timecode.displayString) at \(frameRate.fps) fps.")
        } catch {
            lastError = String(describing: error)
            recordDiagnostic(.error, "Timecode jam failed: \(error)")
        }
    }

    private func observeDiscovery(_ updates: AsyncStream<[DiscoveryCandidate]>) {
        guard discoveryTask == nil else {
            return
        }

        discoveryTask = Task { @MainActor in
            for await candidates in updates {
                discoveryCandidates = candidates
            }
        }
    }

    private func observeSessionState(_ updates: AsyncStream<CameraSessionState>) {
        guard stateTask == nil else {
            return
        }

        stateTask = Task { @MainActor in
            for await state in updates {
                sessionState = state
                liveState.connectionState = connectionState(for: state)
                if case let .connected(camera) = state {
                    activeCamera = camera
                } else if case let .connecting(camera) = state {
                    activeCamera = camera
                } else if case let .authenticating(camera) = state {
                    activeCamera = camera
                } else if case let .subscribing(camera) = state {
                    activeCamera = camera
                } else if case let .reconnecting(camera) = state {
                    activeCamera = camera
                } else if case let .degraded(camera, _) = state {
                    activeCamera = camera
                } else if case let .failed(camera, _) = state {
                    activeCamera = camera
                }
                refreshDiagnosticsReport()
            }
        }
    }

    private func observeVariableUpdates(_ updates: AsyncStream<CAPVariableUpdate>) {
        guard variableTask == nil else {
            return
        }

        variableTask = Task { @MainActor in
            for await update in updates {
                let wasRecording = liveState.isRecording
                liveState = reducer.apply(update, to: liveState)
                activeLookName = liveState.lookName ?? activeLookName
                if wasRecording && !liveState.isRecording {
                    await refreshMetadata()
                }
            }
        }
    }

    private func observeSessionHealth(_ updates: AsyncStream<CameraSessionHealth>) {
        guard healthTask == nil else {
            return
        }

        healthTask = Task { @MainActor in
            for await health in updates {
                sessionHealth = health
            }
        }
    }

    private func recordDiagnostic(_ severity: DiagnosticSeverity, _ message: String) {
        diagnosticLogger?.record(
            DiagnosticEvent(
                severity: severity,
                message: message,
                cameraID: activeCamera?.identifier
            )
        )
        refreshDiagnosticsReport()
    }

    private func refreshDiagnosticsReport() {
        guard let diagnosticsProvider else {
            diagnosticEvents = []
            exportedDiagnosticsReport = nil
            return
        }

        let events = diagnosticsProvider.snapshot()
        diagnosticEvents = events
        exportedDiagnosticsReport = diagnosticReportBuilder.makeReport(
            events: events,
            activeCamera: activeCamera,
            sessionLabel: sessionLabel(for: sessionState)
        )
    }

    private func refreshMetadata() async {
        guard canRunOperatorCommands, let metadataService else {
            return
        }

        let updates = await metadataService.fetchUpdates()
        for update in updates {
            liveState = reducer.apply(update, to: liveState)
        }
    }

    private func sessionLabel(for state: CameraSessionState) -> String {
        switch state {
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

    private func connectionState(for state: CameraSessionState) -> ConnectionState {
        switch state {
        case .idle:
            .idle
        case .discovering:
            .discovering
        case .connecting:
            .connecting
        case .authenticating:
            .authenticating
        case .subscribing:
            .subscribing
        case .connected:
            .connected
        case let .degraded(_, reason):
            .degraded(reason: reason)
        case .reconnecting:
            .reconnecting
        case let .failed(_, reason):
            .failed(reason: reason)
        }
    }

    private func banner(for state: CameraSessionState) -> WorkspaceConnectionBanner? {
        switch state {
        case .idle:
            return nil

        case .discovering:
            return WorkspaceConnectionBanner(
                title: "Searching for Cameras",
                message: "Scanning the local network for compatible ARRI cameras.",
                tone: .neutral
            )

        case let .connecting(camera):
            return WorkspaceConnectionBanner(
                title: "Connecting to \(camera.displayName)",
                message: "Opening a direct CAP control session with the camera.",
                tone: .neutral
            )

        case let .authenticating(camera):
            return WorkspaceConnectionBanner(
                title: "Authenticating \(camera.displayName)",
                message: "Completing the operator handshake before enabling controls.",
                tone: .neutral
            )

        case let .subscribing(camera):
            return WorkspaceConnectionBanner(
                title: "Syncing \(camera.displayName)",
                message: "Subscribing to live camera state so the workspace stays current.",
                tone: .neutral
            )

        case .connected:
            return nil

        case let .degraded(camera, reason):
            return WorkspaceConnectionBanner(
                title: "\(camera.displayName) Connection is Stale",
                message: degradedMessage(for: reason),
                tone: .caution
            )

        case let .reconnecting(camera):
            return WorkspaceConnectionBanner(
                title: "Reconnecting to \(camera.displayName)",
                message: "The previous control stream dropped. The app is restoring the session now.",
                tone: .caution
            )

        case let .failed(camera, reason):
            return WorkspaceConnectionBanner(
                title: "Connection Failed for \(camera.displayName)",
                message: failedMessage(for: reason),
                tone: .critical
            )
        }
    }

    private func degradedMessage(for reason: String) -> String {
        switch reason {
        case "eventStreamStale":
            "Live telemetry is stale. Commands remain enabled, but confirm response on camera until event updates recover."
        case "keepaliveFailed":
            "Transport keepalive failed. The control link may be unstable even if the camera is still visible."
        default:
            "Connection health is degraded: \(reason)"
        }
    }

    private func failedMessage(for reason: String) -> String {
        switch reason {
        case "eventStreamEnded":
            "The live control stream ended unexpectedly. Reconnect once the camera is reachable again."
        default:
            "The control session failed: \(reason)"
        }
    }
}

public actor CameraMetadataService: CameraMetadataServicing {
    private let client: any CAPClientProtocol
    private let diagnosticLogger: (any DiagnosticLogging)?
    private let variables: [CAPVariableIdentifier]

    public init(
        client: any CAPClientProtocol,
        variables: [CAPVariableIdentifier] = [
            .codecList,
            .codec,
            .recordingResolution,
            .frameline,
            .currentReel,
            .clipNumber,
            .remainingRecTime,
            .lastRecMedium,
            .lastRecClipIndex,
            .lensModel,
            .lensIris,
            .lensFocalLength,
            .texture
        ],
        diagnosticLogger: (any DiagnosticLogging)? = nil
    ) {
        self.client = client
        self.variables = variables
        self.diagnosticLogger = diagnosticLogger
    }

    public func fetchUpdates() async -> [CAPVariableUpdate] {
        var updates: [CAPVariableUpdate] = []

        for variable in variables {
            do {
                let reply = try await client.send(.getVariable(variable))
                let value = try reply.decodeValue(for: variable)
                updates.append(CAPVariableUpdate(variableID: variable, value: value))
            } catch CAPClientError.commandFailed(resultCode: .notAvailable),
                CAPClientError.commandFailed(resultCode: .noSuchCommand),
                CAPClientError.commandFailed(resultCode: .invalidArgument) {
                continue
            } catch {
                diagnosticLogger?.record(
                    DiagnosticEvent(
                        severity: .debug,
                        message: "Supplemental metadata fetch for \(variable.rawValue) failed: \(error)"
                    )
                )
            }
        }

        return updates
    }
}

public actor CameraControlService: CameraControlServicing {
    private let client: any CAPClientProtocol
    private let diagnosticLogger: (any DiagnosticLogging)?

    public init(client: any CAPClientProtocol, diagnosticLogger: (any DiagnosticLogging)? = nil) {
        self.client = client
        self.diagnosticLogger = diagnosticLogger
    }

    public func setFrameRate(_ frameRate: FrameRate) async throws {
        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.setVariable(.sensorFPS, .float32(Float(frameRate.fps))))
            recordCommandTiming("setFrameRate", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("setFrameRate", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    public func setWhiteBalance(_ whiteBalance: WhiteBalance) async throws {
        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.setVariable(.colorTemperature, .uInt32(UInt32(whiteBalance.kelvin))))
            _ = try await client.send(.setVariable(.tint, .float32(Float(whiteBalance.tint))))
            recordCommandTiming("setWhiteBalance", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("setWhiteBalance", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    public func setExposureIndex(_ exposureIndex: ExposureIndex) async throws {
        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.setVariable(.exposureIndex, .uInt32(UInt32(exposureIndex.iso))))
            recordCommandTiming("setExposureIndex", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("setExposureIndex", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    public func setNDFilter(_ filter: NDFilter) async throws {
        guard let index = NDFilter.available.firstIndex(of: filter) else {
            throw CameraUserError.invalidValue("Unsupported ND filter stop \(filter.stop)")
        }

        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.setVariable(.ndFilter, .uInt16(UInt16(index))))
            recordCommandTiming("setNDFilter", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("setNDFilter", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    public func setShutterAngle(_ shutterAngle: ShutterAngle) async throws {
        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.setVariable(.shutterAngle, .float32(Float(shutterAngle.degrees))))
            recordCommandTiming("setShutterAngle", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("setShutterAngle", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    public func startRecording() async throws {
        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.recordStart)
            recordCommandTiming("recordStart", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("recordStart", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    public func stopRecording() async throws {
        let clock = ContinuousClock()
        let start = clock.now
        do {
            _ = try await client.send(.recordStop)
            recordCommandTiming("recordStop", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("recordStop", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    private func recordCommandTiming(
        _ name: String,
        startedAt: ContinuousClock.Instant,
        clock: ContinuousClock,
        severity: DiagnosticSeverity,
        error: Error? = nil
    ) {
        guard let diagnosticLogger else {
            return
        }

        let elapsed = startedAt.duration(to: clock.now)
        let milliseconds = elapsedMilliseconds(elapsed)
        let suffix = error.map { " with error: \($0)" } ?? ""
        diagnosticLogger.record(
            DiagnosticEvent(
                severity: severity,
                message: "Command \(name) completed in \(milliseconds) ms\(suffix)."
            )
        )
    }
}

public actor PlaybackControlService: PlaybackControlServicing {
    private let client: any CAPClientProtocol
    private let diagnosticLogger: (any DiagnosticLogging)?

    public init(client: any CAPClientProtocol, diagnosticLogger: (any DiagnosticLogging)? = nil) {
        self.client = client
        self.diagnosticLogger = diagnosticLogger
    }

    public func enterPlayback() async throws {
        try await perform("playbackEnter") {
            _ = try await client.send(.playbackEnter)
        }
    }

    public func exitPlayback() async throws {
        try await perform("playbackExit") {
            _ = try await client.send(.playbackExit)
        }
    }

    public func start() async throws {
        try await perform("playbackStart") {
            _ = try await client.send(.playbackStart)
        }
    }

    public func pause() async throws {
        try await perform("playbackPause") {
            _ = try await client.send(.playbackPause)
        }
    }

    public func selectClip(index: Int) async throws {
        try await perform("playbackSelectClip") {
            _ = try await client.send(.setVariable(.playbackClipIndex, .uInt16(UInt16(index))))
        }
    }

    private func perform(_ name: String, operation: () async throws -> Void) async throws {
        let clock = ContinuousClock()
        let start = clock.now

        do {
            try await operation()
            recordCommandTiming(name, startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming(name, startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    private func recordCommandTiming(
        _ name: String,
        startedAt: ContinuousClock.Instant,
        clock: ContinuousClock,
        severity: DiagnosticSeverity,
        error: Error? = nil
    ) {
        guard let diagnosticLogger else {
            return
        }

        let elapsed = startedAt.duration(to: clock.now)
        let milliseconds = elapsedMilliseconds(elapsed)
        let suffix = error.map { " with error: \($0)" } ?? ""
        diagnosticLogger.record(
            DiagnosticEvent(
                severity: severity,
                message: "Command \(name) completed in \(milliseconds) ms\(suffix)."
            )
        )
    }
}

public actor TimecodeService: TimecodeServicing {
    private let client: any CAPClientProtocol
    private let diagnosticLogger: (any DiagnosticLogging)?

    public init(client: any CAPClientProtocol, diagnosticLogger: (any DiagnosticLogging)? = nil) {
        self.client = client
        self.diagnosticLogger = diagnosticLogger
    }

    public func setRunMode(_ mode: TimecodeRunMode) async throws {
        try await perform("setTimecodeRunMode") {
            _ = try await client.send(.setVariable(.timecodeRunMode, .uInt16(mode.rawValue)))
        }
    }

    public func setTimecode(_ timecode: Timecode, frameRate: FrameRate) async throws {
        try await perform("setTimecode") {
            _ = try await client.send(.setVariable(.timecode, .uInt32(timecode.totalFrames(at: frameRate))))
        }
    }

    private func perform(_ name: String, operation: () async throws -> Void) async throws {
        let clock = ContinuousClock()
        let start = clock.now

        do {
            try await operation()
            recordCommandTiming(name, startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming(name, startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    private func recordCommandTiming(
        _ name: String,
        startedAt: ContinuousClock.Instant,
        clock: ContinuousClock,
        severity: DiagnosticSeverity,
        error: Error? = nil
    ) {
        guard let diagnosticLogger else {
            return
        }

        let elapsed = startedAt.duration(to: clock.now)
        let milliseconds = elapsedMilliseconds(elapsed)
        let suffix = error.map { " with error: \($0)" } ?? ""
        diagnosticLogger.record(
            DiagnosticEvent(
                severity: severity,
                message: "Command \(name) completed in \(milliseconds) ms\(suffix)."
            )
        )
    }
}

public actor LookService: LookServicing {
    private let client: any CAPClientProtocol
    private let diagnosticLogger: (any DiagnosticLogging)?

    public init(client: any CAPClientProtocol, diagnosticLogger: (any DiagnosticLogging)? = nil) {
        self.client = client
        self.diagnosticLogger = diagnosticLogger
    }

    public func applyLook(named name: String) async throws {
        let clock = ContinuousClock()
        let start = clock.now

        do {
            _ = try await client.send(.setVariable(.lookFilename, .string(name)))
            recordCommandTiming("applyLook", startedAt: start, clock: clock, severity: .debug)
        } catch {
            recordCommandTiming("applyLook", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    private func recordCommandTiming(
        _ name: String,
        startedAt: ContinuousClock.Instant,
        clock: ContinuousClock,
        severity: DiagnosticSeverity,
        error: Error? = nil
    ) {
        guard let diagnosticLogger else {
            return
        }

        let elapsed = startedAt.duration(to: clock.now)
        let milliseconds = elapsedMilliseconds(elapsed)
        let suffix = error.map { " with error: \($0)" } ?? ""
        diagnosticLogger.record(
            DiagnosticEvent(
                severity: severity,
                message: "Command \(name) completed in \(milliseconds) ms\(suffix)."
            )
        )
    }
}

public actor FrameGrabService: FrameGrabServicing {
    private let client: any CAPClientProtocol
    private let diagnosticLogger: (any DiagnosticLogging)?

    public init(client: any CAPClientProtocol, diagnosticLogger: (any DiagnosticLogging)? = nil) {
        self.client = client
        self.diagnosticLogger = diagnosticLogger
    }

    public func captureFrameGrab() async throws -> Data {
        let clock = ContinuousClock()
        let start = clock.now

        do {
            let reply = try await client.send(.getFrameGrab)
            recordCommandTiming("captureFrameGrab", startedAt: start, clock: clock, severity: .debug)
            return reply.payload
        } catch {
            recordCommandTiming("captureFrameGrab", startedAt: start, clock: clock, severity: .warning, error: error)
            throw error
        }
    }

    private func recordCommandTiming(
        _ name: String,
        startedAt: ContinuousClock.Instant,
        clock: ContinuousClock,
        severity: DiagnosticSeverity,
        error: Error? = nil
    ) {
        guard let diagnosticLogger else {
            return
        }

        let elapsed = startedAt.duration(to: clock.now)
        let milliseconds = elapsedMilliseconds(elapsed)
        let suffix = error.map { " with error: \($0)" } ?? ""
        diagnosticLogger.record(
            DiagnosticEvent(
                severity: severity,
                message: "Command \(name) completed in \(milliseconds) ms\(suffix)."
            )
        )
    }
}

private func elapsedMilliseconds(_ duration: Duration) -> Int {
    let components = duration.components
    let seconds = Double(components.seconds) * 1_000.0
    let attoseconds = Double(components.attoseconds) / 1_000_000_000_000_000.0
    let rawMilliseconds = seconds + attoseconds
    let clamped = min(max(rawMilliseconds, 0), Double(Int.max))
    return Int(clamped.rounded(.towardZero))
}

private func decodeCodecNames(from data: Data) -> [String]? {
    guard let header = decodeCAPArrayHeader(data), header.fieldCount >= 2 else {
        return nil
    }

    var names: [String] = []
    var offset = header.payloadOffset

    for _ in 0..<header.rowCount {
        guard let (name, nextOffset) = decodeCAPStringValue(data, from: offset) else {
            return nil
        }
        offset = nextOffset
        guard offset + 4 <= data.count else {
            return nil
        }
        offset += 4

        if header.fieldCount > 2 {
            return names.isEmpty ? nil : names
        }

        names.append(name)
    }

    return names
}

private func decodeCAPArrayHeader(_ data: Data) -> (rowCount: Int, fieldCount: Int, payloadOffset: Int)? {
    guard data.count >= 4 else {
        return nil
    }

    let rowCount = Int(UInt16(data[data.startIndex]) << 8 | UInt16(data[data.startIndex + 1]))
    let fieldCount = Int(UInt16(data[data.startIndex + 2]) << 8 | UInt16(data[data.startIndex + 3]))
    return (rowCount, fieldCount, 4)
}

private func decodeCAPStringValue(_ data: Data, from offset: Int) -> (String, Int)? {
    guard offset + 2 <= data.count else {
        return nil
    }

    let length = Int(UInt16(data[offset]) << 8 | UInt16(data[offset + 1]))
    let nextOffset = offset + 2 + length
    guard nextOffset <= data.count else {
        return nil
    }

    let stringData = data.subdata(in: offset..<nextOffset)
    guard let value = try? CAPDataCodec.decodeString(stringData) else {
        return nil
    }

    return (value, nextOffset)
}

private extension TimecodeRunMode {
    var operatorLabel: String {
        switch self {
        case .recordRun:
            "Record Run"
        case .freeRun:
            "Free Run"
        }
    }
}
