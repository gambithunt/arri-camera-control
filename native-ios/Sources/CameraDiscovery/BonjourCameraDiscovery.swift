import Foundation
import Darwin
import CameraDomain

public struct BonjourServiceDescriptor: Equatable, Sendable {
    public let name: String
    public let type: String
    public let endpoint: CameraEndpoint

    public init(name: String, type: String, endpoint: CameraEndpoint) {
        self.name = name
        self.type = type
        self.endpoint = endpoint
    }
}

public protocol BonjourBrowsing: Sendable {
    func browse(serviceTypes: [String]) -> AsyncStream<BonjourServiceDescriptor>
}

public protocol CameraDiscoveryVerifying: Sendable {
    func verify(service: BonjourServiceDescriptor) async throws -> DiscoveryCandidate?
}

public protocol CameraDiscoveryCoordinating: CameraDiscovering {
    func start() async
    func stop() async
    func updates() async -> AsyncStream<[DiscoveryCandidate]>
}

public actor BonjourCameraDiscovery: CameraDiscoveryCoordinating {
    private let browser: any BonjourBrowsing
    private let verifier: any CameraDiscoveryVerifying
    private let serviceTypes: [String]
    private let registry: DiscoveryRegistry
    private var browserTask: Task<Void, Never>?
    private var updateContinuations: [UUID: AsyncStream<[DiscoveryCandidate]>.Continuation] = [:]

    public init(
        browser: any BonjourBrowsing,
        verifier: any CameraDiscoveryVerifying,
        serviceTypes: [String],
        registry: DiscoveryRegistry = DiscoveryRegistry()
    ) {
        self.browser = browser
        self.verifier = verifier
        self.serviceTypes = serviceTypes
        self.registry = registry
    }

    public func start() async {
        guard browserTask == nil else {
            return
        }

        let stream = browser.browse(serviceTypes: serviceTypes)
        browserTask = Task {
            for await service in stream {
                guard !Task.isCancelled else {
                    break
                }

                do {
                    if let candidate = try await verifier.verify(service: service) {
                        await registry.ingest(candidate)
                        let candidates = await registry.candidates()
                        publish(candidates)
                    }
                } catch {
                    continue
                }
            }
        }
    }

    public func stop() async {
        browserTask?.cancel()
        browserTask = nil
        for continuation in updateContinuations.values {
            continuation.finish()
        }
        updateContinuations.removeAll()
    }

    public func candidates() async -> [DiscoveryCandidate] {
        await registry.candidates()
    }

    public func updates() async -> AsyncStream<[DiscoveryCandidate]> {
        AsyncStream { continuation in
            let id = UUID()
            updateContinuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeContinuation(id: id)
                }
            }
        }
    }

    private func publish(_ candidates: [DiscoveryCandidate]) {
        for continuation in updateContinuations.values {
            continuation.yield(candidates)
        }
    }

    private func removeContinuation(id: UUID) {
        updateContinuations.removeValue(forKey: id)
    }
}

public final class NetServiceBonjourBrowser: BonjourBrowsing, @unchecked Sendable {
    public init() {}

    public func browse(serviceTypes: [String]) -> AsyncStream<BonjourServiceDescriptor> {
        AsyncStream { continuation in
            let coordinator = NetServiceBrowserCoordinator(serviceTypes: serviceTypes, continuation: continuation)
            coordinator.start()
            continuation.onTermination = { @Sendable _ in
                coordinator.stop()
            }
        }
    }
}

private final class NetServiceBrowserCoordinator: NSObject, NetServiceBrowserDelegate, NetServiceDelegate, @unchecked Sendable {
    private let serviceTypes: [String]
    private let continuation: AsyncStream<BonjourServiceDescriptor>.Continuation
    private var browsers: [NetServiceBrowser] = []
    private var services: [NetService] = []

    init(serviceTypes: [String], continuation: AsyncStream<BonjourServiceDescriptor>.Continuation) {
        self.serviceTypes = serviceTypes
        self.continuation = continuation
    }

    func start() {
        for type in serviceTypes {
            let browser = NetServiceBrowser()
            browser.delegate = self
            browsers.append(browser)
            browser.searchForServices(ofType: type, inDomain: "local.")
        }
    }

    func stop() {
        browsers.forEach { $0.stop() }
        services.forEach { $0.stop() }
        browsers.removeAll()
        services.removeAll()
        continuation.finish()
    }

    func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
        service.delegate = self
        services.append(service)
        service.resolve(withTimeout: 5)
    }

    func netServiceDidResolveAddress(_ sender: NetService) {
        guard
            let endpoint = sender.addresses?.lazy.compactMap(Self.endpoint(from:)).first
        else {
            return
        }

        continuation.yield(BonjourServiceDescriptor(name: sender.name, type: sender.type, endpoint: endpoint))
    }

    func netService(_ sender: NetService, didNotResolve errorDict: [String : NSNumber]) {}

    private static func endpoint(from data: Data) -> CameraEndpoint? {
        data.withUnsafeBytes { (rawBuffer: UnsafeRawBufferPointer) -> CameraEndpoint? in
            guard let baseAddress = rawBuffer.baseAddress else {
                return nil
            }

            let sockaddr = baseAddress.assumingMemoryBound(to: sockaddr.self).pointee
            switch Int32(sockaddr.sa_family) {
            case AF_INET:
                let address = baseAddress.assumingMemoryBound(to: sockaddr_in.self).pointee
                var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                var addressCopy = address
                let result = getnameinfo(
                    withUnsafePointer(to: &addressCopy) {
                        $0.withMemoryRebound(to: Darwin.sockaddr.self, capacity: 1) { $0 }
                    },
                    socklen_t(MemoryLayout<sockaddr_in>.size),
                    &hostBuffer,
                    socklen_t(hostBuffer.count),
                    nil,
                    0,
                    NI_NUMERICHOST
                )

                guard result == 0 else {
                    return nil
                }

                return CameraEndpoint(
                    host: string(from: hostBuffer),
                    port: Int(UInt16(bigEndian: address.sin_port))
                )

            case AF_INET6:
                let address = baseAddress.assumingMemoryBound(to: sockaddr_in6.self).pointee
                var hostBuffer = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                var addressCopy = address
                let result = getnameinfo(
                    withUnsafePointer(to: &addressCopy) {
                        $0.withMemoryRebound(to: Darwin.sockaddr.self, capacity: 1) { $0 }
                    },
                    socklen_t(MemoryLayout<sockaddr_in6>.size),
                    &hostBuffer,
                    socklen_t(hostBuffer.count),
                    nil,
                    0,
                    NI_NUMERICHOST
                )

                guard result == 0 else {
                    return nil
                }

                return CameraEndpoint(
                    host: string(from: hostBuffer),
                    port: Int(UInt16(bigEndian: address.sin6_port))
                )

            default:
                return nil
            }
        }
    }

    private static func string(from hostBuffer: [CChar]) -> String {
        let bytes = hostBuffer.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }
        return String(decoding: bytes, as: UTF8.self)
    }
}
