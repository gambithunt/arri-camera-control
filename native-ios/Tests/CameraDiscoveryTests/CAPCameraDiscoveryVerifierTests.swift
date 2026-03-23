import Foundation
import Testing
@testable import CameraDiscovery
@testable import CameraDomain
@testable import ARRICAPKit

@Test func capVerifierBuildsVerifiedDescriptorFromCameraIdentityQueries() async throws {
    let client = StubVerifierClient()
    let verifier = CAPCameraDiscoveryVerifier(clientFactory: { client })
    let service = BonjourServiceDescriptor(
        name: "ARRI Service",
        type: "_arri._tcp",
        endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777)
    )

    let candidate = try await verifier.verify(service: service)

    #expect(candidate?.descriptor.displayName == "ARRI ALEXA 35")
    #expect(candidate?.descriptor.family == .alexa35)
    #expect(candidate?.descriptor.serialNumber == "35SN123")
    #expect(candidate?.verificationState == .verified)
}

private actor StubVerifierClient: CAPClientProtocol {
    func connect(to endpoint: CameraEndpoint) async throws {}
    func disconnect() async {}

    func send(_ command: CAPCommand) async throws -> CAPReply {
        switch command {
        case .clientName:
            return CAPReply(messageID: 1, rawResultCode: CAPResultCode.ok.rawValue, payload: Data())
        case .getVariable(.cameraType):
            return CAPReply(messageID: 2, rawResultCode: CAPResultCode.ok.rawValue, payload: CAPDataCodec.encodeString("ARRI ALEXA 35"))
        case .getVariable(.cameraSerial):
            return CAPReply(messageID: 3, rawResultCode: CAPResultCode.ok.rawValue, payload: CAPDataCodec.encodeString("35SN123"))
        default:
            return CAPReply(messageID: 4, rawResultCode: CAPResultCode.ok.rawValue, payload: Data())
        }
    }

    func events() async -> AsyncStream<CAPEvent> {
        AsyncStream { continuation in
            continuation.finish()
        }
    }
}
