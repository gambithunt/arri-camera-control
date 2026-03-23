import Foundation
import Testing
@testable import CameraFeatures
@testable import CameraDiagnostics
@testable import CameraDomain
@testable import CameraSession
@testable import CameraDiscovery
@testable import ARRICAPKit

@MainActor
@Test func workspaceStoreReflectsDiscoverySessionAndVariableUpdateStreams() async throws {
    let session = StubSessionController()
    let discovery = StubDiscoveryCoordinator()
    let store = CameraWorkspaceStore(
        session: session,
        discovery: discovery,
        controlService: StubControlService(),
        playbackService: StubPlaybackService(),
        timecodeService: StubTimecodeService(),
        lookService: StubLookService(),
        frameGrabService: StubFrameGrabService()
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-1"),
        displayName: "ARRI ALEXA LF",
        family: .alexaLF,
        endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777),
        discoverySource: .bonjour
    )

    await store.start()
    await discovery.emit([
        DiscoveryCandidate(descriptor: descriptor, verificationState: .verified)
    ])
    await session.emitState(.connected(descriptor))
    await session.emitVariableUpdate(.init(variableID: .sensorFPS, value: .float32(25.0)))

    try await Task.sleep(for: .milliseconds(50))

    #expect(store.discoveryCandidates.count == 1)
    #expect(store.activeCamera == descriptor)
    #expect(store.sessionState == .connected(descriptor))
    #expect(store.liveState.frameRate == FrameRate(fps: 25))

    await store.stop()
}

@MainActor
@Test func workspaceStoreRunsOperatorWorkflowsAndBuildsDiagnostics() async throws {
    let session = StubSessionController()
    let discovery = StubDiscoveryCoordinator()
    let control = StubControlService()
    let playback = StubPlaybackService()
    let timecodeService = StubTimecodeService()
    let look = StubLookService()
    let frameGrab = StubFrameGrabService()
    let exporter = StubFrameGrabExporter()
    let logger = InMemoryDiagnosticLogger()
    let store = CameraWorkspaceStore(
        session: session,
        discovery: discovery,
        controlService: control,
        playbackService: playback,
        timecodeService: timecodeService,
        lookService: look,
        frameGrabService: frameGrab,
        frameGrabExporter: exporter,
        diagnosticLogger: logger,
        diagnosticsProvider: logger
    )
    let frameRate = try #require(FrameRate(fps: 25))
    let whiteBalance = try #require(WhiteBalance(kelvin: 4_300, tint: 8))
    let exposureIndex = try #require(ExposureIndex(iso: 1280))
    let ndFilter = try #require(NDFilter(stop: 1.8))
    let shutterAngle = try #require(ShutterAngle(degrees: 172.8))
    let jammedTimecode = try #require(Timecode(hours: 1, minutes: 2, seconds: 3, frames: 4))

    await store.start()
    await store.setFrameRate(frameRate)
    await store.setWhiteBalance(whiteBalance)
    await store.setExposureIndex(exposureIndex)
    await store.setNDFilter(ndFilter)
    await store.setShutterAngle(shutterAngle)
    await store.startRecording()
    await store.stopRecording()
    await store.enterPlayback()
    await store.startPlayback()
    await store.pausePlayback()
    await store.selectPlaybackClip(index: 12)
    await store.exitPlayback()
    await store.setTimecodeRunMode(.freeRun)
    await store.setTimecode(jammedTimecode, frameRate: frameRate)
    await store.applyLook(named: "Show LUT")
    await store.captureFrameGrab()
    await store.saveFrameGrabToPhotoLibrary()

    #expect(await control.frameRates == [frameRate])
    #expect(await control.whiteBalances == [whiteBalance])
    #expect(await control.exposureIndices == [exposureIndex])
    #expect(await control.ndFilters == [ndFilter])
    #expect(await control.shutterAngles == [shutterAngle])
    #expect(await control.startRecordingCount == 1)
    #expect(await control.stopRecordingCount == 1)
    #expect(await playback.didEnterPlayback)
    #expect(await playback.didStartPlayback)
    #expect(await playback.didPausePlayback)
    #expect(await playback.selectedClipIndexes == [12])
    #expect(await playback.didExitPlayback)
    #expect(await timecodeService.runModes == [.freeRun])
    #expect(await timecodeService.timecodes.count == 1)
    #expect(await timecodeService.timecodes.first?.timecode == jammedTimecode)
    #expect(await timecodeService.timecodes.first?.frameRate == frameRate)
    #expect(await look.lookNames == ["Show LUT"])
    #expect(await frameGrab.captureCount == 1)
    #expect(await exporter.savedPayloads == [Data([0xFF, 0xD8, 0xFF])])
    #expect(store.frameGrabData == Data([0xFF, 0xD8, 0xFF]))
    #expect(store.activeLookName == "Show LUT")
    #expect(store.liveState.lookName == "Show LUT")
    #expect(store.liveState.timecodeRunMode == .freeRun)
    #expect(store.liveState.timecodeFrames == jammedTimecode.totalFrames(at: frameRate))
    #expect(store.liveState.playbackClipIndex == 12)
    #expect(store.exportedDiagnosticsReport?.contains("Show LUT") == true)
    #expect(store.exportedDiagnosticsReport?.contains("frame grab") == true)

    await store.stop()
}

