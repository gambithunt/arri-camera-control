import Foundation

public struct CameraLiveState: Equatable, Sendable {
    public var connectionState: ConnectionState
    public var mode: CameraMode
    public var isRecording: Bool
    public var frameRate: FrameRate?
    public var whiteBalance: WhiteBalance?
    public var exposureIndex: ExposureIndex?
    public var ndFilter: NDFilter?
    public var shutterAngle: ShutterAngle?
    public var timecodeFrames: UInt32?
    public var timecodeRunMode: TimecodeRunMode?
    public var lookName: String?
    public var playbackClipIndex: Int?

    public init(
        connectionState: ConnectionState = .idle,
        mode: CameraMode = .liveControl,
        isRecording: Bool = false,
        frameRate: FrameRate? = nil,
        whiteBalance: WhiteBalance? = nil,
        exposureIndex: ExposureIndex? = nil,
        ndFilter: NDFilter? = nil,
        shutterAngle: ShutterAngle? = nil,
        timecodeFrames: UInt32? = nil,
        timecodeRunMode: TimecodeRunMode? = nil,
        lookName: String? = nil,
        playbackClipIndex: Int? = nil
    ) {
        self.connectionState = connectionState
        self.mode = mode
        self.isRecording = isRecording
        self.frameRate = frameRate
        self.whiteBalance = whiteBalance
        self.exposureIndex = exposureIndex
        self.ndFilter = ndFilter
        self.shutterAngle = shutterAngle
        self.timecodeFrames = timecodeFrames
        self.timecodeRunMode = timecodeRunMode
        self.lookName = lookName
        self.playbackClipIndex = playbackClipIndex
    }
}
