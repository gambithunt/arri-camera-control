import Foundation

public enum CAPDataCodecError: Error, Equatable, Sendable {
    case invalidStringLength(expected: Int, actual: Int)
    case invalidUInt16ArrayLength(Int)
    case invalidScalarLength(expected: Int, actual: Int)
}

public enum CAPDataCodec {
    public static func encodeUInt8(_ value: UInt8) -> Data {
        Data([value])
    }

    public static func decodeUInt8(_ data: Data) throws -> UInt8 {
        guard data.count == 1 else {
            throw CAPDataCodecError.invalidScalarLength(expected: 1, actual: data.count)
        }

        return data[0]
    }

    public static func encodeUInt16(_ value: UInt16) -> Data {
        Data([UInt8(value >> 8), UInt8(value & 0xFF)])
    }

    public static func decodeUInt16(_ data: Data) throws -> UInt16 {
        guard data.count == 2 else {
            throw CAPDataCodecError.invalidScalarLength(expected: 2, actual: data.count)
        }

        return UInt16(data[0]) << 8 | UInt16(data[1])
    }

    public static func encodeUInt32(_ value: UInt32) -> Data {
        Data([
            UInt8((value >> 24) & 0xFF),
            UInt8((value >> 16) & 0xFF),
            UInt8((value >> 8) & 0xFF),
            UInt8(value & 0xFF)
        ])
    }

    public static func decodeUInt32(_ data: Data) throws -> UInt32 {
        guard data.count == 4 else {
            throw CAPDataCodecError.invalidScalarLength(expected: 4, actual: data.count)
        }

        return UInt32(data[0]) << 24
            | UInt32(data[1]) << 16
            | UInt32(data[2]) << 8
            | UInt32(data[3])
    }

    public static func encodeInt32(_ value: Int32) -> Data {
        encodeUInt32(UInt32(bitPattern: value))
    }

    public static func decodeInt32(_ data: Data) throws -> Int32 {
        Int32(bitPattern: try decodeUInt32(data))
    }

    public static func encodeFloat32(_ value: Float) -> Data {
        encodeUInt32(value.bitPattern)
    }

    public static func decodeFloat32(_ data: Data) throws -> Float {
        Float(bitPattern: try decodeUInt32(data))
    }

    public static func encodeString(_ string: String) -> Data {
        let utf8 = Data(string.utf8)
        var payload = Data()
        let length = UInt16(utf8.count)
        payload.append(contentsOf: [UInt8(length >> 8), UInt8(length & 0xFF)])
        payload.append(utf8)
        return payload
    }

    public static func decodeString(_ data: Data) throws -> String {
        guard data.count >= 2 else {
            throw CAPDataCodecError.invalidStringLength(expected: 2, actual: data.count)
        }

        let length = Int(data[0]) << 8 | Int(data[1])
        let actualLength = data.count - 2
        guard actualLength == length else {
            throw CAPDataCodecError.invalidStringLength(expected: length, actual: actualLength)
        }

        return String(decoding: data.dropFirst(2), as: UTF8.self)
    }

    public static func encodeUInt16Array(_ values: [UInt16]) -> Data {
        var data = Data()
        for value in values {
            data.append(contentsOf: [UInt8(value >> 8), UInt8(value & 0xFF)])
        }
        return data
    }

    public static func decodeUInt16Array(_ data: Data) throws -> [UInt16] {
        guard data.count.isMultiple(of: 2) else {
            throw CAPDataCodecError.invalidUInt16ArrayLength(data.count)
        }

        var values: [UInt16] = []
        values.reserveCapacity(data.count / 2)

        var index = 0
        while index < data.count {
            let value = UInt16(data[index]) << 8 | UInt16(data[index + 1])
            values.append(value)
            index += 2
        }

        return values
    }
}
