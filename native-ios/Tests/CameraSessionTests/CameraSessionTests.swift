import Foundation
import Testing
@testable import CameraSession
@testable import CameraDomain
@testable import ARRICAPKit
@testable import CameraDiagnostics

@Test func sessionConnectTransitionsThroughHandshakeStatesAndSubscriptions() async throws {
    let client = StubCAPClient()
    let logger = InMemoryDiagnosticLogger()
    let session = CameraSession(
        client: client,
        logger: logger,
        subscriptionVariables: [.cameraState, .sensorFPS, .timecode]
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-1"),
        displayName: "ARRI ALEXA LF",
        family: .alexaLF,
        endpoint: CameraEndpoint(host: "10.0.0.8", port: 7777),
        discoverySource: .manual
    )

    await session.beginDiscovery()
    #expect(await session.currentState() == .discovering)

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: "1234")

    #expect(await session.currentState() == .connected(descriptor))
    #expect(await client.connectedEndpoint == descriptor.endpoint)
    #expect(await client.sentCommands == [
        .clientName("ARRI Control"),
        .requestPasswordChallenge,
        .password("1234"),
        .requestVariables([.cameraState, .sensorFPS, .timecode])
    ])
}

@Test func sessionMovesToFailedStateWhenHandshakeCommandThrows() async {
    let client = StubCAPClient(commandError: CAPClientError.commandFailed(resultCode: .notAuthorized))
    let session = CameraSession(
        client: client,
        logger: InMemoryDiagnosticLogger(),
        subscriptionVariables: [.cameraState]
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-2"),
        displayName: "ARRI ALEXA 35",
        family: .alexa35,
        endpoint: CameraEndpoint(host: "10.0.0.9", port: 7777),
        discoverySource: .manual
    )

    do {
        try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
        Issue.record("Expected session connect to fail")
    } catch {
        #expect(await session.currentState() == .failed(camera: descriptor, reason: "commandFailed(resultCode: Optional(ARRICAPKit.CAPResultCode.notAuthorized))"))
    }
}

@Test func sessionPublishesVariableUpdatesFromClientEvents() async throws {
    let client = StubCAPClient()
    let session = CameraSession(
        client: client,
        logger: InMemoryDiagnosticLogger(),
        subscriptionVariables: [.sensorFPS]
    )
    let updates = await session.variableUpdates()
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-3"),
        displayName: "ARRI ALEXA LF",
        family: .alexaLF,
        endpoint: CameraEndpoint(host: "10.0.0.10", port: 7777),
        discoverySource: .manual
    )

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
    await client.emitEvent(
        CAPEvent(
            messageID: 200,
            eventCode: CAPVariableIdentifier.sensorFPS.rawValue,
            payload: CAPDataCodec.encodeFloat32(24.0)
        )
    )

    var iterator = updates.makeAsyncIterator()
    let update = try #require(await iterator.next())

    #expect(update.variableID == .sensorFPS)
    #expect(update.value == .float32(24.0))
}

private actor StubCAPClient: CAPClientProtocol {
    private(set) var connectedEndpoint: CameraEndpoint?
    private(set) var sentCommands: [CAPCommand] = []
    private let commandError: Error?
    private var eventContinuations: [UUID: AsyncStream<CAPEvent>.Continuation] = [:]

    init(commandError: Error? = nil) {
        self.commandError = commandError
    }

    func connect(to endpoint: CameraEndpoint) async throws {
        connectedEndpoint = endpoint
    }

    func disconnect() async {
        connectedEndpoint = nil
    }

    func send(_ command: CAPCommand) async throws -> CAPReply {
        sentCommands.append(command)
        if let commandError {
            throw commandError
        }

        return CAPReply(messageID: UInt16(sentCommands.count), rawResultCode: CAPResultCode.ok.rawValue, payload: Data())
    }

    func events() async -> AsyncStream<CAPEvent> {
        AsyncStream { continuation in
            let id = UUID()
            eventContinuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeContinuation(id: id)
                }
            }
        }
    }

    func emitEvent(_ event: CAPEvent) {
        for continuation in eventContinuations.values {
            continuation.yield(event)
        }
    }

    private func removeContinuation(id: UUID) {
        eventContinuations.removeValue(forKey: id)
    }
}
