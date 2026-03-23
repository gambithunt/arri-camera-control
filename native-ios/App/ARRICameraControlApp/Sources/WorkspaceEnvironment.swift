import ARRICAPKit
import CameraDiagnostics
import CameraDiscovery
import CameraFeatures
import CameraSession
import Foundation
#if canImport(Photos)
import Photos
#endif

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
            frameGrabExporter: PhotoLibraryFrameGrabExporter(),
            diagnosticLogger: logger,
            diagnosticsProvider: logger
        )
    }
}

private final class PhotoLibraryFrameGrabExporter: NSObject, FrameGrabExporting, @unchecked Sendable {
    func saveImageData(_ data: Data) async throws -> String {
#if canImport(Photos)
        try await requestAuthorizationIfNeeded()

        return try await withCheckedThrowingContinuation { continuation in
            var localIdentifier: String?

            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetCreationRequest.forAsset()
                request.addResource(with: .photo, data: data, options: nil)
                localIdentifier = request.placeholderForCreatedAsset?.localIdentifier
            }, completionHandler: { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if success, let localIdentifier {
                    continuation.resume(returning: localIdentifier)
                } else {
                    continuation.resume(throwing: PhotoExportError.saveFailed)
                }
            })
        }
#else
        throw PhotoExportError.unsupportedPlatform
#endif
    }

#if canImport(Photos)
    private func requestAuthorizationIfNeeded() async throws {
        let currentStatus = PHPhotoLibrary.authorizationStatus(for: .addOnly)

        switch currentStatus {
        case .authorized, .limited:
            return
        case .notDetermined:
            let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
            guard status == .authorized || status == .limited else {
                throw PhotoExportError.authorizationDenied
            }
        default:
            throw PhotoExportError.authorizationDenied
        }
    }
#endif
}

private enum PhotoExportError: LocalizedError {
    case authorizationDenied
    case saveFailed
    case unsupportedPlatform

    var errorDescription: String? {
        switch self {
        case .authorizationDenied:
            "Photos access was denied."
        case .saveFailed:
            "The frame grab could not be saved to Photos."
        case .unsupportedPlatform:
            "Photos export is unavailable on this platform."
        }
    }
}
