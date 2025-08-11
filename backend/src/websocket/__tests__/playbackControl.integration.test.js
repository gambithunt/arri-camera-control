/**
 * Integration tests for Playback Control API
 */

const { PlaybackControlHandler } = require('../playbackControlHandler.js');
const { WebSocketManager } = require('../websocketManager.js');
const { EventEmitter } = require('events');

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Playback Control API Integration', () => {
  let playbackControlHandler;
  let mockWsManager;
  let mockCapManager;
  let mockSocket;
  let mockIO;

  beforeEach(() => {
    // Mock Socket.io server
    mockIO = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() })
    };

    // Mock CAP manager
    mockCapManager = new EventEmitter();
    mockCapManager.sendCommand = jest.fn().mockResolvedValue({ success: true });
    mockCapManager.isConnected = jest.fn().mockReturnValue(true);
    mockCapManager.getStatus = jest.fn().mockReturnValue({
      state: 'connected',
      connected: true
    });

    // Mock WebSocket manager
    mockWsManager = {
      io: mockIO,
      capManager: mockCapManager,
      broadcast: jest.fn(),
      connections: new Map()
    };

    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn()
    };

    playbackControlHandler = new PlaybackControlHandler(mockWsManager);
  });

  describe('Complete Playback Workflow', () => {
    it('should handle complete playback workflow', async () => {
      // Enter playback mode
      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:enter:success', expect.objectContaining({
        isInPlaybackMode: true,
        clipList: expect.any(Array)
      }));

      // Get clip list
      await playbackControlHandler.handleGetClipList(mockSocket, {});
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipList:success', expect.objectContaining({
        clips: expect.any(Array),
        totalClips: expect.any(Number)
      }));

      // Start playback with clip selection
      await playbackControlHandler.handlePlaybackStart(mockSocket, { clipIndex: 0 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:start:success', expect.objectContaining({
        status: 'playing',
        speed: 1.0
      }));

      // Change playback speed
      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 2 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:speed:success', expect.objectContaining({
        speed: 2,
        status: 'playing'
      }));

      // Shuttle to position
      await playbackControlHandler.handlePlaybackShuttle(mockSocket, { position: 0.5 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:shuttle:success', expect.objectContaining({
        percentage: 0.5
      }));

      // Pause playback
      await playbackControlHandler.handlePlaybackPause(mockSocket);
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:pause:success', expect.objectContaining({
        status: 'paused'
      }));

      // Skip to next clip
      await playbackControlHandler.handleClipSkip(mockSocket, { clipIndex: 1 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipSkip:success', expect.objectContaining({
        clipIndex: 1
      }));

      // Exit playback mode
      await playbackControlHandler.handleExitPlaybackMode(mockSocket);
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:exit:success', expect.objectContaining({
        isInPlaybackMode: false
      }));

      // Verify all CAP commands were sent
      expect(mockCapManager.sendCommand).toHaveBeenCalledTimes(9); // enter, get clip list, start, clip skip, speed, shuttle, pause, clip skip, exit
      
      // Verify all broadcasts were made
      expect(mockWsManager.broadcast).toHaveBeenCalledTimes(7); // mode changes, status changes, etc.
    });

    it('should maintain playback state correctly', async () => {
      // Set up playback state
      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});
      await playbackControlHandler.handlePlaybackStart(mockSocket, { clipIndex: 0 });
      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 2 });

      // Get current state
      playbackControlHandler.handleGetPlaybackState(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('playback:state', expect.objectContaining({
        isInPlaybackMode: true,
        playbackStatus: 'playing',
        playbackSpeed: 2,
        currentClip: expect.any(Object)
      }));
    });

    it('should handle validation errors for all playback controls', async () => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;

      // Test invalid playback speed
      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 10 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:speed:error', expect.objectContaining({
        code: 'INVALID_SPEED'
      }));

      // Test invalid shuttle position
      await playbackControlHandler.handlePlaybackShuttle(mockSocket, { position: 1.5 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:shuttle:error', expect.objectContaining({
        code: 'INVALID_POSITION'
      }));

      // Test invalid clip index
      await playbackControlHandler.handleClipSkip(mockSocket, { clipIndex: 999 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipSkip:error', expect.objectContaining({
        code: 'INVALID_CLIP_INDEX'
      }));

      // No CAP commands should have been sent for invalid inputs
      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should handle disconnected camera state', async () => {
      mockCapManager.isConnected.mockReturnValue(false);

      // Try to enter playback mode when disconnected
      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:enter:error', expect.objectContaining({
        code: 'NOT_CONNECTED'
      }));

      // Try to get clip list when disconnected
      await playbackControlHandler.handleGetClipList(mockSocket, {});
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipList:error', expect.objectContaining({
        code: 'NOT_CONNECTED'
      }));

      // No CAP commands should have been sent
      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should handle playback mode requirements', async () => {
      // Try playback operations without being in playback mode
      await playbackControlHandler.handlePlaybackStart(mockSocket, {});
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:start:error', expect.objectContaining({
        code: 'NOT_IN_PLAYBACK_MODE'
      }));

      await playbackControlHandler.handlePlaybackPause(mockSocket);
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:pause:error', expect.objectContaining({
        code: 'NOT_IN_PLAYBACK_MODE'
      }));

      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 2 });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:speed:error', expect.objectContaining({
        code: 'NOT_IN_PLAYBACK_MODE'
      }));

      // No CAP commands should have been sent
      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should handle CAP command failures', async () => {
      const error = new Error('CAP command failed');
      error.code = 'COMMAND_ERROR';
      mockCapManager.sendCommand.mockRejectedValue(error);

      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});
      
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:enter:error', expect.objectContaining({
        message: 'CAP command failed',
        code: 'COMMAND_ERROR'
      }));
    });
  });

  describe('Real-time State Updates', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.clipList = [
        { index: 0, name: 'Clip_001.mov', totalFrames: 2160 },
        { index: 1, name: 'Clip_002.mov', totalFrames: 3240 }
      ];
    });

    it('should update state from CAP variable changes', () => {
      const { CAP_VARIABLES } = require('../../cap/types.js');

      // Simulate CAP variable updates
      playbackControlHandler.updateStateFromCAP(CAP_VARIABLES.PLAYBACK_CLIP_INDEX, 1);

      // Verify state was updated
      expect(playbackControlHandler.playbackState.currentClip.index).toBe(1);
      expect(playbackControlHandler.playbackState.totalFrames).toBe(3240);

      // Verify broadcast was sent
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:clip:changed', expect.objectContaining({
        currentClip: expect.objectContaining({ index: 1 }),
        clipIndex: 1
      }));
    });

    it('should not broadcast unchanged values', () => {
      const { CAP_VARIABLES } = require('../../cap/types.js');

      // Set initial value
      playbackControlHandler.playbackState.currentClip = { index: 1 };

      // Update with same value
      playbackControlHandler.updateStateFromCAP(CAP_VARIABLES.PLAYBACK_CLIP_INDEX, 1);

      // Should not broadcast
      expect(mockWsManager.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
    });

    it('should sanitize all playback control inputs', async () => {
      // Test with potentially malicious input
      const maliciousData = {
        speed: 2,
        __proto__: { malicious: true },
        constructor: { prototype: { evil: true } },
        extraField: 'should be removed'
      };

      await playbackControlHandler.handlePlaybackSpeed(mockSocket, maliciousData);

      // Should succeed with sanitized input
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:speed:success', expect.objectContaining({
        speed: 2
      }));

      // Verify CAP command was called with clean data
      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          speed: 2
        })
      );
    });
  });

  describe('Clip Cache Management', () => {
    it('should cache and retrieve clip metadata', async () => {
      const clip = { index: 0, name: 'Test.mov', totalFrames: 1000 };
      
      await playbackControlHandler.cacheClipMetadata(clip);
      
      const cached = playbackControlHandler.getCachedClipMetadata(0);
      expect(cached).toEqual(clip);
    });

    it('should handle cache expiry', async () => {
      const clip = { index: 0, name: 'Test.mov', totalFrames: 1000 };
      
      await playbackControlHandler.cacheClipMetadata(clip);
      
      // Mock expired cache
      const cacheEntry = playbackControlHandler.clipCache.get('clip_0');
      cacheEntry.expiresAt = Date.now() - 1000; // Expired 1 second ago
      
      const cached = playbackControlHandler.getCachedClipMetadata(0);
      expect(cached).toBeNull();
    });

    it('should clear cache when requested', () => {
      playbackControlHandler.clipCache.set('test', { data: 'test' });
      
      playbackControlHandler.clearClipCache();
      
      expect(playbackControlHandler.clipCache.size).toBe(0);
    });
  });

  describe('Supported Values', () => {
    it('should provide supported playback speeds', () => {
      const supportedSpeeds = playbackControlHandler.getSupportedSpeeds();

      expect(Array.isArray(supportedSpeeds)).toBe(true);
      expect(supportedSpeeds).toContain(1);
      expect(supportedSpeeds).toContain(0);
      expect(supportedSpeeds).toContain(-1);
      expect(supportedSpeeds).toContain(2);
      expect(supportedSpeeds).toContain(4);
    });
  });
});