import Foundation
import CameraDomain

public enum MockCameraFactory {
    public static func makeLF() -> CameraDescriptor {
        CameraDescriptor(
            identifier: CameraIdentifier("mock-lf"),
            displayName: "ARRI ALEXA LF",
            family: .alexaLF,
            endpoint: CameraEndpoint(host: "192.168.0.10", port: 7777),
            serialNumber: "LF12345",
            firmwareVersion: "1.0.0",
            discoverySource: .bonjour
        )
    }

    public static func make35() -> CameraDescriptor {
        CameraDescriptor(
            identifier: CameraIdentifier("mock-35"),
            displayName: "ARRI ALEXA 35",
            family: .alexa35,
            endpoint: CameraEndpoint(host: "192.168.0.11", port: 7777),
            serialNumber: "3501234",
            firmwareVersion: "1.0.0",
            discoverySource: .bonjour
        )
    }
}
