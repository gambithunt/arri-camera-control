import Foundation
import SwiftUI
import CameraDiscovery
import CameraDomain
import CameraFeatures
import CameraSession

struct WorkspaceSurfaceCard<Content: View>: View {
    @Environment(\.colorScheme) private var colorScheme
    let content: Content

    init(@ViewBuilder content: () -> Content) {
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(20)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(.white.opacity(colorScheme == .dark ? 0.10 : 0.24), lineWidth: 1)
        }
        .shadow(color: .black.opacity(colorScheme == .dark ? 0.18 : 0.08), radius: 12, y: 8)
    }
}

struct WorkspaceStatusPill: View {
    let title: String
    let systemImage: String
    let tint: Color

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.subheadline.weight(.semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .foregroundStyle(tint)
            .background(tint.opacity(0.12), in: Capsule())
    }
}

struct WorkspaceSettingCard<Controls: View>: View {
    let title: String
    let value: String
    let detail: String
    let controls: Controls

    init(
        title: String,
        value: String,
        detail: String,
        @ViewBuilder controls: () -> Controls
    ) {
        self.title = title
        self.value = value
        self.detail = detail
        self.controls = controls()
    }

    var body: some View {
        WorkspaceSurfaceCard {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text(value)
                .font(.system(.title2, design: .rounded).weight(.semibold))
                .contentTransition(.numericText())

            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)

            controls
        }
    }
}

struct WorkspaceReadoutTile: View {
    let key: String
    let value: String
    let detail: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(key)
                .font(.caption2.weight(.semibold))
                .foregroundStyle(.secondary)
                .textCase(.uppercase)

            Text(value)
                .font(.headline.weight(.semibold))
                .lineLimit(2)
                .minimumScaleFactor(0.85)

            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
}

struct WorkspaceStatusMetricChip: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: systemImage)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)

                Text(value)
                    .font(.subheadline.weight(.semibold))
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.thinMaterial, in: Capsule())
    }
}

struct WorkspaceConnectionBannerCard: View {
    let banner: WorkspaceConnectionBanner

    var body: some View {
        WorkspaceSurfaceCard {
            Label(banner.title, systemImage: banner.tone.symbolName)
                .font(.headline)
                .foregroundStyle(banner.tone.tintColor)

            Text(banner.message)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
    }
}

struct WorkspaceDiscoveredCameraList: View {
    let candidates: [DiscoveryCandidate]
    let canConnect: Bool
    let connect: (CameraDescriptor) -> Void

    var body: some View {
        WorkspaceSurfaceCard {
            Text("Discovered Cameras")
                .font(.headline)

            if candidates.isEmpty {
                Text("Searching the local network for compatible ARRI cameras.")
                    .foregroundStyle(.secondary)
            } else {
                ForEach(Array(candidates.enumerated()), id: \.element.descriptor.identifier) { item in
                    let candidate = item.element

                    VStack(alignment: .leading, spacing: 10) {
                        HStack(alignment: .top, spacing: 12) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(candidate.descriptor.displayName)
                                    .font(.headline)

                                Text("\(candidate.descriptor.familyDisplayName) • \(candidate.descriptor.endpoint.host):\(candidate.descriptor.endpoint.port)")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }

                            Spacer(minLength: 12)

                            Button("Connect") {
                                connect(candidate.descriptor)
                            }
                            .buttonStyle(.borderedProminent)
                            .disabled(!canConnect)
                        }

                        Text("Source: \(candidate.descriptor.discoverySource.rawValue.capitalized)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }

                    if item.offset < candidates.count - 1 {
                        Divider()
                    }
                }
            }
        }
    }
}

struct WorkspaceConnectionRequiredState: View {
    let title: String
    let message: String

    var body: some View {
        ContentUnavailableView(
            title,
            systemImage: "camera.macro.circle",
            description: Text(message)
        )
    }
}

extension WorkspaceConnectionBannerTone {
    var tintColor: Color {
        switch self {
        case .neutral:
            .yellow
        case .caution:
            .orange
        case .critical:
            .red
        }
    }

