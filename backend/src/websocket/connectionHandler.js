/**
 * Connection Handler
 * Handles camera connection related WebSocket events
 */

const { logger } = require('../utils/logger.js');

class ConnectionHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.capManager = wsManager.capManager;
  }

  /**
   * Handle camera connection request
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Connection data
   */
  async handleCameraConnect(socket, data) {
    try {
      const { host, port = 7777, clientName = 'ARRI Camera Control', password } = data;

      // Validate connection parameters
      if (!host) {
        socket.emit('camera:connect:error', {
          message: 'Camera host is required',
          code: 'MISSING_HOST',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if already connected
      if (this.capManager.isConnected()) {
        socket.emit('camera:connect:error', {
          message: 'Already connected to camera',
          code: 'ALREADY_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} requesting camera connection`, {
        clientId: socket.id,
        host,
        port,
        clientName
      });

      // Emit connection starting event
      socket.emit('camera:connecting', {
        host,
        port,
        timestamp: new Date().toISOString()
      });

      // Attempt connection
      const connectionConfig = {
        host,
        port,
        clientName,
        password,
        connectionTimeout: 30000,
        messageTimeout: 5000
      };

      await this.capManager.connect(connectionConfig);

      // Connection successful
      socket.emit('camera:connect:success', {
        host,
        port,
        clientName,
        timestamp: new Date().toISOString(),
        status: this.capManager.getStatus()
      });

      logger.info(`Camera connection established for client ${socket.id}`, {
        clientId: socket.id,
        host,
        port
      });

    } catch (error) {
      logger.error(`Camera connection failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:connect:error', {
        message: error.message,
        code: error.code || 'CONNECTION_FAILED',
        category: error.capError?.category || 'connection',
        recoverable: error.capError?.recoverable || false,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle camera disconnection request
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleCameraDisconnect(socket) {
    try {
      logger.info(`Client ${socket.id} requesting camera disconnection`, {
        clientId: socket.id
      });

      // Check if connected
      if (!this.capManager.isConnected()) {
        socket.emit('camera:disconnect:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Disconnect from camera
      this.capManager.disconnect();

      socket.emit('camera:disconnect:success', {
        timestamp: new Date().toISOString()
      });

      logger.info(`Camera disconnected for client ${socket.id}`, {
        clientId: socket.id
      });

    } catch (error) {
      logger.error(`Camera disconnection failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:disconnect:error', {
        message: error.message,
        code: 'DISCONNECTION_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle camera status request
   * @param {Socket} socket - Socket.io socket instance
   */
  handleCameraStatus(socket) {
    try {
      const status = this.capManager.getStatus();
      const metrics = this.capManager.getMetrics();

      socket.emit('camera:status', {
        ...status,
        metrics,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Camera status sent to client ${socket.id}`, {
        clientId: socket.id,
        connected: status.connected,
        authenticated: status.authenticated
      });

    } catch (error) {
      logger.error(`Failed to get camera status for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:status:error', {
        message: 'Failed to get camera status',
        code: 'STATUS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle camera command request
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Command data
   */
  async handleCameraCommand(socket, data) {
    try {
      const { command, parameters = {} } = data;

      // Validate command
      if (!command) {
        socket.emit('camera:command:error', {
          message: 'Command is required',
          code: 'MISSING_COMMAND',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if connected
      if (!this.capManager.isConnected()) {
        socket.emit('camera:command:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.debug(`Client ${socket.id} sending camera command`, {
        clientId: socket.id,
        command,
        parameters
      });

      // Execute command through CAP manager
      const result = await this.capManager.sendCommand(command, parameters);

      socket.emit('camera:command:success', {
        command,
        parameters,
        result,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Camera command executed for client ${socket.id}`, {
        clientId: socket.id,
        command,
        success: true
      });

    } catch (error) {
      logger.error(`Camera command failed for client ${socket.id}:`, {
        clientId: socket.id,
        command: data.command,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:command:error', {
        command: data.command,
        message: error.message,
        code: error.code || 'COMMAND_FAILED',
        category: error.capError?.category || 'command',
        recoverable: error.capError?.recoverable || false,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle camera authentication request
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Authentication data
   */
  async handleCameraAuth(socket, data) {
    try {
      const { password } = data;

      // Validate password
      if (!password) {
        socket.emit('camera:auth:error', {
          message: 'Password is required',
          code: 'MISSING_PASSWORD',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Check if connected
      if (!this.capManager.isConnected()) {
        socket.emit('camera:auth:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.info(`Client ${socket.id} attempting camera authentication`, {
        clientId: socket.id
      });

      // Attempt authentication through CAP manager
      await this.capManager.authenticate(password);

      socket.emit('camera:auth:success', {
        timestamp: new Date().toISOString(),
        status: this.capManager.getStatus()
      });

      logger.info(`Camera authentication successful for client ${socket.id}`, {
        clientId: socket.id
      });

    } catch (error) {
      logger.error(`Camera authentication failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:auth:error', {
        message: error.message,
        code: error.code || 'AUTH_FAILED',
        category: error.capError?.category || 'authentication',
        recoverable: error.capError?.recoverable || false,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle camera health check request
   * @param {Socket} socket - Socket.io socket instance
   */
  async handleCameraHealthCheck(socket) {
    try {
      // Check if connected
      if (!this.capManager.isConnected()) {
        socket.emit('camera:health:error', {
          message: 'Not connected to camera',
          code: 'NOT_CONNECTED',
          timestamp: new Date().toISOString()
        });
        return;
      }

      logger.debug(`Client ${socket.id} requesting camera health check`, {
        clientId: socket.id
      });

      // Perform health check through CAP manager
      const healthStatus = await this.capManager.performHealthCheck();

      socket.emit('camera:health', {
        ...healthStatus,
        timestamp: new Date().toISOString()
      });

      logger.debug(`Camera health check completed for client ${socket.id}`, {
        clientId: socket.id,
        status: healthStatus.status
      });

    } catch (error) {
      logger.error(`Camera health check failed for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('camera:health:error', {
        message: error.message,
        code: 'HEALTH_CHECK_FAILED',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = { ConnectionHandler };