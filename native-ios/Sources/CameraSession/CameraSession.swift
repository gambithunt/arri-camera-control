import Foundation
import ARRICAPKit
import CameraDiagnostics
import CameraDomain

public enum CameraSessionState: Equatable, Sendable {
    case idle
    case discovering
    case connecting(CameraDescriptor)
    case authenticating(CameraDescriptor)
    case subscribing(CameraDescriptor)
    case connected(CameraDescriptor)
    case degraded(camera: CameraDescriptor, reason: String)
    case reconnecting(CameraDescriptor)
    case failed(camera: CameraDescriptor, reason: String)
}

public protocol CameraSessionControlling: Sendable {
    func currentState() async -> CameraSessionState
    func stateUpdates() async -> AsyncStream<CameraSessionState>
    func variableUpdates() async -> AsyncStream<CAPVariableUpdate>
    func beginDiscovery() async
    func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async throws
    func disconnect() async
}

public actor CameraSession: CameraSessionControlling {
    private let client: any CAPClientProtocol
    private let logger: DiagnosticLogging
    private let subscriptionVariables: [CAPVariableIdentifier]
    private var state: CameraSessionState = .idle
    private var stateContinuations: [UUID: AsyncStream<CameraSessionState>.Continuation] = [:]
    private var variableContinuations: [UUID: AsyncStream<CAPVariableUpdate>.Continuation] = [:]
    private var eventRelayTask: Task<Void, Never>?

    public init() {
        self.client = NullCAPClient()
        self.logger = InMemoryDiagnosticLogger()
        self.subscriptionVariables = []
    }

    public init(
        client: any CAPClientProtocol,
        logger: DiagnosticLogging,
        subscriptionVariables: [CAPVariableIdentifier] = []
    ) {
        self.client = client
        self.logger = logger
        self.subscriptionVariables = subscriptionVariables
    }

    public func currentState() -> CameraSessionState {
        state
    }

    public func stateUpdates() async -> AsyncStream<CameraSessionState> {
        AsyncStream { continuation in
            let id = UUID()
            stateContinuations[id] = continuation
            continuation.yield(state)
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeStateContinuation(id: id)
                }
            }
        }
    }

    public func variableUpdates() async -> AsyncStream<CAPVariableUpdate> {
        AsyncStream { continuation in
            let id = UUID()
            variableContinuations[id] = continuation
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeVariableContinuation(id: id)
                }
            }
        }
    }

    public func beginDiscovery() {
        setState(.discovering)
    }

    public func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async throws {
        setState(.connecting(descriptor))

        do {
            try await client.connect(to: descriptor.endpoint)
            startEventRelay()

            setState(.authenticating(descriptor))
            _ = try await client.send(.clientName(clientName))

            if let password {
                _ = try await client.send(.requestPasswordChallenge)
                _ = try await client.send(.password(password))
            }

            if !subscriptionVariables.isEmpty {
                setState(.subscribing(descriptor))
                _ = try await client.send(.requestVariables(subscriptionVariables))
            }

            setState(.connected(descriptor))
            logger.record(DiagnosticEvent(severity: .info, message: "Connected to \(descriptor.displayName)", cameraID: descriptor.identifier))
        } catch {
            setState(.failed(camera: descriptor, reason: String(describing: error)))
            logger.record(DiagnosticEvent(severity: .error, message: "Failed to connect: \(error)", cameraID: descriptor.identifier))
            throw error
        }
    }

    public func disconnect() async {
        eventRelayTask?.cancel()
        eventRelayTask = nil
        await client.disconnect()
        setState(.idle)
    }

    private func setState(_ newState: CameraSessionState) {
        state = newState
        for continuation in stateContinuations.values {
            continuation.yield(newState)
        }
    }

    private func startEventRelay() {
        guard eventRelayTask == nil else {
            return
        }

        eventRelayTask = Task {
            let events = await client.events()
            for await event in events {
                if let update = try? event.decodeVariableUpdate() {
                    publish(update)
                }
            }
        }
    }

    private func publish(_ update: CAPVariableUpdate) {
        for continuation in variableContinuations.values {
            continuation.yield(update)
        }
    }

    private func removeStateContinuation(id: UUID) {
        stateContinuations.removeValue(forKey: id)
    }

    private func removeVariableContinuation(id: UUID) {
        variableContinuations.removeValue(forKey: id)
    }
}

private actor NullCAPClient: CAPClientProtocol {
    func connect(to endpoint: CameraEndpoint) async throws {}
    func disconnect() async {}

    func send(_ command: CAPCommand) async throws -> CAPReply {
        CAPReply(messageID: 0, rawResultCode: CAPResultCode.ok.rawValue, payload: Data())
    }

    func events() async -> AsyncStream<CAPEvent> {
        AsyncStream { continuation in
            continuation.finish()
        }
    }
}
