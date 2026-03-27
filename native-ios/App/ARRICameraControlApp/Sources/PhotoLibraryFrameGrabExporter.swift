import Foundation
import CameraFeatures
@preconcurrency import Photos

enum PhotoLibraryFrameGrabExporterError: Error, Equatable {
    case authorizationDenied
    case assetCreationFailed
}

struct PhotoLibraryFrameGrabExporter: FrameGrabExporting {
    func saveImageData(_ data: Data) async throws -> String {
        let authorizationStatus = await requestAuthorization()
        guard authorizationStatus == .authorized || authorizationStatus == .limited else {
            throw PhotoLibraryFrameGrabExporterError.authorizationDenied
        }

        return try saveToPhotoLibrary(data)
    }

    private func requestAuthorization() async -> PHAuthorizationStatus {
        await withCheckedContinuation { continuation in
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                continuation.resume(returning: status)
            }
        }
    }

    private func saveToPhotoLibrary(_ data: Data) throws -> String {
        var assetIdentifier: String?

        try PHPhotoLibrary.shared().performChangesAndWait {
            let creationRequest = PHAssetCreationRequest.forAsset()
            creationRequest.addResource(with: .photo, data: data, options: nil)
            assetIdentifier = creationRequest.placeholderForCreatedAsset?.localIdentifier
        }

        guard let assetIdentifier else {
            throw PhotoLibraryFrameGrabExporterError.assetCreationFailed
        }

        return assetIdentifier
    }
}
