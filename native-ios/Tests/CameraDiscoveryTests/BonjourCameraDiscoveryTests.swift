import Foundation
import Testing
@testable import CameraDiscovery
@testable import CameraDomain

@Test func bonjourDiscoveryVerifiesServicesAndPublishesCandidates() async throws {
    let browser = StubBonjourBrowser()
    let verifier = StubDiscoveryVerifier()
    let discovery = BonjourCameraDiscovery(
        browser: browser,
        verifier: verifier,
        serviceTypes: ["_arri._tcp"]
    )

    let updates = await discovery.updates()
    await discovery.start()

    browser.yield(
        BonjourServiceDescriptor(
            name: "ARRI LF",
            type: "_arri._tcp",
            endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777)
        )
    )

    var iterator = updates.makeAsyncIterator()
    let firstUpdate = try #require(await iterator.next())

    #expect(firstUpdate.count == 1)
    #expect(firstUpdate[0].descriptor.displayName == "ARRI ALEXA LF")
    #expect(firstUpdate[0].verificationState == .verified)
}

private final class StubBonjourBrowser: BonjourBrowsing, @unchecked Sendable {
    private let lock = NSLock()
    private var continuations: [UUID: AsyncStream<BonjourServiceDescriptor>.Continuation] = [:]

    func browse(serviceTypes: [String]) -> AsyncStream<BonjourServiceDescriptor> {
        AsyncStream { continuation in
            let id = UUID()
            self.lock.lock()
            continuations[id] = continuation
            self.lock.unlock()
            continuation.onTermination = { @Sendable _ in
                self.removeContinuation(id: id)
            }
        }
    }

    func yield(_ descriptor: BonjourServiceDescriptor) {
        lock.lock()
        let activeContinuations = Array(continuations.values)
        lock.unlock()

        for continuation in activeContinuations {
            continuation.yield(descriptor)
        }
    }

    private func removeContinuation(id: UUID) {
        lock.lock()
        continuations.removeValue(forKey: id)
        lock.unlock()
    }
}

private actor StubDiscoveryVerifier: CameraDiscoveryVerifying {
    func verify(service: BonjourServiceDescriptor) async throws -> DiscoveryCandidate? {
        DiscoveryCandidate(
            descriptor: CameraDescriptor(
                identifier: CameraIdentifier(service.endpoint.host),
                displayName: "ARRI ALEXA LF",
                family: .alexaLF,
                endpoint: service.endpoint,
                serialNumber: "LF12345",
                firmwareVersion: "1.0.0",
                discoverySource: .bonjour
            ),
            verificationState: .verified
        )
    }
}
