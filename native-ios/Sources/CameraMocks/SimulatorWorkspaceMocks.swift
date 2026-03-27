import Foundation
import ARRICAPKit
import CameraDiagnostics
import CameraDiscovery
import CameraDomain
import CameraFeatures
import CameraSession

public enum SimulatorWorkspaceStoreFactory {
    @MainActor
    public static func makeStore(
        frameGrabExporter: (any FrameGrabExporting)? = nil,
        diagnosticLogger: InMemoryDiagnosticLogger = InMemoryDiagnosticLogger()
    ) -> CameraWorkspaceStore {
        let session = SimulatorSessionController(logger: diagnosticLogger)
        let discovery = SimulatorDiscoveryCoordinator(candidates: [
            DiscoveryCandidate(descriptor: MockCameraFactory.makeLF(), verificationState: .verified),
            DiscoveryCandidate(descriptor: MockCameraFactory.make35(), verificationState: .verified)
        ])

        return CameraWorkspaceStore(
            session: session,
            discovery: discovery,
            controlService: SimulatorControlService(session: session),
            playbackService: SimulatorPlaybackService(session: session),
            timecodeService: SimulatorTimecodeService(session: session),
            lookService: SimulatorLookService(session: session),
            frameGrabService: SimulatorFrameGrabService(session: session),
            frameGrabExporter: frameGrabExporter,
            diagnosticLogger: diagnosticLogger,
            diagnosticsProvider: diagnosticLogger
        )
    }
}

public actor SimulatorDiscoveryCoordinator: CameraDiscoveryCoordinating {
    private let fixedCandidates: [DiscoveryCandidate]
    private var isStarted = false
    private var continuations: [UUID: AsyncStream<[DiscoveryCandidate]>.Continuation] = [:]

    public init(candidates: [DiscoveryCandidate]) {
        self.fixedCandidates = candidates
    }

    public func start() async {
        guard !isStarted else {
            return
        }

        isStarted = true
        publish(fixedCandidates)
    }

    public func stop() async {
        isStarted = false
        for continuation in continuations.values {
            continuation.finish()
        }
        continuations.removeAll()
    }

    public func candidates() async -> [DiscoveryCandidate] {
        fixedCandidates
    }

    public func updates() async -> AsyncStream<[DiscoveryCandidate]> {
        AsyncStream { continuation in
            let id = UUID()
            continuations[id] = continuation
            if isStarted {
                continuation.yield(fixedCandidates)
            }
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeContinuation(id: id)
                }
            }
        }
    }

    private func publish(_ candidates: [DiscoveryCandidate]) {
        for continuation in continuations.values {
            continuation.yield(candidates)
        }
    }

    private func removeContinuation(id: UUID) {
        continuations.removeValue(forKey: id)
    }
}

