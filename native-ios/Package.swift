// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ARRICameraControl",
    platforms: [
        .iOS(.v18),
        .macOS(.v14)
    ],
    products: [
        .library(name: "CameraDomain", targets: ["CameraDomain"]),
        .library(name: "CameraDiagnostics", targets: ["CameraDiagnostics"]),
        .library(name: "ARRICAPKit", targets: ["ARRICAPKit"]),
        .library(name: "CameraDiscovery", targets: ["CameraDiscovery"]),
        .library(name: "CameraSession", targets: ["CameraSession"]),
        .library(name: "CameraFeatures", targets: ["CameraFeatures"]),
        .library(name: "CameraMocks", targets: ["CameraMocks"])
    ],
    targets: [
        .target(name: "CameraDomain"),
        .target(name: "CameraDiagnostics", dependencies: ["CameraDomain"]),
        .target(name: "ARRICAPKit", dependencies: ["CameraDomain", "CameraDiagnostics"]),
        .target(name: "CameraDiscovery", dependencies: ["CameraDomain", "CameraDiagnostics", "ARRICAPKit"]),
        .target(name: "CameraSession", dependencies: ["ARRICAPKit", "CameraDiscovery", "CameraDomain", "CameraDiagnostics"]),
        .target(name: "CameraFeatures", dependencies: ["CameraSession", "CameraDiscovery", "CameraDomain", "ARRICAPKit", "CameraDiagnostics"]),
        .target(name: "CameraMocks", dependencies: ["ARRICAPKit", "CameraDiscovery", "CameraDomain", "CameraDiagnostics", "CameraSession"]),
        .testTarget(name: "CameraDomainTests", dependencies: ["CameraDomain"]),
        .testTarget(name: "CameraDiagnosticsTests", dependencies: ["CameraDiagnostics"]),
        .testTarget(name: "ARRICAPKitTests", dependencies: ["ARRICAPKit"]),
        .testTarget(name: "CameraDiscoveryTests", dependencies: ["CameraDiscovery", "ARRICAPKit", "CameraDomain"]),
        .testTarget(name: "CameraSessionTests", dependencies: ["CameraSession"]),
        .testTarget(name: "CameraFeaturesTests", dependencies: ["CameraFeatures", "ARRICAPKit", "CameraDomain", "CameraSession", "CameraDiscovery", "CameraDiagnostics"]),
        .testTarget(name: "CameraMocksTests", dependencies: ["CameraMocks"])
    ]
)
