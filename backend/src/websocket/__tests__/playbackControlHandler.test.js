/**
 * Unit tests for Playback Control Handler
 */

const { PlaybackControlHandler } = require('../playbackControlHandler.js');
const { CAP_COMMANDS, CAP_VARIABLES } = require('../../cap/types.js');
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

describe('PlaybackControlHandler', () => {
  let playbackControlHandler;
  let mockWsManager;
  let mockCapManager;
  let mockSocket;

  beforeEach(() => {
    // Mock CAP manager
    mockCapManager = new EventEmitter();
    mockCapManager.sendCommand = jest.fn().mockResolvedValue({ success: true });
    mockCapManager.isConnected = jest.fn().mockReturnValue(true);

    // Mock WebSocket manager
    mockWsManager = {
      capManager: mockCapManager,
      broadcast: jest.fn()
    };

    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn()
    };

    playbackControlHandler = new PlaybackControlHandler(mockWsManager);
  });

  describe('Playback Mode Control', () => {
    it('should handle entering playback mode', async () => {
      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_ENTER);
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:mode:changed', {
        isInPlaybackMode: true,
        timestamp: expect.any(String)
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:enter:success', {
        isInPlaybackMode: true,
        clipList: expect.any(Array),
        timestamp: expect.any(String)
      });
    });

    it('should handle exiting playback mode', async () => {
      // First enter playback mode
      playbackControlHandler.playbackState.isInPlaybackMode = true;

      await playbackControlHandler.handleExitPlaybackMode(mockSocket);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_EXIT);
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:mode:changed', {
        isInPlaybackMode: false,
        timestamp: expect.any(String)
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:exit:success', {
        isInPlaybackMode: false,
        timestamp: expect.any(String)
      });
    });

    it('should check connection before entering playback mode', async () => {
      mockCapManager.isConnected.mockReturnValue(false);

      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:enter:error', {
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED',
        timestamp: expect.any(String)
      });
    });

    it('should handle playback mode entry errors', async () => {
      const error = new Error('Playback enter failed');
      error.code = 'PLAYBACK_ERROR';
      mockCapManager.sendCommand.mockRejectedValue(error);

      await playbackControlHandler.handleEnterPlaybackMode(mockSocket, {});

      expect(mockSocket.emit).toHaveBeenCalledWith('playback:enter:error', {
        message: 'Playback enter failed',
        code: 'PLAYBACK_ERROR',
        category: 'command',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Clip List Management', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
      playbackControlHandler.playbackState.clipList = [
        { index: 0, name: 'Clip_001.mov', totalFrames: 2160 },
        { index: 1, name: 'Clip_002.mov', totalFrames: 3240 }
      ];
    });

    it('should handle clip list requests', async () => {
      await playbackControlHandler.handleGetClipList(mockSocket, {});

      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipList:success', {
        clips: expect.any(Array),
        totalClips: 2,
        timestamp: expect.any(String)
      });
    });

    it('should refresh clip list when requested', async () => {
      const refreshSpy = jest.spyOn(playbackControlHandler, 'refreshClipList').mockResolvedValue();

      await playbackControlHandler.handleGetClipList(mockSocket, { refresh: true });

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should check connection before getting clip list', async () => {
      mockCapManager.isConnected.mockReturnValue(false);

      await playbackControlHandler.handleGetClipList(mockSocket, {});

      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipList:error', {
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Playback Control', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
      playbackControlHandler.playbackState.clipList = [
        { index: 0, name: 'Clip_001.mov', totalFrames: 2160 },
        { index: 1, name: 'Clip_002.mov', totalFrames: 3240 }
      ];
    });

    it('should handle playback start', async () => {
      await playbackControlHandler.handlePlaybackStart(mockSocket, {});

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_START);
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:status:changed', {
        status: 'playing',
        currentClip: null,
        speed: 1.0,
        timestamp: expect.any(String)
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:start:success', expect.objectContaining({
        status: 'playing',
        speed: 1.0
      }));
    });

    it('should handle playback start with clip selection', async () => {
      await playbackControlHandler.handlePlaybackStart(mockSocket, { clipIndex: 1 });

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_CLIP_SKIP, {
        clipIndex: 1
      });
      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_START);
    });

    it('should validate clip index for playback start', async () => {
      await playbackControlHandler.handlePlaybackStart(mockSocket, { clipIndex: 999 });

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:start:error', {
        message: 'Invalid clip index',
        code: 'INVALID_CLIP_INDEX',
        availableClips: 2,
        timestamp: expect.any(String)
      });
    });

    it('should handle playback pause', async () => {
      await playbackControlHandler.handlePlaybackPause(mockSocket);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_PAUSE);
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:status:changed', {
        status: 'paused',
        currentClip: null,
        position: 0,
        timestamp: expect.any(String)
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:pause:success', expect.objectContaining({
        status: 'paused'
      }));
    });

    it('should check playback mode before playback operations', async () => {
      playbackControlHandler.playbackState.isInPlaybackMode = false;

      await playbackControlHandler.handlePlaybackStart(mockSocket, {});

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:start:error', {
        message: 'Not in playback mode',
        code: 'NOT_IN_PLAYBACK_MODE',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Playback Speed Control', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
    });

    it('should handle valid playback speed changes', async () => {
      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 2 });

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_SPEED, {
        speed: 2
      });
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:speed:changed', {
        speed: 2,
        status: 'playing',
        timestamp: expect.any(String)
      });
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:speed:success', {
        speed: 2,
        status: 'playing',
        timestamp: expect.any(String)
      });
    });

    it('should handle pause speed (0)', async () => {
      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 0 });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:speed:changed', {
        speed: 0,
        status: 'paused',
        timestamp: expect.any(String)
      });
    });

    it('should validate playback speed values', async () => {
      await playbackControlHandler.handlePlaybackSpeed(mockSocket, { speed: 10 });

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:speed:error', {
        message: 'Invalid playback speed data',
        code: 'INVALID_SPEED',
        errors: expect.any(Object),
        supportedSpeeds: expect.any(Array),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Playback Shuttle Control', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
      playbackControlHandler.playbackState.totalFrames = 2160;
    });

    it('should handle valid shuttle positions', async () => {
      await playbackControlHandler.handlePlaybackShuttle(mockSocket, { position: 0.5 });

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_SHUTTLE, {
        position: 0.5
      });
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:position:changed', {
        position: 1080, // 50% of 2160 frames
        totalFrames: 2160,
        percentage: 0.5,
        timestamp: expect.any(String)
      });
    });

    it('should validate shuttle position range', async () => {
      await playbackControlHandler.handlePlaybackShuttle(mockSocket, { position: 1.5 });

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:shuttle:error', {
        message: 'Invalid shuttle position data',
        code: 'INVALID_POSITION',
        errors: expect.any(Object),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Clip Skip Control', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
      playbackControlHandler.playbackState.clipList = [
        { index: 0, name: 'Clip_001.mov', totalFrames: 2160 },
        { index: 1, name: 'Clip_002.mov', totalFrames: 3240 }
      ];
    });

    it('should handle valid clip skip', async () => {
      await playbackControlHandler.handleClipSkip(mockSocket, { clipIndex: 1 });

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.PLAYBACK_CLIP_SKIP, {
        clipIndex: 1
      });
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:clip:changed', {
        currentClip: expect.objectContaining({ index: 1, name: 'Clip_002.mov' }),
        clipIndex: 1,
        position: 0,
        timestamp: expect.any(String)
      });
    });

    it('should validate clip index for skip', async () => {
      await playbackControlHandler.handleClipSkip(mockSocket, { clipIndex: 999 });

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:clipSkip:error', {
        message: 'Invalid clip index',
        code: 'INVALID_CLIP_INDEX',
        availableClips: 2,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Playback State Management', () => {
    it('should return current playback state', () => {
      playbackControlHandler.playbackState.isInPlaybackMode = true;
      playbackControlHandler.playbackState.playbackStatus = 'playing';

      playbackControlHandler.handleGetPlaybackState(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('playback:state', {
        isInPlaybackMode: true,
        currentClip: null,
        playbackStatus: 'playing',
        currentPosition: 0,
        totalFrames: 0,
        playbackSpeed: 1.0,
        clipList: [],
        lastUpdate: null,
        timestamp: expect.any(String)
      });
    });

    it('should handle state errors', () => {
      // Mock emit to throw error on first call, succeed on second
      let callCount = 0;
      mockSocket.emit.mockImplementation((event) => {
        callCount++;
        if (callCount === 1 && event === 'playback:state') {
          throw new Error('Emit failed');
        }
      });

      playbackControlHandler.handleGetPlaybackState(mockSocket);

      // Should handle error gracefully and emit error response
      expect(mockSocket.emit).toHaveBeenCalledWith('playback:state:error', {
        message: 'Failed to get playback state',
        code: 'STATE_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('CAP Variable Updates', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.clipList = [
        { index: 0, name: 'Clip_001.mov', totalFrames: 2160 },
        { index: 1, name: 'Clip_002.mov', totalFrames: 3240 }
      ];
    });

    it('should update state from CAP variable changes', () => {
      playbackControlHandler.updateStateFromCAP(CAP_VARIABLES.PLAYBACK_CLIP_INDEX, 1);

      expect(playbackControlHandler.playbackState.currentClip.index).toBe(1);
      expect(playbackControlHandler.playbackState.totalFrames).toBe(3240);
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('playback:clip:changed', {
        currentClip: expect.objectContaining({ index: 1 }),
        clipIndex: 1,
        timestamp: expect.any(String)
      });
    });

    it('should not broadcast if value unchanged', () => {
      // Set initial value
      playbackControlHandler.playbackState.currentClip = { index: 1 };

      // Update with same value
      playbackControlHandler.updateStateFromCAP(CAP_VARIABLES.PLAYBACK_CLIP_INDEX, 1);

      expect(mockWsManager.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('Validation Methods', () => {
    beforeEach(() => {
      playbackControlHandler.playbackState.clipList = [
        { index: 0, name: 'Clip_001.mov' },
        { index: 1, name: 'Clip_002.mov' }
      ];
    });

    it('should validate clip indices correctly', () => {
      expect(playbackControlHandler.isValidClipIndex(0)).toBe(true);
      expect(playbackControlHandler.isValidClipIndex(1)).toBe(true);
      expect(playbackControlHandler.isValidClipIndex(2)).toBe(false);
      expect(playbackControlHandler.isValidClipIndex(-1)).toBe(false);
      expect(playbackControlHandler.isValidClipIndex('0')).toBe(false);
    });

    it('should validate playback speeds correctly', () => {
      expect(playbackControlHandler.isValidPlaybackSpeed(1)).toBe(true);
      expect(playbackControlHandler.isValidPlaybackSpeed(2)).toBe(true);
      expect(playbackControlHandler.isValidPlaybackSpeed(0)).toBe(true);
      expect(playbackControlHandler.isValidPlaybackSpeed(-1)).toBe(true);
      expect(playbackControlHandler.isValidPlaybackSpeed(10)).toBe(false);
      expect(playbackControlHandler.isValidPlaybackSpeed('1')).toBe(false);
    });
  });

  describe('Supported Values', () => {
    it('should return supported playback speeds', () => {
      const supportedSpeeds = playbackControlHandler.getSupportedSpeeds();

      expect(Array.isArray(supportedSpeeds)).toBe(true);
      expect(supportedSpeeds).toContain(1);
      expect(supportedSpeeds).toContain(0);
      expect(supportedSpeeds).toContain(-1);
      expect(supportedSpeeds).toContain(2);
    });
  });

  describe('Clip Cache Management', () => {
    it('should cache clip metadata', async () => {
      const clip = { index: 0, name: 'Test.mov', totalFrames: 1000 };
      
      await playbackControlHandler.cacheClipMetadata(clip);
      
      const cached = playbackControlHandler.getCachedClipMetadata(0);
      expect(cached).toEqual(clip);
    });

    it('should return null for expired cache entries', async () => {
      const clip = { index: 0, name: 'Test.mov', totalFrames: 1000 };
      
      await playbackControlHandler.cacheClipMetadata(clip);
      
      // Mock expired cache
      const cacheEntry = playbackControlHandler.clipCache.get('clip_0');
      cacheEntry.expiresAt = Date.now() - 1000; // Expired 1 second ago
      
      const cached = playbackControlHandler.getCachedClipMetadata(0);
      expect(cached).toBeNull();
    });

    it('should clear clip cache', () => {
      playbackControlHandler.clipCache.set('test', { data: 'test' });
      
      playbackControlHandler.clearClipCache();
      
      expect(playbackControlHandler.clipCache.size).toBe(0);
    });
  });
});