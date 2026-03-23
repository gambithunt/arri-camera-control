import Foundation
import Testing
@testable import ARRICAPKit
@testable import CameraDomain

@Test func networkTransportEncodesOutgoingFramesAndDecodesFragmentedIncomingFrames() async throws {
    let channel = StubDataChannel()
    let transport = NetworkCAPTransport(channel: channel)
    let endpoint = CameraEndpoint(host: "10.0.0.8", port: 7777)
    let outgoing = CAPFrame(messageType: .command, messageID: 4, commandCode: CAPCommandCode.live.rawValue)
    let incoming = CAPFrame(
        messageType: .reply,
        messageID: 4,
        commandCode: CAPResultCode.ok.rawValue,
        payload: CAPDataCodec.encodeUInt16(0x0061)
    )
    let bytes = incoming.encode()

    try await transport.connect(to: endpoint)
    try await transport.send(outgoing)
    await channel.enqueueIncomingChunk(bytes.prefix(3))
    await channel.enqueueIncomingChunk(bytes.dropFirst(3))
    let decoded = try await transport.receive()

    #expect(await channel.connectedEndpoint == endpoint)
    #expect(await channel.sentPayloads == [outgoing.encode()])
    #expect(decoded == incoming)
}

private actor StubDataChannel: CAPDataChannel {
    private(set) var connectedEndpoint: CameraEndpoint?
    private(set) var sentPayloads: [Data] = []
    private var queuedChunks: [Data] = []
    private var waiters: [CheckedContinuation<Data, Error>] = []

    func connect(host: String, port: UInt16) async throws {
        connectedEndpoint = CameraEndpoint(host: host, port: Int(port))
    }

    func disconnect() async {
        connectedEndpoint = nil
    }

    func send(_ data: Data) async throws {
        sentPayloads.append(data)
    }

    func receive() async throws -> Data {
        if !queuedChunks.isEmpty {
            return queuedChunks.removeFirst()
        }

        return try await withCheckedThrowingContinuation { continuation in
            waiters.append(continuation)
        }
    }

    func enqueueIncomingChunk<S: DataProtocol>(_ chunk: S) {
        let data = Data(chunk)
        if let waiter = waiters.first {
            waiters.removeFirst()
            waiter.resume(returning: data)
        } else {
            queuedChunks.append(data)
        }
    }
}
