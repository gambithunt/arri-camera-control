import Foundation
import CameraDomain

public enum CAPClientError: Error, Equatable, Sendable {
    case unexpectedMessageType
    case mismatchedReplyID(expected: UInt16, actual: UInt16)
    case commandFailed(resultCode: CAPResultCode?)
}

public protocol CAPTransport: Sendable {
    func connect(to endpoint: CameraEndpoint) async throws
    func disconnect() async
    func send(_ frame: CAPFrame) async throws
    func receive() async throws -> CAPFrame
}

public protocol CAPClientProtocol: Sendable {
    func connect(to endpoint: CameraEndpoint) async throws
    func disconnect() async
    func send(_ command: CAPCommand) async throws -> CAPReply
    func events() async -> AsyncStream<CAPEvent>
}

public actor CAPClient: CAPClientProtocol {
    private let transport: any CAPTransport
    private var messageIDs = CAPMessageIDSequence()
    private var pendingReplies: [UInt16: CheckedContinuation<CAPReply, Error>] = [:]
    private var eventContinuations: [UUID: AsyncStream<CAPEvent>.Continuation] = [:]
    private var receiveLoop: Task<Void, Never>?

    public init(transport: any CAPTransport) {
        self.transport = transport
    }

    public func connect(to endpoint: CameraEndpoint) async throws {
        try await transport.connect(to: endpoint)
        startReceiveLoop()
    }

    public func disconnect() async {
        receiveLoop?.cancel()
        receiveLoop = nil
        for continuation in pendingReplies.values {
            continuation.resume(throwing: CAPClientError.unexpectedMessageType)
        }
        pendingReplies.removeAll()
        for continuation in eventContinuations.values {
            continuation.finish()
        }
        eventContinuations.removeAll()
        await transport.disconnect()
    }

    public func send(_ command: CAPCommand) async throws -> CAPReply {
        let messageID = messageIDs.next()
        let frame = try command.makeFrame(messageID: messageID)
        return try await withCheckedThrowingContinuation { continuation in
            pendingReplies[messageID] = continuation

            Task {
                do {
                    try await transport.send(frame)
                } catch {
                    failPendingReply(messageID: messageID, error: error)
                }
            }
        }
    }

    public func events() async -> AsyncStream<CAPEvent> {
        AsyncStream { continuation in
            let id = UUID()
            eventContinuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeEventContinuation(id: id)
                }
            }
        }
    }

    private func startReceiveLoop() {
        guard receiveLoop == nil else {
            return
        }

        receiveLoop = Task {
            defer {
                receiveLoop = nil
            }

            while !Task.isCancelled {
                do {
                    let frame = try await transport.receive()
                    try handleIncoming(frame: frame)
                } catch {
                    failAllPendingReplies(error: error)
                    finishAllEvents()
                    break
                }
            }
        }
    }

    private func handleIncoming(frame: CAPFrame) throws {
        let incomingMessage = try CAPIncomingMessage(frame: frame)

        switch incomingMessage {
        case let .reply(reply):
            guard let continuation = pendingReplies.removeValue(forKey: reply.messageID) else {
                throw CAPClientError.mismatchedReplyID(expected: 0, actual: reply.messageID)
            }

            guard reply.resultCode == .ok else {
                continuation.resume(throwing: CAPClientError.commandFailed(resultCode: reply.resultCode))
                return
            }

            continuation.resume(returning: reply)
        case let .event(event):
            for continuation in eventContinuations.values {
                continuation.yield(event)
            }
        }
    }

    private func removeEventContinuation(id: UUID) {
        eventContinuations.removeValue(forKey: id)
    }

    private func failPendingReply(messageID: UInt16, error: Error) {
        let continuation = pendingReplies.removeValue(forKey: messageID)
        continuation?.resume(throwing: error)
    }

    private func failAllPendingReplies(error: Error) {
        for continuation in pendingReplies.values {
            continuation.resume(throwing: error)
        }
        pendingReplies.removeAll()
    }

    private func finishAllEvents() {
        for continuation in eventContinuations.values {
            continuation.finish()
        }
        eventContinuations.removeAll()
    }
}
