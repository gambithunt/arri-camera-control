import Foundation
import Testing
@testable import CameraFeatures
@testable import CameraDomain
@testable import ARRICAPKit

@Test func defaultWorkspaceContainsAllTopLevelSections() {
    let layout = WorkspaceLayout()

    #expect(layout.sections == [.control, .playback, .timecode, .look, .diagnostics])
}

@Test func stateReducerBuildsLiveStateFromVariableUpdates() {
    let reducer = CameraStateReducer()
    var state = CameraLiveState()

    state = reducer.apply(.init(variableID: .sensorFPS, value: .float32(24.0)), to: state)
    state = reducer.apply(.init(variableID: .colorTemperature, value: .uInt32(5_600)), to: state)
    state = reducer.apply(.init(variableID: .tint, value: .float32(2.0)), to: state)
    state = reducer.apply(.init(variableID: .exposureIndex, value: .uInt32(800)), to: state)
    state = reducer.apply(.init(variableID: .ndFilter, value: .uInt16(2)), to: state)
    state = reducer.apply(.init(variableID: .cameraState, value: .uInt16(0x0001)), to: state)

    #expect(state.frameRate == FrameRate(fps: 24))
    #expect(state.whiteBalance == WhiteBalance(kelvin: 5_600, tint: 2))
    #expect(state.exposureIndex == ExposureIndex(iso: 800))
    #expect(state.ndFilter == NDFilter(stop: 1.2))
    #expect(state.isRecording)
}

@Test func stateReducerMapsLookTimecodeModeAndPlaybackClipIndex() {
    let reducer = CameraStateReducer()
    var state = CameraLiveState()

    state = reducer.apply(.init(variableID: .timecodeRunMode, value: .uInt16(TimecodeRunMode.freeRun.rawValue)), to: state)
    state = reducer.apply(.init(variableID: .lookFilename, value: .string("Show LUT")), to: state)
    state = reducer.apply(.init(variableID: .playbackClipIndex, value: .uInt16(7)), to: state)

    #expect(state.timecodeRunMode == .freeRun)
    #expect(state.lookName == "Show LUT")
    #expect(state.playbackClipIndex == 7)
}

@Test func controlServiceMapsOperatorActionsToCAPCommands() async throws {
    let client = RecordingCAPClient()
    let service = CameraControlService(client: client)

    try await service.setWhiteBalance(WhiteBalance(kelvin: 5_600, tint: 4)!)
    try await service.setFrameRate(FrameRate(fps: 25)!)
    try await service.startRecording()

    #expect(await client.commands == [
        .setVariable(.colorTemperature, .uInt32(5_600)),
        .setVariable(.tint, .float32(4.0)),
        .setVariable(.sensorFPS, .float32(25.0)),
        .recordStart
    ])
}

@Test func playbackTimecodeLookAndFrameGrabServicesMapToExpectedCommands() async throws {
    let client = RecordingCAPClient(replyPayload: Data([0xFF, 0xD8, 0xFF]))
    let playback = PlaybackControlService(client: client)
    let timecode = TimecodeService(client: client)
    let look = LookService(client: client)
    let frameGrab = FrameGrabService(client: client)

    try await playback.enterPlayback()
    try await playback.start()
    try await playback.pause()
    try await playback.selectClip(index: 4)
    try await playback.exitPlayback()
    try await timecode.setRunMode(.freeRun)
    try await timecode.setTimecode(Timecode(hours: 1, minutes: 0, seconds: 0, frames: 0)!, frameRate: FrameRate(fps: 24)!)
    try await look.applyLook(named: "Show LUT")
    let imageData = try await frameGrab.captureFrameGrab()

    #expect(imageData == Data([0xFF, 0xD8, 0xFF]))
    #expect(await client.commands == [
        .playbackEnter,
        .playbackStart,
        .playbackPause,
        .setVariable(.playbackClipIndex, .uInt16(4)),
        .playbackExit,
        .setVariable(.timecodeRunMode, .uInt16(1)),
        .setVariable(.timecode, .uInt32(86_400)),
        .setVariable(.lookFilename, .string("Show LUT")),
        .getFrameGrab
    ])
}

private actor RecordingCAPClient: CAPClientProtocol {
    private(set) var commands: [CAPCommand] = []
    private let replyPayload: Data

    init(replyPayload: Data = Data()) {
        self.replyPayload = replyPayload
    }

    func connect(to endpoint: CameraEndpoint) async throws {}
    func disconnect() async {}

    func send(_ command: CAPCommand) async throws -> CAPReply {
        commands.append(command)
        return CAPReply(messageID: UInt16(commands.count), rawResultCode: CAPResultCode.ok.rawValue, payload: replyPayload)
    }

    func events() async -> AsyncStream<CAPEvent> {
        AsyncStream { continuation in
            continuation.finish()
        }
    }
}
