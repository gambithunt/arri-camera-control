/**
 * Playback Control Handler
 * Handles playback control WebSocket events for clip listing, playback, and transport commands
 */

const { logger } = require('../utils/logger.js');
const { inputValidator } = require('../utils/inputValidation.js');
const { CAP_COMMANDS, CAP_VARIABLES } = require('../cap/types.js');

class PlaybackControlHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.capManager = wsManager.capManager;
    
    // Playback state cache
    this.playbackState = {
      isInPlaybackMode: false,
      currentClip: null,
      playbackStatus: 'stopped', // stopped, playing, paused
      currentPosition: 0, // in frames
      totalFrames: 0,
      playbackSpeed: 1.0,
      clipList: [],
      lastUpdate: null
    };

    // Clip metadata cache
    this.clipCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

    // Supported playback speeds
    this.supportedSpeeds = [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4];
  }

  /**
   * Handle entering playback mode
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Playback mode data
   */
  async handleEnterPlaybackMode(socket, data) {
    try {
      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:enter:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} entering playback mode`, {
        clientId: socket.id
      });

      // Send CAP command to enter playback mode
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_ENTER);

      // Update local state
      this.playbackState.isInPlaybackMode = true;
      this.playbackState.playbackStatus = 'stopped';
      this.playbackState.lastUpdate = new Date().toISOString();

      // Get initial clip list
      await this.refreshClipList();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:mode:changed', {
        isInPlaybackMode: true,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:enter:success', {
        isInPlaybackMode: true,
        clipList: this.playbackState.clipList,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Playback mode entered successfully`, {
        clientId: socket.id,
        clipCount: this.playbackState.clipList.length
      });

    } catch (error) {
      logger.error(`Enter playback mode failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:enter:error', {
        message: error.message,
        code: error.code || 'PLAYBACK_ENTER_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle exiting playback mode
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleExitPlaybackMode(socket) {
    try {
      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:exit:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} exiting playback mode`, {
        clientId: socket.id
      });

      // Send CAP command to exit playback mode
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_EXIT);

      // Update local state
      this.playbackState.isInPlaybackMode = false;
      this.playbackState.playbackStatus = 'stopped';
      this.playbackState.currentClip = null;
      this.playbackState.currentPosition = 0;
      this.playbackState.totalFrames = 0;
      this.playbackState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:mode:changed', {
        isInPlaybackMode: false,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:exit:success', {
        isInPlaybackMode: false,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Playback mode exited successfully`, {
        clientId: socket.id
      });

    } catch (error) {
      logger.error(`Exit playback mode failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:exit:error', {
        message: error.message,
        code: error.code || 'PLAYBACK_EXIT_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle clip list request
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Request data
   */
  async handleGetClipList(socket, data = {}) {
    try {
      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:clipList:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { refresh = false } = data;

      logger.debug(`Client ${socket.id} requesting clip list`, {
        clientId: socket.id,
        refresh
      });

      // Refresh clip list if requested or if cache is empty
      if (refresh || this.playbackState.clipList.length === 0) {
        await this.refreshClipList();
      }

      // Send clip list to client
      socket.emit('playback:clipList:success', {
        clips: this.playbackState.clipList,
        totalClips: this.playbackState.clipList.length,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Clip list sent to client ${socket.id}`, {
        clientId: socket.id,
        clipCount: this.playbackState.clipList.length
      });

    } catch (error) {
      logger.error(`Get clip list failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:clipList:error', {
        message: error.message,
        code: error.code || 'CLIP_LIST_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle playback start
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Playback data
   */
  async handlePlaybackStart(socket, data = {}) {
    try {
      // Check if in playback mode
      if (!this.playbackState.isInPlaybackMode) {
        socket.emit('playback:start:error', {
          message: 'Not in playback mode',
          code: 'NOT_IN_PLAYBACK_MODE',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:start:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { clipIndex } = data;

      logger.info(`Client ${socket.id} starting playback`, {
        clientId: socket.id,
        clipIndex
      });

      // If clip index is provided, select the clip first
      if (clipIndex !== undefined) {
        if (!this.isValidClipIndex(clipIndex)) {
          socket.emit('playback:start:error', {
            message: 'Invalid clip index',
            code: 'INVALID_CLIP_INDEX',
            availableClips: this.playbackState.clipList.length,
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Send CAP command to skip to clip
        await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_CLIP_SKIP, {
          clipIndex
        });

        this.playbackState.currentClip = this.playbackState.clipList[clipIndex];
      }

      // Send CAP command to start playback
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_START);

      // Update local state
      this.playbackState.playbackStatus = 'playing';
      this.playbackState.playbackSpeed = 1.0;
      this.playbackState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:status:changed', {
        status: 'playing',
        currentClip: this.playbackState.currentClip,
        speed: this.playbackState.playbackSpeed,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:start:success', {
        status: 'playing',
        currentClip: this.playbackState.currentClip,
        speed: this.playbackState.playbackSpeed,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Playback started successfully`, {
        clientId: socket.id,
        clipIndex,
        currentClip: this.playbackState.currentClip?.name
      });

    } catch (error) {
      logger.error(`Playback start failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:start:error', {
        message: error.message,
        code: error.code || 'PLAYBACK_START_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle playback pause
   * @param {Socket} socket - Socket.io socket instance
   */
  async handlePlaybackPause(socket) {
    try {
      // Check if in playback mode
      if (!this.playbackState.isInPlaybackMode) {
        socket.emit('playback:pause:error', {
          message: 'Not in playback mode',
          code: 'NOT_IN_PLAYBACK_MODE',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:pause:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} pausing playback`, {
        clientId: socket.id
      });

      // Send CAP command to pause playback
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_PAUSE);

      // Update local state
      this.playbackState.playbackStatus = 'paused';
      this.playbackState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:status:changed', {
        status: 'paused',
        currentClip: this.playbackState.currentClip,
        position: this.playbackState.currentPosition,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:pause:success', {
        status: 'paused',
        currentClip: this.playbackState.currentClip,
        position: this.playbackState.currentPosition,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Playback paused successfully`, {
        clientId: socket.id
      });

    } catch (error) {
      logger.error(`Playback pause failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:pause:error', {
        message: error.message,
        code: error.code || 'PLAYBACK_PAUSE_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle playback speed control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Speed data
   */
  async handlePlaybackSpeed(socket, data) {
    try {
      // Sanitize and validate input
      const sanitizedData = inputValidator.sanitizeObject(data);
      const validation = inputValidator.validateCameraControl(sanitizedData, 'playbackSpeed');
      
      if (!validation.isValid) {
        socket.emit('playback:speed:error', {
          message: 'Invalid playback speed data',
          code: 'INVALID_SPEED',
          errors: validation.errors,
          supportedSpeeds: this.supportedSpeeds,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { speed } = validation.sanitizedInputs;

      // Check if in playback mode
      if (!this.playbackState.isInPlaybackMode) {
        socket.emit('playback:speed:error', {
          message: 'Not in playback mode',
          code: 'NOT_IN_PLAYBACK_MODE',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:speed:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} setting playback speed to ${speed}x`, {
        clientId: socket.id,
        speed
      });

      // Send CAP command to set playback speed
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_SPEED, {
        speed
      });

      // Update local state
      this.playbackState.playbackSpeed = speed;
      this.playbackState.playbackStatus = speed === 0 ? 'paused' : 'playing';
      this.playbackState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:speed:changed', {
        speed,
        status: this.playbackState.playbackStatus,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:speed:success', {
        speed,
        status: this.playbackState.playbackStatus,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Playback speed set to ${speed}x successfully`, {
        clientId: socket.id,
        speed
      });

    } catch (error) {
      logger.error(`Playback speed control failed for client ${socket.id}:`, {
        clientId: socket.id,
        speed: data.speed,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:speed:error', {
        message: error.message,
        code: error.code || 'PLAYBACK_SPEED_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle playback shuttle control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Shuttle data
   */
  async handlePlaybackShuttle(socket, data) {
    try {
      // Sanitize and validate input
      const sanitizedData = inputValidator.sanitizeObject(data);
      const validation = inputValidator.validateCameraControl(sanitizedData, 'playbackShuttle');
      
      if (!validation.isValid) {
        socket.emit('playback:shuttle:error', {
          message: 'Invalid shuttle position data',
          code: 'INVALID_POSITION',
          errors: validation.errors,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { position } = validation.sanitizedInputs;

      // Check if in playback mode
      if (!this.playbackState.isInPlaybackMode) {
        socket.emit('playback:shuttle:error', {
          message: 'Not in playback mode',
          code: 'NOT_IN_PLAYBACK_MODE',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:shuttle:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} shuttling to position ${position}`, {
        clientId: socket.id,
        position
      });

      // Send CAP command to shuttle to position
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_SHUTTLE, {
        position
      });

      // Update local state
      this.playbackState.currentPosition = Math.round(position * this.playbackState.totalFrames);
      this.playbackState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:position:changed', {
        position: this.playbackState.currentPosition,
        totalFrames: this.playbackState.totalFrames,
        percentage: position,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:shuttle:success', {
        position: this.playbackState.currentPosition,
        totalFrames: this.playbackState.totalFrames,
        percentage: position,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Playback shuttled to position ${position} successfully`, {
        clientId: socket.id,
        position,
        frame: this.playbackState.currentPosition
      });

    } catch (error) {
      logger.error(`Playback shuttle failed for client ${socket.id}:`, {
        clientId: socket.id,
        position: data.position,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:shuttle:error', {
        message: error.message,
        code: error.code || 'PLAYBACK_SHUTTLE_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle clip skip
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Clip skip data
   */
  async handleClipSkip(socket, data) {
    try {
      // Sanitize and validate input
      const sanitizedData = inputValidator.sanitizeObject(data);
      const validation = inputValidator.validateCameraControl(sanitizedData, 'clipSkip');
      
      if (!validation.isValid) {
        socket.emit('playback:clipSkip:error', {
          message: 'Invalid clip skip data',
          code: 'INVALID_CLIP_INDEX',
          errors: validation.errors,
          availableClips: this.playbackState.clipList.length,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { clipIndex } = validation.sanitizedInputs;

      // Additional validation for clip index range
      if (!this.isValidClipIndex(clipIndex)) {
        socket.emit('playback:clipSkip:error', {
          message: 'Invalid clip index',
          code: 'INVALID_CLIP_INDEX',
          availableClips: this.playbackState.clipList.length,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if in playback mode
      if (!this.playbackState.isInPlaybackMode) {
        socket.emit('playback:clipSkip:error', {
          message: 'Not in playback mode',
          code: 'NOT_IN_PLAYBACK_MODE',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('playback:clipSkip:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} skipping to clip ${clipIndex}`, {
        clientId: socket.id,
        clipIndex
      });

      // Send CAP command to skip to clip
      await this.capManager.sendCommand(CAP_COMMANDS.PLAYBACK_CLIP_SKIP, {
        clipIndex
      });

      // Update local state
      this.playbackState.currentClip = this.playbackState.clipList[clipIndex];
      this.playbackState.currentPosition = 0;
      this.playbackState.totalFrames = this.playbackState.currentClip?.totalFrames || 0;
      this.playbackState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('playback:clip:changed', {
        currentClip: this.playbackState.currentClip,
        clipIndex,
        position: 0,
        timestamp: this.playbackState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('playback:clipSkip:success', {
        currentClip: this.playbackState.currentClip,
        clipIndex,
        position: 0,
        timestamp: this.playbackState.lastUpdate
      });

      logger.info(`Clip skip to ${clipIndex} successful`, {
        clientId: socket.id,
        clipIndex,
        clipName: this.playbackState.currentClip?.name
      });

    } catch (error) {
      logger.error(`Clip skip failed for client ${socket.id}:`, {
        clientId: socket.id,
        clipIndex: data.clipIndex,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:clipSkip:error', {
        message: error.message,
        code: error.code || 'CLIP_SKIP_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get current playback state
   * @param {Socket} socket - Socket.io socket instance
   */
  handleGetPlaybackState(socket) {
    try {
      socket.emit('playback:state', {
        ...this.playbackState,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Playback state sent to client ${socket.id}`, {
        clientId: socket.id,
        state: this.playbackState
      });

    } catch (error) {
      logger.error(`Failed to get playback state for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('playback:state:error', {
        message: 'Failed to get playback state',
        code: 'STATE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Refresh clip list from camera
   */
  async refreshClipList() {
    try {
      logger.debug('Refreshing clip list from camera');

      // Send CAP command to get clip list
      const response = await this.capManager.sendCommand(CAP_COMMANDS.GET_CLIP_LIST);

      // Parse clip list from response
      const clips = this.parseClipListResponse(response);

      // Update cache with metadata
      for (const clip of clips) {
        await this.cacheClipMetadata(clip);
      }

      // Update state
      this.playbackState.clipList = clips;
      this.playbackState.lastUpdate = new Date().toISOString();

      logger.info(`Clip list refreshed: ${clips.length} clips found`);

    } catch (error) {
      logger.error('Failed to refresh clip list:', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Parse clip list response from CAP
   * @param {Object} response - CAP response
   * @returns {Array} Parsed clip list
   */
  parseClipListResponse(response) {
    // This would parse the actual CAP response format
    // For now, return mock data structure
    const mockClips = [
      {
        index: 0,
        name: 'Clip_001.mov',
        duration: '00:01:30:00',
        totalFrames: 2160, // 90 seconds at 24fps
        resolution: '4K UHD',
        codec: 'ProRes 422',
        frameRate: 24,
        size: '2.1 GB',
        timestamp: '2024-01-15T10:30:00Z'
      },
      {
        index: 1,
        name: 'Clip_002.mov',
        duration: '00:02:15:00',
        totalFrames: 3240, // 135 seconds at 24fps
        resolution: '4K UHD',
        codec: 'ProRes 422',
        frameRate: 24,
        size: '3.2 GB',
        timestamp: '2024-01-15T10:32:00Z'
      }
    ];

    return mockClips;
  }

  /**
   * Cache clip metadata
   * @param {Object} clip - Clip information
   */
  async cacheClipMetadata(clip) {
    const cacheKey = `clip_${clip.index}`;
    const cacheEntry = {
      clip,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.cacheExpiry
    };

    this.clipCache.set(cacheKey, cacheEntry);
  }

  /**
   * Get clip metadata from cache
   * @param {number} clipIndex - Clip index
   * @returns {Object|null} Cached clip metadata
   */
  getCachedClipMetadata(clipIndex) {
    const cacheKey = `clip_${clipIndex}`;
    const cacheEntry = this.clipCache.get(cacheKey);

    if (!cacheEntry || Date.now() > cacheEntry.expiresAt) {
      this.clipCache.delete(cacheKey);
      return null;
    }

    return cacheEntry.clip;
  }

  /**
   * Validate clip index
   * @param {number} clipIndex - Clip index to validate
   * @returns {boolean} Whether clip index is valid
   */
  isValidClipIndex(clipIndex) {
    return typeof clipIndex === 'number' && 
           clipIndex >= 0 && 
           clipIndex < this.playbackState.clipList.length;
  }

  /**
   * Validate playback speed
   * @param {number} speed - Playback speed to validate
   * @returns {boolean} Whether speed is valid
   */
  isValidPlaybackSpeed(speed) {
    return typeof speed === 'number' && 
           this.supportedSpeeds.includes(speed);
  }

  /**
   * Update playback state from CAP variable changes
   * @param {number} variableId - Variable ID
   * @param {*} value - New value
   */
  updateStateFromCAP(variableId, value) {
    let changed = false;
    const timestamp = new Date().toISOString();

    switch (variableId) {
      case CAP_VARIABLES.PLAYBACK_CLIP_INDEX:
        if (this.playbackState.currentClip?.index !== value) {
          const clip = this.playbackState.clipList[value];
          if (clip) {
            this.playbackState.currentClip = clip;
            this.playbackState.totalFrames = clip.totalFrames;
            this.wsManager.broadcast('playback:clip:changed', { 
              currentClip: clip, 
              clipIndex: value,
              timestamp 
            });
            changed = true;
          }
        }
        break;
    }

    if (changed) {
      this.playbackState.lastUpdate = timestamp;
      logger.debug('Playback state updated from CAP', {
        variableId,
        value,
        timestamp
      });
    }
  }

  /**
   * Get supported playback speeds
   * @returns {Array} Supported speeds
   */
  getSupportedSpeeds() {
    return [...this.supportedSpeeds];
  }

  /**
   * Clear clip cache
   */
  clearClipCache() {
    this.clipCache.clear();
    logger.debug('Clip cache cleared');
  }
}

module.exports = { PlaybackControlHandler };