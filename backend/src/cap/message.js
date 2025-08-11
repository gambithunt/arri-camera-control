/**
 * CAP Protocol Message Handling
 * Handles serialization and deserialization of CAP protocol messages
 */

const { CAP_MESSAGE_TYPES, CAP_DATA_TYPES } = require('./types.js');

/**
 * CAP Message Structure:
 * [length: U16][msgType: U8][msgId: U16][cmdCode: U16][data: variable]
 */
class CAPMessage {
  constructor(msgType, msgId, cmdCode, data = null) {
    this.msgType = msgType;
    this.msgId = msgId;
    this.cmdCode = cmdCode;
    this.data = data;
  }

  /**
   * Serialize message to binary buffer
   * @returns {Buffer} Serialized message
   */
  serialize() {
    const dataBuffer = this.data ? this.serializeData(this.data) : Buffer.alloc(0);
    const headerSize = 7; // 2 + 1 + 2 + 2 bytes
    const totalLength = headerSize + dataBuffer.length;
    
    const buffer = Buffer.alloc(totalLength);
    let offset = 0;
    
    // Write length (U16)
    buffer.writeUInt16BE(totalLength, offset);
    offset += 2;
    
    // Write message type (U8)
    buffer.writeUInt8(this.msgType, offset);
    offset += 1;
    
    // Write message ID (U16)
    buffer.writeUInt16BE(this.msgId, offset);
    offset += 2;
    
    // Write command code (U16)
    buffer.writeUInt16BE(this.cmdCode, offset);
    offset += 2;
    
    // Write data
    if (dataBuffer.length > 0) {
      dataBuffer.copy(buffer, offset);
    }
    
    return buffer;
  }

  /**
   * Deserialize binary buffer to CAP message
   * @param {Buffer} buffer - Binary data
   * @returns {CAPMessage} Parsed message
   */
  static deserialize(buffer) {
    if (buffer.length < 7) {
      throw new Error('Invalid CAP message: too short');
    }
    
    let offset = 0;
    
    // Read length (U16)
    const length = buffer.readUInt16BE(offset);
    offset += 2;
    
    if (buffer.length !== length) {
      throw new Error(`Invalid CAP message: expected length ${length}, got ${buffer.length}`);
    }
    
    // Read message type (U8)
    const msgType = buffer.readUInt8(offset);
    offset += 1;
    
    // Read message ID (U16)
    const msgId = buffer.readUInt16BE(offset);
    offset += 2;
    
    // Read command code (U16)
    const cmdCode = buffer.readUInt16BE(offset);
    offset += 2;
    
    // Read data (if any)
    let data = null;
    if (offset < buffer.length) {
      const dataBuffer = buffer.slice(offset);
      data = CAPMessage.deserializeData(dataBuffer);
    }
    
    return new CAPMessage(msgType, msgId, cmdCode, data);
  }

  /**
   * Serialize data based on CAP data types
   * @param {*} data - Data to serialize
   * @returns {Buffer} Serialized data
   */
  serializeData(data) {
    if (data === null || data === undefined) {
      return Buffer.alloc(0);
    }
    
    // Handle different data types
    if (typeof data === 'string') {
      return this.serializeString(data);
    } else if (typeof data === 'number') {
      return this.serializeNumber(data);
    } else if (typeof data === 'boolean') {
      return this.serializeBoolean(data);
    } else if (Array.isArray(data)) {
      return this.serializeArray(data);
    } else if (Buffer.isBuffer(data)) {
      return data;
    }
    
    // Default: convert to JSON string
    return this.serializeString(JSON.stringify(data));
  }

  /**
   * Deserialize data from buffer
   * @param {Buffer} buffer - Data buffer
   * @returns {*} Deserialized data
   */
  static deserializeData(buffer) {
    if (buffer.length === 0) {
      return null;
    }
    
    // For now, return raw buffer - will be enhanced based on type information
    return buffer;
  }

  /**
   * Serialize string data
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
   * Serialize number data (assumes F32 for now)
   * @param {number} num - Number to serialize
   * @returns {Buffer} Serialized number
   */
  serializeNumber(num) {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatBE(num, 0);
    return buffer;
  }

  /**
   * Serialize boolean data
   * @param {boolean} bool - Boolean to serialize
   * @returns {Buffer} Serialized boolean
   */
  serializeBoolean(bool) {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(bool ? 1 : 0, 0);
    return buffer;
  }

  /**
   * Serialize array data
   * @param {Array} arr - Array to serialize
   * @returns {Buffer} Serialized array
   */
  serializeArray(arr) {
    const countBuffer = Buffer.alloc(2);
    countBuffer.writeUInt16BE(arr.length, 0);
    
    const elementBuffers = arr.map(element => this.serializeData(element));
    return Buffer.concat([countBuffer, ...elementBuffers]);
  }

  /**
   * Create a command message
   * @param {number} msgId - Message ID
   * @param {number} cmdCode - Command code
   * @param {*} data - Command data
   * @returns {CAPMessage} Command message
   */
  static createCommand(msgId, cmdCode, data = null) {
    return new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, msgId, cmdCode, data);
  }

  /**
   * Create a reply message
   * @param {number} msgId - Message ID
   * @param {number} resultCode - Result code
   * @param {*} data - Reply data
   * @returns {CAPMessage} Reply message
   */
  static createReply(msgId, resultCode, data = null) {
    return new CAPMessage(CAP_MESSAGE_TYPES.REPLY, msgId, resultCode, data);
  }

  /**
   * Create an event message
   * @param {number} msgId - Message ID
   * @param {number} eventCode - Event code
   * @param {*} data - Event data
   * @returns {CAPMessage} Event message
   */
  static createEvent(msgId, eventCode, data = null) {
    return new CAPMessage(CAP_MESSAGE_TYPES.EVENT, msgId, eventCode, data);
  }
}

module.exports = { CAPMessage };