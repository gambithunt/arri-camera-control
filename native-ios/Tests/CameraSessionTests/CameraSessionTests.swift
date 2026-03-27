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

    await session.disconnect()
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

    await session.disconnect()
}

@Test func sessionMovesToFailedStateWhenEventStreamEndsUnexpectedly() async throws {
    let client = StubCAPClient()
    let logger = InMemoryDiagnosticLogger()
    let session = CameraSession(
        client: client,
        logger: logger,
        subscriptionVariables: [.sensorFPS],
        maxReconnectAttempts: 0,
        reconnectDelay: .zero,
        staleTimeout: .zero,
        sleep: { _ in }
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-4"),
        displayName: "ARRI ALEXA 35",
        family: .alexa35,
        endpoint: CameraEndpoint(host: "10.0.0.11", port: 7777),
        discoverySource: .manual
    )

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
    await client.finishEvents()
    try await Task.sleep(for: .milliseconds(50))

    #expect(await session.currentState() == .failed(camera: descriptor, reason: "eventStreamEnded"))
    #expect(logger.events.last?.message.contains("Event stream ended") == true)

    await session.disconnect()
}

@Test func sessionReconnectsAfterUnexpectedEventStreamEnd() async throws {
    let client = StubCAPClient()
    let logger = InMemoryDiagnosticLogger()
    let session = CameraSession(
        client: client,
        logger: logger,
        subscriptionVariables: [.cameraState, .sensorFPS],
        maxReconnectAttempts: 1,
        reconnectDelay: .zero,
        staleTimeout: .zero,
        sleep: { _ in }
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-5"),
        displayName: "ARRI ALEXA LF",
        family: .alexaLF,
        endpoint: CameraEndpoint(host: "10.0.0.12", port: 7777),
        discoverySource: .manual
    )

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
    await client.finishEvents()
    try await Task.sleep(for: .milliseconds(50))

    #expect(await session.currentState() == .connected(descriptor))
    #expect(await client.connectCount == 2)
    #expect(await client.sentCommands == [
        .clientName("ARRI Control"),
        .requestVariables([.cameraState, .sensorFPS]),
        .clientName("ARRI Control"),
        .requestVariables([.cameraState, .sensorFPS])
    ])
    #expect(logger.events.last?.message.contains("Reconnected") == true)

    await session.disconnect()
}

@Test func sessionFailsWhenReconnectAttemptsAreExhausted() async throws {
    let client = StubCAPClient()
    let logger = InMemoryDiagnosticLogger()
    let session = CameraSession(
        client: client,
        logger: logger,
        subscriptionVariables: [.cameraState],
        maxReconnectAttempts: 1,
        reconnectDelay: .zero,
        staleTimeout: .zero,
        sleep: { _ in }
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-6"),
        displayName: "ARRI ALEXA 35",
        family: .alexa35,
        endpoint: CameraEndpoint(host: "10.0.0.13", port: 7777),
        discoverySource: .manual
    )

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
    await client.enqueueConnectError(CAPNetworkTransportError.connectionFailed("linkDown"))
    await client.finishEvents()
    try await Task.sleep(for: .milliseconds(50))

    #expect(await session.currentState() == .failed(camera: descriptor, reason: "connectionFailed(\"linkDown\")"))
    #expect(await client.connectCount == 2)
    #expect(logger.events.last?.message.contains("Reconnect exhausted") == true)

    await session.disconnect()
}

@Test func sessionMovesToDegradedStateWhenEventStreamGoesStale() async throws {
    let client = StubCAPClient()
    let logger = InMemoryDiagnosticLogger()
    let session = CameraSession(
        client: client,
        logger: logger,
        subscriptionVariables: [.sensorFPS],
        maxReconnectAttempts: 0,
        reconnectDelay: .zero,
        staleTimeout: .milliseconds(20)
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-7"),
        displayName: "ARRI ALEXA LF",
        family: .alexaLF,
        endpoint: CameraEndpoint(host: "10.0.0.14", port: 7777),
        discoverySource: .manual
    )

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
    try await Task.sleep(for: .milliseconds(40))

    #expect(await session.currentState() == .degraded(camera: descriptor, reason: "eventStreamStale"))
    #expect(logger.events.last?.message.contains("No camera events received") == true)

    await session.disconnect()
}

@Test func sessionRecoversFromDegradedStateWhenEventsResume() async throws {
    let client = StubCAPClient()
    let logger = InMemoryDiagnosticLogger()
    let session = CameraSession(
        client: client,
        logger: logger,
        subscriptionVariables: [.sensorFPS],
        maxReconnectAttempts: 0,
        reconnectDelay: .zero,
        staleTimeout: .milliseconds(20)
    )
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-8"),
        displayName: "ARRI ALEXA 35",
        family: .alexa35,
        endpoint: CameraEndpoint(host: "10.0.0.15", port: 7777),
        discoverySource: .manual
    )

    try await session.connect(to: descriptor, clientName: "ARRI Control", password: nil)
    try await Task.sleep(for: .milliseconds(40))
    #expect(await session.currentState() == .degraded(camera: descriptor, reason: "eventStreamStale"))

    await client.emitEvent(
        CAPEvent(
            messageID: 300,
            eventCode: CAPVariableIdentifier.sensorFPS.rawValue,
            payload: CAPDataCodec.encodeFloat32(24.0)
        )
    )
    try await Task.sleep(for: .milliseconds(5))

    #expect(await session.currentState() == .connected(descriptor))
    #expect(logger.events.last?.message.contains("Camera event stream recovered") == true)

    await session.disconnect()
}

private actor StubCAPClient: CAPClientProtocol {
    private(set) var connectedEndpoint: CameraEndpoint?
    private(set) var connectCount = 0
    private(set) var sentCommands: [CAPCommand] = []
    private let commandError: Error?
    private var connectErrors: [Error] = []
    private var commandErrors: [Error] = []
    private var eventContinuations: [UUID: AsyncStream<CAPEvent>.Continuation] = [:]

    init(commandError: Error? = nil) {
        self.commandError = commandError
    }

    func connect(to endpoint: CameraEndpoint) async throws {
        connectCount += 1
        if !connectErrors.isEmpty {
            throw connectErrors.removeFirst()
        }
        connectedEndpoint = endpoint
    }

    func disconnect() async {
        connectedEndpoint = nil
    }

    func send(_ command: CAPCommand) async throws -> CAPReply {
        sentCommands.append(command)
        if !commandErrors.isEmpty {
            throw commandErrors.removeFirst()
        }
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

    func finishEvents() {
        for continuation in eventContinuations.values {
            continuation.finish()
        }
        eventContinuations.removeAll()
    }

    func enqueueCommandError(_ error: Error) {
        commandErrors.append(error)
    }

    func enqueueConnectError(_ error: Error) {
        connectErrors.append(error)
    }

    private func removeContinuation(id: UUID) {
        eventContinuations.removeValue(forKey: id)
    }
}