public actor SimulatorSessionController: CameraSessionControlling {
    private let logger: DiagnosticLogging
    private var state: CameraSessionState = .idle
    private var health = CameraSessionHealth()
    private var stateContinuations: [UUID: AsyncStream<CameraSessionState>.Continuation] = [:]
    private var healthContinuations: [UUID: AsyncStream<CameraSessionHealth>.Continuation] = [:]
    private var variableContinuations: [UUID: AsyncStream<CAPVariableUpdate>.Continuation] = [:]
    private var connectedCamera: CameraDescriptor?
    private var frameRate = FrameRate(fps: 24)!
    private var whiteBalance = WhiteBalance(kelvin: 5_600, tint: 0)!
    private var exposureIndex = ExposureIndex(iso: 800)!
    private var ndFilter = NDFilter(stop: 0.0)!
    private var shutterAngle = ShutterAngle(degrees: 180)!
    private var timecode = Timecode(hours: 1, minutes: 0, seconds: 0, frames: 0)!
    private var timecodeRunMode: TimecodeRunMode = .recordRun
    private var lookName = "Show LUT"
    private var currentReel = 1
    private var clipNumber = 12
    private var remainingRecordSeconds: UInt32 = 5_880
    private var lastRecordedMediumID = 1
    private var lastRecordedClipIndex = 12
    private var lensModel = "ARRI Signature Prime 35"
    private var lensIrisMillistops = 2_800
    private var lensFocalLengthMillimetersTimesOneThousand = 35_000
    private var framelineName = "16:9 Open Gate"
    private var textureName = "K445 Default"
    private let codecOptions = ["ProRes 4444 XQ", "ARRIRAW"]
    private var codecIndex = 0
    private var recordingResolutionIndex = 0
    private var playbackClipIndex = 1
    private var isRecording = false
    private var isInPlayback = false

    public init(logger: DiagnosticLogging) {
        self.logger = logger
    }

    public func currentState() async -> CameraSessionState {
        state
    }

    public func currentHealth() async -> CameraSessionHealth {
        health
    }

    public func stateUpdates() async -> AsyncStream<CameraSessionState> {
        AsyncStream { continuation in
            let id = UUID()
            stateContinuations[id] = continuation
            continuation.yield(state)
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeStateContinuation(id: id)
                }
            }
        }
    }

    public func healthUpdates() async -> AsyncStream<CameraSessionHealth> {
        AsyncStream { continuation in
            let id = UUID()
            healthContinuations[id] = continuation
            continuation.yield(health)
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeHealthContinuation(id: id)
                }
            }
        }
    }

    public func variableUpdates() async -> AsyncStream<CAPVariableUpdate> {
        AsyncStream { continuation in
            let id = UUID()
            variableContinuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeVariableContinuation(id: id)
                }
            }
        }
    }

    public func beginDiscovery() async {
        setState(.discovering)
    }

    public func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async throws {
        setState(.connecting(descriptor))
        setState(.authenticating(descriptor))
        setState(.subscribing(descriptor))
        connectedCamera = descriptor
        health = CameraSessionHealth(lastKeepaliveAt: Date(), lastKeepaliveLatencyMS: 18, consecutiveKeepaliveFailures: 0)
        publish(health)
        setState(.connected(descriptor))
        publishBootstrapState()
        logger.record(
            DiagnosticEvent(
                severity: .info,
                message: "Connected to simulator camera \(descriptor.displayName).",
                cameraID: descriptor.identifier
            )
        )
    }

    public func disconnect() async {
        connectedCamera = nil
        health = CameraSessionHealth()
        publish(health)
        setState(.idle)
    }

    func setFrameRate(_ value: FrameRate) {
        frameRate = value
        publish(.init(variableID: .sensorFPS, value: .float32(Float(value.fps))))
    }

    func setWhiteBalance(_ value: WhiteBalance) {
        whiteBalance = value
        publish(.init(variableID: .colorTemperature, value: .uInt32(UInt32(value.kelvin))))
        publish(.init(variableID: .tint, value: .float32(Float(value.tint))))
    }

    func setExposureIndex(_ value: ExposureIndex) {
        exposureIndex = value
        publish(.init(variableID: .exposureIndex, value: .uInt32(UInt32(value.iso))))
    }

    func setNDFilter(_ value: NDFilter) {
        ndFilter = value
        let index = UInt16(NDFilter.available.firstIndex(of: value) ?? 0)
        publish(.init(variableID: .ndFilter, value: .uInt16(index)))
    }

    func setShutterAngle(_ value: ShutterAngle) {
        shutterAngle = value
        publish(.init(variableID: .shutterAngle, value: .float32(Float(value.degrees))))
    }

    func startRecording() {
        isRecording = true
        isInPlayback = false
        publishCameraState()
    }

    func stopRecording() {
        isRecording = false
        clipNumber += 1
        lastRecordedClipIndex = clipNumber
        publishCameraState()
        publish(.init(variableID: .clipNumber, value: .uInt16(UInt16(clipNumber))))
        publish(.init(variableID: .lastRecClipIndex, value: .uInt16(UInt16(lastRecordedClipIndex))))
    }

    func enterPlayback() {
        isInPlayback = true
        isRecording = false
        publishCameraState()
    }

    func exitPlayback() {
        isInPlayback = false
        publishCameraState()
    }

    func selectClip(index: Int) {
        playbackClipIndex = max(index, 0)
        publish(.init(variableID: .playbackClipIndex, value: .uInt16(UInt16(playbackClipIndex))))
    }

    func setTimecodeRunMode(_ value: TimecodeRunMode) {
        timecodeRunMode = value
        publish(.init(variableID: .timecodeRunMode, value: .uInt16(value.rawValue)))
    }

    func setTimecode(_ value: Timecode, frameRate: FrameRate) {
        timecode = value
        self.frameRate = frameRate
        publish(.init(variableID: .sensorFPS, value: .float32(Float(frameRate.fps))))
        publish(.init(variableID: .timecode, value: .uInt32(value.totalFrames(at: frameRate))))
    }

    func applyLook(named name: String) {
        lookName = name
        publish(.init(variableID: .lookFilename, value: .string(name)))
    }

    private func publishBootstrapState() {
        publish(.init(variableID: .codecList, value: .opaque(Self.makeCodecListPayload(codecOptions))))
        publish(.init(variableID: .codec, value: .uInt16(UInt16(codecIndex))))
        publish(.init(variableID: .recordingResolution, value: .uInt16(UInt16(recordingResolutionIndex))))
        publish(.init(variableID: .sensorFPS, value: .float32(Float(frameRate.fps))))
        publish(.init(variableID: .colorTemperature, value: .uInt32(UInt32(whiteBalance.kelvin))))
        publish(.init(variableID: .tint, value: .float32(Float(whiteBalance.tint))))
        publish(.init(variableID: .exposureIndex, value: .uInt32(UInt32(exposureIndex.iso))))
        publish(.init(variableID: .ndFilter, value: .uInt16(UInt16(NDFilter.available.firstIndex(of: ndFilter) ?? 0))))
        publish(.init(variableID: .shutterAngle, value: .float32(Float(shutterAngle.degrees))))
        publish(.init(variableID: .timecode, value: .uInt32(timecode.totalFrames(at: frameRate))))
        publish(.init(variableID: .timecodeRunMode, value: .uInt16(timecodeRunMode.rawValue)))
        publish(.init(variableID: .lookFilename, value: .string(lookName)))
        publish(.init(variableID: .currentReel, value: .uInt16(UInt16(currentReel))))
        publish(.init(variableID: .clipNumber, value: .uInt16(UInt16(clipNumber))))
        publish(.init(variableID: .remainingRecTime, value: .uInt32(remainingRecordSeconds)))
        publish(.init(variableID: .lastRecMedium, value: .uInt16(UInt16(lastRecordedMediumID))))
        publish(.init(variableID: .lastRecClipIndex, value: .uInt16(UInt16(lastRecordedClipIndex))))
        publish(.init(variableID: .lensModel, value: .string(lensModel)))
        publish(.init(variableID: .lensIris, value: .int32(Int32(lensIrisMillistops))))
        publish(.init(variableID: .lensFocalLength, value: .int32(Int32(lensFocalLengthMillimetersTimesOneThousand))))
        publish(.init(variableID: .frameline, value: .string(framelineName)))
        publish(.init(variableID: .texture, value: .string(textureName)))
        publish(.init(variableID: .playbackClipIndex, value: .uInt16(UInt16(playbackClipIndex))))
        publishCameraState()
    }

    private func publishCameraState() {
        var flags: UInt16 = 0
        if isRecording {
            flags |= 0x0001
        }
        if isInPlayback {
            flags |= 0x0002
        }
        publish(.init(variableID: .cameraState, value: .uInt16(flags)))
    }

    private func setState(_ newState: CameraSessionState) {
        state = newState
        publish(newState)
    }

    private func publish(_ state: CameraSessionState) {
        for continuation in stateContinuations.values {
            continuation.yield(state)
        }
    }

    private func publish(_ health: CameraSessionHealth) {
        for continuation in healthContinuations.values {
            continuation.yield(health)
        }
    }

    private func publish(_ update: CAPVariableUpdate) {
        for continuation in variableContinuations.values {
            continuation.yield(update)
        }
    }

    private func removeStateContinuation(id: UUID) {
        stateContinuations.removeValue(forKey: id)
    }

    private func removeHealthContinuation(id: UUID) {
        healthContinuations.removeValue(forKey: id)
    }

    private func removeVariableContinuation(id: UUID) {
        variableContinuations.removeValue(forKey: id)
    }

    private static func makeCodecListPayload(_ values: [String]) -> Data {
        var data = CAPDataCodec.encodeUInt16(UInt16(values.count))
        data.append(CAPDataCodec.encodeUInt16(2))
        for value in values {
            data.append(CAPDataCodec.encodeString(value))
            data.append(CAPDataCodec.encodeUInt32(0x0000_0001))
        }
        return data
    }
}

