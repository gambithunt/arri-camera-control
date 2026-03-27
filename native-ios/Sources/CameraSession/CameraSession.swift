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

public struct CameraSessionHealth: Equatable, Sendable {
    public var lastKeepaliveAt: Date?
    public var lastKeepaliveLatencyMS: Int?
    public var consecutiveKeepaliveFailures: Int

    public init(
        lastKeepaliveAt: Date? = nil,
        lastKeepaliveLatencyMS: Int? = nil,
        consecutiveKeepaliveFailures: Int = 0
    ) {
        self.lastKeepaliveAt = lastKeepaliveAt
        self.lastKeepaliveLatencyMS = lastKeepaliveLatencyMS
        self.consecutiveKeepaliveFailures = consecutiveKeepaliveFailures
    }
}

public protocol CameraSessionControlling: Sendable {
    func currentState() async -> CameraSessionState
    func currentHealth() async -> CameraSessionHealth
    func stateUpdates() async -> AsyncStream<CameraSessionState>
    func healthUpdates() async -> AsyncStream<CameraSessionHealth>
    func variableUpdates() async -> AsyncStream<CAPVariableUpdate>
    func beginDiscovery() async
    func connect(to descriptor: CameraDescriptor, clientName: String, password: String?) async throws
    func disconnect() async
}

