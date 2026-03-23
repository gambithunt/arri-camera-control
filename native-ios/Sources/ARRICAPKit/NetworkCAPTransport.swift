import Foundation
import Network
import CameraDomain

public enum CAPNetworkTransportError: Error, Equatable, Sendable {
    case invalidPort(Int)
    case notConnected
    case connectionFailed(String)
    case missingData
}

public struct CAPFrameStreamDecoder: Sendable {
    private var buffer = Data()

    public init() {}

    public mutating func append<S: DataProtocol>(_ data: S) {
        buffer.append(contentsOf: data)
    }

    public mutating func nextFrame() throws -> CAPFrame? {
        guard buffer.count >= 2 else {
            return nil
        }

        let length = Int(buffer[0]) << 8 | Int(buffer[1])
        guard buffer.count >= length else {
            return nil
        }

        let frameData = Data(buffer.prefix(length))
        buffer.removeFirst(length)
        return try CAPFrame.decode(frameData)
    }
}

public protocol CAPDataChannel: Sendable {
    func connect(host: String, port: UInt16) async throws
    func disconnect() async
    func send(_ data: Data) async throws
    func receive() async throws -> Data
}

public actor NetworkCAPTransport: CAPTransport {
    private let channel: any CAPDataChannel
    private var decoder = CAPFrameStreamDecoder()

    public init(channel: any CAPDataChannel = NWConnectionDataChannel()) {
        self.channel = channel
    }

    public func connect(to endpoint: CameraEndpoint) async throws {
        guard let port = UInt16(exactly: endpoint.port) else {
            throw CAPNetworkTransportError.invalidPort(endpoint.port)
        }

        try await channel.connect(host: endpoint.host, port: port)
    }

    public func disconnect() async {
        await channel.disconnect()
    }

    public func send(_ frame: CAPFrame) async throws {
        try await channel.send(frame.encode())
    }

    public func receive() async throws -> CAPFrame {
        while true {
            if let frame = try decoder.nextFrame() {
                return frame
            }

            let chunk = try await channel.receive()
            decoder.append(chunk)
        }
    }
}

public final class NWConnectionDataChannel: CAPDataChannel, @unchecked Sendable {
    private var connection: NWConnection?
    private let queue: DispatchQueue

    public init(queue: DispatchQueue = DispatchQueue(label: "ARRICAPKit.NWConnectionDataChannel")) {
        self.queue = queue
    }

    public func connect(host: String, port: UInt16) async throws {
        guard let nwPort = NWEndpoint.Port(rawValue: port) else {
            throw CAPNetworkTransportError.invalidPort(Int(port))
        }

        let connection = NWConnection(host: NWEndpoint.Host(host), port: nwPort, using: .tcp)
        self.connection = connection

        try await withCheckedThrowingContinuation { continuation in
            let resumeBox = ResumeBox()

            connection.stateUpdateHandler = { state in
                guard resumeBox.tryResume() else {
                    return
                }

                switch state {
                case .ready:
                    continuation.resume()
                case let .failed(error):
                    continuation.resume(throwing: CAPNetworkTransportError.connectionFailed(error.localizedDescription))
                default:
                    resumeBox.reset()
                    break
                }
            }

            connection.start(queue: queue)
        }
    }

    public func disconnect() async {
        connection?.cancel()
        connection = nil
    }

    public func send(_ data: Data) async throws {
        guard let connection else {
            throw CAPNetworkTransportError.notConnected
        }

        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, completion: .contentProcessed { error in
                if let error {
                    continuation.resume(throwing: CAPNetworkTransportError.connectionFailed(error.localizedDescription))
                } else {
                    continuation.resume()
                }
            })
        }
    }

    public func receive() async throws -> Data {
        guard let connection else {
            throw CAPNetworkTransportError.notConnected
        }

        return try await withCheckedThrowingContinuation { continuation in
            connection.receive(minimumIncompleteLength: 1, maximumLength: 65_535) { data, _, isComplete, error in
                if let error {
                    continuation.resume(throwing: CAPNetworkTransportError.connectionFailed(error.localizedDescription))
                    return
                }

                if let data, !data.isEmpty {
                    continuation.resume(returning: data)
                    return
                }

                if isComplete {
                    continuation.resume(throwing: CAPNetworkTransportError.missingData)
                } else {
                    continuation.resume(throwing: CAPNetworkTransportError.notConnected)
                }
            }
        }
    }
}

private final class ResumeBox: @unchecked Sendable {
    private let lock = NSLock()
    private var resumed = false

    func tryResume() -> Bool {
        lock.lock()
        defer { lock.unlock() }

        guard !resumed else {
            return false
        }

        resumed = true
        return true
    }

    func reset() {
        lock.lock()
        resumed = false
        lock.unlock()
    }
}
