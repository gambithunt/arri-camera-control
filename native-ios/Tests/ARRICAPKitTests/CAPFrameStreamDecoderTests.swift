import Foundation
import Testing
@testable import ARRICAPKit

@Test func frameStreamDecoderWaitsForCompleteFrameAcrossChunks() throws {
    var decoder = CAPFrameStreamDecoder()
    let frame = CAPFrame(
        messageType: .event,
        messageID: 7,
        commandCode: CAPVariableIdentifier.sensorFPS.rawValue,
        payload: CAPDataCodec.encodeFloat32(24.0)
    )
    let bytes = frame.encode()

    decoder.append(bytes.prefix(4))
    #expect(try decoder.nextFrame() == nil)

    decoder.append(bytes.dropFirst(4))
    let decoded = try decoder.nextFrame()

    #expect(decoded == frame)
}
