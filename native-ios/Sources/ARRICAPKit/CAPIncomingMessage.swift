import Foundation

public enum CAPResultCode: UInt16, Sendable {
    case ok = 0x0000
    case noSuchCommand = 0x0001
    case notAllowed = 0x0002
    case notAuthorized = 0x0007
    case tooManyClients = 0x0008
    case protocolError = 0x0009
    case systemError = 0x000A
    case invalidArgument = 0x000D
    case notAvailable = 0x0011
    case tryAgain = 0x0012
    case unspecifiedError = 0x0100
}

public enum CAPIncomingMessageError: Error, Equatable, Sendable {
    case unsupportedMessageType(CAPMessageType)
}

public struct CAPReply: Equatable, Sendable {
    public let messageID: UInt16
    public let resultCode: CAPResultCode?
    public let rawResultCode: UInt16
    public let payload: Data

    public init(messageID: UInt16, rawResultCode: UInt16, payload: Data) {
        self.messageID = messageID
        self.resultCode = CAPResultCode(rawValue: rawResultCode)
        self.rawResultCode = rawResultCode
        self.payload = payload
    }

    public func decodeValue(for variableID: CAPVariableIdentifier) throws -> CAPVariableValue {
        try CAPVariableValue.decode(payload: payload, for: variableID)
    }
}

public struct CAPEvent: Equatable, Sendable {
    public let messageID: UInt16
    public let eventCode: UInt16
    public let payload: Data

    public init(messageID: UInt16, eventCode: UInt16, payload: Data) {
        self.messageID = messageID
        self.eventCode = eventCode
        self.payload = payload
    }

    public func decodeVariableUpdate() throws -> CAPVariableUpdate {
        guard let variableID = CAPVariableIdentifier(rawValue: eventCode) else {
            throw CAPVariableValueError.unsupportedVariable(eventCode)
        }

        return CAPVariableUpdate(
            variableID: variableID,
            value: try CAPVariableValue.decode(payload: payload, for: variableID)
        )
    }
}

public enum CAPIncomingMessage: Equatable, Sendable {
    case reply(CAPReply)
    case event(CAPEvent)

    public init(frame: CAPFrame) throws {
        switch frame.messageType {
        case .reply:
            self = .reply(CAPReply(messageID: frame.messageID, rawResultCode: frame.commandCode, payload: frame.payload))
        case .event:
            self = .event(CAPEvent(messageID: frame.messageID, eventCode: frame.commandCode, payload: frame.payload))
        case .command:
            throw CAPIncomingMessageError.unsupportedMessageType(.command)
        }
    }
}
