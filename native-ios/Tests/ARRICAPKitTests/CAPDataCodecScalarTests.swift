import Foundation
import Testing
@testable import ARRICAPKit

@Test func uint16RoundTripsThroughCodec() throws {
    let encoded = CAPDataCodec.encodeUInt16(0x1234)
    let decoded = try CAPDataCodec.decodeUInt16(encoded)

    #expect(decoded == 0x1234)
}

@Test func uint32RoundTripsThroughCodec() throws {
    let encoded = CAPDataCodec.encodeUInt32(0x12345678)
    let decoded = try CAPDataCodec.decodeUInt32(encoded)

    #expect(decoded == 0x12345678)
}

@Test func float32RoundTripsThroughCodec() throws {
    let encoded = CAPDataCodec.encodeFloat32(24.0)
    let decoded = try CAPDataCodec.decodeFloat32(encoded)

    #expect(abs(decoded - 24.0) < 0.0001)
}

@Test func scalarCodecsRejectInvalidLengths() {
    #expect(throws: CAPDataCodecError.invalidScalarLength(expected: 2, actual: 1)) {
        try CAPDataCodec.decodeUInt16(Data([0x01]))
    }

    #expect(throws: CAPDataCodecError.invalidScalarLength(expected: 4, actual: 2)) {
        try CAPDataCodec.decodeUInt32(Data([0x01, 0x02]))
    }
}
