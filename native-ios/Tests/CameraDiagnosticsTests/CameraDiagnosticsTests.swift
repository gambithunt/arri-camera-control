import Foundation
import Testing
@testable import CameraDiagnostics
@testable import CameraDomain

@Test func loggerStoresRecordedEvents() {
    let logger = InMemoryDiagnosticLogger()
    let event = DiagnosticEvent(severity: .warning, message: "Connection degraded", cameraID: CameraIdentifier("camera-1"))

    logger.record(event)

    #expect(logger.events.count == 1)
    #expect(logger.events.first?.message == "Connection degraded")
}

@Test func reportBuilderRendersOperatorFriendlyDiagnosticExport() {
    let logger = InMemoryDiagnosticLogger()
    let descriptor = CameraDescriptor(
        identifier: CameraIdentifier("camera-1"),
        displayName: "ARRI ALEXA 35",
        family: .alexa35,
        endpoint: CameraEndpoint(host: "10.0.0.15", port: 7777),
        discoverySource: .bonjour
    )
    logger.record(DiagnosticEvent(severity: .info, message: "Connected to ARRI ALEXA 35", cameraID: descriptor.identifier))
    logger.record(DiagnosticEvent(severity: .warning, message: "Frame grab retry on attempt 2", cameraID: descriptor.identifier))

    let report = DiagnosticReportBuilder().makeReport(
        events: logger.snapshot(),
        activeCamera: descriptor,
        sessionLabel: "Connected"
    )

    #expect(report.contains("ARRI ALEXA 35"))
    #expect(report.contains("10.0.0.15:7777"))
    #expect(report.contains("Frame grab retry on attempt 2"))
    #expect(report.contains("Session: Connected"))
}