    var symbolName: String {
        switch self {
        case .neutral:
            "dot.radiowaves.left.and.right"
        case .caution:
            "exclamationmark.triangle.fill"
        case .critical:
            "xmark.octagon.fill"
        }
    }
}

extension WorkspaceSection {
    var title: String {
        switch self {
        case .control:
            "Control"
        case .playback:
            "Playback"
        case .timecode:
            "Timecode"
        case .look:
            "Look"
        case .diagnostics:
            "Diagnostics"
        }
    }

    var symbolName: String {
        switch self {
        case .control:
            "slider.horizontal.3"
        case .playback:
            "play.rectangle"
        case .timecode:
            "clock"
        case .look:
            "camera.filters"
        case .diagnostics:
            "waveform.path.ecg"
        }
    }
}

extension CameraMode {
    var displayName: String {
        switch self {
        case .liveControl:
            "Live"
        case .playback:
            "Playback"
        case .recording:
            "Recording"
        case .unavailable:
            "Unavailable"
        }
    }

    var symbolName: String {
        switch self {
        case .liveControl:
            "camera.aperture"
        case .playback:
            "play.circle"
        case .recording:
            "record.circle"
        case .unavailable:
            "questionmark.circle"
        }
    }

    var tintColor: Color {
        switch self {
        case .liveControl:
            .yellow
        case .playback:
            .orange
        case .recording:
            .red
        case .unavailable:
            .secondary
        }
    }
}

extension CameraSessionState {
    var label: String {
        switch self {
        case .idle:
            "Idle"
        case .discovering:
            "Discovering"
        case .connecting:
            "Connecting"
        case .authenticating:
            "Authenticating"
        case .subscribing:
            "Syncing"
        case .connected:
            "Connected"
        case .degraded:
            "Degraded"
        case .reconnecting:
            "Reconnecting"
        case .failed:
            "Failed"
        }
    }
}

extension CameraSessionHealth {
    var keepaliveDisplay: String {
        lastKeepaliveLatencyMS.map { "\($0) ms" } ?? "--"
    }
}

extension ConnectionState {
    var operatorLabel: String {
        switch self {
        case .idle:
            "Idle"
        case .discovering:
            "Discovering"
        case .connecting:
            "Connecting"
        case .authenticating:
            "Authenticating"
        case .subscribing:
            "Syncing"
        case .connected:
            "Healthy"
        case .degraded:
            "Degraded"
        case .reconnecting:
            "Reconnecting"
        case .failed:
            "Failed"
        }
    }

    var tintColor: Color {
        switch self {
        case .connected:
            .green
        case .degraded:
            .orange
        case .failed:
            .red
        case .idle, .discovering, .connecting, .authenticating, .subscribing, .reconnecting:
            .yellow
        }
    }

    var symbolName: String {
        switch self {
        case .connected:
            "checkmark.circle.fill"
        case .degraded:
            "exclamationmark.triangle.fill"
        case .failed:
            "xmark.circle.fill"
        case .idle, .discovering, .connecting, .authenticating, .subscribing, .reconnecting:
            "dot.radiowaves.left.and.right"
        }
    }
}

extension FrameRate {
    var displayName: String {
        "\(fps) fps"
    }
}

extension WhiteBalance {
    var displayName: String {
        "\(kelvin) K"
    }

    var tintDisplay: String {
        "Tint \(WorkspaceDisplayFormatter.signedNumber(tint))"
    }
}

extension ExposureIndex {
    var displayName: String {
        "EI \(iso)"
    }
}

extension NDFilter {
    var displayName: String {
        WorkspaceDisplayFormatter.ndPresetLabel(stop)
    }
}

extension ShutterAngle {
    var displayName: String {
        WorkspaceDisplayFormatter.angleLabel(degrees)
    }
}

extension TimecodeRunMode {
    var displayName: String {
        switch self {
        case .recordRun:
            "Record Run"
        case .freeRun:
            "Free Run"
        }
    }
}

extension CameraDescriptor {
    var familyDisplayName: String {
        switch family {
        case .alexaLF:
            "ALEXA LF"
        case .alexa35:
            "ALEXA 35"
        }
    }
}

extension CameraLiveState {
    var timecodeDisplay: String {
        WorkspaceDisplayFormatter.timecodeString(from: timecodeFrames, frameRate: frameRate)
    }

