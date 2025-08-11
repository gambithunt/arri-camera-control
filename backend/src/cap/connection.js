/**
 * CAP Protocol TCP Connection Management
 * Handles TCP socket connections to ARRI cameras
 */

const net = require('net');
const EventEmitter = require('events');
const { logger } = require('../utils/logger.js');
const { CAPMessage } = require('./message.js');
const { CAP_COMMANDS, CAP_RESULT_CODES } = require('./types.js');

class CAPConnection extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.authenticated = false;
    this.messageId = 1;
    this.pendingMessages = new Map();
    this.keepAliveInterval = null;
    this.connectionTimeout = 30000; // 30 seconds
    this.keepAliveTimeout = 1000; // 1 second (CAP requirement)
    this.receiveBuffer = Buffer.alloc(0);
  }

  /**
   * Connect to ARRI camera
   * @param {string} host - Camera IP address
   * @param {number} port - Camera port (default 7777)
   * @returns {Promise<boolean>} Connection success
   */
  async connect(host, port = 7777) {
    return new Promise((resolve, reject) => {
      try {
        logger.info(`Connecting to ARRI camera at ${host}:${port}`);
        
        this.socket = new net.Socket();
        this.socket.setTimeout(this.connectionTimeout);
        
        // Connection event handlers
        this.socket.on('connect', () => {
          logger.info(`Connected to ARRI camera at ${host}:${port}`);
          this.connected = true;
          this.startKeepAlive();
          this.emit('connected');
          resolve(true);
        });
        
        this.socket.on('data', (data) => {
          this.handleIncomingData(data);
        });
        
        this.socket.on('error', (error) => {
          logger.error(`Socket error: ${error.message}`);
          if (!this.connected) {
            reject(error);
          } else {
            this.emit('error', error);
          }
        });
        
        this.socket.on('close', () => {
          logger.info('Connection to camera closed');
          this.connected = false;
          this.authenticated = false;
          this.stopKeepAlive();
          this.emit('disconnected');
        });
        
        this.socket.on('timeout', () => {
          logger.warn('Connection timeout');
          this.disconnect();
          reject(new Error('Connection timeout'));
        });
        
        // Initiate connection
        this.socket.connect(port, host);
        
      } catch (error) {
        logger.error(`Failed to connect: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from camera
   */
  disconnect() {
    if (this.socket) {
      logger.info('Disconnecting from camera');
      this.stopKeepAlive();
      this.socket.destroy();
      this.socket = null;
      this.connected = false;
      this.authenticated = false;
    }
  }

  /**
   * Send CAP message to camera
   * @param {CAPMessage} message - Message to send
   * @returns {Promise<CAPMessage>} Response message
   */
  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      if (!this.connected || !this.socket) {
        reject(new Error('Not connected to camera'));
        return;
      }
      
      try {
        const buffer = message.serialize();
        logger.debug(`Sending CAP message: ${message.cmdCode.toString(16)}`);
        
        // Store pending message for response matching
        this.pendingMessages.set(message.msgId, { resolve, reject, timestamp: Date.now() });
        
        // Send message
        this.socket.write(buffer);
        
        // Set timeout for response
        const timeoutId = setTimeout(() => {
          if (this.pendingMessages.has(message.msgId)) {
            this.pendingMessages.delete(message.msgId);
            reject(new Error('Message timeout'));
          }
        }, 5000);
        
        // Store timeout ID for cleanup
        this.pendingMessages.get(message.msgId).timeoutId = timeoutId;
        
      } catch (error) {
        logger.error(`Failed to send message: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Send command and wait for response
   * @param {number} cmdCode - Command code
   * @param {*} data - Command data
   * @returns {Promise<CAPMessage>} Response message
   */
  async sendCommand(cmdCode, data = null) {
    const msgId = this.getNextMessageId();
    const message = CAPMessage.createCommand(msgId, cmdCode, data);
    return this.sendMessage(message);
  }

  /**
   * Handle incoming data from camera
   * @param {Buffer} data - Incoming data
   */
  handleIncomingData(data) {
    // Append to receive buffer
    this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
    
    // Process complete messages
    while (this.receiveBuffer.length >= 2) {
      // Read message length
      const messageLength = this.receiveBuffer.readUInt16BE(0);
      
      // Check if we have complete message
      if (this.receiveBuffer.length >= messageLength) {
        // Extract message
        const messageBuffer = this.receiveBuffer.slice(0, messageLength);
        this.receiveBuffer = this.receiveBuffer.slice(messageLength);
        
        try {
          const message = CAPMessage.deserialize(messageBuffer);
          this.handleMessage(message);
        } catch (error) {
          logger.error(`Failed to parse CAP message: ${error.message}`);
        }
      } else {
        // Wait for more data
        break;
      }
    }
  }

  /**
   * Handle parsed CAP message
   * @param {CAPMessage} message - Parsed message
   */
  handleMessage(message) {
    logger.debug(`Received CAP message: type=${message.msgType}, id=${message.msgId}, cmd=${message.cmdCode.toString(16)}`);
    
    // Handle replies to pending messages
    if (message.msgType === 0x02 && this.pendingMessages.has(message.msgId)) {
      const pending = this.pendingMessages.get(message.msgId);
      this.pendingMessages.delete(message.msgId);
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }
      pending.resolve(message);
      return;
    }
    
    // Handle specific message types
    switch (message.cmdCode) {
      case CAP_COMMANDS.WELCOME:
        this.handleWelcomeMessage(message);
        break;
      default:
        this.emit('message', message);
        break;
    }
  }

  /**
   * Handle welcome message from camera
   * @param {CAPMessage} message - Welcome message
   */
  handleWelcomeMessage(message) {
    logger.info('Received welcome message from camera');
    
    // Check result code
    if (message.cmdCode === CAP_RESULT_CODES.OK) {
      logger.info('Camera connection established successfully');
      this.emit('welcome', message);
    } else if (message.cmdCode === CAP_RESULT_CODES.TOO_MANY_CLIENTS) {
      logger.warn('Camera rejected connection: too many clients');
      this.emit('error', new Error('Too many clients connected to camera'));
    } else {
      logger.warn(`Camera connection failed: ${message.cmdCode}`);
      this.emit('error', new Error(`Connection failed: ${message.cmdCode}`));
    }
  }

  /**
   * Start keep-alive mechanism
   */
  startKeepAlive() {
    this.keepAliveInterval = setInterval(() => {
      if (this.connected) {
        this.sendCommand(CAP_COMMANDS.LIVE).catch(error => {
          logger.warn(`Keep-alive failed: ${error.message}`);
        });
      }
    }, this.keepAliveTimeout);
  }

  /**
   * Stop keep-alive mechanism
   */
  stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Get next message ID
   * @returns {number} Next message ID
   */
  getNextMessageId() {
    const id = this.messageId;
    this.messageId = this.messageId >= 65535 ? 1 : this.messageId + 1; // U16 range, avoid 0
    return id;
  }

  /**
   * Check if connected to camera
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Check if authenticated with camera
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return this.authenticated;
  }
}

module.exports = { CAPConnection };