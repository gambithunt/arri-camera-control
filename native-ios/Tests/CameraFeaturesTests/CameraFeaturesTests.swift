import Foundation
import Testing
@testable import CameraFeatures
@testable import CameraDiagnostics
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

@Test func stateReducerMapsLensClipAndCodecMetadata() {
    let reducer = CameraStateReducer()
    var state = CameraLiveState()

    var codecListPayload = CAPDataCodec.encodeUInt16(2)
    codecListPayload.append(CAPDataCodec.encodeUInt16(2))
    codecListPayload.append(CAPDataCodec.encodeString("ProRes 4444 XQ"))
    codecListPayload.append(CAPDataCodec.encodeUInt32(0x0000_0001))
    codecListPayload.append(CAPDataCodec.encodeString("ARRIRAW"))
    codecListPayload.append(CAPDataCodec.encodeUInt32(0x0000_0002))

    state = reducer.apply(.init(variableID: .codecList, value: .opaque(codecListPayload)), to: state)
    state = reducer.apply(.init(variableID: .codec, value: .uInt16(1)), to: state)
    state = reducer.apply(.init(variableID: .currentReel, value: .uInt16(3)), to: state)
    state = reducer.apply(.init(variableID: .clipNumber, value: .uInt16(14)), to: state)
    state = reducer.apply(.init(variableID: .remainingRecTime, value: .uInt32(4_200)), to: state)
    state = reducer.apply(.init(variableID: .lensModel, value: .string("Signature Prime 35")), to: state)
    state = reducer.apply(.init(variableID: .lensIris, value: .int32(2_800)), to: state)
    state = reducer.apply(.init(variableID: .lensFocalLength, value: .int32(35_000)), to: state)
    state = reducer.apply(.init(variableID: .texture, value: .string("K445 Default")), to: state)

    #expect(state.codecOptions == ["ProRes 4444 XQ", "ARRIRAW"])
    #expect(state.codecIndex == 1)
    #expect(state.currentReel == 3)
    #expect(state.clipNumber == 14)
    #expect(state.remainingRecordSeconds == 4_200)
    #expect(state.lensModel == "Signature Prime 35")
    #expect(state.lensIrisTStopMillistops == 2_800)
    #expect(state.lensFocalLengthMillimetersTimesOneThousand == 35_000)
    #expect(state.textureName == "K445 Default")
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

@Test func servicesEmitTimingDiagnosticsForOperatorCommands() async throws {
    let client = RecordingCAPClient(replyPayload: Data([0xFF, 0xD8, 0xFF]))
    let logger = InMemoryDiagnosticLogger()
    let control = CameraControlService(client: client, diagnosticLogger: logger)
    let playback = PlaybackControlService(client: client, diagnosticLogger: logger)
    let frameGrab = FrameGrabService(client: client, diagnosticLogger: logger)

    try await control.startRecording()
    try await playback.start()
    _ = try await frameGrab.captureFrameGrab()

    let messages = logger.events.map(\.message)
    #expect(messages.contains(where: { $0.contains("Command recordStart completed in") }))
    #expect(messages.contains(where: { $0.contains("Command playbackStart completed in") }))
    #expect(messages.contains(where: { $0.contains("Command captureFrameGrab completed in") }))
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