    var currentLookDisplay: String {
        lookName ?? "None"
    }

    var currentClipDisplay: String {
        WorkspaceDisplayFormatter.clipIdentifier(reel: currentReel, clipNumber: clipNumber)
    }

    var currentCodecDisplay: String {
        guard let codecIndex, codecOptions.indices.contains(codecIndex) else {
            return "--"
        }

        return codecOptions[codecIndex]
    }

    var remainingRecordTimeDisplay: String {
        WorkspaceDisplayFormatter.remainingRecordTime(seconds: remainingRecordSeconds)
    }

    var lensIrisDisplay: String {
        WorkspaceDisplayFormatter.tStop(millistops: lensIrisTStopMillistops)
    }

    var lensFocalLengthDisplay: String {
        WorkspaceDisplayFormatter.focalLength(millimetersTimesOneThousand: lensFocalLengthMillimetersTimesOneThousand)
    }

    var framelineDisplay: String {
        framelineName ?? "None"
    }

    var textureDisplay: String {
        textureName ?? "None"
    }

    var recordingResolutionDisplay: String {
        recordingResolutionIndex.map { "Preset \($0 + 1)" } ?? "--"
    }
}

enum WorkspaceDisplayFormatter {
    static func timecodeString(from totalFrames: UInt32?, frameRate: FrameRate?) -> String {
        guard let totalFrames, let frameRate else {
            return "--:--:--:--"
        }

        let fps = max(frameRate.fps, 1)
        let total = Int(totalFrames)
        let frames = total % fps
        let totalSeconds = total / fps
        let seconds = totalSeconds % 60
        let minutes = (totalSeconds / 60) % 60
        let hours = (totalSeconds / 3_600) % 24

        return String(format: "%02d:%02d:%02d:%02d", hours, minutes, seconds, frames)
    }

    static func signedNumber(_ value: Int) -> String {
        value > 0 ? "+\(value)" : "\(value)"
    }

    static func angleLabel(_ value: Double) -> String {
        "\(formattedDecimal(value))°"
    }

    static func ndPresetLabel(_ value: Double) -> String {
        value == 0 ? "Clear" : "ND \(formattedDecimal(value))"
    }

    static func clipIdentifier(reel: Int?, clipNumber: Int?) -> String {
        guard let reel, let clipNumber else {
            return "--"
        }

        return String(format: "R%03d C%03d", reel, clipNumber)
    }

    static func remainingRecordTime(seconds: UInt32?) -> String {
        guard let seconds else {
            return "--"
        }

        let total = Int(seconds)
        let hours = total / 3_600
        let minutes = (total % 3_600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        }

        return "\(minutes)m"
    }

    static func tStop(millistops: Int?) -> String {
        guard let millistops else {
            return "--"
        }

        if millistops == -1 {
            return "Invalid"
        }

        if millistops == -2 {
            return "Closed"
        }

        if millistops == -3 {
            return "Near Closed"
        }

        return "T\(formattedDecimal(Double(millistops) / 1_000.0))"
    }

    static func focalLength(millimetersTimesOneThousand: Int?) -> String {
        guard let millimetersTimesOneThousand, millimetersTimesOneThousand > 0 else {
            return "--"
        }

        return "\(formattedDecimal(Double(millimetersTimesOneThousand) / 1_000.0)) mm"
    }

    private static func formattedDecimal(_ value: Double) -> String {
        if value.rounded() == value {
            return String(Int(value))
        }

        return String(format: "%.1f", value)
    }
}
