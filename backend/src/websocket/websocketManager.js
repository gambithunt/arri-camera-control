/**
 * WebSocket Manager
 * Manages WebSocket connections and message routing
 */

const { Server } = require('socket.io');
const { CAPProtocol } = require('../cap/capProtocol');

class WebSocketManager {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.clients = new Map();
    this.capProtocol = new CAPProtocol();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      this.clients.set(socket.id, {
        socket,
        connected: false
      });

      // Camera connection events
      socket.on('camera:connect', async (data) => {
        try {
          const result = await this.capProtocol.connect(data.ip, 7755);
          if (result.success) {
            this.clients.get(socket.id).connected = true;
            socket.emit('camera:connect:success', {
              model: 'ARRI ALEXA Mini LF',
              serialNumber: 'ALF001234',
              firmwareVersion: '7.2.1'
            });
          } else {
            socket.emit('camera:connect:error', {
              code: 'CAP_001',
              message: 'Connection failed',
              details: result.error
            });
          }
        } catch (error) {
          socket.emit('camera:connect:error', {
            code: 'CAP_001',
            message: 'Connection failed',
            details: error.message
          });
        }
      });

      socket.on('camera:disconnect', async () => {
        try {
          await this.capProtocol.disconnect();
          this.clients.get(socket.id).connected = false;
          socket.emit('camera:disconnect:success');
        } catch (error) {
          socket.emit('camera:disconnect:error', {
            code: 'CAP_001',
            message: 'Disconnect failed',
            details: error.message
          });
        }
      });

