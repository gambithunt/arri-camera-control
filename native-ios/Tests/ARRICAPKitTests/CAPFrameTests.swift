import Foundation
import Testing
@testable import ARRICAPKit

@Test func capFrameRoundTripsThroughEncodeDecode() throws {
    let frame = CAPFrame(messageType: .command, messageID: 42, commandCode: 0x0080, payload: Data([0x01, 0x02]))

    let encoded = frame.encode()
    let decoded = try CAPFrame.decode(encoded)

    #expect(decoded == frame)
}

@Test func capFrameRejectsShortPayload() {
    #expect(throws: CAPFrameError.tooShort) {
        try CAPFrame.decode(Data([0x00, 0x01]))
    }
}

@Test func capFrameRejectsLengthMismatch() {
    let badFrame = Data([0x00, 0x08, 0x01, 0x00, 0x01, 0x00, 0x80])

    #expect(throws: CAPFrameError.invalidLength(expected: 8, actual: 7)) {
        try CAPFrame.decode(badFrame)
    }
}
