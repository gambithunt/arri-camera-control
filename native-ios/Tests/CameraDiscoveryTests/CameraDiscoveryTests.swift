import Testing
@testable import CameraDiscovery
@testable import CameraDomain

@Test func discoveryCandidatePreservesVerificationState() {
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("discovered-camera"),
        displayName: "ARRI ALEXA 35",
        family: .alexa35,
        endpoint: CameraEndpoint(host: "10.0.0.9", port: 7777),
        discoverySource: .bonjour
    )

    let candidate = DiscoveryCandidate(descriptor: descriptor, verificationState: .verified)
    #expect(candidate.verificationState == .verified)
    #expect(candidate.descriptor.family == .alexa35)
}

@Test func registryPromotesLaterVerifiedCandidateAndKeepsBestDescriptorData() async {
    let registry = DiscoveryRegistry()
    let discovered = DiscoveryCandidate(
        descriptor: CameraDescriptor(
            identifier: CameraIdentifier("camera-1"),
            displayName: "ARRI Camera",
            family: .alexaLF,
            endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777),
            discoverySource: .bonjour
        ),
        verificationState: .discovered
    )
    let verified = DiscoveryCandidate(
        descriptor: CameraDescriptor(
            identifier: CameraIdentifier("camera-1"),
            displayName: "ARRI ALEXA LF",
            family: .alexaLF,
            endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777),
            serialNumber: "LF12345",
            firmwareVersion: "1.2.3",
            discoverySource: .bonjour
        ),
        verificationState: .verified
    )

    await registry.ingest(discovered)
    await registry.ingest(verified)
    let candidates = await registry.candidates()

    #expect(candidates.count == 1)
    #expect(candidates[0].verificationState == .verified)
    #expect(candidates[0].descriptor.displayName == "ARRI ALEXA LF")
    #expect(candidates[0].descriptor.serialNumber == "LF12345")
}
