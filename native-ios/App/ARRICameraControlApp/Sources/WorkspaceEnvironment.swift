import ARRICAPKit
import CameraDiagnostics
import CameraDiscovery
import CameraFeatures
import CameraMocks
import CameraSession
import Foundation

enum WorkspaceEnvironment {
    @MainActor
    static func makeStore() -> CameraWorkspaceStore {
        #if targetEnvironment(simulator)
        if ProcessInfo.processInfo.environment["ARRI_FORCE_LIVE_CAMERA"] != "1" {
            return SimulatorWorkspaceStoreFactory.makeStore(
                frameGrabExporter: PhotoLibraryFrameGrabExporter()
            )
        }
        #endif

        let client = CAPClient(transport: NetworkCAPTransport())
        let logger = InMemoryDiagnosticLogger()
        let session = CameraSession(
            client: client,
            logger: logger,
            subscriptionVariables: [
                .cameraState,
                .sensorFPS,
                .colorTemperature,
                .tint,
                .exposureIndex,
                .ndFilter,
                .shutterAngle,
                .timecode,
                .timecodeRunMode,
                .lookFilename,
                .playbackClipIndex
            ],
            keepaliveInterval: .seconds(2)
        )
        let discovery = BonjourCameraDiscovery(
            browser: NetServiceBonjourBrowser(),
            verifier: CAPCameraDiscoveryVerifier(
                clientFactory: {
                    CAPClient(transport: NetworkCAPTransport())
                }
            ),
            serviceTypes: [
                "_arri._tcp",
                "_arri-cap._tcp",
                "_camera._tcp"
            ]
        )

        return CameraWorkspaceStore(
            session: session,
            discovery: discovery,
            controlService: CameraControlService(client: client, diagnosticLogger: logger),
            playbackService: PlaybackControlService(client: client, diagnosticLogger: logger),
            timecodeService: TimecodeService(client: client, diagnosticLogger: logger),
            lookService: LookService(client: client, diagnosticLogger: logger),
            frameGrabService: FrameGrabService(client: client, diagnosticLogger: logger),
            metadataService: CameraMetadataService(client: client, diagnosticLogger: logger),
            frameGrabExporter: PhotoLibraryFrameGrabExporter(),
            diagnosticLogger: logger,
            diagnosticsProvider: logger
        )
    }
}
