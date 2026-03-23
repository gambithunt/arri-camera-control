import Foundation
import Testing
@testable import ARRICAPKit
@testable import CameraDomain

@Test func clientSendsEncodedCommandAndReturnsMatchingReply() async throws {
    let transport = TestTransport()
    let client = CAPClient(transport: transport)
    let endpoint = CameraEndpoint(host: "10.0.0.8", port: 7777)

    await transport.enqueueIncomingFrame(
        CAPFrame(
            messageType: .reply,
            messageID: 1,
            commandCode: CAPResultCode.ok.rawValue,
            payload: CAPDataCodec.encodeString("ARRI ALEXA LF")
        )
    )

    try await client.connect(to: endpoint)
    let reply = try await client.send(.getVariable(.cameraType))

    #expect(await transport.connectedEndpoint == endpoint)
    #expect(await transport.sentFrames.count == 1)
    #expect(await transport.sentFrames.first?.commandCode == CAPCommandCode.getVariable.rawValue)
    #expect(reply.messageID == 1)
    #expect(try reply.decodeValue(for: .cameraType) == .string("ARRI ALEXA LF"))
}

@Test func clientThrowsWhenReplyReportsFailure() async {
    let transport = TestTransport()
    let client = CAPClient(transport: transport)
    let endpoint = CameraEndpoint(host: "10.0.0.9", port: 7777)

    await transport.enqueueIncomingFrame(
        CAPFrame(
            messageType: .reply,
            messageID: 1,
            commandCode: CAPResultCode.notAuthorized.rawValue
        )
    )

    do {
        try await client.connect(to: endpoint)
        _ = try await client.send(.recordStart)
        Issue.record("Expected command failure")
    } catch let error as CAPClientError {
        #expect(error == .commandFailed(resultCode: .notAuthorized))
    } catch {
        Issue.record("Unexpected error: \(error)")
    }
}

@Test func clientPublishesIncomingEventsWhileStillCorrelatingReplies() async throws {
    let transport = TestTransport()
    let client = CAPClient(transport: transport)
    let endpoint = CameraEndpoint(host: "10.0.0.10", port: 7777)
    let events = await client.events()

    try await client.connect(to: endpoint)

    let replyTask = Task {
        try await client.send(.requestVariables([.sensorFPS]))
    }

    await transport.enqueueIncomingFrame(
        CAPFrame(
            messageType: .event,
            messageID: 99,
            commandCode: CAPVariableIdentifier.sensorFPS.rawValue,
            payload: CAPDataCodec.encodeFloat32(25.0)
        )
    )
    await transport.enqueueIncomingFrame(
        CAPFrame(
            messageType: .reply,
            messageID: 1,
            commandCode: CAPResultCode.ok.rawValue
        )
    )

    var iterator = events.makeAsyncIterator()
    let event = try #require(await iterator.next())
    let update = try event.decodeVariableUpdate()
    let reply = try await replyTask.value

    #expect(update.variableID == .sensorFPS)
    #expect(update.value == .float32(25.0))
    #expect(reply.messageID == 1)
}

private actor TestTransport: CAPTransport {
    private(set) var connectedEndpoint: CameraEndpoint?
    private(set) var sentFrames: [CAPFrame] = []
    private var incomingFrames: [CAPFrame] = []
    private var waiters: [CheckedContinuation<CAPFrame, Error>] = []

    func connect(to endpoint: CameraEndpoint) async throws {
        connectedEndpoint = endpoint
    }

    func disconnect() async {
        connectedEndpoint = nil
    }

    func send(_ frame: CAPFrame) async throws {
        sentFrames.append(frame)
    }

    func receive() async throws -> CAPFrame {
        if !incomingFrames.isEmpty {
            return incomingFrames.removeFirst()
        }

        return try await withCheckedThrowingContinuation { continuation in
            waiters.append(continuation)
        }
    }

    func enqueueIncomingFrame(_ frame: CAPFrame) {
        if let waiter = waiters.first {
            waiters.removeFirst()
            waiter.resume(returning: frame)
        } else {
            incomingFrames.append(frame)
        }
    }
}