private actor StubSessionController: CameraSessionControlling {
    private var stateContinuations: [UUID: AsyncStream<CameraSessionState>.Continuation] = [:]
    private var variableContinuations: [UUID: AsyncStream<CAPVariableUpdate>.Continuation] = [:]

    func currentState() async -> CameraSessionState {
        .idle
    }

    func stateUpdates() async -> AsyncStream<CameraSessionState> {
        AsyncStream { continuation in
            let id = UUID()
            stateContinuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeStateContinuation(id: id)
                }
            }
        }
    }

    func variableUpdates() async -> AsyncStream<CAPVariableUpdate> {
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

    func beginDiscovery() async {}
    func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async throws {}
    func disconnect() async {}

    func emitState(_ state: CameraSessionState) {
        for continuation in stateContinuations.values {
            continuation.yield(state)
        }
    }

    func emitVariableUpdate(_ update: CAPVariableUpdate) {
        for continuation in variableContinuations.values {
            continuation.yield(update)
        }
    }

    private func removeStateContinuation(id: UUID) {
        stateContinuations.removeValue(forKey: id)
    }

    private func removeVariableContinuation(id: UUID) {
        variableContinuations.removeValue(forKey: id)
    }
}

private actor StubDiscoveryCoordinator: CameraDiscoveryCoordinating {
    private var continuations: [UUID: AsyncStream<[DiscoveryCandidate]>.Continuation] = [:]

    func start() async {}
    func stop() async {}
    func candidates() async -> [DiscoveryCandidate] { [] }

    func updates() async -> AsyncStream<[DiscoveryCandidate]> {
        AsyncStream { continuation in
            let id = UUID()
            continuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeContinuation(id: id)
                }
            }
        }
    }

    func emit(_ candidates: [DiscoveryCandidate]) {
        for continuation in continuations.values {
            continuation.yield(candidates)
        }
    }

    private func removeContinuation(id: UUID) {
        continuations.removeValue(forKey: id)
    }
}

private actor StubControlService: CameraControlServicing {
    private(set) var frameRates: [FrameRate] = []
    private(set) var whiteBalances: [WhiteBalance] = []
    private(set) var exposureIndices: [ExposureIndex] = []
    private(set) var ndFilters: [NDFilter] = []
    private(set) var shutterAngles: [ShutterAngle] = []
    private(set) var startRecordingCount = 0
    private(set) var stopRecordingCount = 0

    func startRecording() async throws {
        startRecordingCount += 1
    }

    func stopRecording() async throws {
        stopRecordingCount += 1
    }

    func setFrameRate(_ frameRate: FrameRate) async throws {
        frameRates.append(frameRate)
    }

    func setWhiteBalance(_ whiteBalance: WhiteBalance) async throws {
        whiteBalances.append(whiteBalance)
    }

    func setExposureIndex(_ exposureIndex: ExposureIndex) async throws {
        exposureIndices.append(exposureIndex)
    }

    func setNDFilter(_ filter: NDFilter) async throws {
        ndFilters.append(filter)
    }

    func setShutterAngle(_ shutterAngle: ShutterAngle) async throws {
        shutterAngles.append(shutterAngle)
    }
}

private actor StubPlaybackService: PlaybackControlServicing {
    private(set) var didEnterPlayback = false
    private(set) var didExitPlayback = false
    private(set) var didStartPlayback = false
    private(set) var didPausePlayback = false
    private(set) var selectedClipIndexes: [Int] = []

    func enterPlayback() async throws {
        didEnterPlayback = true
    }

    func exitPlayback() async throws {
        didExitPlayback = true
    }

    func start() async throws {
        didStartPlayback = true
    }

    func pause() async throws {
        didPausePlayback = true
    }

    func selectClip(index: Int) async throws {
        selectedClipIndexes.append(index)
    }
}

private actor StubTimecodeService: TimecodeServicing {
    private(set) var runModes: [TimecodeRunMode] = []
    private(set) var timecodes: [RecordedTimecode] = []

    func setRunMode(_ mode: TimecodeRunMode) async throws {
        runModes.append(mode)
    }

    func setTimecode(_ timecode: Timecode, frameRate: FrameRate) async throws {
        timecodes.append(RecordedTimecode(timecode: timecode, frameRate: frameRate))
    }
}

private struct RecordedTimecode: Equatable {
    let timecode: Timecode
    let frameRate: FrameRate
}

private actor StubLookService: LookServicing {
    private(set) var lookNames: [String] = []

    func applyLook(named name: String) async throws {
        lookNames.append(name)
    }
}

private actor StubFrameGrabService: FrameGrabServicing {
    private(set) var captureCount = 0

    func captureFrameGrab() async throws -> Data {
        captureCount += 1
        return Data([0xFF, 0xD8, 0xFF])
    }
}

private actor StubFrameGrabExporter: FrameGrabExporting {
    private(set) var savedPayloads: [Data] = []

    func saveImageData(_ data: Data) async throws -> String {
        savedPayloads.append(data)
        return "asset-id-1"
    }
}
