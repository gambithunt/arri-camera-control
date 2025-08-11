/**
 * Color Grading Handler
 * Handles color grading WebSocket events for CDL adjustments and LUT management
 */

const { logger } = require('../utils/logger.js');
const { inputValidator } = require('../utils/inputValidation.js');
const { CAP_COMMANDS, CAP_VARIABLES } = require('../cap/types.js');

class ColorGradingHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.capManager = wsManager.capManager;
    
    // CDL state cache
    this.cdlState = {
      shadows: {
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 1, g: 1, b: 1 },
        gain: { r: 1, g: 1, b: 1 }
      },
      midtones: {
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 1, g: 1, b: 1 },
        gain: { r: 1, g: 1, b: 1 }
      },
      highlights: {
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 1, g: 1, b: 1 },
        gain: { r: 1, g: 1, b: 1 }
      }
    };
    
    this.lastUpdate = null;
    this.updateQueue = [];
    this.isProcessingQueue = false;
  }

  /**
   * Handle CDL value updates
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - CDL data
   */
  async handleSetCDL(socket, data) {
    try {
      const sanitizedData = inputValidator.sanitizeObject(data);
      
      if (!sanitizedData.cdl || !this.validateCDLStructure(sanitizedData.cdl)) {
        socket.emit('grading:setCDL:error', {
          message: 'Invalid CDL structure',
          code: 'INVALID_CDL_STRUCTURE'
        });
        return;
      }

      logger.info('Setting CDL values', { 
        clientId: socket.id,
        cdl: this.summarizeCDL(sanitizedData.cdl)
      });

      // Queue the update to prevent overwhelming the camera
      this.queueCDLUpdate(sanitizedData.cdl, socket);

    } catch (error) {
      logger.error('Error setting CDL', { error: error.message, stack: error.stack });
      socket.emit('grading:setCDL:error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Queue CDL update to prevent overwhelming the camera
   * @private
   */
  queueCDLUpdate(cdlValues, socket) {
    // Add to queue
    this.updateQueue.push({
      cdl: cdlValues,
      socket,
      timestamp: Date.now()
    });

    // Process queue if not already processing
    if (!this.isProcessingQueue) {
      this.processUpdateQueue();
    }
  }

  /**
   * Process queued CDL updates
   * @private
   */
  async processUpdateQueue() {
    if (this.updateQueue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;

    // Get the most recent update (discard older ones)
    const latestUpdate = this.updateQueue[this.updateQueue.length - 1];
    this.updateQueue = [];

    try {
      const result = await this.applyCDLToCamera(latestUpdate.cdl);
      
      if (result.success) {
        this.cdlState = { ...latestUpdate.cdl };
        this.lastUpdate = Date.now();
        
        // Broadcast to all clients
        this.wsManager.broadcast('grading:cdl:changed', {
          cdl: this.cdlState,
          timestamp: this.lastUpdate
        });
        
        latestUpdate.socket.emit('grading:setCDL:success', {
          cdl: this.cdlState
        });
        
        logger.info('CDL values applied successfully');
      } else {
        latestUpdate.socket.emit('grading:setCDL:error', {
          message: result.error || 'Failed to apply CDL values',
          code: 'CDL_APPLICATION_FAILED'
        });
      }
    } catch (error) {
      logger.error('Error processing CDL update queue', { error: error.message });
      latestUpdate.socket.emit('grading:setCDL:error', {
        message: 'Failed to process CDL update',
        code: 'QUEUE_PROCESSING_ERROR'
      });
    }

    // Continue processing queue after a short delay
    setTimeout(() => {
      this.processUpdateQueue();
    }, 50); // 50ms delay between updates
  }

  /**
   * Apply CDL values to camera via CAP protocol
   * @private
   */
  async applyCDLToCamera(cdlValues) {
    try {
      // Convert CDL values to CAP protocol format
      const capCDLData = this.convertCDLToCAP(cdlValues);
      
      // Send CDL data to camera
      // Note: This is a simplified implementation. Real CAP protocol
      // may require multiple commands or specific variable IDs
      const result = await this.capManager.sendCommand({
        command: 'SET_CDL',
        data: capCDLData
      });

      return { success: result.success, error: result.error };
    } catch (error) {
      logger.error('Error applying CDL to camera', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Convert CDL values to CAP protocol format
   * @private
   */
  convertCDLToCAP(cdlValues) {
    // Convert the CDL structure to the format expected by ARRI cameras
    // This is a simplified conversion - real implementation would depend
    // on the specific CAP protocol requirements
    
    const capData = {
      shadows: {
        lift: [cdlValues.shadows.lift.r, cdlValues.shadows.lift.g, cdlValues.shadows.lift.b],
        gamma: [cdlValues.shadows.gamma.r, cdlValues.shadows.gamma.g, cdlValues.shadows.gamma.b],
        gain: [cdlValues.shadows.gain.r, cdlValues.shadows.gain.g, cdlValues.shadows.gain.b]
      },
      midtones: {
        lift: [cdlValues.midtones.lift.r, cdlValues.midtones.lift.g, cdlValues.midtones.lift.b],
        gamma: [cdlValues.midtones.gamma.r, cdlValues.midtones.gamma.g, cdlValues.midtones.gamma.b],
        gain: [cdlValues.midtones.gain.r, cdlValues.midtones.gain.g, cdlValues.midtones.gain.b]
      },
      highlights: {
        lift: [cdlValues.highlights.lift.r, cdlValues.highlights.lift.g, cdlValues.highlights.lift.b],
        gamma: [cdlValues.highlights.gamma.r, cdlValues.highlights.gamma.g, cdlValues.highlights.gamma.b],
        gain: [cdlValues.highlights.gain.r, cdlValues.highlights.gain.g, cdlValues.highlights.gain.b]
      }
    };

    return capData;
  }

  /**
   * Handle CDL reset
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleResetCDL(socket) {
    try {
      logger.info('Resetting CDL values', { clientId: socket.id });

      const defaultCDL = {
        shadows: {
          lift: { r: 0, g: 0, b: 0 },
          gamma: { r: 1, g: 1, b: 1 },
          gain: { r: 1, g: 1, b: 1 }
        },
        midtones: {
          lift: { r: 0, g: 0, b: 0 },
          gamma: { r: 1, g: 1, b: 1 },
          gain: { r: 1, g: 1, b: 1 }
        },
        highlights: {
          lift: { r: 0, g: 0, b: 0 },
          gamma: { r: 1, g: 1, b: 1 },
          gain: { r: 1, g: 1, b: 1 }
        }
      };

      const result = await this.applyCDLToCamera(defaultCDL);
      
      if (result.success) {
        this.cdlState = defaultCDL;
        this.lastUpdate = Date.now();
        
        // Broadcast to all clients
        this.wsManager.broadcast('grading:cdl:changed', {
          cdl: this.cdlState,
          timestamp: this.lastUpdate
        });
        
        socket.emit('grading:resetCDL:success', {
          cdl: this.cdlState
        });
        
        logger.info('CDL values reset successfully');
      } else {
        socket.emit('grading:resetCDL:error', {
          message: result.error || 'Failed to reset CDL values',
          code: 'CDL_RESET_FAILED'
        });
      }
    } catch (error) {
      logger.error('Error resetting CDL', { error: error.message, stack: error.stack });
      socket.emit('grading:resetCDL:error', {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Handle get current CDL values
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleGetCDL(socket) {
    try {
      // Try to get current CDL values from camera
      try {
        const result = await this.capManager.getVariable(CAP_VARIABLES.CDL_VALUES);
        if (result.success && result.value) {
          // Convert CAP format back to our CDL structure
          this.cdlState = this.convertCAPToCDL(result.value);
        }
      } catch (error) {
        logger.warn('Could not retrieve CDL from camera, using cached values', { error: error.message });
      }

      socket.emit('grading:getCDL:success', {
        cdl: this.cdlState,
        timestamp: this.lastUpdate
      });
    } catch (error) {
      logger.error('Error getting CDL', { error: error.message, stack: error.stack });
      socket.emit('grading:getCDL:error', {
        message: 'Failed to get CDL values',
        code: 'CDL_GET_FAILED'
      });
    }
  }

  /**
   * Convert CAP format back to CDL structure
   * @private
   */
  convertCAPToCDL(capData) {
    // Convert from CAP protocol format back to our CDL structure
    // This is the inverse of convertCDLToCAP
    
    return {
      shadows: {
        lift: { r: capData.shadows.lift[0], g: capData.shadows.lift[1], b: capData.shadows.lift[2] },
        gamma: { r: capData.shadows.gamma[0], g: capData.shadows.gamma[1], b: capData.shadows.gamma[2] },
        gain: { r: capData.shadows.gain[0], g: capData.shadows.gain[1], b: capData.shadows.gain[2] }
      },
      midtones: {
        lift: { r: capData.midtones.lift[0], g: capData.midtones.lift[1], b: capData.midtones.lift[2] },
        gamma: { r: capData.midtones.gamma[0], g: capData.midtones.gamma[1], b: capData.midtones.gamma[2] },
        gain: { r: capData.midtones.gain[0], g: capData.midtones.gain[1], b: capData.midtones.gain[2] }
      },
      highlights: {
        lift: { r: capData.highlights.lift[0], g: capData.highlights.lift[1], b: capData.highlights.lift[2] },
        gamma: { r: capData.highlights.gamma[0], g: capData.highlights.gamma[1], b: capData.highlights.gamma[2] },
        gain: { r: capData.highlights.gain[0], g: capData.highlights.gain[1], b: capData.highlights.gain[2] }
      }
    };
  }

  /**
   * Validate CDL structure
   * @private
   */
  validateCDLStructure(cdl) {
    const requiredWheels = ['shadows', 'midtones', 'highlights'];
    const requiredControls = ['lift', 'gamma', 'gain'];
    const requiredChannels = ['r', 'g', 'b'];

    for (const wheel of requiredWheels) {
      if (!cdl[wheel]) return false;
      
      for (const control of requiredControls) {
        if (!cdl[wheel][control]) return false;
        
        for (const channel of requiredChannels) {
          if (typeof cdl[wheel][control][channel] !== 'number') return false;
          
          // Validate ranges
          if (control === 'lift') {
            if (cdl[wheel][control][channel] < -2 || cdl[wheel][control][channel] > 2) return false;
          } else { // gamma and gain
            if (cdl[wheel][control][channel] < 0.1 || cdl[wheel][control][channel] > 4) return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Create a summary of CDL values for logging
   * @private
   */
  summarizeCDL(cdl) {
    const summary = {};
    
    for (const wheel of ['shadows', 'midtones', 'highlights']) {
      summary[wheel] = {};
      for (const control of ['lift', 'gamma', 'gain']) {
        const values = cdl[wheel][control];
        summary[wheel][control] = `(${values.r.toFixed(2)}, ${values.g.toFixed(2)}, ${values.b.toFixed(2)})`;
      }
    }
    
    return summary;
  }

  /**
   * Register event handlers
   */
  registerHandlers(socket) {
    socket.on('grading:setCDL', (data) => this.handleSetCDL(socket, data));
    socket.on('grading:resetCDL', () => this.handleResetCDL(socket));
    socket.on('grading:getCDL', () => this.handleGetCDL(socket));
  }
}

module.exports = { ColorGradingHandler };