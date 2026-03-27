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
    public var currentReel: Int?
    public var clipNumber: Int?
    public var remainingRecordSeconds: UInt32?
    public var lastRecordedMediumID: Int?
    public var lastRecordedClipIndex: Int?
    public var lensModel: String?
    public var lensIrisTStopMillistops: Int?
    public var lensFocalLengthMillimetersTimesOneThousand: Int?
    public var framelineName: String?
    public var textureName: String?
    public var codecOptions: [String]
    public var codecIndex: Int?
    public var recordingResolutionIndex: Int?
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
        currentReel: Int? = nil,
        clipNumber: Int? = nil,
        remainingRecordSeconds: UInt32? = nil,
        lastRecordedMediumID: Int? = nil,
        lastRecordedClipIndex: Int? = nil,
        lensModel: String? = nil,
        lensIrisTStopMillistops: Int? = nil,
        lensFocalLengthMillimetersTimesOneThousand: Int? = nil,
        framelineName: String? = nil,
        textureName: String? = nil,
        codecOptions: [String] = [],
        codecIndex: Int? = nil,
        recordingResolutionIndex: Int? = nil,
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
        self.currentReel = currentReel
        self.clipNumber = clipNumber
        self.remainingRecordSeconds = remainingRecordSeconds
        self.lastRecordedMediumID = lastRecordedMediumID
        self.lastRecordedClipIndex = lastRecordedClipIndex
        self.lensModel = lensModel
        self.lensIrisTStopMillistops = lensIrisTStopMillistops
        self.lensFocalLengthMillimetersTimesOneThousand = lensFocalLengthMillimetersTimesOneThousand
        self.framelineName = framelineName
        self.textureName = textureName
        self.codecOptions = codecOptions
        self.codecIndex = codecIndex
        self.recordingResolutionIndex = recordingResolutionIndex
        self.playbackClipIndex = playbackClipIndex
    }
}
