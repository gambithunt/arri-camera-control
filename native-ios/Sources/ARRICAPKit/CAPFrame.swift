import Foundation

public enum CAPMessageType: UInt8, Sendable {
    case command = 0x01
    case reply = 0x02
    case event = 0x03
}

public enum CAPFrameError: Error, Equatable, Sendable {
    case tooShort
    case invalidLength(expected: Int, actual: Int)
    case unknownMessageType(UInt8)
}

public struct CAPFrame: Equatable, Sendable {
    public let messageType: CAPMessageType
    public let messageID: UInt16
    public let commandCode: UInt16
    public let payload: Data

    public init(messageType: CAPMessageType, messageID: UInt16, commandCode: UInt16, payload: Data = Data()) {
        self.messageType = messageType
        self.messageID = messageID
        self.commandCode = commandCode
        self.payload = payload
    }

    public func encode() -> Data {
        let totalLength = UInt16(7 + payload.count)
        var data = Data()
        data.append(contentsOf: [UInt8(totalLength >> 8), UInt8(totalLength & 0xFF)])
        data.append(messageType.rawValue)
        data.append(contentsOf: [UInt8(messageID >> 8), UInt8(messageID & 0xFF)])
        data.append(contentsOf: [UInt8(commandCode >> 8), UInt8(commandCode & 0xFF)])
        data.append(payload)
        return data
    }

    public static func decode(_ data: Data) throws -> CAPFrame {
        guard data.count >= 7 else {
            throw CAPFrameError.tooShort
        }

        let declaredLength = Int(data[0]) << 8 | Int(data[1])
        guard declaredLength == data.count else {
            throw CAPFrameError.invalidLength(expected: declaredLength, actual: data.count)
        }

        guard let messageType = CAPMessageType(rawValue: data[2]) else {
            throw CAPFrameError.unknownMessageType(data[2])
        }

        let messageID = UInt16(data[3]) << 8 | UInt16(data[4])
        let commandCode = UInt16(data[5]) << 8 | UInt16(data[6])
        let payload = data.dropFirst(7)

        return CAPFrame(messageType: messageType, messageID: messageID, commandCode: commandCode, payload: Data(payload))
    }
}
