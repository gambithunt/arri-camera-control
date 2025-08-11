/**
 * Timecode Handler
 * Handles timecode-related WebSocket events for ARRI cameras
 */

const { logger } = require('../utils/logger.js');
const { inputValidator } = require('../utils/inputValidation.js');
const { CAP_COMMANDS, CAP_VARIABLES, TIMECODE_RUN_MODES, TIMECODE_INIT_MODES } = require('../cap/types.js');

class TimecodeHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.capManager = wsManager.capManager;
    
    // Timecode state cache
    this.timecodeState = {
      current: '00:00:00:00',
      mode: 'free_run',
      userBits: '00:00:00:00',
      frameRate: 24,
      lastUpdate: null,
      syncStatus: 'synced',
      lastSyncTime: null,
      driftHistory: [],
      consecutiveErrors: 0,
      expectedTimecode: null,
      syncOffset: 0
    };

    // Supported timecode modes
    this.supportedModes = {
      'free_run': TIMECODE_RUN_MODES.FREE_RUN,
      'record_run': TIMECODE_RUN_MODES.REC_RUN,
      'external': 'external',
      'time_of_day': 'time_of_day'
    };
  }

  /**
   * Set timecode value
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Timecode data
   */
  async handleSetTimecode(socket, data) {
    try {
      const sanitizedData = inputValidator.sanitizeObject(data);
      
      if (!sanitizedData.timecode || !this.validateTimecodeFormat(sanitizedData.timecode)) {
        socket.emit('timecode:set:error', {
          message: 'Invalid timecode format. Use HH:MM:SS:FF',
          code: 'INVALID_TIMECODE_FORMAT'
        });
        return;
      }

      logger.info('Setting timecode', { timecode: sanitizedData.timecode });

      // Convert timecode string to frame count for CAP protocol
      const frameCount = this.timecodeToFrames(sanitizedData.timecode, this.timecodeState.frameRate);
      
      // Send CAP command to set timecode
      const result = await this.capManager.setVariable(CAP_VARIABLES.TIMECODE, frameCount);
      
      if (result.success) {
        this.timecodeState.current = sanitizedData.timecode;
        this.timecodeState.lastUpdate = Date.now();
        
        // Broadcast to all clients
        this.wsManager.broadcast('timecode:changed', {
          current: this.timecodeState.current,
          timestamp: this.timecodeState.lastUpdate
        });
        
        socket.emit('timecode:set:success', {
          timecode: sanitizedData.timecode
        });
        
        logger.info('Timecode set successfully', { timecode: sanitizedData.timecode });
      } else {
        socket.emit('timecode:set:error', {
          message: result.error || 'Failed to set timecode',
          code: 'TIMECODE_SET_FAILED'
        });
      }
    } catch (error) {
      logger.error('Error setting timecode', { error: error.message, stack: error.stack });
      socket.emit('timecode:set:error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Set timecode mode
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Mode data
   */
  async handleSetTimecodeMode(socket, data) {
    try {
      const sanitizedData = inputValidator.sanitizeObject(data);
      
      if (!sanitizedData.mode || !this.supportedModes[sanitizedData.mode]) {
        socket.emit('timecode:setMode:error', {
          message: 'Invalid timecode mode',
          code: 'INVALID_TIMECODE_MODE',
          supportedModes: Object.keys(this.supportedModes)
        });
        return;
      }

      logger.info('Setting timecode mode', { mode: sanitizedData.mode });

      let result;
      
      if (sanitizedData.mode === 'time_of_day') {
        // Special handling for time of day mode
        result = await this.syncToTimeOfDay();
      } else if (sanitizedData.mode === 'external') {
        // External timecode mode - set appropriate CAP variable
        result = await this.capManager.setVariable(CAP_VARIABLES.TIMECODE_RUN_MODE, this.supportedModes.free_run);
        // Note: External sync would require additional hardware setup
      } else {
        // Standard run modes (free_run, record_run)
        const modeValue = this.supportedModes[sanitizedData.mode];
        result = await this.capManager.setVariable(CAP_VARIABLES.TIMECODE_RUN_MODE, modeValue);
      }
      
      if (result.success) {
        this.timecodeState.mode = sanitizedData.mode;
        this.timecodeState.lastUpdate = Date.now();
        
        // Broadcast to all clients
        this.wsManager.broadcast('timecode:mode:changed', {
          mode: this.timecodeState.mode,
          timestamp: this.timecodeState.lastUpdate
        });
        
        socket.emit('timecode:setMode:success', {
          mode: sanitizedData.mode
        });
        
        logger.info('Timecode mode set successfully', { mode: sanitizedData.mode });
      } else {
        socket.emit('timecode:setMode:error', {
          message: result.error || 'Failed to set timecode mode',
          code: 'TIMECODE_MODE_SET_FAILED'
        });
      }
    } catch (error) {
      logger.error('Error setting timecode mode', { error: error.message, stack: error.stack });
      socket.emit('timecode:setMode:error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Sync timecode to time of day
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleSyncToTimeOfDay(socket, data) {
    try {
      logger.info('Syncing timecode to time of day');

      const result = await this.syncToTimeOfDay();
      
      if (result.success) {
        socket.emit('timecode:syncToTimeOfDay:success', {
          timecode: this.timecodeState.current,
          mode: 'time_of_day'
        });
        
        logger.info('Timecode synced to time of day successfully');
      } else {
        socket.emit('timecode:syncToTimeOfDay:error', {
          message: result.error || 'Failed to sync to time of day',
          code: 'TIMECODE_SYNC_FAILED'
        });
      }
    } catch (error) {
      logger.error('Error syncing timecode to time of day', { error: error.message, stack: error.stack });
      socket.emit('timecode:syncToTimeOfDay:error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Set user bits
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - User bits data
   */
  async handleSetUserBits(socket, data) {
    try {
      const sanitizedData = inputValidator.sanitizeObject(data);
      
      if (!sanitizedData.userBits || !this.validateTimecodeFormat(sanitizedData.userBits)) {
        socket.emit('timecode:setUserBits:error', {
          message: 'Invalid user bits format. Use HH:MM:SS:FF',
          code: 'INVALID_USER_BITS_FORMAT'
        });
        return;
      }

      logger.info('Setting user bits', { userBits: sanitizedData.userBits });

      // Convert user bits to appropriate format for CAP protocol
      const userBitsValue = this.timecodeToFrames(sanitizedData.userBits, this.timecodeState.frameRate);
      
      // Note: User bits handling may require specific CAP variable or command
      // For now, we'll store it locally and broadcast the change
      this.timecodeState.userBits = sanitizedData.userBits;
      this.timecodeState.lastUpdate = Date.now();
      
      // Broadcast to all clients
      this.wsManager.broadcast('timecode:userBits:changed', {
        userBits: this.timecodeState.userBits,
        timestamp: this.timecodeState.lastUpdate
      });
      
      socket.emit('timecode:setUserBits:success', {
        userBits: sanitizedData.userBits
      });
      
      logger.info('User bits set successfully', { userBits: sanitizedData.userBits });
    } catch (error) {
      logger.error('Error setting user bits', { error: error.message, stack: error.stack });
      socket.emit('timecode:setUserBits:error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Get current timecode state
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleGetTimecodeState(socket) {
    try {
      // Get current timecode from camera
      const timecodeResult = await this.capManager.getVariable(CAP_VARIABLES.TIMECODE);
      
      if (timecodeResult.success) {
        const currentTimecode = this.framesToTimecode(timecodeResult.value, this.timecodeState.frameRate);
        this.timecodeState.current = currentTimecode;
      }

      socket.emit('timecode:state:success', {
        ...this.timecodeState,
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting timecode state', { error: error.message, stack: error.stack });
      socket.emit('timecode:state:error', {
        message: 'Failed to get timecode state',
        code: 'TIMECODE_STATE_ERROR'
      });
    }
  }

  /**
   * Sync timecode to current time of day
   * @private
   */
  async syncToTimeOfDay() {
    try {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const frames = Math.floor((now.getMilliseconds() / 1000) * this.timecodeState.frameRate)
        .toString().padStart(2, '0');
      
      const timeOfDayTimecode = `${hours}:${minutes}:${seconds}:${frames}`;
      const frameCount = this.timecodeToFrames(timeOfDayTimecode, this.timecodeState.frameRate);
      
      const result = await this.capManager.setVariable(CAP_VARIABLES.TIMECODE, frameCount);
      
      if (result.success) {
        this.timecodeState.current = timeOfDayTimecode;
        this.timecodeState.mode = 'time_of_day';
        this.timecodeState.lastUpdate = Date.now();
        
        // Broadcast to all clients
        this.wsManager.broadcast('timecode:changed', {
          current: this.timecodeState.current,
          mode: this.timecodeState.mode,
          timestamp: this.timecodeState.lastUpdate
        });
        
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      logger.error('Error syncing to time of day', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate timecode format (HH:MM:SS:FF)
   * @private
   */
  validateTimecodeFormat(timecode) {
    const tcRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]):([0-2][0-9]|3[0-1])$/;
    return tcRegex.test(timecode);
  }

  /**
   * Convert timecode string to frame count
   * @private
   */
  timecodeToFrames(timecode, frameRate) {
    const [hours, minutes, seconds, frames] = timecode.split(':').map(Number);
    return (hours * 3600 + minutes * 60 + seconds) * frameRate + frames;
  }

  /**
   * Convert frame count to timecode string
   * @private
   */
  framesToTimecode(frameCount, frameRate) {
    const totalSeconds = Math.floor(frameCount / frameRate);
    const frames = frameCount % frameRate;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  }

  /**
   * Start periodic timecode updates with synchronization logic
   */
  startTimecodeUpdates() {
    // Update timecode more frequently for better sync accuracy
    this.timecodeUpdateInterval = setInterval(async () => {
      await this.updateTimecodeWithSync();
    }, 250); // Update every 250ms for better accuracy

    // Separate interval for drift detection and correction
    this.syncMonitorInterval = setInterval(async () => {
      await this.monitorSyncStatus();
    }, 5000); // Check sync status every 5 seconds
  }

  /**
   * Update timecode with synchronization logic
   * @private
   */
  async updateTimecodeWithSync() {
    if (!this.shouldUpdateTimecode()) {
      return;
    }

    try {
      const startTime = Date.now();
      const result = await this.capManager.getVariable(CAP_VARIABLES.TIMECODE);
      const networkLatency = Date.now() - startTime;

      if (result.success) {
        const cameraTimecode = this.framesToTimecode(result.value, this.timecodeState.frameRate);
        const currentTime = Date.now();
        
        // Calculate expected timecode based on last known good sync
        const expectedTimecode = this.calculateExpectedTimecode(currentTime);
        
        // Detect and handle drift
        const driftInfo = this.detectDrift(cameraTimecode, expectedTimecode, networkLatency);
        
        // Update state based on drift analysis
        this.updateTimecodeState(cameraTimecode, currentTime, driftInfo);
        
        // Reset consecutive errors on successful update
        this.timecodeState.consecutiveErrors = 0;
        
        // Broadcast update if timecode changed or sync status changed
        if (this.shouldBroadcastUpdate(cameraTimecode, driftInfo)) {
          this.broadcastTimecodeUpdate();
        }
        
      } else {
        this.handleTimecodeError('Failed to get timecode from camera');
      }
    } catch (error) {
      this.handleTimecodeError(error.message);
    }
  }

  /**
   * Monitor sync status and perform corrections
   * @private
   */
  async monitorSyncStatus() {
    try {
      // Check if we're in a mode that requires sync monitoring
      if (!this.requiresSyncMonitoring()) {
        return;
      }

      // Analyze drift history for patterns
      const driftAnalysis = this.analyzeDriftHistory();
      
      // Update sync status based on analysis
      const newSyncStatus = this.determineSyncStatus(driftAnalysis);
      
      if (newSyncStatus !== this.timecodeState.syncStatus) {
        this.timecodeState.syncStatus = newSyncStatus;
        this.broadcastSyncStatusChange(newSyncStatus, driftAnalysis);
        
        // Attempt correction if needed
        if (newSyncStatus === 'drifting' && driftAnalysis.correctable) {
          await this.attemptDriftCorrection(driftAnalysis);
        }
      }

      // Clean up old drift history
      this.cleanupDriftHistory();
      
    } catch (error) {
      logger.error('Error monitoring sync status', { error: error.message });
    }
  }

  /**
   * Determine if timecode should be updated
   * @private
   */
  shouldUpdateTimecode() {
    return this.timecodeState.mode === 'free_run' || 
           this.timecodeState.mode === 'time_of_day' ||
           this.timecodeState.mode === 'external';
  }

  /**
   * Calculate expected timecode based on last sync
   * @private
   */
  calculateExpectedTimecode(currentTime) {
    if (!this.timecodeState.lastSyncTime || !this.timecodeState.expectedTimecode) {
      return null;
    }

    const timeDiff = currentTime - this.timecodeState.lastSyncTime;
    const framesDiff = Math.round((timeDiff / 1000) * this.timecodeState.frameRate);
    const lastFrames = this.timecodeToFrames(this.timecodeState.expectedTimecode, this.timecodeState.frameRate);
    
    return this.framesToTimecode(lastFrames + framesDiff, this.timecodeState.frameRate);
  }

  /**
   * Detect drift between camera and expected timecode
   * @private
   */
  detectDrift(cameraTimecode, expectedTimecode, networkLatency) {
    if (!expectedTimecode) {
      // First sync or no reference point
      return {
        drift: 0,
        driftFrames: 0,
        networkLatency,
        reliable: true,
        correctable: false
      };
    }

    const cameraFrames = this.timecodeToFrames(cameraTimecode, this.timecodeState.frameRate);
    const expectedFrames = this.timecodeToFrames(expectedTimecode, this.timecodeState.frameRate);
    const driftFrames = cameraFrames - expectedFrames;
    const driftMs = (driftFrames / this.timecodeState.frameRate) * 1000;

    // Account for network latency in drift calculation
    const adjustedDriftMs = driftMs - (networkLatency / 2);

    return {
      drift: adjustedDriftMs,
      driftFrames,
      networkLatency,
      reliable: networkLatency < 100, // Consider unreliable if latency > 100ms
      correctable: Math.abs(driftFrames) <= 5 && networkLatency < 200 // Correctable if small drift and reasonable latency
    };
  }

  /**
   * Update timecode state with drift information
   * @private
   */
  updateTimecodeState(cameraTimecode, currentTime, driftInfo) {
    const previousTimecode = this.timecodeState.current;
    
    this.timecodeState.current = cameraTimecode;
    this.timecodeState.lastUpdate = currentTime;
    this.timecodeState.expectedTimecode = cameraTimecode;
    this.timecodeState.lastSyncTime = currentTime;
    
    // Record drift history for analysis
    if (driftInfo.reliable) {
      this.timecodeState.driftHistory.push({
        timestamp: currentTime,
        drift: driftInfo.drift,
        driftFrames: driftInfo.driftFrames,
        networkLatency: driftInfo.networkLatency,
        timecode: cameraTimecode
      });
    }

    // Update sync offset for future calculations
    this.timecodeState.syncOffset = driftInfo.drift;
  }

  /**
   * Determine if update should be broadcast
   * @private
   */
  shouldBroadcastUpdate(cameraTimecode, driftInfo) {
    return this.timecodeState.current !== cameraTimecode || 
           Math.abs(driftInfo.drift) > 100; // Broadcast if significant drift
  }

  /**
   * Broadcast timecode update to all clients
   * @private
   */
  broadcastTimecodeUpdate() {
    this.wsManager.broadcast('timecode:changed', {
      current: this.timecodeState.current,
      mode: this.timecodeState.mode,
      syncStatus: this.timecodeState.syncStatus,
      syncOffset: this.timecodeState.syncOffset,
      timestamp: this.timecodeState.lastUpdate
    });
  }

  /**
   * Handle timecode update errors
   * @private
   */
  handleTimecodeError(errorMessage) {
    this.timecodeState.consecutiveErrors++;
    
    logger.warn('Timecode update error', {
      error: errorMessage,
      consecutiveErrors: this.timecodeState.consecutiveErrors,
      mode: this.timecodeState.mode
    });

    // Update sync status based on error count
    if (this.timecodeState.consecutiveErrors >= 3) {
      if (this.timecodeState.syncStatus !== 'lost') {
        this.timecodeState.syncStatus = 'lost';
        this.broadcastSyncStatusChange('lost', { reason: 'consecutive_errors', count: this.timecodeState.consecutiveErrors });
      }
    } else if (this.timecodeState.consecutiveErrors >= 1) {
      if (this.timecodeState.syncStatus === 'synced') {
        this.timecodeState.syncStatus = 'drifting';
        this.broadcastSyncStatusChange('drifting', { reason: 'communication_error' });
      }
    }
  }

  /**
   * Check if sync monitoring is required for current mode
   * @private
   */
  requiresSyncMonitoring() {
    return this.timecodeState.mode === 'free_run' || 
           this.timecodeState.mode === 'time_of_day' ||
           this.timecodeState.mode === 'external';
  }

  /**
   * Analyze drift history for patterns
   * @private
   */
  analyzeDriftHistory() {
    const history = this.timecodeState.driftHistory;
    if (history.length < 3) {
      return { trend: 'insufficient_data', avgDrift: 0, maxDrift: 0, correctable: false };
    }

    const recentHistory = history.slice(-10); // Analyze last 10 samples
    const drifts = recentHistory.map(h => h.drift);
    const avgDrift = drifts.reduce((sum, drift) => sum + drift, 0) / drifts.length;
    const maxDrift = Math.max(...drifts.map(Math.abs));
    
    // Determine trend
    let trend = 'stable';
    if (maxDrift > 500) { // > 500ms drift
      trend = 'major_drift';
    } else if (avgDrift > 100) { // > 100ms average drift
      trend = 'consistent_drift';
    } else if (maxDrift > 200) { // > 200ms max drift
      trend = 'intermittent_drift';
    }

    return {
      trend,
      avgDrift,
      maxDrift,
      sampleCount: recentHistory.length,
      correctable: trend !== 'major_drift' && maxDrift < 1000
    };
  }

  /**
   * Determine sync status based on drift analysis
   * @private
   */
  determineSyncStatus(driftAnalysis) {
    if (this.timecodeState.consecutiveErrors >= 3) {
      return 'lost';
    }

    switch (driftAnalysis.trend) {
      case 'major_drift':
        return 'lost';
      case 'consistent_drift':
      case 'intermittent_drift':
        return 'drifting';
      case 'stable':
      default:
        return 'synced';
    }
  }

  /**
   * Broadcast sync status change
   * @private
   */
  broadcastSyncStatusChange(newStatus, analysis) {
    logger.info('Timecode sync status changed', {
      oldStatus: this.timecodeState.syncStatus,
      newStatus,
      analysis
    });

    this.wsManager.broadcast('timecode:syncStatus:changed', {
      syncStatus: newStatus,
      analysis,
      timestamp: Date.now()
    });
  }

  /**
   * Attempt to correct drift
   * @private
   */
  async attemptDriftCorrection(driftAnalysis) {
    if (!driftAnalysis.correctable) {
      return;
    }

    try {
      logger.info('Attempting drift correction', {
        avgDrift: driftAnalysis.avgDrift,
        maxDrift: driftAnalysis.maxDrift
      });

      // For time_of_day mode, resync to current time
      if (this.timecodeState.mode === 'time_of_day') {
        await this.syncToTimeOfDay();
        logger.info('Drift correction: resynced to time of day');
      }
      
      // For other modes, we could implement specific correction strategies
      // This is a placeholder for more advanced correction logic
      
    } catch (error) {
      logger.error('Drift correction failed', { error: error.message });
    }
  }

  /**
   * Clean up old drift history
   * @private
   */
  cleanupDriftHistory() {
    const maxHistoryAge = 5 * 60 * 1000; // 5 minutes
    const cutoffTime = Date.now() - maxHistoryAge;
    
    this.timecodeState.driftHistory = this.timecodeState.driftHistory.filter(
      entry => entry.timestamp > cutoffTime
    );
  }

  /**
   * Stop periodic timecode updates
   */
  stopTimecodeUpdates() {
    if (this.timecodeUpdateInterval) {
      clearInterval(this.timecodeUpdateInterval);
      this.timecodeUpdateInterval = null;
    }
    
    if (this.syncMonitorInterval) {
      clearInterval(this.syncMonitorInterval);
      this.syncMonitorInterval = null;
    }
  }

  /**
   * Handle sync status request
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleGetSyncStatus(socket) {
    try {
      const driftAnalysis = this.analyzeDriftHistory();
      
      socket.emit('timecode:syncStatus:success', {
        syncStatus: this.timecodeState.syncStatus,
        syncOffset: this.timecodeState.syncOffset,
        lastSyncTime: this.timecodeState.lastSyncTime,
        consecutiveErrors: this.timecodeState.consecutiveErrors,
        driftAnalysis,
        driftHistory: this.timecodeState.driftHistory.slice(-5), // Last 5 samples
        timestamp: Date.now()
      });
    } catch (error) {
      logger.error('Error getting sync status', { error: error.message });
      socket.emit('timecode:syncStatus:error', {
        message: 'Failed to get sync status',
        code: 'SYNC_STATUS_ERROR'
      });
    }
  }

  /**
   * Handle manual sync request
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleManualSync(socket) {
    try {
      logger.info('Manual sync requested', { clientId: socket.id });

      // Reset error counters and drift history
      this.timecodeState.consecutiveErrors = 0;
      this.timecodeState.driftHistory = [];
      this.timecodeState.syncStatus = 'synced';

      // Force immediate update
      await this.updateTimecodeWithSync();

      socket.emit('timecode:manualSync:success', {
        message: 'Manual sync completed',
        syncStatus: this.timecodeState.syncStatus,
        timestamp: Date.now()
      });

      logger.info('Manual sync completed successfully');
    } catch (error) {
      logger.error('Manual sync failed', { error: error.message });
      socket.emit('timecode:manualSync:error', {
        message: 'Manual sync failed',
        code: 'MANUAL_SYNC_FAILED'
      });
    }
  }

  /**
   * Handle sync diagnostics request
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleGetSyncDiagnostics(socket) {
    try {
      const diagnostics = {
        timecodeState: {
          current: this.timecodeState.current,
          mode: this.timecodeState.mode,
          syncStatus: this.timecodeState.syncStatus,
          frameRate: this.timecodeState.frameRate,
          lastUpdate: this.timecodeState.lastUpdate,
          lastSyncTime: this.timecodeState.lastSyncTime,
          consecutiveErrors: this.timecodeState.consecutiveErrors,
          syncOffset: this.timecodeState.syncOffset
        },
        driftAnalysis: this.analyzeDriftHistory(),
        driftHistory: this.timecodeState.driftHistory,
        systemInfo: {
          updateInterval: this.timecodeUpdateInterval ? 250 : null,
          monitorInterval: this.syncMonitorInterval ? 5000 : null,
          isRunning: !!(this.timecodeUpdateInterval && this.syncMonitorInterval)
        },
        timestamp: Date.now()
      };

      socket.emit('timecode:diagnostics:success', diagnostics);
    } catch (error) {
      logger.error('Error getting sync diagnostics', { error: error.message });
      socket.emit('timecode:diagnostics:error', {
        message: 'Failed to get sync diagnostics',
        code: 'DIAGNOSTICS_ERROR'
      });
    }
  }

  /**
   * Register event handlers
   */
  registerHandlers(socket) {
    socket.on('timecode:set', (data) => this.handleSetTimecode(socket, data));
    socket.on('timecode:setMode', (data) => this.handleSetTimecodeMode(socket, data));
    socket.on('timecode:syncToTimeOfDay', (data) => this.handleSyncToTimeOfDay(socket, data));
    socket.on('timecode:setUserBits', (data) => this.handleSetUserBits(socket, data));
    socket.on('timecode:getState', () => this.handleGetTimecodeState(socket));
    socket.on('timecode:getSyncStatus', () => this.handleGetSyncStatus(socket));
    socket.on('timecode:manualSync', () => this.handleManualSync(socket));
    socket.on('timecode:getDiagnostics', () => this.handleGetSyncDiagnostics(socket));
  }
}

module.exports = { TimecodeHandler };