public actor SimulatorControlService: CameraControlServicing {
    private let session: SimulatorSessionController

    public init(session: SimulatorSessionController) {
        self.session = session
    }

    public func setFrameRate(_ frameRate: FrameRate) async throws {
        await session.setFrameRate(frameRate)
    }

    public func setWhiteBalance(_ whiteBalance: WhiteBalance) async throws {
        await session.setWhiteBalance(whiteBalance)
    }

    public func setExposureIndex(_ exposureIndex: ExposureIndex) async throws {
        await session.setExposureIndex(exposureIndex)
    }

    public func setNDFilter(_ filter: NDFilter) async throws {
        await session.setNDFilter(filter)
    }

    public func setShutterAngle(_ shutterAngle: ShutterAngle) async throws {
        await session.setShutterAngle(shutterAngle)
    }

    public func startRecording() async throws {
        await session.startRecording()
    }

    public func stopRecording() async throws {
        await session.stopRecording()
    }
}

public actor SimulatorPlaybackService: PlaybackControlServicing {
    private let session: SimulatorSessionController

    public init(session: SimulatorSessionController) {
        self.session = session
    }

    public func enterPlayback() async throws {
        await session.enterPlayback()
    }

    public func exitPlayback() async throws {
        await session.exitPlayback()
    }

    public func start() async throws {}

    public func pause() async throws {}

    public func selectClip(index: Int) async throws {
        await session.selectClip(index: index)
    }
}

public actor SimulatorTimecodeService: TimecodeServicing {
    private let session: SimulatorSessionController

    public init(session: SimulatorSessionController) {
        self.session = session
    }

    public func setRunMode(_ mode: TimecodeRunMode) async throws {
        await session.setTimecodeRunMode(mode)
    }

    public func setTimecode(_ timecode: Timecode, frameRate: FrameRate) async throws {
        await session.setTimecode(timecode, frameRate: frameRate)
    }
}

public actor SimulatorLookService: LookServicing {
    private let session: SimulatorSessionController

    public init(session: SimulatorSessionController) {
        self.session = session
    }

    public func applyLook(named name: String) async throws {
        await session.applyLook(named: name)
    }
}

public actor SimulatorFrameGrabService: FrameGrabServicing {
    private let session: SimulatorSessionController

    public init(session: SimulatorSessionController) {
        self.session = session
    }

    public func captureFrameGrab() async throws -> Data {
        let _ = await session.currentState()
        return Data([0xFF, 0xD8, 0xFF, 0xD9])
    }
}
