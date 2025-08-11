/**
 * Camera Control Handler
 * Handles camera control WebSocket events for frame rate, white balance, ISO, ND, etc.
 */

const { logger } = require('../utils/logger.js');
const { inputValidator } = require('../utils/inputValidation.js');
const { CAP_COMMANDS, CAP_VARIABLES } = require('../cap/types.js');

class CameraControlHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.capManager = wsManager.capManager;
    
    // Camera state cache for broadcasting
    this.cameraState = {
      frameRate: null,
      whiteBalance: { kelvin: null, tint: null },
      iso: null,
      ndFilter: null,
      frameLines: false,
      lut: null,
      lastUpdate: null
    };

    // Supported values for validation
    this.supportedValues = {
      frameRates: [23.98, 24, 25, 29.97, 30, 50, 59.94, 60],
      isoValues: [100, 200, 400, 800, 1600, 3200, 6400, 12800],
      ndStops: [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4],
      kelvinRange: { min: 2000, max: 11000 },
      tintRange: { min: -100, max: 100 }
    };
  }

  /**
   * Handle frame rate control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Frame rate data
   */
  async handleFrameRateControl(socket, data) {
    try {
      // Sanitize and validate input
      const sanitizedData = inputValidator.sanitizeObject(data);
      const validation = inputValidator.validateCameraControl(sanitizedData, 'frameRate');
      
      if (!validation.isValid) {
        socket.emit('camera:frameRate:error', {
          message: 'Invalid frame rate data',
          code: 'INVALID_FRAME_RATE',
          errors: validation.errors,
          supportedValues: this.supportedValues.frameRates,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { frameRate } = validation.sanitizedInputs;

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('camera:frameRate:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} setting frame rate to ${frameRate}`, {
        clientId: socket.id,
        frameRate
      });

      // Send CAP command to set frame rate
      await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.SENSOR_FPS,
        value: frameRate
      });

      // Update local state
      this.cameraState.frameRate = frameRate;
      this.cameraState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('camera:frameRate:changed', {
        frameRate,
        timestamp: this.cameraState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('camera:frameRate:success', {
        frameRate,
        timestamp: this.cameraState.lastUpdate
      });

      logger.info(`Frame rate set to ${frameRate} successfully`, {
        clientId: socket.id,
        frameRate
      });

    } catch (error) {
      logger.error(`Frame rate control failed for client ${socket.id}:`, {
        clientId: socket.id,
        frameRate: data.frameRate,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:frameRate:error', {
        message: error.message,
        code: error.code || 'FRAME_RATE_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle white balance control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - White balance data
   */
  async handleWhiteBalanceControl(socket, data) {
    try {
      // Sanitize and validate input
      const sanitizedData = inputValidator.sanitizeObject(data);
      const validation = inputValidator.validateCameraControl(sanitizedData, 'whiteBalance');
      
      if (!validation.isValid) {
        socket.emit('camera:whiteBalance:error', {
          message: 'Invalid white balance data',
          code: 'INVALID_WHITE_BALANCE',
          errors: validation.errors,
          supportedRanges: {
            kelvin: this.supportedValues.kelvinRange,
            tint: this.supportedValues.tintRange
          },
          timestamp: new Date().toISOString()
        });
        return;
      }

      const { kelvin, tint } = validation.sanitizedInputs;

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('camera:whiteBalance:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} setting white balance`, {
        clientId: socket.id,
        kelvin,
        tint
      });

      // Send CAP commands for white balance
      if (kelvin !== undefined) {
        await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
          variableId: CAP_VARIABLES.COLOR_TEMPERATURE,
          value: kelvin
        });
        this.cameraState.whiteBalance.kelvin = kelvin;
      }

      if (tint !== undefined) {
        await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
          variableId: CAP_VARIABLES.TINT,
          value: tint
        });
        this.cameraState.whiteBalance.tint = tint;
      }

      this.cameraState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('camera:whiteBalance:changed', {
        whiteBalance: { ...this.cameraState.whiteBalance },
        timestamp: this.cameraState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('camera:whiteBalance:success', {
        whiteBalance: { ...this.cameraState.whiteBalance },
        timestamp: this.cameraState.lastUpdate
      });

      logger.info(`White balance set successfully`, {
        clientId: socket.id,
        kelvin,
        tint
      });

    } catch (error) {
      logger.error(`White balance control failed for client ${socket.id}:`, {
        clientId: socket.id,
        kelvin: data.kelvin,
        tint: data.tint,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:whiteBalance:error', {
        message: error.message,
        code: error.code || 'WHITE_BALANCE_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle ISO control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - ISO data
   */
  async handleISOControl(socket, data) {
    try {
      const { iso } = data;

      // Validate ISO value
      if (!this.isValidISO(iso)) {
        socket.emit('camera:iso:error', {
          message: 'Invalid ISO value',
          code: 'INVALID_ISO',
          supportedValues: this.supportedValues.isoValues,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('camera:iso:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} setting ISO to ${iso}`, {
        clientId: socket.id,
        iso
      });

      // Send CAP command to set ISO
      await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.EXPOSURE_INDEX,
        value: iso
      });

      // Update local state
      this.cameraState.iso = iso;
      this.cameraState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('camera:iso:changed', {
        iso,
        timestamp: this.cameraState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('camera:iso:success', {
        iso,
        timestamp: this.cameraState.lastUpdate
      });

      logger.info(`ISO set to ${iso} successfully`, {
        clientId: socket.id,
        iso
      });

    } catch (error) {
      logger.error(`ISO control failed for client ${socket.id}:`, {
        clientId: socket.id,
        iso: data.iso,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:iso:error', {
        message: error.message,
        code: error.code || 'ISO_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle ND filter control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - ND filter data
   */
  async handleNDFilterControl(socket, data) {
    try {
      const { ndStop } = data;

      // Validate ND stop value
      if (!this.isValidNDStop(ndStop)) {
        socket.emit('camera:ndFilter:error', {
          message: 'Invalid ND filter stop value',
          code: 'INVALID_ND_STOP',
          supportedValues: this.supportedValues.ndStops,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('camera:ndFilter:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} setting ND filter to ${ndStop} stops`, {
        clientId: socket.id,
        ndStop
      });

      // Send CAP command to set ND filter
      await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.ND_FILTER,
        value: ndStop
      });

      // Update local state
      this.cameraState.ndFilter = ndStop;
      this.cameraState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('camera:ndFilter:changed', {
        ndFilter: ndStop,
        timestamp: this.cameraState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('camera:ndFilter:success', {
        ndFilter: ndStop,
        timestamp: this.cameraState.lastUpdate
      });

      logger.info(`ND filter set to ${ndStop} stops successfully`, {
        clientId: socket.id,
        ndStop
      });

    } catch (error) {
      logger.error(`ND filter control failed for client ${socket.id}:`, {
        clientId: socket.id,
        ndStop: data.ndStop,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:ndFilter:error', {
        message: error.message,
        code: error.code || 'ND_FILTER_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle frame lines control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Frame lines data
   */
  async handleFrameLinesControl(socket, data) {
    try {
      const { enabled } = data;

      // Validate enabled value
      if (typeof enabled !== 'boolean') {
        socket.emit('camera:frameLines:error', {
          message: 'Frame lines enabled must be a boolean value',
          code: 'INVALID_FRAME_LINES',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('camera:frameLines:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} ${enabled ? 'enabling' : 'disabling'} frame lines`, {
        clientId: socket.id,
        enabled
      });

      // Send CAP command to toggle frame lines (using look switch for EVF as example)
      await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.LOOK_SWITCH_EVF,
        value: enabled
      });

      // Update local state
      this.cameraState.frameLines = enabled;
      this.cameraState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('camera:frameLines:changed', {
        frameLines: enabled,
        timestamp: this.cameraState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('camera:frameLines:success', {
        frameLines: enabled,
        timestamp: this.cameraState.lastUpdate
      });

      logger.info(`Frame lines ${enabled ? 'enabled' : 'disabled'} successfully`, {
        clientId: socket.id,
        enabled
      });

    } catch (error) {
      logger.error(`Frame lines control failed for client ${socket.id}:`, {
        clientId: socket.id,
        enabled: data.enabled,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:frameLines:error', {
        message: error.message,
        code: error.code || 'FRAME_LINES_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle LUT control
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - LUT data
   */
  async handleLUTControl(socket, data) {
    try {
      const { lutName } = data;

      // Validate LUT name
      if (!lutName || typeof lutName !== 'string') {
        socket.emit('camera:lut:error', {
          message: 'LUT name must be a non-empty string',
          code: 'INVALID_LUT_NAME',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check connection
      if (!this.capManager.isConnected()) {
        socket.emit('camera:lut:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} setting LUT to ${lutName}`, {
        clientId: socket.id,
        lutName
      });

      // Send CAP command to set LUT
      await this.capManager.sendCommand(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.LOOK_FILENAME,
        value: lutName
      });

      // Update local state
      this.cameraState.lut = lutName;
      this.cameraState.lastUpdate = new Date().toISOString();

      // Broadcast to all clients
      this.wsManager.broadcast('camera:lut:changed', {
        lut: lutName,
        timestamp: this.cameraState.lastUpdate
      });

      // Confirm to requesting client
      socket.emit('camera:lut:success', {
        lut: lutName,
        timestamp: this.cameraState.lastUpdate
      });

      logger.info(`LUT set to ${lutName} successfully`, {
        clientId: socket.id,
        lutName
      });

    } catch (error) {
      logger.error(`LUT control failed for client ${socket.id}:`, {
        clientId: socket.id,
        lutName: data.lutName,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:lut:error', {
        message: error.message,
        code: error.code || 'LUT_FAILED',
        category: error.capError?.category || 'command',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get current camera state
   * @param {Socket} socket - Socket.io socket instance
   */
  handleGetCameraState(socket) {
    try {
      socket.emit('camera:state', {
        ...this.cameraState,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Camera state sent to client ${socket.id}`, {
        clientId: socket.id,
        state: this.cameraState
      });

    } catch (error) {
      logger.error(`Failed to get camera state for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:state:error', {
        message: 'Failed to get camera state',
        code: 'STATE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Validate frame rate value
   * @param {number} frameRate - Frame rate to validate
   * @returns {boolean} Whether frame rate is valid
   */
  isValidFrameRate(frameRate) {
    return typeof frameRate === 'number' && 
           this.supportedValues.frameRates.includes(frameRate);
  }

  /**
   * Validate white balance values
   * @param {number} kelvin - Kelvin value
   * @param {number} tint - Tint value
   * @returns {boolean} Whether white balance values are valid
   */
  isValidWhiteBalance(kelvin, tint) {
    const kelvinValid = kelvin === undefined || 
      (typeof kelvin === 'number' && 
       kelvin >= this.supportedValues.kelvinRange.min && 
       kelvin <= this.supportedValues.kelvinRange.max);
    
    const tintValid = tint === undefined || 
      (typeof tint === 'number' && 
       tint >= this.supportedValues.tintRange.min && 
       tint <= this.supportedValues.tintRange.max);
    
    return kelvinValid && tintValid;
  }

  /**
   * Validate ISO value
   * @param {number} iso - ISO value to validate
   * @returns {boolean} Whether ISO is valid
   */
  isValidISO(iso) {
    return typeof iso === 'number' && 
           this.supportedValues.isoValues.includes(iso);
  }

  /**
   * Validate ND stop value
   * @param {number} ndStop - ND stop value to validate
   * @returns {boolean} Whether ND stop is valid
   */
  isValidNDStop(ndStop) {
    return typeof ndStop === 'number' && 
           this.supportedValues.ndStops.includes(ndStop);
  }

  /**
   * Update camera state from CAP variable changes
   * @param {number} variableId - Variable ID
   * @param {*} value - New value
   */
  updateStateFromCAP(variableId, value) {
    let changed = false;
    const timestamp = new Date().toISOString();

    switch (variableId) {
      case CAP_VARIABLES.SENSOR_FPS:
        if (this.cameraState.frameRate !== value) {
          this.cameraState.frameRate = value;
          this.wsManager.broadcast('camera:frameRate:changed', { frameRate: value, timestamp });
          changed = true;
        }
        break;

      case CAP_VARIABLES.COLOR_TEMPERATURE:
        if (this.cameraState.whiteBalance.kelvin !== value) {
          this.cameraState.whiteBalance.kelvin = value;
          this.wsManager.broadcast('camera:whiteBalance:changed', { 
            whiteBalance: { ...this.cameraState.whiteBalance }, 
            timestamp 
          });
          changed = true;
        }
        break;

      case CAP_VARIABLES.TINT:
        if (this.cameraState.whiteBalance.tint !== value) {
          this.cameraState.whiteBalance.tint = value;
          this.wsManager.broadcast('camera:whiteBalance:changed', { 
            whiteBalance: { ...this.cameraState.whiteBalance }, 
            timestamp 
          });
          changed = true;
        }
        break;

      case CAP_VARIABLES.EXPOSURE_INDEX:
        if (this.cameraState.iso !== value) {
          this.cameraState.iso = value;
          this.wsManager.broadcast('camera:iso:changed', { iso: value, timestamp });
          changed = true;
        }
        break;

      case CAP_VARIABLES.ND_FILTER:
        if (this.cameraState.ndFilter !== value) {
          this.cameraState.ndFilter = value;
          this.wsManager.broadcast('camera:ndFilter:changed', { ndFilter: value, timestamp });
          changed = true;
        }
        break;

      case CAP_VARIABLES.LOOK_SWITCH_EVF:
        if (this.cameraState.frameLines !== value) {
          this.cameraState.frameLines = value;
          this.wsManager.broadcast('camera:frameLines:changed', { frameLines: value, timestamp });
          changed = true;
        }
        break;

      case CAP_VARIABLES.LOOK_FILENAME:
        if (this.cameraState.lut !== value) {
          this.cameraState.lut = value;
          this.wsManager.broadcast('camera:lut:changed', { lut: value, timestamp });
          changed = true;
        }
        break;
    }

    if (changed) {
      this.cameraState.lastUpdate = timestamp;
      logger.debug('Camera state updated from CAP', {
        variableId,
        value,
        timestamp
      });
    }
  }

  /**
   * Get supported camera values
   * @returns {Object} Supported values
   */
  getSupportedValues() {
    return { ...this.supportedValues };
  }
}

module.exports = { CameraControlHandler };