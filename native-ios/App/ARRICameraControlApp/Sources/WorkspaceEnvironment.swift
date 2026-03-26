import ARRICAPKit
import CameraDiagnostics
import CameraDiscovery
import CameraFeatures
import CameraSession
import Foundation

enum WorkspaceEnvironment {
    static func makeStore() -> CameraWorkspaceStore {
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
            ]
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
            controlService: CameraControlService(client: client),
            playbackService: PlaybackControlService(client: client),
            timecodeService: TimecodeService(client: client),
            lookService: LookService(client: client),
            frameGrabService: FrameGrabService(client: client),
            diagnosticLogger: logger,
            diagnosticsProvider: logger
        )
    }
}
