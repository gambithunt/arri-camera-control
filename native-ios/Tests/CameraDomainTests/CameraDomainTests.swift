import Testing
@testable import CameraDomain

@Test func baselineCapabilitiesCoverLFAnd35() {
    let families = Set(CameraFamily.allCases)
    #expect(families == [.alexaLF, .alexa35])
    #expect(CameraCapabilities.baseline(for: .alexaLF).supportsFrameGrab)
    #expect(CameraCapabilities.baseline(for: .alexa35).supportsPlayback)
}

@Test func cameraDescriptorStoresIdentityAndEndpoint() {
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-1"),
        displayName: "ARRI ALEXA LF",
        family: .alexaLF,
        endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777),
        discoverySource: .manual
    )

    #expect(descriptor.identifier.value == "camera-1")
    #expect(descriptor.endpoint.host == "10.0.0.8")
    #expect(descriptor.endpoint.port == 7777)
}
