import Foundation
import Testing
@testable import ARRICAPKit

@Test func clientNameCommandEncodesUtf8StringPayload() throws {
    let frame = try CAPCommand.clientName("ARRI Control").makeFrame(messageID: 7)
    let decodedString = try CAPDataCodec.decodeString(frame.payload)

    #expect(frame.messageType == .command)
    #expect(frame.commandCode == CAPCommandCode.clientName.rawValue)
    #expect(decodedString == "ARRI Control")
}

@Test func requestVariablesCommandEncodesUInt16ArrayPayload() throws {
    let frame = try CAPCommand.requestVariables([.sensorFPS, .ndFilter]).makeFrame(messageID: 8)
    let decoded = try CAPDataCodec.decodeUInt16Array(frame.payload)

    #expect(frame.commandCode == CAPCommandCode.requestVariables.rawValue)
    #expect(decoded == [0x0061, 0x0068])
}

@Test func getVariableCommandEncodesRequestedVariableIdentifier() throws {
    let frame = try CAPCommand.getVariable(.sensorFPS).makeFrame(messageID: 11)

    #expect(frame.commandCode == CAPCommandCode.getVariable.rawValue)
    #expect(try CAPDataCodec.decodeUInt16(frame.payload) == CAPVariableIdentifier.sensorFPS.rawValue)
}

@Test func setVariableCommandEncodesVariableIdentifierAndTypedValue() throws {
    let frame = try CAPCommand.setVariable(.colorTemperature, .uInt32(5_600)).makeFrame(messageID: 12)
    let payload = try CAPVariablePayload.decode(frame.payload)

    #expect(frame.commandCode == CAPCommandCode.setVariable.rawValue)
    #expect(payload.variableID == .colorTemperature)
    #expect(payload.value == .uInt32(5_600))
}

@Test func recordStartCommandUsesCommandWithoutPayload() throws {
    let frame = try CAPCommand.recordStart.makeFrame(messageID: 13)

    #expect(frame.commandCode == CAPCommandCode.recordStart.rawValue)
    #expect(frame.payload.isEmpty)
}

@Test func getClipListCommandUsesExpectedCodeWithoutPayload() throws {
    let frame = try CAPCommand.getClipList.makeFrame(messageID: 14)

    #expect(frame.commandCode == CAPCommandCode.getClipList.rawValue)
    #expect(frame.payload.isEmpty)
}

@Test func buttonPressCommandEncodesButtonNameAsStringPayload() throws {
    let frame = try CAPCommand.buttonPress("MON_1").makeFrame(messageID: 15)

    #expect(frame.commandCode == CAPCommandCode.buttonPress.rawValue)
    #expect(try CAPDataCodec.decodeString(frame.payload) == "MON_1")
}
