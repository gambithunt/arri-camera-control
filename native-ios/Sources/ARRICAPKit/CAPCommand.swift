import Foundation

public enum CAPCommandCode: UInt16, Sendable {
    case live = 0x0080
    case requestPasswordChallenge = 0x0081
    case password = 0x0082
    case clientName = 0x0083
    case requestVariables = 0x0084
    case unrequestVariables = 0x0085
    case setVariable = 0x0086
    case welcome = 0x0087
    case getFrameGrab = 0x0088
    case getVariable = 0x0090
    case autoWhiteBalance = 0x0091
    case recordStart = 0x00A0
    case recordStop = 0x00A1
    case getClipList = 0x00A4
    case playbackEnter = 0x00A8
    case playbackExit = 0x00A9
    case playbackStart = 0x00AA
    case playbackPause = 0x00AB
}

public enum CAPCommand: Equatable, Sendable {
    case live
    case requestPasswordChallenge
    case password(String)
    case clientName(String)
    case requestVariables([CAPVariableIdentifier])
    case unrequestVariables([CAPVariableIdentifier])
    case getVariable(CAPVariableIdentifier)
    case setVariable(CAPVariableIdentifier, CAPVariableValue)
    case getFrameGrab
    case recordStart
    case recordStop
    case playbackEnter
    case playbackExit
    case playbackStart
    case playbackPause

    public func makeFrame(messageID: UInt16) throws -> CAPFrame {
        switch self {
        case .live:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.live.rawValue)
        case .requestPasswordChallenge:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.requestPasswordChallenge.rawValue)
        case let .password(password):
            return CAPFrame(
                messageType: .command,
                messageID: messageID,
                commandCode: CAPCommandCode.password.rawValue,
                payload: CAPDataCodec.encodeString(password)
            )
        case let .clientName(name):
            return CAPFrame(
                messageType: .command,
                messageID: messageID,
                commandCode: CAPCommandCode.clientName.rawValue,
                payload: CAPDataCodec.encodeString(name)
            )
        case let .requestVariables(variableIDs):
            return CAPFrame(
                messageType: .command,
                messageID: messageID,
                commandCode: CAPCommandCode.requestVariables.rawValue,
                payload: CAPDataCodec.encodeUInt16Array(variableIDs.map(\.rawValue))
            )
        case let .unrequestVariables(variableIDs):
            return CAPFrame(
                messageType: .command,
                messageID: messageID,
                commandCode: CAPCommandCode.unrequestVariables.rawValue,
                payload: CAPDataCodec.encodeUInt16Array(variableIDs.map(\.rawValue))
            )
        case let .getVariable(variableID):
            return CAPFrame(
                messageType: .command,
                messageID: messageID,
                commandCode: CAPCommandCode.getVariable.rawValue,
                payload: CAPDataCodec.encodeUInt16(variableID.rawValue)
            )
        case let .setVariable(variableID, value):
            return CAPFrame(
                messageType: .command,
                messageID: messageID,
                commandCode: CAPCommandCode.setVariable.rawValue,
                payload: try CAPVariablePayload(variableID: variableID, value: value).encode()
            )
        case .getFrameGrab:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.getFrameGrab.rawValue)
        case .recordStart:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.recordStart.rawValue)
        case .recordStop:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.recordStop.rawValue)
        case .playbackEnter:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.playbackEnter.rawValue)
        case .playbackExit:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.playbackExit.rawValue)
        case .playbackStart:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.playbackStart.rawValue)
        case .playbackPause:
            return CAPFrame(messageType: .command, messageID: messageID, commandCode: CAPCommandCode.playbackPause.rawValue)
        }
    }
}
