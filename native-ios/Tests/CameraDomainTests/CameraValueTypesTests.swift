import Foundation
import Testing
@testable import CameraDomain

@Test func frameRateValidationRejectsOutOfRangeValues() {
    #expect(FrameRate(fps: 24)?.fps == 24)
    #expect(FrameRate(fps: 0) == nil)
    #expect(FrameRate(fps: 121) == nil)
}

@Test func whiteBalanceValidationRejectsUnsupportedKelvin() {
    #expect(WhiteBalance(kelvin: 5600, tint: 0)?.kelvin == 5600)
    #expect(WhiteBalance(kelvin: 1500, tint: 0) == nil)
    #expect(WhiteBalance(kelvin: 12000, tint: 0) == nil)
}

@Test func ndFilterProvidesCanonicalStops() {
    #expect(NDFilter.available.map(\.stop) == [0.0, 0.6, 1.2, 1.8, 2.4, 3.0])
}

@Test func timecodeFormattingRequiresValidRanges() {
    #expect(Timecode(hours: 1, minutes: 2, seconds: 3, frames: 4)?.displayString == "01:02:03:04")
    #expect(Timecode(hours: 25, minutes: 0, seconds: 0, frames: 0) == nil)
}

@Test func cameraOperationAvailabilityFollowsCapabilities() {
    let capabilities = CameraCapabilities.baseline(for: .alexaLF)
    #expect(capabilities.isSupported(.frameGrab))
    #expect(capabilities.isSupported(.playbackTransport))
}

@Test func clipAndLookMetadataCaptureCoreFields() {
    let clip = ClipSummary(id: "clip-1", name: "A001C001", totalFrames: 240, frameRate: FrameRate(fps: 24)!)
    let lut = LUTDescriptor(id: "lut-1", name: "Show LUT")
    let metadata = FrameGrabMetadata(width: 1920, height: 1080, pixelFormat: "jpeg")

    #expect(clip.name == "A001C001")
    #expect(lut.name == "Show LUT")
    #expect(metadata.width == 1920)
}
