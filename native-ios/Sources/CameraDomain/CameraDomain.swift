import Foundation

public enum CameraFamily: String, CaseIterable, Codable, Sendable {
    case alexaLF = "LF"
    case alexa35 = "35"
}

public enum DiscoverySource: String, Codable, Sendable {
    case bonjour
    case manual
    case subnetScan
}

public struct CameraIdentifier: Hashable, Codable, Sendable {
    public let value: String

    public init(_ value: String) {
        self.value = value
    }
}

public struct CameraEndpoint: Equatable, Codable, Sendable {
    public let host: String
    public let port: Int

    public init(host: String, port: Int) {
        self.host = host
        self.port = port
    }
}

public struct CameraDescriptor: Equatable, Codable, Sendable {
    public let identifier: CameraIdentifier
    public let displayName: String
    public let family: CameraFamily
    public let endpoint: CameraEndpoint
    public let serialNumber: String?
    public let firmwareVersion: String?
    public let discoverySource: DiscoverySource

    public init(
        identifier: CameraIdentifier,
        displayName: String,
        family: CameraFamily,
        endpoint: CameraEndpoint,
        serialNumber: String? = nil,
        firmwareVersion: String? = nil,
        discoverySource: DiscoverySource
    ) {
        self.identifier = identifier
        self.displayName = displayName
        self.family = family
        self.endpoint = endpoint
        self.serialNumber = serialNumber
        self.firmwareVersion = firmwareVersion
        self.discoverySource = discoverySource
    }
}

public struct CameraCapabilities: Equatable, Sendable {
    public func isSupported(_ operation: CameraOperation) -> Bool {
        switch operation {
        case .frameGrab:
            supportsFrameGrab
        case .playbackTransport:
            supportsPlayback
        case .timecodeControl:
            supportsTimecodeControl
        case .lookManagement:
            supportsLookManagement
        }
    }

    public let family: CameraFamily
    public let supportsDiscovery: Bool
    public let supportsFrameGrab: Bool
    public let supportsPlayback: Bool
    public let supportsTimecodeControl: Bool
    public let supportsLookManagement: Bool

    public init(
        family: CameraFamily,
        supportsDiscovery: Bool,
        supportsFrameGrab: Bool,
        supportsPlayback: Bool,
        supportsTimecodeControl: Bool,
        supportsLookManagement: Bool
    ) {
        self.family = family
        self.supportsDiscovery = supportsDiscovery
        self.supportsFrameGrab = supportsFrameGrab
        self.supportsPlayback = supportsPlayback
        self.supportsTimecodeControl = supportsTimecodeControl
        self.supportsLookManagement = supportsLookManagement
    }

    public static func baseline(for family: CameraFamily) -> CameraCapabilities {
        switch family {
        case .alexaLF:
            return CameraCapabilities(
                family: family,
                supportsDiscovery: true,
                supportsFrameGrab: true,
                supportsPlayback: true,
                supportsTimecodeControl: true,
                supportsLookManagement: true
            )
        case .alexa35:
            return CameraCapabilities(
                family: family,
                supportsDiscovery: true,
                supportsFrameGrab: true,
                supportsPlayback: true,
                supportsTimecodeControl: true,
                supportsLookManagement: true
            )
        }
    }
}
