import Foundation
import CameraDomain

public enum DiscoveryVerificationState: Equatable, Sendable {
    case discovered
    case verified
    case rejected(reason: String)

    fileprivate var rank: Int {
        switch self {
        case .verified:
            return 2
        case .discovered:
            return 1
        case .rejected:
            return 0
        }
    }
}

public struct DiscoveryCandidate: Equatable, Sendable {
    public let descriptor: CameraDescriptor
    public let verificationState: DiscoveryVerificationState

    public init(descriptor: CameraDescriptor, verificationState: DiscoveryVerificationState) {
        self.descriptor = descriptor
        self.verificationState = verificationState
    }
}

public protocol CameraDiscovering: Sendable {
    func candidates() async -> [DiscoveryCandidate]
}

public actor DiscoveryRegistry: CameraDiscovering {
    private var storage: [CameraIdentifier: DiscoveryCandidate] = [:]

    public init() {}

    public func ingest(_ candidate: DiscoveryCandidate) {
        guard let existing = storage[candidate.descriptor.identifier] else {
            storage[candidate.descriptor.identifier] = candidate
            return
        }

        if shouldReplace(existing: existing, with: candidate) {
            storage[candidate.descriptor.identifier] = merge(existing: candidate, with: existing)
        } else {
            storage[candidate.descriptor.identifier] = merge(existing: existing, with: candidate)
        }
    }

    public func candidates() async -> [DiscoveryCandidate] {
        storage.values.sorted { lhs, rhs in
            lhs.descriptor.displayName < rhs.descriptor.displayName
        }
    }

    private func shouldReplace(existing: DiscoveryCandidate, with candidate: DiscoveryCandidate) -> Bool {
        if candidate.verificationState.rank != existing.verificationState.rank {
            return candidate.verificationState.rank > existing.verificationState.rank
        }

        let existingMetadataCount = metadataCount(for: existing.descriptor)
        let candidateMetadataCount = metadataCount(for: candidate.descriptor)
        return candidateMetadataCount >= existingMetadataCount
    }

    private func metadataCount(for descriptor: CameraDescriptor) -> Int {
        [descriptor.serialNumber, descriptor.firmwareVersion].compactMap { $0 }.count
    }

    private func merge(existing primary: DiscoveryCandidate, with secondary: DiscoveryCandidate) -> DiscoveryCandidate {
        let descriptor = CameraDescriptor(
            identifier: primary.descriptor.identifier,
            displayName: primary.descriptor.displayName,
            family: primary.descriptor.family,
            endpoint: primary.descriptor.endpoint,
            serialNumber: primary.descriptor.serialNumber ?? secondary.descriptor.serialNumber,
            firmwareVersion: primary.descriptor.firmwareVersion ?? secondary.descriptor.firmwareVersion,
            discoverySource: primary.descriptor.discoverySource
        )

        return DiscoveryCandidate(descriptor: descriptor, verificationState: primary.verificationState)
    }
}
