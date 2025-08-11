/**
 * Unit tests for CAP message handling
 */

const { CAPMessage } = require('../message.js');
const { CAP_MESSAGE_TYPES, CAP_COMMANDS } = require('../types.js');

describe('CAPMessage', () => {
  describe('Message Creation', () => {
    it('should create a command message', () => {
      const message = CAPMessage.createCommand(1, CAP_COMMANDS.LIVE);
      
      expect(message.msgType).toBe(CAP_MESSAGE_TYPES.COMMAND);
      expect(message.msgId).toBe(1);
      expect(message.cmdCode).toBe(CAP_COMMANDS.LIVE);
      expect(message.data).toBeNull();
    });

    it('should create a reply message', () => {
      const message = CAPMessage.createReply(1, 0x0000, 'test data');
      
      expect(message.msgType).toBe(CAP_MESSAGE_TYPES.REPLY);
      expect(message.msgId).toBe(1);
      expect(message.cmdCode).toBe(0x0000);
      expect(message.data).toBe('test data');
    });

    it('should create an event message', () => {
      const message = CAPMessage.createEvent(1, 0x1000);
      
      expect(message.msgType).toBe(CAP_MESSAGE_TYPES.EVENT);
      expect(message.msgId).toBe(1);
      expect(message.cmdCode).toBe(0x1000);
    });
  });

  describe('Message Serialization', () => {
    it('should serialize a simple command message', () => {
      const message = CAPMessage.createCommand(1, CAP_COMMANDS.LIVE);
      const buffer = message.serialize();
      
      // Check header structure: [length: U16][msgType: U8][msgId: U16][cmdCode: U16]
      expect(buffer.length).toBe(7); // Header only, no data
      expect(buffer.readUInt16BE(0)).toBe(7); // Length
      expect(buffer.readUInt8(2)).toBe(CAP_MESSAGE_TYPES.COMMAND); // Message type
      expect(buffer.readUInt16BE(3)).toBe(1); // Message ID
      expect(buffer.readUInt16BE(5)).toBe(CAP_COMMANDS.LIVE); // Command code
    });

    it('should serialize a message with string data', () => {
      const message = CAPMessage.createCommand(2, CAP_COMMANDS.CLIENT_NAME, 'TestClient');
      const buffer = message.serialize();
      
      expect(buffer.length).toBeGreaterThan(7); // Header + data
      expect(buffer.readUInt16BE(0)).toBe(buffer.length); // Length matches actual
      expect(buffer.readUInt8(2)).toBe(CAP_MESSAGE_TYPES.COMMAND);
      expect(buffer.readUInt16BE(3)).toBe(2);
      expect(buffer.readUInt16BE(5)).toBe(CAP_COMMANDS.CLIENT_NAME);
    });
  });

  describe('Message Deserialization', () => {
    it('should deserialize a simple command message', () => {
      const originalMessage = CAPMessage.createCommand(1, CAP_COMMANDS.LIVE);
      const buffer = originalMessage.serialize();
      const deserializedMessage = CAPMessage.deserialize(buffer);
      
      expect(deserializedMessage.msgType).toBe(originalMessage.msgType);
      expect(deserializedMessage.msgId).toBe(originalMessage.msgId);
      expect(deserializedMessage.cmdCode).toBe(originalMessage.cmdCode);
    });

    it('should throw error for invalid message length', () => {
      const invalidBuffer = Buffer.from([0x00, 0x05]); // Claims length 5 but only 2 bytes
      
      expect(() => {
        CAPMessage.deserialize(invalidBuffer);
      }).toThrow('Invalid CAP message: too short');
    });

    it('should throw error for mismatched length', () => {
      const buffer = Buffer.alloc(10);
      buffer.writeUInt16BE(15, 0); // Claims length 15 but buffer is 10 bytes
      
      expect(() => {
        CAPMessage.deserialize(buffer);
      }).toThrow('Invalid CAP message: expected length 15, got 10');
    });
  });

  describe('Data Serialization', () => {
    it('should serialize string data with length prefix', () => {
      const message = new CAPMessage(1, 1, 1, 'test');
      const testStr = 'test';
      const serialized = message.serializeString(testStr);
      
      expect(serialized.readUInt16BE(0)).toBe(testStr.length);
      expect(serialized.slice(2).toString('utf8')).toBe(testStr);
    });

    it('should serialize number data as F32', () => {
      const message = new CAPMessage(1, 1, 1, null);
      const testNum = 3.14159;
      const serialized = message.serializeNumber(testNum);
      
      expect(serialized.length).toBe(4);
      expect(Math.abs(serialized.readFloatBE(0) - testNum)).toBeLessThan(0.0001);
    });

    it('should serialize boolean data', () => {
      const message = new CAPMessage(1, 1, 1, null);
      
      const trueBuffer = message.serializeBoolean(true);
      expect(trueBuffer.length).toBe(1);
      expect(trueBuffer.readUInt8(0)).toBe(1);
      
      const falseBuffer = message.serializeBoolean(false);
      expect(falseBuffer.length).toBe(1);
      expect(falseBuffer.readUInt8(0)).toBe(0);
    });

    it('should serialize array data with count prefix', () => {
      const message = new CAPMessage(1, 1, 1, null);
      const testArray = [1, 2, 3];
      const serialized = message.serializeArray(testArray);
      
      expect(serialized.readUInt16BE(0)).toBe(testArray.length);
    });
  });
});