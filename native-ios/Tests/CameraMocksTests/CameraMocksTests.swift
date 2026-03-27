import Testing
@testable import CameraMocks
@testable import CameraDomain
@testable import CameraFeatures

@Test func mockFactoryProducesLFAnd35Descriptors() {
    let lf = MockCameraFactory.makeLF()
    let alexa35 = MockCameraFactory.make35()

    #expect(lf.family == .alexaLF)
    #expect(alexa35.family == .alexa35)
    #expect(lf.endpoint.port == 7777)
}

@MainActor
@Test func simulatorWorkspaceBootstrapsMockDiscoveryAndConnects() async throws {
    let store = SimulatorWorkspaceStoreFactory.makeStore()

    await store.start()
    try await Task.sleep(for: .milliseconds(20))

    #expect(store.discoveryCandidates.count == 2)
    #expect(Set(store.discoveryCandidates.map(\.descriptor.family)) == Set([.alexa35, .alexaLF]))

    let lf = try #require(store.discoveryCandidates.first(where: { $0.descriptor.family == .alexaLF })?.descriptor)
    await store.connect(to: lf, clientName: "ARRI Control", password: nil)
    try await Task.sleep(for: .milliseconds(20))

    #expect(store.activeCamera == lf)
    #expect(store.sessionState == .connected(lf))
    #expect(store.liveState.frameRate == FrameRate(fps: 24))
    #expect(store.liveState.lookName == "Show LUT")
    #expect(store.sessionHealth.lastKeepaliveLatencyMS == 18)

    await store.startRecording()
    #expect(store.liveState.isRecording == true)

    await store.stop()
}
