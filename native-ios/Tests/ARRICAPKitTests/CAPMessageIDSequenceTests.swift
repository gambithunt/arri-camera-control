import Testing
@testable import ARRICAPKit

@Test func messageIDSequenceIncrementsAndWrapsToOne() {
    var sequence = CAPMessageIDSequence(startingAt: UInt16.max)

    #expect(sequence.next() == UInt16.max)
    #expect(sequence.next() == 1)
    #expect(sequence.next() == 2)
}
