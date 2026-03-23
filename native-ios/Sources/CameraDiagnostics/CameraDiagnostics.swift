import Foundation
import CameraDomain

public enum DiagnosticSeverity: String, Sendable {
    case debug
    case info
    case warning
    case error
}

public struct DiagnosticEvent: Equatable, Sendable {
    public let severity: DiagnosticSeverity
    public let message: String
    public let cameraID: CameraIdentifier?
    public let timestamp: Date

    public init(severity: DiagnosticSeverity, message: String, cameraID: CameraIdentifier? = nil, timestamp: Date = .init()) {
        self.severity = severity
        self.message = message
        self.cameraID = cameraID
        self.timestamp = timestamp
    }
}

public protocol DiagnosticLogging: Sendable {
    func record(_ event: DiagnosticEvent)
}

public protocol DiagnosticProviding: Sendable {
    func snapshot() -> [DiagnosticEvent]
}

public struct DiagnosticReportBuilder: Sendable {
    public init() {}

    public func makeReport(
        events: [DiagnosticEvent],
        activeCamera: CameraDescriptor?,
        sessionLabel: String,
        generatedAt: Date = .init()
    ) -> String {
        var lines: [String] = [
            "ARRI Camera Control Diagnostics",
            "Generated: \(generatedAt.formatted(date: .abbreviated, time: .standard))",
            "Session: \(sessionLabel)"
        ]

        if let activeCamera {
            lines.append("Camera: \(activeCamera.displayName)")
            lines.append("Family: \(activeCamera.family.rawValue)")
            lines.append("Endpoint: \(activeCamera.endpoint.host):\(activeCamera.endpoint.port)")

            if let serialNumber = activeCamera.serialNumber {
                lines.append("Serial: \(serialNumber)")
            }
        } else {
            lines.append("Camera: None")
        }

        lines.append("Events:")

        if events.isEmpty {
            lines.append("- None")
        } else {
            for event in events.sorted(by: { $0.timestamp < $1.timestamp }) {
                let cameraSuffix = event.cameraID.map { " [\($0.value)]" } ?? ""
                let timestamp = event.timestamp.formatted(date: .omitted, time: .standard)
                lines.append("- [\(event.severity.rawValue.uppercased())] \(timestamp)\(cameraSuffix) \(event.message)")
            }
        }

        return lines.joined(separator: "\n")
    }
}

public final class InMemoryDiagnosticLogger: DiagnosticLogging, @unchecked Sendable {
    private let lock = NSLock()
    private var storage: [DiagnosticEvent] = []

    public init() {}

    public func record(_ event: DiagnosticEvent) {
        lock.lock()
        defer { lock.unlock() }
        storage.append(event)
    }

    public var events: [DiagnosticEvent] {
        lock.lock()
        defer { lock.unlock() }
        return storage
    }
}

extension InMemoryDiagnosticLogger: DiagnosticProviding {
    public func snapshot() -> [DiagnosticEvent] {
        events
    }
}
