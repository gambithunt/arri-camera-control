import Foundation

public enum CAPVariableIdentifier: UInt16, CaseIterable, Sendable {
    case cameraType = 0x0001
    case cameraSerial = 0x0002
    case batteryVoltage = 0x0011
    case batteryCapacity = 0x0012
    case cameraState = 0x0040
    case lookFilename = 0x0041
    case cdlValues = 0x0050
    case colorTemperature = 0x0051
    case tint = 0x0052
    case exposureIndex = 0x0053
    case activeMedium = 0x005B
    case sensorFPS = 0x0061
    case shutterAngle = 0x0063
    case ndFilter = 0x0068
    case mediaStatus = 0x006D
    case remainingRecTime = 0x0072
    case timecode = 0x0078
    case timecodeRunMode = 0x007A
    case playbackClipIndex = 0x0085
}

public enum CAPVariableValueError: Error, Equatable, Sendable {
    case unsupportedVariable(UInt16)
    case unsupportedEncoding(variableID: CAPVariableIdentifier, value: CAPVariableValue)
}

public enum CAPVariableValue: Equatable, Sendable {
    case string(String)
    case uInt16(UInt16)
    case uInt32(UInt32)
    case float32(Float)
    case opaque(Data)

    public static func decode(payload: Data, for variableID: CAPVariableIdentifier) throws -> CAPVariableValue {
        switch variableID {
        case .cameraType, .cameraSerial, .lookFilename:
            return .string(try CAPDataCodec.decodeString(payload))
        case .cameraState, .ndFilter, .mediaStatus, .activeMedium, .timecodeRunMode, .playbackClipIndex:
            return .uInt16(try CAPDataCodec.decodeUInt16(payload))
        case .sensorFPS, .shutterAngle, .tint, .batteryVoltage:
            return .float32(try CAPDataCodec.decodeFloat32(payload))
        case .colorTemperature, .exposureIndex, .timecode, .remainingRecTime, .batteryCapacity:
            return .uInt32(try CAPDataCodec.decodeUInt32(payload))
        case .cdlValues:
            return .opaque(payload)
        }
    }

    public func encode(for variableID: CAPVariableIdentifier) throws -> Data {
        switch (variableID, self) {
        case ((.cameraType, .string(let value))),
            ((.cameraSerial, .string(let value))),
            ((.lookFilename, .string(let value))):
            return CAPDataCodec.encodeString(value)

        case ((.cameraState, .uInt16(let value))),
            ((.ndFilter, .uInt16(let value))),
            ((.mediaStatus, .uInt16(let value))),
            ((.activeMedium, .uInt16(let value))),
            ((.timecodeRunMode, .uInt16(let value))),
            ((.playbackClipIndex, .uInt16(let value))):
            return CAPDataCodec.encodeUInt16(value)

        case ((.sensorFPS, .float32(let value))),
            ((.shutterAngle, .float32(let value))),
            ((.tint, .float32(let value))),
            ((.batteryVoltage, .float32(let value))):
            return CAPDataCodec.encodeFloat32(value)

        case ((.colorTemperature, .uInt32(let value))),
            ((.exposureIndex, .uInt32(let value))),
            ((.timecode, .uInt32(let value))),
            ((.remainingRecTime, .uInt32(let value))),
            ((.batteryCapacity, .uInt32(let value))):
            return CAPDataCodec.encodeUInt32(value)

        case (.cdlValues, .opaque(let value)):
            return value

        default:
            throw CAPVariableValueError.unsupportedEncoding(variableID: variableID, value: self)
        }
    }
}

public struct CAPVariablePayload: Equatable, Sendable {
    public let variableID: CAPVariableIdentifier
    public let value: CAPVariableValue

    public init(variableID: CAPVariableIdentifier, value: CAPVariableValue) {
        self.variableID = variableID
        self.value = value
    }

    public func encode() throws -> Data {
        var data = CAPDataCodec.encodeUInt16(variableID.rawValue)
        data.append(try value.encode(for: variableID))
        return data
    }

    public static func decode(_ data: Data) throws -> CAPVariablePayload {
        let variableIDData = Data(data.prefix(2))
        let valueData = Data(data.dropFirst(2))
        let rawVariableID = try CAPDataCodec.decodeUInt16(variableIDData)
        guard let variableID = CAPVariableIdentifier(rawValue: rawVariableID) else {
            throw CAPVariableValueError.unsupportedVariable(rawVariableID)
        }

        return CAPVariablePayload(
            variableID: variableID,
            value: try CAPVariableValue.decode(payload: valueData, for: variableID)
        )
    }
}

public struct CAPVariableUpdate: Equatable, Sendable {
    public let variableID: CAPVariableIdentifier
    public let value: CAPVariableValue

    public init(variableID: CAPVariableIdentifier, value: CAPVariableValue) {
        self.variableID = variableID
        self.value = value
    }
}

public struct CAPMessageIDSequence: Equatable, Sendable {
    private var current: UInt16

    public init(startingAt current: UInt16 = 1) {
        self.current = current == 0 ? 1 : current
    }

    public mutating func next() -> UInt16 {
        let nextValue = current
        current = current == UInt16.max ? 1 : current + 1
        return nextValue
    }
}
