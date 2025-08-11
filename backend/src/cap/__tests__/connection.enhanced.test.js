/**
 * Integration tests for enhanced CAP connection with error handling and logging
 */
const { CAPConnection } = require('../connection.js');
const { CAPMessage } = require('../message.js');
const { CAP_COMMANDS, CAP_RESULT_CODES, CAP_MESSAGE_TYPES } = require('../types.js');
const net = require('net');

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

// Mock socket for testing
class MockSocket extends require('events').EventEmitter {
  constructor() {
    super();
    this.connected = false;
    this.data = [];
  }

  connect(port, host) {
    setTimeout(() => {
      this.connected = true;
      this.emit('connect');
    }, 10);
  }

  write(data) {
    this.data.push(data);
    return true;
  }

  setTimeout(timeout) {
    this.timeout = timeout;
  }

  destroy() {
    this.connected = false;
    this.emit('close');
  }

  simulateError(error) {
    this.emit('error', error);
  }

  simulateTimeout() {
    this.emit('timeout');
  }

  simulateData(data) {
    this.emit('data', data);
  }
}

describe('Enhanced CAP Connection', () => {
  let connection;
  let mockSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    connection = new CAPConnection({
      connectionTimeout: 1000,
      messageTimeout: 500,
      maxRetries: 2,
      retryDelay: 100,
      logging: { enabled: true, logLevel: 'debug' }
    });
    
    mockSocket = new MockSocket();
    jest.spyOn(net, 'Socket').mockImplementation(() => mockSocket);
  });

  afterEach(() => {
    if (connection.connected) {
      connection.disconnect();
    }
    jest.restoreAllMocks();
  });

  describe('Enhanced Connection', () => {
    it('should connect successfully with logging', async () => {
      const connectPromise = connection.connect('192.168.1.100', 7777);
      
      // Wait for connection to complete
      await connectPromise;
      
      expect(connection.connected).toBe(true);
      expect(connection.getConnectionStats().connectionState.totalConnections).toBe(1);
    });

    it('should retry connection on failure', async () => {
      let connectAttempts = 0;
      jest.spyOn(net, 'Socket').mockImplementation(() => {
        connectAttempts++;
        const socket = new MockSocket();
        if (connectAttempts < 3) {
          // Fail first two attempts
          setTimeout(() => socket.simulateError(new Error('ECONNREFUSED')), 5);
        } else {
          // Succeed on third attempt
          setTimeout(() => socket.emit('connect'), 10);
        }
        return socket;
      });

      await connection.connect('192.168.1.100', 7777);
      
      expect(connectAttempts).toBe(3);
      expect(connection.connected).toBe(true);
    });

    it('should fail after max retries', async () => {
      jest.spyOn(net, 'Socket').mockImplementation(() => {
        const socket = new MockSocket();
        setTimeout(() => socket.simulateError(new Error('ECONNREFUSED')), 5);
        return socket;
      });

      await expect(connection.connect('192.168.1.100', 7777))
        .rejects.toThrow();
      
      expect(connection.connected).toBe(false);
    });

    it('should handle connection timeout', async () => {
      jest.spyOn(net, 'Socket').mockImplementation(() => {
        const socket = new MockSocket();
        setTimeout(() => socket.simulateTimeout(), 50);
        return socket;
      });

      await expect(connection.connect('192.168.1.100', 7777))
        .rejects.toThrow('timeout');
    });
  });

  describe('Enhanced Message Handling', () => {
    beforeEach(async () => {
      await connection.connect('192.168.1.100', 7777);
    });

    it('should send message with enhanced logging', async () => {
      const message = new CAPMessage(
        CAP_MESSAGE_TYPES.COMMAND,
        1,
        CAP_COMMANDS.CLIENT_NAME,
        Buffer.from('TestClient')
      );

      // Simulate successful response
      setTimeout(() => {
        const response = new CAPMessage(
          CAP_MESSAGE_TYPES.REPLY,
          1,
          CAP_RESULT_CODES.OK,
          null
        );
        const responseBuffer = response.serialize();
        mockSocket.simulateData(responseBuffer);
      }, 10);

      const response = await connection.sendMessage(message);
      
      expect(response.cmdCode).toBe(CAP_RESULT_CODES.OK);
      expect(connection.getConnectionStats().messageStats.sent).toBe(1);
      expect(connection.getConnectionStats().messageStats.received).toBe(1);
    });

    it('should handle message timeout with enhanced error', async () => {
      const message = new CAPMessage(
        CAP_MESSAGE_TYPES.COMMAND,
        1,
        CAP_COMMANDS.CLIENT_NAME
      );

      // Don't send response to trigger timeout
      await expect(connection.sendMessage(message))
        .rejects.toThrow('timeout');
      
      expect(connection.getConnectionStats().messageStats.timeouts).toBe(1);
    });

    it('should handle error responses with enhanced error info', async () => {
      const message = new CAPMessage(
        CAP_MESSAGE_TYPES.COMMAND,
        1,
        CAP_COMMANDS.CLIENT_NAME
      );

      // Simulate error response
      setTimeout(() => {
        const errorResponse = new CAPMessage(
          CAP_MESSAGE_TYPES.REPLY,
          1,
          CAP_RESULT_CODES.WRONG_PASSWD,
          null
        );
        const responseBuffer = errorResponse.serialize();
        mockSocket.simulateData(responseBuffer);
      }, 10);

      try {
        await connection.sendMessage(message);
        fail('Should have thrown error');
      } catch (error) {
        expect(error.capError).toBeDefined();
        expect(error.capError.category).toBe('authentication');
        expect(error.capError.userMessage).toContain('password');
      }
    });
  });

  describe('Connection Statistics', () => {
    it('should track connection statistics', async () => {
      await connection.connect('192.168.1.100', 7777);
      
      const stats = connection.getConnectionStats();
      
      expect(stats.connectionState.totalConnections).toBe(1);
      expect(stats.connectionState.lastConnectTime).toBeDefined();
      expect(stats.messageStats).toBeDefined();
      expect(stats.protocolLogger).toBeDefined();
    });

    it('should reset statistics', async () => {
      await connection.connect('192.168.1.100', 7777);
      
      // Send a message to generate stats
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      setTimeout(() => {
        const response = new CAPMessage(CAP_MESSAGE_TYPES.REPLY, 1, CAP_RESULT_CODES.OK);
        mockSocket.simulateData(response.serialize());
      }, 10);
      await connection.sendMessage(message);
      
      connection.resetStats();
      
      const stats = connection.getConnectionStats();
      expect(stats.messageStats.sent).toBe(0);
      expect(stats.messageStats.received).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should configure connection parameters', () => {
      const config = {
        connectionTimeout: 5000,
        messageTimeout: 2000,
        retryConfig: {
          maxRetries: 5,
          retryDelay: 1000
        },
        logging: {
          enabled: false,
          logLevel: 'info'
        }
      };

      connection.configure(config);
      
      expect(connection.connectionTimeout).toBe(5000);
      expect(connection.messageTimeout).toBe(2000);
      expect(connection.retryConfig.maxRetries).toBe(5);
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await connection.connect('192.168.1.100', 7777);
    });

    it('should clear pending messages on disconnect', async () => {
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      
      // Send message but don't respond
      const messagePromise = connection.sendMessage(message);
      
      // Simulate disconnect
      mockSocket.destroy();
      
      await expect(messagePromise).rejects.toThrow('Connection closed');
    });

    it('should handle socket errors gracefully', async () => {
      const errorSpy = jest.fn();
      connection.on('error', errorSpy);
      
      mockSocket.simulateError(new Error('Socket error'));
      
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('Protocol Logger Integration', () => {
    beforeEach(async () => {
      await connection.connect('192.168.1.100', 7777);
    });

    it('should log outgoing messages', async () => {
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      
      setTimeout(() => {
        const response = new CAPMessage(CAP_MESSAGE_TYPES.REPLY, 1, CAP_RESULT_CODES.OK);
        mockSocket.simulateData(response.serialize());
      }, 10);
      
      await connection.sendMessage(message);
      
      // Verify protocol logger was called (through mocked logger)
      const { logger } = require('../../utils/logger.js');
      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Outgoing Message',
        expect.objectContaining({
          direction: 'OUTGOING',
          cmdName: 'CLIENT_NAME'
        })
      );
    });

    it('should log incoming messages', async () => {
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      
      setTimeout(() => {
        const response = new CAPMessage(CAP_MESSAGE_TYPES.REPLY, 1, CAP_RESULT_CODES.OK);
        mockSocket.simulateData(response.serialize());
      }, 10);
      
      await connection.sendMessage(message);
      
      const { logger } = require('../../utils/logger.js');
      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Incoming Message',
        expect.objectContaining({
          direction: 'INCOMING'
        })
      );
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await connection.connect('192.168.1.100', 7777);
    });

    it('should log performance metrics for message round trips', async () => {
      const message = new CAPMessage(CAP_MESSAGE_TYPES.COMMAND, 1, CAP_COMMANDS.CLIENT_NAME);
      
      setTimeout(() => {
        const response = new CAPMessage(CAP_MESSAGE_TYPES.REPLY, 1, CAP_RESULT_CODES.OK);
        mockSocket.simulateData(response.serialize());
      }, 100); // Add delay to measure
      
      await connection.sendMessage(message);
      
      const { logger } = require('../../utils/logger.js');
      expect(logger.debug).toHaveBeenCalledWith(
        'CAP Protocol - Performance',
        expect.objectContaining({
          operation: 'Message Round Trip'
        })
      );
    });
  });
});