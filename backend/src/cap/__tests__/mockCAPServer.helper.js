/**
 * Mock CAP Server for Integration Testing
 * Simulates an ARRI camera for testing CAP protocol implementation
 */

const net = require('net');
const EventEmitter = require('events');
const { CAPMessage } = require('../message.js');
const { 
  CAP_COMMANDS, 
  CAP_VARIABLES, 
  CAP_RESULT_CODES,
  CAP_MESSAGE_TYPES,
  CAMERA_STATE_FLAGS 
} = require('../types.js');

class MockCAPServer extends EventEmitter {
  constructor(port = 7777) {
    super();
    this.port = port;
    this.server = null;
    this.clients = new Map();
    this.messageId = 1;
    
    // Mock camera state
    this.cameraState = {
      type: 'Alexa 35',
      serial: 'A35001',
      state: CAMERA_STATE_FLAGS.STDBY_READY,
      sensorFps: 24.0,
      shutterAngle: 180.0,
      exposureIndex: 800,
      colorTemperature: 5600,
      tint: 0.0,
      ndFilter: 0,
      timecode: 0x00000000,
      recording: false
    };
    
    // Subscribed variables per client
    this.subscriptions = new Map();
  }

  /**
   * Start mock server
   * @returns {Promise<void>}
   */
  async start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleClientConnection(socket);
      });

      this.server.on('error', (error) => {
        reject(error);
      });

      this.server.listen(this.port, () => {
        console.log(`Mock CAP server listening on port ${this.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop mock server
   * @returns {Promise<void>}
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('Mock CAP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new client connection
   * @param {net.Socket} socket - Client socket
   */
  handleClientConnection(socket) {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
    console.log(`Mock CAP server: Client connected (${clientId})`);
    
    this.clients.set(clientId, {
      socket,
      authenticated: false,
      clientName: null,
      receiveBuffer: Buffer.alloc(0)
    });
    
    this.subscriptions.set(clientId, new Set());

    // Send welcome message
    this.sendWelcomeMessage(clientId);

    socket.on('data', (data) => {
      this.handleClientData(clientId, data);
    });

    socket.on('close', () => {
      console.log(`Mock CAP server: Client disconnected (${clientId})`);
      this.clients.delete(clientId);
      this.subscriptions.delete(clientId);
    });

    socket.on('error', (error) => {
      console.log(`Mock CAP server: Client error (${clientId}): ${error.message}`);
      this.clients.delete(clientId);
      this.subscriptions.delete(clientId);
    });
  }

  /**
   * Send welcome message to client
   * @param {string} clientId - Client ID
   */
  sendWelcomeMessage(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Create protocol version data (1.12)
    const versionBuffer = Buffer.alloc(2);
    versionBuffer.writeUInt16BE(0x010C, 0); // Version 1.12

    const welcomeMessage = CAPMessage.createReply(
      this.getNextMessageId(),
      CAP_RESULT_CODES.OK,
      versionBuffer
    );

    this.sendMessage(clientId, welcomeMessage);
  }

  /**
   * Handle incoming data from client
   * @param {string} clientId - Client ID
   * @param {Buffer} data - Incoming data
   */
  handleClientData(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Append to receive buffer
    client.receiveBuffer = Buffer.concat([client.receiveBuffer, data]);

    // Process complete messages
    while (client.receiveBuffer.length >= 2) {
      const messageLength = client.receiveBuffer.readUInt16BE(0);
      
      if (client.receiveBuffer.length >= messageLength) {
        const messageBuffer = client.receiveBuffer.slice(0, messageLength);
        client.receiveBuffer = client.receiveBuffer.slice(messageLength);
        
        try {
          const message = CAPMessage.deserialize(messageBuffer);
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.log(`Mock CAP server: Failed to parse message: ${error.message}`);
        }
      } else {
        break;
      }
    }
  }

  /**
   * Handle parsed message from client
   * @param {string} clientId - Client ID
   * @param {CAPMessage} message - Parsed message
   */
  handleClientMessage(clientId, message) {
    console.log(`Mock CAP server: Received command ${message.cmdCode.toString(16)} from ${clientId}`);

    switch (message.cmdCode) {
      case CAP_COMMANDS.LIVE:
        this.handleLiveCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.CLIENT_NAME:
        this.handleClientNameCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.REQUEST_PWD_CHALLENGE:
        this.handlePasswordChallengeCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.PASSWORD:
        this.handlePasswordCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.GET_VARIABLE:
        this.handleGetVariableCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.SET_VARIABLE:
        this.handleSetVariableCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.REQUEST_VARIABLES:
        this.handleRequestVariablesCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.UN_REQUEST_VARIABLES:
        this.handleUnRequestVariablesCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.RECORD_START:
        this.handleRecordStartCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.RECORD_STOP:
        this.handleRecordStopCommand(clientId, message);
        break;
        
      case CAP_COMMANDS.AUTO_WHITE_BALANCE:
        this.handleAutoWhiteBalanceCommand(clientId, message);
        break;
        
      default:
        this.sendErrorReply(clientId, message.msgId, CAP_RESULT_CODES.NOT_IMPLEMENTED);
        break;
    }
  }

  /**
   * Handle LIVE command (keep-alive)
   */
  handleLiveCommand(clientId, message) {
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle CLIENT_NAME command
   */
  handleClientNameCommand(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && message.data) {
      client.clientName = message.data.toString();
      console.log(`Mock CAP server: Client name set to "${client.clientName}"`);
    }
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle password challenge request
   */
  handlePasswordChallengeCommand(clientId, message) {
    // Send dummy challenge
    const challenge = Buffer.from('mock_challenge');
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK, challenge);
  }

  /**
   * Handle password authentication
   */
  handlePasswordCommand(clientId, message) {
    const client = this.clients.get(clientId);
    if (client) {
      client.authenticated = true;
      console.log(`Mock CAP server: Client authenticated (${clientId})`);
    }
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle GET_VARIABLE command
   */
  handleGetVariableCommand(clientId, message) {
    const variableId = message.data;
    const value = this.getVariableValue(variableId);
    
    if (value !== null) {
      this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK, value);
    } else {
      this.sendErrorReply(clientId, message.msgId, CAP_RESULT_CODES.NO_SUCH_VARIABLES);
    }
  }

  /**
   * Handle SET_VARIABLE command
   */
  handleSetVariableCommand(clientId, message) {
    // For now, just acknowledge all set commands
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle REQUEST_VARIABLES command (subscribe)
   */
  handleRequestVariablesCommand(clientId, message) {
    const subscriptions = this.subscriptions.get(clientId);
    if (subscriptions && Array.isArray(message.data)) {
      message.data.forEach(variableId => {
        subscriptions.add(variableId);
      });
      console.log(`Mock CAP server: Client subscribed to ${message.data.length} variables`);
    }
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle UN_REQUEST_VARIABLES command (unsubscribe)
   */
  handleUnRequestVariablesCommand(clientId, message) {
    const subscriptions = this.subscriptions.get(clientId);
    if (subscriptions && Array.isArray(message.data)) {
      message.data.forEach(variableId => {
        subscriptions.delete(variableId);
      });
      console.log(`Mock CAP server: Client unsubscribed from ${message.data.length} variables`);
    }
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle RECORD_START command
   */
  handleRecordStartCommand(clientId, message) {
    this.cameraState.recording = true;
    this.cameraState.state |= CAMERA_STATE_FLAGS.RECORDING;
    console.log('Mock CAP server: Recording started');
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle RECORD_STOP command
   */
  handleRecordStopCommand(clientId, message) {
    this.cameraState.recording = false;
    this.cameraState.state &= ~CAMERA_STATE_FLAGS.RECORDING;
    console.log('Mock CAP server: Recording stopped');
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Handle AUTO_WHITE_BALANCE command
   */
  handleAutoWhiteBalanceCommand(clientId, message) {
    console.log('Mock CAP server: Auto white balance triggered');
    this.sendReply(clientId, message.msgId, CAP_RESULT_CODES.OK);
  }

  /**
   * Get mock variable value
   * @param {number} variableId - Variable ID
   * @returns {Buffer|null} Variable value or null if not found
   */
  getVariableValue(variableId) {
    switch (variableId) {
      case CAP_VARIABLES.CAMERA_TYPE:
        return this.serializeString(this.cameraState.type);
        
      case CAP_VARIABLES.CAMERA_SERIAL:
        return this.serializeString(this.cameraState.serial);
        
      case CAP_VARIABLES.CAMERA_STATE: {
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16BE(this.cameraState.state, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.SENSOR_FPS: {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatBE(this.cameraState.sensorFps, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.SHUTTER_ANGLE: {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatBE(this.cameraState.shutterAngle, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.EXPOSURE_INDEX: {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32BE(this.cameraState.exposureIndex, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.COLOR_TEMPERATURE: {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32BE(this.cameraState.colorTemperature, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.TINT: {
        const buffer = Buffer.alloc(4);
        buffer.writeFloatBE(this.cameraState.tint, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.ND_FILTER: {
        const buffer = Buffer.alloc(2);
        buffer.writeUInt16BE(this.cameraState.ndFilter, 0);
        return buffer;
      }
        
      case CAP_VARIABLES.TIMECODE: {
        const buffer = Buffer.alloc(4);
        buffer.writeUInt32BE(this.cameraState.timecode, 0);
        return buffer;
      }
        
      default:
        return null;
    }
  }

  /**
   * Serialize string for CAP protocol
   * @param {string} str - String to serialize
   * @returns {Buffer} Serialized string
   */
  serializeString(str) {
    const strBuffer = Buffer.from(str, 'utf8');
    const lengthBuffer = Buffer.alloc(2);
    lengthBuffer.writeUInt16BE(strBuffer.length, 0);
    return Buffer.concat([lengthBuffer, strBuffer]);
  }

  /**
   * Send message to client
   * @param {string} clientId - Client ID
   * @param {CAPMessage} message - Message to send
   */
  sendMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.socket) {
      const buffer = message.serialize();
      client.socket.write(buffer);
    }
  }

  /**
   * Send reply to client
   * @param {string} clientId - Client ID
   * @param {number} msgId - Original message ID
   * @param {number} resultCode - Result code
   * @param {*} data - Reply data
   */
  sendReply(clientId, msgId, resultCode, data = null) {
    const reply = CAPMessage.createReply(msgId, resultCode, data);
    this.sendMessage(clientId, reply);
  }

  /**
   * Send error reply to client
   * @param {string} clientId - Client ID
   * @param {number} msgId - Original message ID
   * @param {number} errorCode - Error code
   */
  sendErrorReply(clientId, msgId, errorCode) {
    this.sendReply(clientId, msgId, errorCode);
  }

  /**
   * Get next message ID
   * @returns {number} Next message ID
   */
  getNextMessageId() {
    const id = this.messageId;
    this.messageId = this.messageId >= 65535 ? 1 : this.messageId + 1;
    return id;
  }

  /**
   * Simulate variable change and broadcast to subscribers
   * @param {number} variableId - Variable ID
   * @param {*} value - New value
   */
  broadcastVariableUpdate(variableId, value) {
    this.subscriptions.forEach((subscriptions, clientId) => {
      if (subscriptions.has(variableId)) {
        const event = CAPMessage.createEvent(
          this.getNextMessageId(),
          variableId,
          value
        );
        this.sendMessage(clientId, event);
      }
    });
  }
}

module.exports = { MockCAPServer };