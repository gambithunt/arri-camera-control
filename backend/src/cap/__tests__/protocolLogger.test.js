/**
 * Unit tests for CAP protocol logger
 */
const { CAPProtocolLogger } = require('../protocolLogger.js');
const { CAPMessage } = require('../message.js');
const { CAP_COMMANDS, CAP_MESSAGE_TYPES } = require('../types.js');

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

const { logger } = require('../../utils/logger.js');

describe('CAPProtocolLogger', () => {
  let protocolLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    protocolLogger = new CAPProtocolLogger({
      enabled: true,
      logLevel: 'debug',
      logRawData: true
    });
  });

  describe('Initialization', () => {
    it('should initialize with default options', () => {
      const defaultLogger = new CAPProtocolLogger();
      expect(defaultLogger.enabled).toBe(true);
      expect(defaultLogger.logLevel).toBe('debug');
      expect(defaultLogger.sessionId).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customLogger = new CAPProtocolLogger({
        enabled: false,
        logLevel: 'info',
        logRawData: false,
        maxDataLength: 128
      });
      
      expect(customLogger.enabled).toBe(false);
      expect(customLogger.logLevel).toBe('info');
      expect(customLogger.logRawData).toBe(false);
      expect(customLogger.maxDataLength).toBe(128);
    });
  });

  describe('Message Logging', () => {
    it('should log outgoing messages', () => {
      const message = new CAPMessage(
        CAP_MESSAGE_TYPES.COMMAND,
        1,
        CAP_COMMANDS.CLIENT_NAME,
        Buffer.from('TestClient')
      );

      protocolLogger.logOutgoingMessage(message, '192.168.1.100:7777');

      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Outgoing Message',
        expect.objectContaining({
          direction: 'OUTGOING',
          destination: '192.168.1.100:7777',
          msgType: 'COMMAND',
          msgId: 1,
          cmdName: 'CLIENT_NAME'
        })
      );
    });

    it('should log incoming messages', () => {
      const message = new CAPMessage(
        CAP_MESSAGE_TYPES.REPLY,
        1,
        0x0000, // OK response
        null
      );

      protocolLogger.logIncomingMessage(message, '192.168.1.100:7777');

      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Incoming Message',
        expect.objectContaining({
          direction: 'INCOMING',
          source: '192.168.1.100:7777',
          msgType: 'REPLY',
          msgId: 1
        })
      );
    });

    it('should not log when disabled', () => {
      protocolLogger.setEnabled(false);
      
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      protocolLogger.logOutgoingMessage(message);

      expect(logger.debug).not.toHaveBeenCalled();
    });

    it('should include raw data when enabled', () => {
      const testData = Buffer.from('test data');
      const message = new CAPMessage(
        CAP_MESSAGE_TYPES.COMMAND,
        1,
        CAP_COMMANDS.CLIENT_NAME,
        testData
      );

      protocolLogger.logOutgoingMessage(message);

      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Outgoing Message',
        expect.objectContaining({
          rawData: expect.stringContaining('74 65 73 74') // hex for 'test'
        })
      );
    });
  });

  describe('Connection Event Logging', () => {
    it('should log connection events', () => {
      protocolLogger.logConnectionEvent('connect', {
        host: '192.168.1.100',
        port: 7777,
        duration: 1500
      });

      expect(logger.info).toHaveBeenCalledWith(
        'CAP Protocol - Connection Established',
        expect.objectContaining({
          event: 'CONNECT',
          host: '192.168.1.100',
          port: 7777,
          duration: 1500
        })
      );
    });

    it('should log connection errors', () => {
      protocolLogger.logConnectionEvent('error', {
        error: 'Connection refused',
        host: '192.168.1.100'
      });

      expect(logger.error).toHaveBeenCalledWith(
        'CAP Protocol - Connection Error',
        expect.objectContaining({
          event: 'ERROR',
          error: 'Connection refused'
        })
      );
    });
  });

  describe('Authentication Logging', () => {
    it('should log successful authentication steps', () => {
      protocolLogger.logAuthenticationStep('password_verification', true, {
        username: 'admin'
      });

      expect(logger.info).toHaveBeenCalledWith(
        'CAP Protocol - Authentication: password_verification successful',
        expect.objectContaining({
          authStep: 'password_verification',
          success: true,
          username: 'admin'
        })
      );
    });

    it('should log failed authentication steps', () => {
      protocolLogger.logAuthenticationStep('password_verification', false, {
        reason: 'Invalid password'
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'CAP Protocol - Authentication: password_verification failed',
        expect.objectContaining({
          authStep: 'password_verification',
          success: false,
          reason: 'Invalid password'
        })
      );
    });
  });

  describe('Variable Subscription Logging', () => {
    it('should log variable subscriptions', () => {
      const variableIds = [0x1001, 0x1002, 0x1003];
      
      protocolLogger.logVariableSubscription('subscribe', variableIds, {
        clientId: 'test-client'
      });

      expect(logger.info).toHaveBeenCalledWith(
        'CAP Protocol - Variable subscribe',
        expect.objectContaining({
          action: 'SUBSCRIBE',
          variableCount: 3,
          variables: expect.arrayContaining(['0x1001', '0x1002', '0x1003']),
          clientId: 'test-client'
        })
      );
    });

    it('should log variable changes', () => {
      protocolLogger.logVariableChange(0x1001, 'old_value', 'new_value');

      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Variable Change',
        expect.objectContaining({
          variableId: '0x1001',
          oldValue: 'old_value',
          newValue: 'new_value'
        })
      );
    });
  });

  describe('Performance Logging', () => {
    it('should log normal performance metrics', () => {
      protocolLogger.logPerformanceMetrics('message_send', 500, {
        messageType: 'GET_VARIABLE'
      });

      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Performance',
        expect.objectContaining({
          operation: 'message_send',
          duration: '500ms',
          messageType: 'GET_VARIABLE'
        })
      );
    });

    it('should warn about slow operations', () => {
      protocolLogger.logPerformanceMetrics('slow_operation', 2000);

      expect(logger.warn).toHaveBeenCalledWith(
        'CAP Protocol - Slow Operation',
        expect.objectContaining({
          operation: 'slow_operation',
          duration: '2000ms'
        })
      );
    });
  });

  describe('Error Logging', () => {
    it('should log protocol errors', () => {
      const error = new Error('Protocol error');
      error.code = 'PROTOCOL_ERROR';
      error.stack = 'Error stack trace';

      protocolLogger.logProtocolError(error, 'Message parsing', {
        messageId: 123
      });

      expect(logger.error).toHaveBeenCalledWith(
        'CAP Protocol - Error',
        expect.objectContaining({
          context: 'Message parsing',
          errorMessage: 'Protocol error',
          errorCode: 'PROTOCOL_ERROR',
          messageId: 123
        })
      );
    });
  });

  describe('Data Formatting', () => {
    it('should format buffer data as hex', () => {
      const buffer = Buffer.from([0x01, 0x02, 0x03, 0x04]);
      const formatted = protocolLogger.formatRawData(buffer);
      expect(formatted).toBe('01 02 03 04');
    });

    it('should truncate long buffer data', () => {
      const longBuffer = Buffer.alloc(300, 0xFF);
      const formatted = protocolLogger.formatRawData(longBuffer);
      expect(formatted).toContain('...');
      expect(formatted).toContain('more bytes');
    });

    it('should format JSON data', () => {
      const data = { test: 'value', number: 123 };
      const formatted = protocolLogger.formatRawData(data);
      expect(formatted).toBe('{"test":"value","number":123}');
    });

    it('should truncate long JSON data', () => {
      const longData = { longString: 'a'.repeat(300) };
      const formatted = protocolLogger.formatRawData(longData);
      expect(formatted).toContain('...');
    });
  });

  describe('Configuration', () => {
    it('should enable/disable logging', () => {
      protocolLogger.setEnabled(false);
      expect(protocolLogger.enabled).toBe(false);

      protocolLogger.setEnabled(true);
      expect(protocolLogger.enabled).toBe(true);
    });

    it('should change log level', () => {
      protocolLogger.setLogLevel('info');
      expect(protocolLogger.logLevel).toBe('info');
    });
  });

  describe('Child Logger', () => {
    it('should create child logger with component context', () => {
      const childLogger = protocolLogger.createChildLogger('ConnectionManager');
      
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      childLogger.logOutgoing(message, 'camera');

      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Outgoing Message',
        expect.objectContaining({
          destination: 'ConnectionManager->camera'
        })
      );
    });
  });

  describe('Statistics', () => {
    it('should provide logging statistics', () => {
      const stats = protocolLogger.getStats();
      
      expect(stats.sessionId).toBeDefined();
      expect(stats.messageCount).toBeDefined();
      expect(stats.enabled).toBe(true);
      expect(stats.logLevel).toBe('debug');
    });
  });

  describe('Message Type Names', () => {
    it('should return correct message type names', () => {
      expect(protocolLogger.getMessageTypeName(CAP_MESSAGE_TYPES.COMMAND)).toBe('COMMAND');
      expect(protocolLogger.getMessageTypeName(CAP_MESSAGE_TYPES.REPLY)).toBe('REPLY');
      expect(protocolLogger.getMessageTypeName(CAP_MESSAGE_TYPES.EVENT)).toBe('EVENT');
      expect(protocolLogger.getMessageTypeName(0xFF)).toContain('UNKNOWN');
    });
  });
});