import Testing
@testable import CameraMocks
@testable import CameraDomain

@Test func mockFactoryProducesLFAnd35Descriptors() {
    let lf = MockCameraFactory.makeLF()
    let alexa35 = MockCameraFactory.make35()

    #expect(lf.family == .alexaLF)
    #expect(alexa35.family == .alexa35)
    #expect(lf.endpoint.port == 7777)
}
