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

public protocol FrameGrabExporting: Sendable {
    func saveImageData(_ data: Data) async throws -> String
}

public enum FrameGrabExportError: Error, Equatable, Sendable {
    case missingFrameGrab
}

@MainActor
@Observable
public final class CameraWorkspaceStore {
    public var layout: WorkspaceLayout
    public var selectedSection: WorkspaceSection
    public var discoveryCandidates: [DiscoveryCandidate]
    public var sessionState: CameraSessionState
    public var liveState: CameraLiveState
    public var activeCamera: CameraDescriptor?
    public var frameGrabData: Data?
    public var activeLookName: String?
    public var lastSavedPhotoAssetIdentifier: String?
    public var diagnosticEvents: [DiagnosticEvent]
    public var exportedDiagnosticsReport: String?
    public var lastError: String?

    private let session: any CameraSessionControlling
    private let discovery: any CameraDiscoveryCoordinating
    private let controlService: any CameraControlServicing
    private let playbackService: any PlaybackControlServicing
    private let timecodeService: any TimecodeServicing
    private let lookService: any LookServicing
    private let frameGrabService: any FrameGrabServicing
    private let frameGrabExporter: (any FrameGrabExporting)?
    private let diagnosticLogger: (any DiagnosticLogging)?
    private let diagnosticsProvider: (any DiagnosticProviding)?
    private let diagnosticReportBuilder = DiagnosticReportBuilder()
    private let reducer = CameraStateReducer()
    private var discoveryTask: Task<Void, Never>?
    private var stateTask: Task<Void, Never>?
    private var variableTask: Task<Void, Never>?

    public init(
        session: any CameraSessionControlling,
        discovery: any CameraDiscoveryCoordinating,
        controlService: any CameraControlServicing,
        playbackService: any PlaybackControlServicing,
        timecodeService: any TimecodeServicing,
        lookService: any LookServicing,
        frameGrabService: any FrameGrabServicing,
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
        self.frameGrabExporter = frameGrabExporter
        self.diagnosticLogger = diagnosticLogger
        self.diagnosticsProvider = diagnosticsProvider
        self.layout = layout
        self.selectedSection = .control
        self.discoveryCandidates = []
        self.sessionState = .idle
        self.liveState = CameraLiveState()
        self.diagnosticEvents = []
        self.exportedDiagnosticsReport = nil
    }

    public func start() async {
        let discoveryUpdates = await discovery.updates()
        let sessionStateUpdates = await session.stateUpdates()
        let sessionVariableUpdates = await session.variableUpdates()

        observeDiscovery(discoveryUpdates)
        observeSessionState(sessionStateUpdates)
        observeVariableUpdates(sessionVariableUpdates)

        sessionState = await session.currentState()
        discoveryCandidates = await discovery.candidates()
        refreshDiagnosticsReport()
        await discovery.start()
        await session.beginDiscovery()
    }

    public func stop() async {
        discoveryTask?.cancel()
        stateTask?.cancel()
        variableTask?.cancel()
        discoveryTask = nil
        stateTask = nil
        variableTask = nil
        await discovery.stop()
        await session.disconnect()
    }

    public func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async {
        do {
            try await session.connect(to: descriptor, clientName: clientName, password: password)
            activeCamera = descriptor
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
            lastError = "No frame grab exporter configured."
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
                liveState = reducer.apply(update, to: liveState)
                activeLookName = liveState.lookName ?? activeLookName
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
}

public actor CameraControlService: CameraControlServicing {
    private let client: any CAPClientProtocol

    public init(client: any CAPClientProtocol) {
        self.client = client
    }

    public func setFrameRate(_ frameRate: FrameRate) async throws {
        _ = try await client.send(.setVariable(.sensorFPS, .float32(Float(frameRate.fps))))
    }

    public func setWhiteBalance(_ whiteBalance: WhiteBalance) async throws {
        _ = try await client.send(.setVariable(.colorTemperature, .uInt32(UInt32(whiteBalance.kelvin))))
        _ = try await client.send(.setVariable(.tint, .float32(Float(whiteBalance.tint))))
    }

    public func setExposureIndex(_ exposureIndex: ExposureIndex) async throws {
        _ = try await client.send(.setVariable(.exposureIndex, .uInt32(UInt32(exposureIndex.iso))))
    }

    public func setNDFilter(_ filter: NDFilter) async throws {
        guard let index = NDFilter.available.firstIndex(of: filter) else {
            throw CameraUserError.invalidValue("Unsupported ND filter stop \(filter.stop)")
        }

        _ = try await client.send(.setVariable(.ndFilter, .uInt16(UInt16(index))))
    }

    public func setShutterAngle(_ shutterAngle: ShutterAngle) async throws {
        _ = try await client.send(.setVariable(.shutterAngle, .float32(Float(shutterAngle.degrees))))
    }

    public func startRecording() async throws {
        _ = try await client.send(.recordStart)
    }

    public func stopRecording() async throws {
        _ = try await client.send(.recordStop)
    }
}

public actor PlaybackControlService: PlaybackControlServicing {
    private let client: any CAPClientProtocol

    public init(client: any CAPClientProtocol) {
        self.client = client
    }

    public func enterPlayback() async throws {
        _ = try await client.send(.playbackEnter)
    }

    public func exitPlayback() async throws {
        _ = try await client.send(.playbackExit)
    }

    public func start() async throws {
        _ = try await client.send(.playbackStart)
    }

    public func pause() async throws {
        _ = try await client.send(.playbackPause)
    }

    public func selectClip(index: Int) async throws {
        _ = try await client.send(.setVariable(.playbackClipIndex, .uInt16(UInt16(index))))
    }
}

public actor TimecodeService: TimecodeServicing {
    private let client: any CAPClientProtocol

    public init(client: any CAPClientProtocol) {
        self.client = client
    }

    public func setRunMode(_ mode: TimecodeRunMode) async throws {
        _ = try await client.send(.setVariable(.timecodeRunMode, .uInt16(mode.rawValue)))
    }

    public func setTimecode(_ timecode: Timecode, frameRate: FrameRate) async throws {
        _ = try await client.send(.setVariable(.timecode, .uInt32(timecode.totalFrames(at: frameRate))))
    }
}

public actor LookService: LookServicing {
    private let client: any CAPClientProtocol

    public init(client: any CAPClientProtocol) {
        self.client = client
    }

    public func applyLook(named name: String) async throws {
        _ = try await client.send(.setVariable(.lookFilename, .string(name)))
    }
}

public actor FrameGrabService: FrameGrabServicing {
    private let client: any CAPClientProtocol

    public init(client: any CAPClientProtocol) {
        self.client = client
    }

    public func captureFrameGrab() async throws -> Data {
        let reply = try await client.send(.getFrameGrab)
        return reply.payload
    }
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
