/**
 * Enhanced CAP Connection Manager with Error Handling and Retry Logic
 * Provides robust connection management with automatic recovery
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger.js');
const { CAPConnection } = require('./connection.js');
const { CAPErrorHandler } = require('./errorHandler.js');
const { CAPProtocolLogger } = require('./protocolLogger.js');

class CAPConnectionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.connection = null;
    this.connectionConfig = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 2000; // Start with 2 seconds
    this.maxReconnectDelay = options.maxReconnectDelay || 30000; // Max 30 seconds
    this.reconnectTimer = null;
    this.healthCheckInterval = null;
    this.healthCheckTimeout = options.healthCheckTimeout || 10000; // 10 seconds
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
    this.lastError = null;
    
    // Enhanced error handling and logging
    this.errorHandler = new CAPErrorHandler();
    this.protocolLogger = new CAPProtocolLogger(options.logging || {});
    
    this.connectionMetrics = {
      connectTime: null,
      disconnectTime: null,
      totalConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      uptime: 0
    };
  }

  /**
   * Connect to ARRI camera with retry logic
   * @param {Object} config - Connection configuration
   * @param {string} config.host - Camera IP address
   * @param {number} config.port - Camera port
   * @param {string} config.clientName - Client name
   * @param {string} config.password - Camera password
   * @returns {Promise<boolean>} Connection success
   */
  async connect(config) {
    this.connectionConfig = { ...config };
    this.connectionState = 'connecting';
    
    try {
      await this.attemptConnection();
      return true;
    } catch (error) {
      const capError = this.errorHandler.handleConnectionError(error, 'Connection Manager');
      this.lastError = capError;
      this.emit('error', capError);
      throw this.errorHandler.createErrorFromResponse({ cmdCode: 'CONNECTION_ERROR' }, 'Connection Manager');
    }
  }

  /**
   * Attempt connection with error handling
   * @returns {Promise<void>}
   */
  async attemptConnection() {
    try {
      logger.info(`Attempting connection to ${this.connectionConfig.host}:${this.connectionConfig.port} (attempt ${this.reconnectAttempts + 1})`);
      
      // Create new connection with enhanced options
      this.connection = new CAPConnection({
        connectionTimeout: this.connectionConfig.connectionTimeout || 30000,
        messageTimeout: this.connectionConfig.messageTimeout || 5000,
        maxRetries: this.connectionConfig.maxRetries || 3,
        retryDelay: this.connectionConfig.retryDelay || 2000,
        logging: {
          enabled: true,
          logLevel: 'debug'
        }
      });
      this.setupConnectionHandlers();
      
      // Attempt connection
      await this.connection.connect(
        this.connectionConfig.host,
        this.connectionConfig.port
      );
      
      // Connection successful
      this.onConnectionSuccess();
      
    } catch (error) {
      this.onConnectionFailure(error);
      throw error;
    }
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    if (!this.connection) return;

    this.connection.on('connected', () => {
      this.onConnectionSuccess();
    });

    this.connection.on('disconnected', () => {
      this.onDisconnection();
    });

    this.connection.on('error', (error) => {
      this.onConnectionError(error);
    });

    this.connection.on('message', (message) => {
      this.emit('message', message);
    });

    this.connection.on('welcome', (message) => {
      this.emit('welcome', message);
    });
  }

  /**
   * Handle successful connection
   */
  onConnectionSuccess() {
    this.connectionState = 'connected';
    this.reconnectAttempts = 0;
    this.reconnectDelay = 2000; // Reset delay
    this.connectionMetrics.connectTime = Date.now();
    this.connectionMetrics.totalConnections++;
    
    // Clear any reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Start health monitoring
    this.startHealthCheck();
    
    logger.info('CAP connection established successfully');
    this.emit('connected');
  }

  /**
   * Handle connection failure
   * @param {Error} error - Connection error
   */
  onConnectionFailure(error) {
    this.connectionMetrics.totalErrors++;
    
    const capError = errorHandler.handleError(error, 'connection_failure', {
      attempt: this.reconnectAttempts + 1,
      maxAttempts: this.maxReconnectAttempts
    });
    
    this.lastError = capError;
    
    // Check if we should retry
    if (this.shouldRetryConnection(capError)) {
      this.scheduleReconnect();
    } else {
      this.connectionState = 'disconnected';
      logger.error('Connection failed permanently, no more retries');
      this.emit('connectionFailed', capError);
    }
  }

  /**
   * Handle disconnection
   */
  onDisconnection() {
    this.connectionState = 'disconnected';
    this.connectionMetrics.disconnectTime = Date.now();
    this.connectionMetrics.totalDisconnections++;
    
    // Calculate uptime
    if (this.connectionMetrics.connectTime) {
      this.connectionMetrics.uptime += Date.now() - this.connectionMetrics.connectTime;
    }
    
    // Stop health check
    this.stopHealthCheck();
    
    logger.warn('CAP connection lost');
    this.emit('disconnected');
    
    // Attempt reconnection if configured
    if (this.connectionConfig && this.shouldAttemptReconnect()) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle connection error
   * @param {Error} error - Connection error
   */
  onConnectionError(error) {
    this.connectionMetrics.totalErrors++;
    
    const capError = errorHandler.handleError(error, 'connection_error');
    this.lastError = capError;
    
    logger.error(`Connection error: ${capError.message}`);
    this.emit('error', capError);
    
    // If error is recoverable, attempt recovery
    if (capError.recoverable && this.connectionState === 'connected') {
      this.attemptRecovery(capError);
    }
  }

  /**
   * Determine if connection should be retried
   * @param {CAPError} error - Connection error
   * @returns {boolean} Whether to retry
   */
  shouldRetryConnection(error) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return false;
    }
    
    // Don't retry for certain error types
    const nonRetryableCategories = ['auth', 'feature'];
    if (nonRetryableCategories.includes(error.category)) {
      return false;
    }
    
    return error.recoverable;
  }

  /**
   * Determine if automatic reconnection should be attempted
   * @returns {boolean} Whether to attempt reconnection
   */
  shouldAttemptReconnect() {
    return this.reconnectAttempts < this.maxReconnectAttempts;
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.attemptConnection();
      } catch (error) {
        // Error already handled in attemptConnection
      }
    }, delay);
    
    this.emit('reconnecting', {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.maxReconnectAttempts
    });
  }

  /**
   * Attempt error recovery
   * @param {CAPError} error - Error to recover from
   */
  async attemptRecovery(error) {
    const strategy = errorHandler.createRecoveryStrategy(error);
    
    if (!strategy.canRecover) {
      logger.warn('Error is not recoverable, disconnecting');
      this.disconnect();
      return;
    }
    
    logger.info(`Attempting recovery for ${error.category} error`);
    
    try {
      // Implement recovery based on error type
      switch (error.category) {
        case 'protocol':
          await this.recoverFromProtocolError();
          break;
        case 'timeout':
          await this.recoverFromTimeout();
          break;
        default:
          logger.warn(`No specific recovery strategy for ${error.category} errors`);
      }
      
      this.emit('recovered', { error, strategy });
      
    } catch (recoveryError) {
      logger.error(`Recovery failed: ${recoveryError.message}`);
      this.disconnect();
    }
  }

  /**
   * Recover from protocol errors
   */
  async recoverFromProtocolError() {
    // Clear receive buffer and pending messages
    if (this.connection) {
      this.connection.receiveBuffer = Buffer.alloc(0);
      this.connection.pendingMessages.clear();
    }
    
    // Send keep-alive to test connection
    await this.sendKeepAlive();
  }

  /**
   * Recover from timeout errors
   */
  async recoverFromTimeout() {
    // Clear pending messages
    if (this.connection) {
      this.connection.pendingMessages.clear();
    }
    
    // Send keep-alive to test connection
    await this.sendKeepAlive();
  }

  /**
   * Send keep-alive message
   */
  async sendKeepAlive() {
    if (this.connection && this.connection.isConnected()) {
      try {
        await this.connection.sendCommand(require('./types.js').CAP_COMMANDS.LIVE);
        logger.debug('Keep-alive successful');
      } catch (error) {
        logger.warn('Keep-alive failed, connection may be lost');
        throw error;
      }
    }
  }

  /**
   * Start health check monitoring
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.warn('Health check failed');
        this.onConnectionError(error);
      }
    }, this.healthCheckTimeout);
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform connection health check
   */
  async performHealthCheck() {
    if (!this.connection || !this.connection.isConnected()) {
      throw new Error('Connection not available for health check');
    }
    
    // Send keep-alive and measure response time
    const startTime = Date.now();
    await this.sendKeepAlive();
    const responseTime = Date.now() - startTime;
    
    // Emit health status
    this.emit('healthCheck', {
      responseTime,
      timestamp: Date.now(),
      status: 'healthy'
    });
  }

  /**
   * Disconnect from camera
   */
  disconnect() {
    logger.info('Disconnecting from camera');
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.stopHealthCheck();
    
    // Disconnect connection
    if (this.connection) {
      this.connection.disconnect();
      this.connection = null;
    }
    
    this.connectionState = 'disconnected';
    this.connectionConfig = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Get connection status
   * @returns {Object} Connection status
   */
  getStatus() {
    return {
      state: this.connectionState,
      connected: this.connection ? this.connection.isConnected() : false,
      authenticated: this.connection ? this.connection.isAuthenticated() : false,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastError: this.lastError ? this.lastError.toJSON() : null,
      metrics: { ...this.connectionMetrics }
    };
  }

  /**
   * Get connection metrics
   * @returns {Object} Connection metrics
   */
  getMetrics() {
    const metrics = { ...this.connectionMetrics };
    
    // Calculate current uptime if connected
    if (this.connectionState === 'connected' && this.connectionMetrics.connectTime) {
      metrics.currentUptime = Date.now() - this.connectionMetrics.connectTime;
    }
    
    return metrics;
  }

  /**
   * Reset connection metrics
   */
  resetMetrics() {
    this.connectionMetrics = {
      connectTime: null,
      disconnectTime: null,
      totalConnections: 0,
      totalDisconnections: 0,
      totalErrors: 0,
      uptime: 0
    };
    
    logger.info('Connection metrics reset');
  }

  /**
   * Configure connection parameters
   * @param {Object} config - Configuration options
   */
  configure(config) {
    if (config.maxReconnectAttempts !== undefined) {
      this.maxReconnectAttempts = config.maxReconnectAttempts;
    }
    
    if (config.reconnectDelay !== undefined) {
      this.reconnectDelay = config.reconnectDelay;
    }
    
    if (config.maxReconnectDelay !== undefined) {
      this.maxReconnectDelay = config.maxReconnectDelay;
    }
    
    if (config.healthCheckTimeout !== undefined) {
      this.healthCheckTimeout = config.healthCheckTimeout;
    }
    
    logger.info('Connection manager configured', config);
  }

  /**
   * Forward method calls to underlying connection
   */
  async sendCommand(cmdCode, data) {
    if (!this.connection || !this.connection.isConnected()) {
      throw errorHandler.handleError('Not connected to camera', 'connection');
    }
    
    try {
      return await this.connection.sendCommand(cmdCode, data);
    } catch (error) {
      throw errorHandler.handleError(error, 'command_execution', { cmdCode });
    }
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connection ? this.connection.isConnected() : false;
  }

  /**
   * Check if authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return this.connection ? this.connection.isAuthenticated() : false;
  }
}

module.exports = { CAPConnectionManager };