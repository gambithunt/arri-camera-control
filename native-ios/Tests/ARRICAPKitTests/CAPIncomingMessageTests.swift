import Foundation
import Testing
@testable import ARRICAPKit

@Test func replyFrameParsesIntoResultCodeAndPayload() throws {
    let frame = CAPFrame(
        messageType: .reply,
        messageID: 15,
        commandCode: CAPResultCode.ok.rawValue,
        payload: CAPDataCodec.encodeUInt16(0x0061)
    )

    let message = try CAPIncomingMessage(frame: frame)

    switch message {
    case let .reply(reply):
        #expect(reply.messageID == 15)
        #expect(reply.resultCode == .ok)
        #expect(try CAPDataCodec.decodeUInt16(reply.payload) == 0x0061)
    default:
        Issue.record("Expected reply message")
    }
}

@Test func eventFrameParsesIntoEventCodeAndPayload() throws {
    let frame = CAPFrame(
        messageType: .event,
        messageID: 22,
        commandCode: 0x0068,
        payload: CAPDataCodec.encodeUInt16(0x0002)
    )

    let message = try CAPIncomingMessage(frame: frame)

    switch message {
    case let .event(event):
        #expect(event.messageID == 22)
        #expect(event.eventCode == 0x0068)
        #expect(try CAPDataCodec.decodeUInt16(event.payload) == 0x0002)
    default:
        Issue.record("Expected event message")
    }
}

@Test func eventCanDecodeTypedVariableUpdateWhenVariableIsKnown() throws {
    let frame = CAPFrame(
        messageType: .event,
        messageID: 23,
        commandCode: CAPVariableIdentifier.sensorFPS.rawValue,
        payload: CAPDataCodec.encodeFloat32(24.0)
    )

    let message = try CAPIncomingMessage(frame: frame)

    switch message {
    case let .event(event):
        let update = try event.decodeVariableUpdate()
        #expect(update.variableID == .sensorFPS)
        #expect(update.value == .float32(24.0))
    default:
        Issue.record("Expected event message")
    }
}

@Test func commandFramesAreRejectedByIncomingMessageParser() {
    let frame = CAPFrame(messageType: .command, messageID: 1, commandCode: CAPCommandCode.live.rawValue)

    #expect(throws: CAPIncomingMessageError.unsupportedMessageType(.command)) {
        try CAPIncomingMessage(frame: frame)
    }
}
