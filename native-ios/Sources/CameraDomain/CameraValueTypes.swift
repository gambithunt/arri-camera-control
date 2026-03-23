import Foundation

public enum CameraMode: String, Codable, Sendable {
    case liveControl
    case playback
    case recording
    case unavailable
}

public enum ConnectionState: Equatable, Sendable {
    case idle
    case discovering
    case connecting
    case authenticating
    case subscribing
    case connected
    case degraded(reason: String)
    case reconnecting
    case failed(reason: String)
}

public struct FrameRate: Equatable, Codable, Sendable {
    public let fps: Int

    public init?(fps: Int) {
        guard (1...120).contains(fps) else {
            return nil
        }
        self.fps = fps
    }
}

public struct WhiteBalance: Equatable, Codable, Sendable {
    public let kelvin: Int
    public let tint: Int

    public init?(kelvin: Int, tint: Int) {
        guard (2000...11000).contains(kelvin), (-150...150).contains(tint) else {
            return nil
        }
        self.kelvin = kelvin
        self.tint = tint
    }
}

public struct ExposureIndex: Equatable, Codable, Sendable {
    public let iso: Int

    public init?(iso: Int) {
        let allowed = [100, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1280, 1600, 2000, 2560, 3200, 6400]
        guard allowed.contains(iso) else {
            return nil
        }
        self.iso = iso
    }
}

public struct NDFilter: Equatable, Codable, Sendable {
    public let stop: Double

    public init?(stop: Double) {
        guard Self.available.map(\.stop).contains(stop) else {
            return nil
        }
        self.stop = stop
    }

    public static let available: [NDFilter] = [0.0, 0.6, 1.2, 1.8, 2.4, 3.0].map { NDFilter(uncheckedStop: $0) }

    private init(uncheckedStop: Double) {
        self.stop = uncheckedStop
    }
}

public struct ShutterAngle: Equatable, Codable, Sendable {
    public let degrees: Double

    public init?(degrees: Double) {
        guard degrees > 0, degrees <= 360 else {
            return nil
        }
        self.degrees = degrees
    }
}

public struct Timecode: Equatable, Codable, Sendable {
    public let hours: Int
    public let minutes: Int
    public let seconds: Int
    public let frames: Int

    public init?(hours: Int, minutes: Int, seconds: Int, frames: Int) {
        guard (0...23).contains(hours), (0...59).contains(minutes), (0...59).contains(seconds), (0...99).contains(frames) else {
            return nil
        }

        self.hours = hours
        self.minutes = minutes
        self.seconds = seconds
        self.frames = frames
    }

    public var displayString: String {
        String(format: "%02d:%02d:%02d:%02d", hours, minutes, seconds, frames)
    }

    public func totalFrames(at frameRate: FrameRate) -> UInt32 {
        let fps = frameRate.fps
        let frameCount = (((hours * 60) + minutes) * 60 + seconds) * fps + frames
        return UInt32(frameCount)
    }
}

public enum TimecodeRunMode: UInt16, Codable, Sendable {
    case recordRun = 0x0000
    case freeRun = 0x0001
}

public struct CDLValues: Equatable, Codable, Sendable {
    public struct RGBTriple: Equatable, Codable, Sendable {
        public let r: Double
        public let g: Double
        public let b: Double

        public init(r: Double, g: Double, b: Double) {
            self.r = r
            self.g = g
            self.b = b
        }
    }

    public let lift: RGBTriple
    public let gamma: RGBTriple
    public let gain: RGBTriple

    public init(lift: RGBTriple, gamma: RGBTriple, gain: RGBTriple) {
        self.lift = lift
        self.gamma = gamma
        self.gain = gain
    }
}

public struct ClipSummary: Equatable, Codable, Sendable {
    public let id: String
    public let name: String
    public let totalFrames: Int
    public let frameRate: FrameRate

    public init(id: String, name: String, totalFrames: Int, frameRate: FrameRate) {
        self.id = id
        self.name = name
        self.totalFrames = totalFrames
        self.frameRate = frameRate
    }
}

public struct LUTDescriptor: Equatable, Codable, Sendable {
    public let id: String
    public let name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct FrameGrabMetadata: Equatable, Codable, Sendable {
    public let width: Int
    public let height: Int
    public let pixelFormat: String

    public init(width: Int, height: Int, pixelFormat: String) {
        self.width = width
        self.height = height
        self.pixelFormat = pixelFormat
    }
}

public enum CameraOperation: CaseIterable, Sendable {
    case frameGrab
    case playbackTransport
    case timecodeControl
    case lookManagement
}

public enum CameraUserError: Error, Equatable, Sendable {
    case unsupportedOperation(CameraOperation)
    case invalidValue(String)
    case unavailableInCurrentMode(CameraMode)
}
