import Foundation
import ARRICAPKit
import CameraDomain

public final class CAPCameraDiscoveryVerifier: CameraDiscoveryVerifying, @unchecked Sendable {
    private let clientFactory: @Sendable () -> any CAPClientProtocol
    private let clientName: String

    public init(
        clientFactory: @escaping @Sendable () -> any CAPClientProtocol,
        clientName: String = "ARRI Control Discovery"
    ) {
        self.clientFactory = clientFactory
        self.clientName = clientName
    }

    public func verify(service: BonjourServiceDescriptor) async throws -> DiscoveryCandidate? {
        let client = clientFactory()
        try await client.connect(to: service.endpoint)
        defer {
            Task {
                await client.disconnect()
            }
        }

        _ = try await client.send(.clientName(clientName))
        let cameraTypeReply = try await client.send(.getVariable(.cameraType))
        let cameraSerialReply = try? await client.send(.getVariable(.cameraSerial))

        guard case let .string(cameraType) = try cameraTypeReply.decodeValue(for: .cameraType) else {
            return nil
        }

        let serialNumber: String?
        if let cameraSerialReply,
           case let .string(value) = try cameraSerialReply.decodeValue(for: .cameraSerial) {
            serialNumber = value
        } else {
            serialNumber = nil
        }

        let family: CameraFamily = cameraType.localizedCaseInsensitiveContains("35") ? .alexa35 : .alexaLF

        return DiscoveryCandidate(
            descriptor: CameraDescriptor(
                identifier: CameraIdentifier(serialNumber ?? service.endpoint.host),
                displayName: cameraType,
                family: family,
                endpoint: service.endpoint,
                serialNumber: serialNumber,
                discoverySource: .bonjour
            ),
            verificationState: .verified
        )
    }
}
