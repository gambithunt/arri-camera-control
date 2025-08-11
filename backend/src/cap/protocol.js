/**
 * CAP Protocol Handler
 * Implements core CAP protocol commands and camera communication
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger.js');
const { CAPConnection } = require('./connection.js');
const { CAPMessage } = require('./message.js');
const { 
  CAP_COMMANDS, 
  CAP_VARIABLES, 
  CAP_RESULT_CODES,
  CAP_MESSAGE_TYPES 
} = require('./types.js');

class CAPProtocolHandler extends EventEmitter {
  constructor() {
    super();
    this.connection = new CAPConnection();
    this.subscribedVariables = new Set();
    this.variableValues = new Map();
    this.commandQueue = [];
    this.isProcessingQueue = false;
    this.protocolVersion = null;
    this.cameraType = null;
    this.cameraSerial = null;
    
    this.setupConnectionHandlers();
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    this.connection.on('connected', () => {
      logger.info('CAP protocol connection established');
      this.emit('connected');
    });

    this.connection.on('disconnected', () => {
      logger.info('CAP protocol connection lost');
      this.subscribedVariables.clear();
      this.variableValues.clear();
      this.emit('disconnected');
    });

    this.connection.on('error', (error) => {
      logger.error(`CAP protocol error: ${error.message}`);
      this.emit('error', error);
    });

    this.connection.on('welcome', (message) => {
      this.handleWelcomeMessage(message);
    });

    this.connection.on('message', (message) => {
      this.handleMessage(message);
    });
  }

  /**
   * Connect to ARRI camera
   * @param {string} host - Camera IP address
   * @param {number} port - Camera port (default 7777)
   * @param {string} clientName - Client identifier
   * @param {string} password - Camera password (optional)
   * @returns {Promise<boolean>} Connection success
   */
  async connect(host, port = 7777, clientName = 'ARRI Camera Control App', password = null) {
    try {
      logger.info(`Connecting to ARRI camera at ${host}:${port}`);
      
      // Establish TCP connection
      await this.connection.connect(host, port);
      
      // Send client name
      await this.sendClientName(clientName);
      
      // Handle authentication if password required
      if (password) {
        await this.authenticate(password);
      }
      
      // Get basic camera information
      await this.getCameraInfo();
      
      logger.info('CAP protocol initialization complete');
      return true;
      
    } catch (error) {
      logger.error(`Failed to connect to camera: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnect from camera
   */
  disconnect() {
    logger.info('Disconnecting from ARRI camera');
    this.connection.disconnect();
  }

  /**
   * Send client name to camera
   * @param {string} clientName - Client identifier
   * @returns {Promise<void>}
   */
  async sendClientName(clientName) {
    logger.debug(`Sending client name: ${clientName}`);
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.CLIENT_NAME, clientName);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to set client name: ${response.cmdCode}`);
    }
  }

  /**
   * Authenticate with camera
   * @param {string} password - Camera password
   * @returns {Promise<void>}
   */
  async authenticate(password) {
    try {
      logger.debug('Requesting password challenge');
      
      // Request password challenge
      const challengeResponse = await this.connection.sendCommand(CAP_COMMANDS.REQUEST_PWD_CHALLENGE);
      
      if (challengeResponse.cmdCode !== CAP_RESULT_CODES.OK) {
        throw new Error(`Failed to get password challenge: ${challengeResponse.cmdCode}`);
      }
      
      // Send password response
      logger.debug('Sending password');
      const authResponse = await this.connection.sendCommand(CAP_COMMANDS.PASSWORD, password);
      
      if (authResponse.cmdCode !== CAP_RESULT_CODES.OK) {
        if (authResponse.cmdCode === CAP_RESULT_CODES.WRONG_PASSWD) {
          throw new Error('Invalid password');
        }
        throw new Error(`Authentication failed: ${authResponse.cmdCode}`);
      }
      
      logger.info('Camera authentication successful');
      
    } catch (error) {
      logger.error(`Authentication failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get basic camera information
   * @returns {Promise<void>}
   */
  async getCameraInfo() {
    try {
      // Get camera type
      const typeResponse = await this.getVariable(CAP_VARIABLES.CAMERA_TYPE);
      this.cameraType = this.parseStringData(typeResponse.data);
      
      // Get camera serial
      const serialResponse = await this.getVariable(CAP_VARIABLES.CAMERA_SERIAL);
      this.cameraSerial = this.parseStringData(serialResponse.data);
      
      logger.info(`Connected to ${this.cameraType} (Serial: ${this.cameraSerial})`);
      
      this.emit('cameraInfo', {
        type: this.cameraType,
        serial: this.cameraSerial
      });
      
    } catch (error) {
      logger.warn(`Failed to get camera info: ${error.message}`);
      // Don't throw - camera info is not critical for basic operation
    }
  }

  /**
   * Handle welcome message from camera
   * @param {CAPMessage} message - Welcome message
   */
  handleWelcomeMessage(message) {
    try {
      // Parse protocol version and camera type from welcome message
      if (message.data) {
        const data = message.data;
        if (Buffer.isBuffer(data) && data.length >= 2) {
          this.protocolVersion = data.readUInt16BE(0);
          logger.info(`CAP protocol version: ${this.protocolVersion >> 8}.${this.protocolVersion & 0xFF}`);
        }
      }
      
      this.emit('welcome', {
        protocolVersion: this.protocolVersion,
        cameraType: this.cameraType
      });
      
    } catch (error) {
      logger.warn(`Failed to parse welcome message: ${error.message}`);
    }
  }

  /**
   * Handle incoming CAP messages
   * @param {CAPMessage} message - Incoming message
   */
  handleMessage(message) {
    // Handle variable update events
    if (message.msgType === CAP_MESSAGE_TYPES.EVENT) {
      this.handleVariableUpdate(message);
    }
  }

  /**
   * Handle variable update events
   * @param {CAPMessage} message - Variable update message
   */
  handleVariableUpdate(message) {
    try {
      const variableId = message.cmdCode;
      const value = this.parseVariableData(variableId, message.data);
      
      this.variableValues.set(variableId, value);
      
      logger.debug(`Variable update: ${variableId.toString(16)} = ${JSON.stringify(value)}`);
      
      this.emit('variableUpdate', {
        variableId,
        value,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.warn(`Failed to handle variable update: ${error.message}`);
    }
  }

  /**
   * Get variable value from camera
   * @param {number} variableId - Variable ID
   * @returns {Promise<CAPMessage>} Variable response
   */
  async getVariable(variableId) {
    logger.debug(`Getting variable: ${variableId.toString(16)}`);
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.GET_VARIABLE, variableId);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to get variable ${variableId.toString(16)}: ${response.cmdCode}`);
    }
    
    return response;
  }

  /**
   * Set variable value on camera
   * @param {number} variableId - Variable ID
   * @param {*} value - Variable value
   * @returns {Promise<CAPMessage>} Set response
   */
  async setVariable(variableId, value) {
    logger.debug(`Setting variable: ${variableId.toString(16)} = ${JSON.stringify(value)}`);
    
    const data = this.serializeVariableData(variableId, value);
    const response = await this.connection.sendCommand(CAP_COMMANDS.SET_VARIABLE, data);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to set variable ${variableId.toString(16)}: ${response.cmdCode}`);
    }
    
    return response;
  }

  /**
   * Subscribe to variable updates
   * @param {number[]} variableIds - Array of variable IDs to subscribe to
   * @returns {Promise<void>}
   */
  async subscribeToVariables(variableIds) {
    logger.debug(`Subscribing to variables: ${variableIds.map(id => id.toString(16)).join(', ')}`);
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.REQUEST_VARIABLES, variableIds);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to subscribe to variables: ${response.cmdCode}`);
    }
    
    // Add to subscribed set
    variableIds.forEach(id => this.subscribedVariables.add(id));
    
    logger.info(`Subscribed to ${variableIds.length} variables`);
  }

  /**
   * Unsubscribe from variable updates
   * @param {number[]} variableIds - Array of variable IDs to unsubscribe from
   * @returns {Promise<void>}
   */
  async unsubscribeFromVariables(variableIds) {
    logger.debug(`Unsubscribing from variables: ${variableIds.map(id => id.toString(16)).join(', ')}`);
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.UN_REQUEST_VARIABLES, variableIds);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to unsubscribe from variables: ${response.cmdCode}`);
    }
    
    // Remove from subscribed set
    variableIds.forEach(id => this.subscribedVariables.delete(id));
    
    logger.info(`Unsubscribed from ${variableIds.length} variables`);
  }

  /**
   * Start recording
   * @returns {Promise<void>}
   */
  async startRecording() {
    logger.info('Starting recording');
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.RECORD_START);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to start recording: ${response.cmdCode}`);
    }
  }

  /**
   * Stop recording
   * @returns {Promise<void>}
   */
  async stopRecording() {
    logger.info('Stopping recording');
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.RECORD_STOP);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to stop recording: ${response.cmdCode}`);
    }
  }

  /**
   * Trigger auto white balance
   * @returns {Promise<void>}
   */
  async autoWhiteBalance() {
    logger.info('Triggering auto white balance');
    
    const response = await this.connection.sendCommand(CAP_COMMANDS.AUTO_WHITE_BALANCE);
    
    if (response.cmdCode !== CAP_RESULT_CODES.OK) {
      throw new Error(`Failed to trigger auto white balance: ${response.cmdCode}`);
    }
  }

  /**
   * Parse string data from buffer
   * @param {Buffer} data - Raw data buffer
   * @returns {string} Parsed string
   */
  parseStringData(data) {
    if (!Buffer.isBuffer(data) || data.length < 2) {
      return '';
    }
    
    const length = data.readUInt16BE(0);
    if (data.length < 2 + length) {
      return '';
    }
    
    return data.slice(2, 2 + length).toString('utf8');
  }

  /**
   * Parse variable data based on variable type
   * @param {number} variableId - Variable ID
   * @param {Buffer} data - Raw data buffer
   * @returns {*} Parsed value
   */
  parseVariableData(variableId, data) {
    if (!Buffer.isBuffer(data)) {
      return data;
    }
    
    // Parse based on known variable types
    switch (variableId) {
      case CAP_VARIABLES.CAMERA_TYPE:
      case CAP_VARIABLES.CAMERA_SERIAL:
      case CAP_VARIABLES.LOOK_FILENAME:
        return this.parseStringData(data);
        
      case CAP_VARIABLES.SENSOR_FPS:
      case CAP_VARIABLES.SHUTTER_ANGLE:
      case CAP_VARIABLES.EXPOSURE_TIME:
      case CAP_VARIABLES.TINT:
        return data.length >= 4 ? data.readFloatBE(0) : 0;
        
      case CAP_VARIABLES.COLOR_TEMPERATURE:
      case CAP_VARIABLES.EXPOSURE_INDEX:
      case CAP_VARIABLES.TIMECODE:
      case CAP_VARIABLES.TIMECODE_OFFSET:
        return data.length >= 4 ? data.readUInt32BE(0) : 0;
        
      case CAP_VARIABLES.CAMERA_STATE:
      case CAP_VARIABLES.ND_FILTER:
      case CAP_VARIABLES.CAMERA_INDEX:
        return data.length >= 2 ? data.readUInt16BE(0) : 0;
        
      default:
        // Return raw buffer for unknown types
        return data;
    }
  }

  /**
   * Serialize variable data for sending
   * @param {number} variableId - Variable ID
   * @param {*} value - Value to serialize
   * @returns {Buffer} Serialized data
   */
  serializeVariableData(variableId, value) {
    // Create a simple serialization based on variable type
    switch (variableId) {
      case CAP_VARIABLES.SENSOR_FPS:
      case CAP_VARIABLES.SHUTTER_ANGLE:
      case CAP_VARIABLES.EXPOSURE_TIME:
      case CAP_VARIABLES.TINT: {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatBE(value, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.COLOR_TEMPERATURE:
      case CAP_VARIABLES.EXPOSURE_INDEX:
      case CAP_VARIABLES.TIMECODE:
      case CAP_VARIABLES.TIMECODE_OFFSET: {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32BE(value, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.ND_FILTER:
      case CAP_VARIABLES.CAMERA_INDEX: {
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16BE(value, 0);
        return buffer;
      }
        
      default:
        // For unknown types, try to convert to string
        if (typeof value === 'string') {
          const strBuffer = Buffer.from(value, 'utf8');
          const lengthBuffer = Buffer.alloc(2);
          lengthBuffer.writeUInt16BE(strBuffer.length, 0);
          return Buffer.concat([lengthBuffer, strBuffer]);
        }
        return Buffer.from(JSON.stringify(value));
    }
  }

  /**
   * Get current connection status
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connection.isConnected();
  }

  /**
   * Get current authentication status
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return this.connection.isAuthenticated();
  }

  /**
   * Get subscribed variables
   * @returns {Set<number>} Set of subscribed variable IDs
   */
  getSubscribedVariables() {
    return new Set(this.subscribedVariables);
  }

  /**
   * Get cached variable value
   * @param {number} variableId - Variable ID
   * @returns {*} Cached value or undefined
   */
  getCachedVariable(variableId) {
    return this.variableValues.get(variableId);
  }

  /**
   * Get all cached variable values
   * @returns {Map<number, *>} Map of variable ID to value
   */
  getAllCachedVariables() {
    return new Map(this.variableValues);
  }
}

module.exports = { CAPProtocolHandler };