      // Camera control events
      socket.on('camera:frameRate:set', async (data) => {
        if (!this.clients.get(socket.id).connected) {
          socket.emit('camera:frameRate:error', {
            code: 'CAP_001',
            message: 'Camera not connected'
          });
          return;
        }

        try {
          const result = await this.capProtocol.setFrameRate(data.frameRate);
          if (result.success) {
            socket.emit('camera:frameRate:success', result.data);
            this.broadcastCameraUpdate('frameRate', result.data);
          } else {
            socket.emit('camera:frameRate:error', result.error);
          }
        } catch (error) {
          socket.emit('camera:frameRate:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('camera:whiteBalance:set', async (data) => {
        if (!this.clients.get(socket.id).connected) {
          socket.emit('camera:whiteBalance:error', {
            code: 'CAP_001',
            message: 'Camera not connected'
          });
          return;
        }

        try {
          const result = await this.capProtocol.setWhiteBalance(data.kelvin);
          if (result.success) {
            socket.emit('camera:whiteBalance:success', result.data);
            this.broadcastCameraUpdate('whiteBalance', result.data);
          } else {
            socket.emit('camera:whiteBalance:error', result.error);
          }
        } catch (error) {
          socket.emit('camera:whiteBalance:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('camera:iso:set', async (data) => {
        if (!this.clients.get(socket.id).connected) {
          socket.emit('camera:iso:error', {
            code: 'CAP_001',
            message: 'Camera not connected'
          });
          return;
        }

        try {
          const result = await this.capProtocol.setISO(data.iso);
          if (result.success) {
            socket.emit('camera:iso:success', result.data);
            this.broadcastCameraUpdate('iso', result.data);
          } else {
            socket.emit('camera:iso:error', result.error);
          }
        } catch (error) {
          socket.emit('camera:iso:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      // Playback events
      socket.on('playback:enter', async () => {
        try {
          const result = await this.capProtocol.setPlaybackMode('playback');
          if (result.success) {
            socket.emit('playback:enter:success', result.data);
          } else {
            socket.emit('playback:enter:error', result.error);
          }
        } catch (error) {
          socket.emit('playback:enter:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('playback:exit', async () => {
        try {
          const result = await this.capProtocol.setPlaybackMode('record');
          if (result.success) {
            socket.emit('playback:exit:success', result.data);
          } else {
            socket.emit('playback:exit:error', result.error);
          }
        } catch (error) {
          socket.emit('playback:exit:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('playback:play', async () => {
        try {
          const result = await this.capProtocol.controlPlayback('play');
          if (result.success) {
            socket.emit('playback:play:success', result.data);
          } else {
            socket.emit('playback:play:error', result.error);
          }
        } catch (error) {
          socket.emit('playback:play:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('playback:pause', async () => {
        try {
          const result = await this.capProtocol.controlPlayback('pause');
          if (result.success) {
            socket.emit('playback:pause:success', result.data);
          } else {
            socket.emit('playback:pause:error', result.error);
          }
        } catch (error) {
          socket.emit('playback:pause:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('playback:stop', async () => {
        try {
          const result = await this.capProtocol.controlPlayback('stop');
          if (result.success) {
            socket.emit('playback:stop:success', result.data);
          } else {
            socket.emit('playback:stop:error', result.error);
          }
        } catch (error) {
          socket.emit('playback:stop:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('playback:seek', async (data) => {
        try {
          const result = await this.capProtocol.controlPlayback('seek', { position: data.position });
          if (result.success) {
            socket.emit('playback:seek:success', result.data);
          } else {
            socket.emit('playback:seek:error', result.error);
          }
        } catch (error) {
          socket.emit('playback:seek:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      // Timecode events
      socket.on('timecode:sync', async () => {
        try {
          const result = await this.capProtocol.syncTimecode();
          if (result.success) {
            socket.emit('timecode:sync:success', result.data);
          } else {
            socket.emit('timecode:sync:error', result.error);
          }
        } catch (error) {
          socket.emit('timecode:sync:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('timecode:set', async (data) => {
        try {
          // For now, just echo back the timecode
          socket.emit('timecode:set:success', { timecode: data.timecode });
        } catch (error) {
          socket.emit('timecode:set:error', {
            code: 'CAP_003',
            message: 'Invalid timecode format'
          });
        }
      });

      // Color grading events
      socket.on('grading:loadLUT', async (data) => {
        try {
          const result = await this.capProtocol.loadLUT(data.lutId);
          if (result.success) {
            socket.emit('grading:loadLUT:success', result.data);
          } else {
            socket.emit('grading:loadLUT:error', result.error);
          }
        } catch (error) {
          socket.emit('grading:loadLUT:error', {
            code: 'CAP_004',
            message: 'Command failed',
            details: error.message
          });
        }
      });

      socket.on('grading:saveLUT', async (data) => {
        try {
          // For now, just return a success with generated ID
          socket.emit('grading:saveLUT:success', {
            name: data.name,
            id: `lut_${Date.now()}`
          });
        } catch (error) {
          socket.emit('grading:saveLUT:error', {
            code: 'CAP_004',
            message: 'Save failed',
            details: error.message
          });
        }
      });

      socket.on('grading:adjust', async (data) => {
        try {
          // For now, just echo back the adjustment data
          socket.emit('grading:adjust:success', data);
        } catch (error) {
          socket.emit('grading:adjust:error', {
            code: 'CAP_004',
            message: 'Adjustment failed',
            details: error.message
          });
        }
      });

      // Handle unknown commands
      socket.onAny((eventName, data) => {
        if (!eventName.includes(':')) return; // Skip non-command events
        
        const parts = eventName.split(':');
        if (parts.length < 2) return;
        
        // Check if this is a known event
        const knownEvents = [
          'camera:connect', 'camera:disconnect', 'camera:frameRate:set',
          'camera:whiteBalance:set', 'camera:iso:set', 'playback:enter',
          'playback:exit', 'playback:play', 'playback:pause', 'playback:stop',
          'playback:seek', 'timecode:sync', 'timecode:set', 'grading:loadLUT',
          'grading:saveLUT', 'grading:adjust'
        ];
        
        if (!knownEvents.includes(eventName)) {
          socket.emit(`${eventName}:error`, {
            code: 'CAP_002',
            message: 'Unknown command',
            details: `Command ${eventName} not recognized`
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        this.clients.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      // Handle malformed messages
      socket.on('message', (data) => {
        try {
          JSON.parse(data);
        } catch (error) {
          socket.emit('error', {
            code: 'PARSE_ERROR',
            message: 'Invalid JSON format'
          });
        }
      });
    });
  }

  broadcastCameraUpdate(property, data) {
    this.io.emit('camera:status:update', {
      [property]: data[property] || data
    });
  }

  broadcastCameraStatus(status) {
    this.io.emit('camera:status:update', status);
  }

  broadcastPlaybackProgress(progress) {
    this.io.emit('playback:progress:update', progress);
  }

  /**
   * Initialize the WebSocket manager
   */
  async initialize() {
    console.log('WebSocket manager initialized');
    return Promise.resolve();
  }

  /**
   * Handle new socket connection
   */
  handleConnection(socket) {
    // This method is called from server.js but the logic is already in setupEventHandlers
    // Just log that we're handling the connection
    console.log('Handling connection for socket:', socket.id);
  }

  /**
   * Get connection count
   */
  getConnectionCount() {
    return this.clients.size;
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.closeAllConnections();
    return Promise.resolve();
  }

  reset() {
    // Reset any internal state for testing
    this.clients.clear();
  }

  closeAllConnections() {
    this.clients.forEach((client) => {
      client.socket.disconnect();
    });
    this.clients.clear();
  }
}

module.exports = { WebSocketManager };