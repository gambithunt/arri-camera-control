import Foundation

public enum CAPVariableIdentifier: UInt16, CaseIterable, Sendable {
    case cameraType = 0x0001
    case cameraSerial = 0x0002
    case batteryVoltage = 0x0011
    case batteryCapacity = 0x0012
    case codecList = 0x0024
    case codec = 0x0025
    case recordingResolutionList = 0x0026
    case recordingResolution = 0x0027
    case cameraState = 0x0040
    case lookFilename = 0x0041
    case frameline = 0x0046
    case cdlValues = 0x0050
    case colorTemperature = 0x0051
    case tint = 0x0052
    case exposureIndex = 0x0053
    case currentReel = 0x005C
    case clipNumber = 0x005D
    case activeMedium = 0x005B
    case sensorFPS = 0x0061
    case shutterAngle = 0x0063
    case ndFilter = 0x0068
    case mediaStatus = 0x006D
    case remainingRecTime = 0x0072
    case timecode = 0x0078
    case timecodeRunMode = 0x007A
    case lastRecMedium = 0x007E
    case lastRecClipIndex = 0x007F
    case lensModel = 0x0080
    case lensIris = 0x0083
    case lensFocalLength = 0x0084
    case playbackClipIndex = 0x0085
    case textureList = 0x00A0
    case texture = 0x00A1
    case mvfUserButtons = 0x00D5
    case mvfUserButtonLEDs = 0x00D6
    case cameraUserButtons = 0x00D7
    case cameraUserButtonLEDs = 0x00D8
    case handUnitUserButtons = 0x00D9
    case handUnitUserButtonLEDs = 0x00DA
    case lbusDeviceUserButtons = 0x00DB
    case lbusDeviceUserButtonLEDs = 0x00DC
    case gpioUserButtons = 0x00DD
    case gpioUserButtonLEDs = 0x00DE
    case lensUserButtons = 0x00DF
    case lensUserButtonLEDs = 0x00E0
    case monitorUserButtons = 0x00E3
    case monitorUserButtonLEDs = 0x00E4
    case userButtonActions = 0x00E5
    case gpioUserButtonAction = 0x00E6
    case powerCapacity = 0x00E9
}

public enum CAPVariableValueError: Error, Equatable, Sendable {
    case unsupportedVariable(UInt16)
    case unsupportedEncoding(variableID: CAPVariableIdentifier, value: CAPVariableValue)
}

public enum CAPVariableValue: Equatable, Sendable {
    case string(String)
    case uInt16(UInt16)
    case uInt32(UInt32)
    case int32(Int32)
    case float32(Float)
    case opaque(Data)

    public static func decode(payload: Data, for variableID: CAPVariableIdentifier) throws -> CAPVariableValue {
        switch variableID {
        case .cameraType, .cameraSerial, .lookFilename, .frameline, .lensModel, .texture:
            return .string(try CAPDataCodec.decodeString(payload))
        case .cameraState,
            .codec,
            .recordingResolution,
            .currentReel,
            .clipNumber,
            .ndFilter,
            .activeMedium,
            .timecodeRunMode,
            .lastRecMedium,
            .lastRecClipIndex,
            .playbackClipIndex:
            return .uInt16(try CAPDataCodec.decodeUInt16(payload))
        case .sensorFPS, .shutterAngle, .tint, .batteryVoltage:
            return .float32(try CAPDataCodec.decodeFloat32(payload))
        case .colorTemperature, .exposureIndex, .timecode, .remainingRecTime, .batteryCapacity:
            return .uInt32(try CAPDataCodec.decodeUInt32(payload))
        case .lensIris, .lensFocalLength:
            return .int32(try CAPDataCodec.decodeInt32(payload))
        case .cdlValues,
            .codecList,
            .recordingResolutionList,
            .mediaStatus,
            .textureList,
            .mvfUserButtons,
            .mvfUserButtonLEDs,
            .cameraUserButtons,
            .cameraUserButtonLEDs,
            .handUnitUserButtons,
            .handUnitUserButtonLEDs,
            .lbusDeviceUserButtons,
            .lbusDeviceUserButtonLEDs,
            .gpioUserButtons,
            .gpioUserButtonLEDs,
            .lensUserButtons,
            .lensUserButtonLEDs,
            .monitorUserButtons,
            .monitorUserButtonLEDs,
            .userButtonActions,
            .gpioUserButtonAction,
            .powerCapacity:
            return .opaque(payload)
        }
    }

    public func encode(for variableID: CAPVariableIdentifier) throws -> Data {
        switch (variableID, self) {
        case ((.cameraType, .string(let value))),
            ((.cameraSerial, .string(let value))),
            ((.lookFilename, .string(let value))),
            ((.frameline, .string(let value))),
            ((.lensModel, .string(let value))),
            ((.texture, .string(let value))):
            return CAPDataCodec.encodeString(value)

        case ((.cameraState, .uInt16(let value))),
            ((.codec, .uInt16(let value))),
            ((.recordingResolution, .uInt16(let value))),
            ((.currentReel, .uInt16(let value))),
            ((.clipNumber, .uInt16(let value))),
            ((.ndFilter, .uInt16(let value))),
            ((.activeMedium, .uInt16(let value))),
            ((.timecodeRunMode, .uInt16(let value))),
            ((.lastRecMedium, .uInt16(let value))),
            ((.lastRecClipIndex, .uInt16(let value))),
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

        case ((.lensIris, .int32(let value))),
            ((.lensFocalLength, .int32(let value))):
            return CAPDataCodec.encodeInt32(value)

        case (.cdlValues, .opaque(let value)),
            (.codecList, .opaque(let value)),
            (.recordingResolutionList, .opaque(let value)),
            (.mediaStatus, .opaque(let value)),
            (.textureList, .opaque(let value)),
            (.mvfUserButtons, .opaque(let value)),
            (.mvfUserButtonLEDs, .opaque(let value)),
            (.cameraUserButtons, .opaque(let value)),
            (.cameraUserButtonLEDs, .opaque(let value)),
            (.handUnitUserButtons, .opaque(let value)),
            (.handUnitUserButtonLEDs, .opaque(let value)),
            (.lbusDeviceUserButtons, .opaque(let value)),
            (.lbusDeviceUserButtonLEDs, .opaque(let value)),
            (.gpioUserButtons, .opaque(let value)),
            (.gpioUserButtonLEDs, .opaque(let value)),
            (.lensUserButtons, .opaque(let value)),
            (.lensUserButtonLEDs, .opaque(let value)),
            (.monitorUserButtons, .opaque(let value)),
            (.monitorUserButtonLEDs, .opaque(let value)),
            (.userButtonActions, .opaque(let value)),
            (.gpioUserButtonAction, .opaque(let value)),
            (.powerCapacity, .opaque(let value)):
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
