/**
 * Unit tests for CAP connection handling
 */

const { CAPConnection } = require('../connection.js');
const { CAP_COMMANDS } = require('../types.js');

// Mock the net module
jest.mock('net');
const net = require('net');

describe('CAPConnection', () => {
  let connection;
  let mockSocket;

  beforeEach(() => {
    connection = new CAPConnection();
    
    // Create mock socket
    mockSocket = {
      connect: jest.fn(),
      write: jest.fn(),
      destroy: jest.fn(),
      setTimeout: jest.fn(),
      on: jest.fn(),
      removeAllListeners: jest.fn()
    };
    
    net.Socket.mockImplementation(() => mockSocket);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize with correct default values', () => {
      expect(connection.connected).toBe(false);
      expect(connection.authenticated).toBe(false);
      expect(connection.messageId).toBe(1);
      expect(connection.socket).toBeNull();
    });

    it('should attempt to connect to camera', async () => {
      const connectPromise = connection.connect('192.168.1.100', 7777);
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
      connectHandler();
      
      await expect(connectPromise).resolves.toBe(true);
      expect(mockSocket.connect).toHaveBeenCalledWith(7777, '192.168.1.100');
      expect(connection.connected).toBe(true);
    });

    it('should handle connection errors', async () => {
      const connectPromise = connection.connect('192.168.1.100', 7777);
      
      // Simulate connection error
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'error')[1];
      const testError = new Error('Connection refused');
      errorHandler(testError);
      
      await expect(connectPromise).rejects.toThrow('Connection refused');
      expect(connection.connected).toBe(false);
    });

    it('should handle connection timeout', async () => {
      const connectPromise = connection.connect('192.168.1.100', 7777);
      
      // Simulate timeout
      const timeoutHandler = mockSocket.on.mock.calls.find(call => call[0] === 'timeout')[1];
      timeoutHandler();
      
      await expect(connectPromise).rejects.toThrow('Connection timeout');
    });

    it('should disconnect properly', () => {
      connection.socket = mockSocket;
      connection.connected = true;
      
      connection.disconnect();
      
      expect(mockSocket.destroy).toHaveBeenCalled();
      expect(connection.connected).toBe(false);
      expect(connection.socket).toBeNull();
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      connection.socket = mockSocket;
      connection.connected = true;
    });

    it('should send command messages', async () => {
      const sendPromise = connection.sendCommand(CAP_COMMANDS.LIVE);
      
      expect(mockSocket.write).toHaveBeenCalled();
      expect(connection.pendingMessages.size).toBe(1);
      
      // The promise will timeout since we're not simulating a response
      // This is expected behavior for this test
    });

    it('should reject send when not connected', async () => {
      connection.connected = false;
      
      await expect(connection.sendCommand(CAP_COMMANDS.LIVE))
        .rejects.toThrow('Not connected to camera');
    });

    it('should generate sequential message IDs', () => {
      const id1 = connection.getNextMessageId();
      const id2 = connection.getNextMessageId();
      const id3 = connection.getNextMessageId();
      
      expect(id2).toBe(id1 + 1);
      expect(id3).toBe(id2 + 1);
    });

    it('should wrap message ID at U16 limit', () => {
      connection.messageId = 65535;
      
      const id1 = connection.getNextMessageId();
      const id2 = connection.getNextMessageId();
      
      expect(id1).toBe(65535);
      expect(id2).toBe(1); // Wrapped around
    });
  });

  describe('Keep-Alive Mechanism', () => {
    beforeEach(() => {
      connection.socket = mockSocket;
      connection.connected = true;
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should start keep-alive when connected', () => {
      connection.startKeepAlive();
      
      expect(connection.keepAliveInterval).not.toBeNull();
    });

    it('should send keep-alive messages periodically', () => {
      connection.startKeepAlive();
      
      // Fast-forward time
      jest.advanceTimersByTime(1000);
      
      expect(mockSocket.write).toHaveBeenCalled();
    });

    it('should stop keep-alive when disconnected', () => {
      connection.startKeepAlive();
      const intervalId = connection.keepAliveInterval;
      
      connection.stopKeepAlive();
      
      expect(connection.keepAliveInterval).toBeNull();
    });
  });

  describe('Status Checks', () => {
    it('should report connection status correctly', () => {
      expect(connection.isConnected()).toBe(false);
      
      connection.connected = true;
      expect(connection.isConnected()).toBe(true);
    });

    it('should report authentication status correctly', () => {
      expect(connection.isAuthenticated()).toBe(false);
      
      connection.authenticated = true;
      expect(connection.isAuthenticated()).toBe(true);
    });
  });
});