public actor CameraSession: CameraSessionControlling {
    private struct ReconnectContext: Sendable {
        let descriptor: CameraDescriptor
        let clientName: String
        let password: String?
    }

    private let client: any CAPClientProtocol
    private let logger: DiagnosticLogging
    private let subscriptionVariables: [CAPVariableIdentifier]
    private let maxReconnectAttempts: Int
    private let reconnectDelay: Duration
    private let staleTimeout: Duration
    private let keepaliveInterval: Duration
    private let sleep: @Sendable (Duration) async -> Void
    private let now: @Sendable () -> Date
    private var state: CameraSessionState = .idle
    private var health = CameraSessionHealth()
    private var stateContinuations: [UUID: AsyncStream<CameraSessionState>.Continuation] = [:]
    private var healthContinuations: [UUID: AsyncStream<CameraSessionHealth>.Continuation] = [:]
    private var variableContinuations: [UUID: AsyncStream<CAPVariableUpdate>.Continuation] = [:]
    private var eventRelayTask: Task<Void, Never>?
    private var stalenessMonitorTask: Task<Void, Never>?
    private var keepaliveTask: Task<Void, Never>?
    private var connectedCamera: CameraDescriptor?
    private var isDisconnecting = false
    private var reconnectContext: ReconnectContext?
    private var activityGeneration: UInt64 = 0

    public init() {
        self.client = NullCAPClient()
        self.logger = InMemoryDiagnosticLogger()
        self.subscriptionVariables = []
        self.maxReconnectAttempts = 0
        self.reconnectDelay = .zero
        self.staleTimeout = .zero
        self.keepaliveInterval = .zero
        self.sleep = { _ in }
        self.now = Date.init
    }

    public init(
        client: any CAPClientProtocol,
        logger: DiagnosticLogging,
        subscriptionVariables: [CAPVariableIdentifier] = [],
        maxReconnectAttempts: Int = 2,
        reconnectDelay: Duration = .milliseconds(500),
        staleTimeout: Duration = .seconds(3),
        keepaliveInterval: Duration = .zero,
        sleep: @escaping @Sendable (Duration) async -> Void = { duration in
            try? await Task.sleep(for: duration)
        },
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.client = client
        self.logger = logger
        self.subscriptionVariables = subscriptionVariables
        self.maxReconnectAttempts = maxReconnectAttempts
        self.reconnectDelay = reconnectDelay
        self.staleTimeout = staleTimeout
        self.keepaliveInterval = keepaliveInterval
        self.sleep = sleep
        self.now = now
    }

    public func currentState() -> CameraSessionState {
        state
    }

    public func currentHealth() -> CameraSessionHealth {
        health
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

    public func healthUpdates() async -> AsyncStream<CameraSessionHealth> {
        AsyncStream { continuation in
            let id = UUID()
            healthContinuations[id] = continuation
            continuation.yield(health)
            continuation.onTermination = { @Sendable _ in
                Task {
                    await self.removeHealthContinuation(id: id)
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
        let context = ReconnectContext(descriptor: descriptor, clientName: clientName, password: password)
        isDisconnecting = false
        reconnectContext = context

        do {
            try await establishConnection(using: context) { .connecting($0) }
            logger.record(DiagnosticEvent(severity: .info, message: "Connected to \(descriptor.displayName)", cameraID: descriptor.identifier))
        } catch {
            await cancelEventRelayTask()
            await cancelKeepaliveTask()
            await cancelStalenessMonitorTask()
            await client.disconnect()
            connectedCamera = nil
            reconnectContext = nil
            updateHealth(.init())
            setState(.failed(camera: descriptor, reason: String(describing: error)))
            logger.record(DiagnosticEvent(severity: .error, message: "Failed to connect: \(error)", cameraID: descriptor.identifier))
            throw error
        }
    }

    public func disconnect() async {
        isDisconnecting = true
        await cancelEventRelayTask()
        await cancelStalenessMonitorTask()
        await cancelKeepaliveTask()
        await client.disconnect()
        connectedCamera = nil
        reconnectContext = nil
        updateHealth(.init())
        setState(.idle)
    }

    private func setState(_ newState: CameraSessionState) {
        state = newState
        for continuation in stateContinuations.values {
            continuation.yield(newState)
        }
    }

    private func updateHealth(_ newHealth: CameraSessionHealth) {
        health = newHealth
        for continuation in healthContinuations.values {
            continuation.yield(newHealth)
        }
    }

    private func startEventRelay(for descriptor: CameraDescriptor) {
        guard eventRelayTask == nil else {
            return
        }

        eventRelayTask = Task {
            let events = await client.events()
            for await event in events {
                noteActivity(for: descriptor)
                if let update = try? event.decodeVariableUpdate() {
                    publish(update)
                }
            }

            guard !Task.isCancelled else {
                return
            }

            await handleEventStreamEnded(for: descriptor)
        }
    }

    private func establishConnection(
        using context: ReconnectContext,
        phase: (CameraDescriptor) -> CameraSessionState
    ) async throws {
        let descriptor = context.descriptor
        setState(phase(descriptor))
        try await client.connect(to: descriptor.endpoint)
        startEventRelay(for: descriptor)

        setState(.authenticating(descriptor))
        _ = try await client.send(.clientName(context.clientName))

        if let password = context.password {
            _ = try await client.send(.requestPasswordChallenge)
            _ = try await client.send(.password(password))
        }

        if !subscriptionVariables.isEmpty {
            setState(.subscribing(descriptor))
            _ = try await client.send(.requestVariables(subscriptionVariables))
        }

        connectedCamera = descriptor
        setState(.connected(descriptor))
        startKeepaliveLoop(for: descriptor)
        noteActivity(for: descriptor)
    }

    private func publish(_ update: CAPVariableUpdate) {
        for continuation in variableContinuations.values {
            continuation.yield(update)
        }
    }

    private func handleEventStreamEnded(for descriptor: CameraDescriptor) async {
        eventRelayTask = nil
        await cancelStalenessMonitorTask()
        await cancelKeepaliveTask()

        guard !isDisconnecting else {
            return
        }

        logger.record(
            DiagnosticEvent(
                severity: .warning,
                message: "Event stream ended unexpectedly for \(descriptor.displayName)",
                cameraID: descriptor.identifier
            )
        )

        guard let reconnectContext, reconnectContext.descriptor == descriptor, maxReconnectAttempts > 0 else {
            connectedCamera = descriptor
            setState(.failed(camera: descriptor, reason: "eventStreamEnded"))
            return
        }

        Task {
            await attemptReconnect(using: reconnectContext)
        }
    }

    private func attemptReconnect(using context: ReconnectContext) async {
        let descriptor = context.descriptor
        var lastErrorDescription = "eventStreamEnded"

        for attempt in 1...maxReconnectAttempts {
            guard !isDisconnecting else {
                return
            }

            setState(.reconnecting(descriptor))
            await client.disconnect()
            await cancelKeepaliveTask()
            await cancelStalenessMonitorTask()

            if reconnectDelay > .zero {
                await sleep(reconnectDelay)
            }

            do {
                try await establishConnection(using: context) { .reconnecting($0) }
                logger.record(
                    DiagnosticEvent(
                        severity: .info,
                        message: "Reconnected to \(descriptor.displayName) on attempt \(attempt).",
                        cameraID: descriptor.identifier
                    )
                )
                return
            } catch {
                lastErrorDescription = String(describing: error)
                logger.record(
                    DiagnosticEvent(
                        severity: .warning,
                        message: "Reconnect attempt \(attempt) failed: \(error)",
                        cameraID: descriptor.identifier
                    )
                )
            }
        }

        connectedCamera = descriptor
        setState(.failed(camera: descriptor, reason: lastErrorDescription))
        logger.record(
            DiagnosticEvent(
                severity: .error,
                message: "Reconnect exhausted for \(descriptor.displayName): \(lastErrorDescription)",
                cameraID: descriptor.identifier
            )
        )
    }

    private func noteActivity(for descriptor: CameraDescriptor) {
        activityGeneration &+= 1

        if case .degraded(camera: descriptor, let reason) = state, reason == "eventStreamStale" {
            setState(.connected(descriptor))
            logger.record(
                DiagnosticEvent(
                    severity: .info,
                    message: "Camera event stream recovered for \(descriptor.displayName).",
                    cameraID: descriptor.identifier
                )
            )
        }

        startStalenessMonitor(for: descriptor, generation: activityGeneration)
    }

    private func startKeepaliveLoop(for descriptor: CameraDescriptor) {
        guard keepaliveInterval > .zero else {
            return
        }

        keepaliveTask?.cancel()
        let keepaliveInterval = keepaliveInterval
        let sleep = sleep
        let now = now

        keepaliveTask = Task { [descriptor, keepaliveInterval, sleep, now] in
            while !Task.isCancelled {
                await sleep(keepaliveInterval)

                guard !Task.isCancelled else {
                    return
                }

                let startedAt = now()

                do {
                    _ = try await self.client.send(.live)
                    let latencyMS = Self.safeLatencyMS(from: startedAt, to: now())
                    self.handleKeepaliveSuccess(for: descriptor, completedAt: now(), latencyMS: latencyMS)
                } catch {
                    self.handleKeepaliveFailure(for: descriptor, error: error)
                }
            }
        }
    }

    private func handleKeepaliveSuccess(for descriptor: CameraDescriptor, completedAt: Date, latencyMS: Int) {
        var nextHealth = health
        nextHealth.lastKeepaliveAt = completedAt
        nextHealth.lastKeepaliveLatencyMS = latencyMS
        nextHealth.consecutiveKeepaliveFailures = 0
        updateHealth(nextHealth)

        if case .degraded(camera: descriptor, let reason) = state, reason == "keepaliveFailed" {
            setState(.connected(descriptor))
            logger.record(
                DiagnosticEvent(
                    severity: .info,
                    message: "Keepalive recovered for \(descriptor.displayName).",
                    cameraID: descriptor.identifier
                )
            )
        }
    }

    private func handleKeepaliveFailure(for descriptor: CameraDescriptor, error: Error) {
        guard !isDisconnecting else {
            return
        }

        var nextHealth = health
        nextHealth.consecutiveKeepaliveFailures += 1
        updateHealth(nextHealth)

        if case .connected(descriptor) = state {
            setState(.degraded(camera: descriptor, reason: "keepaliveFailed"))
        }

        logger.record(
            DiagnosticEvent(
                severity: .warning,
                message: "Keepalive failed for \(descriptor.displayName): \(error)",
                cameraID: descriptor.identifier
            )
        )
    }

    private func startStalenessMonitor(for descriptor: CameraDescriptor, generation: UInt64) {
        guard staleTimeout > .zero else {
            return
        }

        stalenessMonitorTask?.cancel()
        let staleTimeout = staleTimeout
        let sleep = sleep
        stalenessMonitorTask = Task { [descriptor, generation, staleTimeout, sleep] in
            await sleep(staleTimeout)

            guard !Task.isCancelled else {
                return
            }

            self.handleStalenessCheck(for: descriptor, generation: generation)
        }
    }

    private func handleStalenessCheck(for descriptor: CameraDescriptor, generation: UInt64) {
        guard generation == activityGeneration else {
            return
        }

        guard case .connected(descriptor) = state else {
            return
        }

        setState(.degraded(camera: descriptor, reason: "eventStreamStale"))
        logger.record(
            DiagnosticEvent(
                severity: .warning,
                message: "No camera events received from \(descriptor.displayName) within the expected interval.",
                cameraID: descriptor.identifier
            )
        )
    }

    private func removeStateContinuation(id: UUID) {
        stateContinuations.removeValue(forKey: id)
    }

    private func removeHealthContinuation(id: UUID) {
        healthContinuations.removeValue(forKey: id)
    }

    private func removeVariableContinuation(id: UUID) {
        variableContinuations.removeValue(forKey: id)
    }

    private func cancelEventRelayTask() async {
        guard let task = eventRelayTask else {
            return
        }

        eventRelayTask = nil
        task.cancel()
        _ = await task.result
    }

    private func cancelStalenessMonitorTask() async {
        guard let task = stalenessMonitorTask else {
            return
        }

        stalenessMonitorTask = nil
        task.cancel()
        _ = await task.result
    }

    private func cancelKeepaliveTask() async {
        guard let task = keepaliveTask else {
            return
        }

        keepaliveTask = nil
        task.cancel()
        _ = await task.result
    }

    private static func safeLatencyMS(from startedAt: Date, to completedAt: Date) -> Int {
        let rawLatencyMS = completedAt.timeIntervalSince(startedAt) * 1_000.0

        guard rawLatencyMS.isFinite else {
            return 0
        }

        let clamped = min(max(rawLatencyMS, 0), Double(Int.max))
        return Int(clamped.rounded(.towardZero))
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
