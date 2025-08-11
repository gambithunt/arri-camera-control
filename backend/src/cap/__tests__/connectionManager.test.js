/**
 * Unit tests for CAP connection manager
 */

const { CAPConnectionManager } = require('../connectionManager.js');
const { CAPConnection } = require('../connection.js');
const { CAP_RESULT_CODES } = require('../types.js');

// Mock the CAPConnection
jest.mock('../connection.js');

describe('CAPConnectionManager', () => {
  let manager;
  let mockConnection;

  beforeEach(() => {
    manager = new CAPConnectionManager();
    
    // Create mock connection
    mockConnection = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      sendCommand: jest.fn(),
      isConnected: jest.fn(() => true),
      isAuthenticated: jest.fn(() => false),
      on: jest.fn(),
      receiveBuffer: Buffer.alloc(0),
      pendingMessages: new Map()
    };
    
    CAPConnection.mockImplementation(() => mockConnection);
    
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should initialize with correct default values', () => {
      expect(manager.connectionState).toBe('disconnected');
      expect(manager.reconnectAttempts).toBe(0);
      expect(manager.maxReconnectAttempts).toBe(5);
      expect(manager.connection).toBeNull();
    });

    it('should connect successfully', async () => {
      const config = {
        host: '192.168.1.100',
        port: 7777,
        clientName: 'TestClient'
      };

      mockConnection.connect.mockResolvedValue(true);

      const result = await manager.connect(config);

      expect(result).toBe(true);
      expect(manager.connectionState).toBe('connecting');
      expect(mockConnection.connect).toHaveBeenCalledWith('192.168.1.100', 7777);
    });

    it('should handle connection failure', async () => {
      const config = { host: '192.168.1.100', port: 7777 };
      const error = new Error('Connection refused');
      
      mockConnection.connect.mockRejectedValue(error);

      await expect(manager.connect(config)).rejects.toThrow();
      expect(manager.connectionMetrics.totalErrors).toBe(1);
    });

    it('should disconnect properly', () => {
      manager.connection = mockConnection;
      manager.connectionState = 'connected';

      manager.disconnect();

      expect(mockConnection.disconnect).toHaveBeenCalled();
      expect(manager.connectionState).toBe('disconnected');
      expect(manager.connection).toBeNull();
    });
  });

  describe('Reconnection Logic', () => {
    beforeEach(() => {
      manager.connectionConfig = { host: '192.168.1.100', port: 7777 };
    });

    it('should schedule reconnection on failure', () => {
      const error = new Error('Connection lost');
      manager.onConnectionFailure(error);

      expect(manager.connectionState).toBe('reconnecting');
      expect(manager.reconnectAttempts).toBe(1);
      expect(manager.reconnectTimer).not.toBeNull();
    });

    it('should use exponential backoff for reconnection delay', () => {
      manager.reconnectAttempts = 2;
      manager.reconnectDelay = 1000;

      manager.scheduleReconnect();

      // Should use exponential backoff: 1000 * 2^(3-1) = 4000ms
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 4000);
    });

    it('should respect maximum reconnection attempts', () => {
      manager.reconnectAttempts = 5;
      manager.maxReconnectAttempts = 5;

      const error = new Error('Connection failed');
      const shouldRetry = manager.shouldRetryConnection({ recoverable: true });

      expect(shouldRetry).toBe(false);
    });

    it('should not retry non-recoverable errors', () => {
      manager.reconnectAttempts = 1;
      
      const shouldRetry = manager.shouldRetryConnection({
        recoverable: false,
        category: 'auth'
      });

      expect(shouldRetry).toBe(false);
    });

    it('should emit reconnecting event', () => {
      const reconnectingSpy = jest.fn();
      manager.on('reconnecting', reconnectingSpy);

      manager.scheduleReconnect();

      expect(reconnectingSpy).toHaveBeenCalledWith({
        attempt: 1,
        delay: expect.any(Number),
        maxAttempts: 5
      });
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      manager.connection = mockConnection;
      manager.connectionState = 'connected';
    });

    it('should start health check when connected', () => {
      manager.startHealthCheck();

      expect(manager.healthCheckInterval).not.toBeNull();
    });

    it('should stop health check when disconnected', () => {
      manager.startHealthCheck();
      const intervalId = manager.healthCheckInterval;

      manager.stopHealthCheck();

      expect(manager.healthCheckInterval).toBeNull();
    });

    it('should perform health check successfully', async () => {
      mockConnection.sendCommand.mockResolvedValue({ cmdCode: CAP_RESULT_CODES.OK });
      
      const healthCheckSpy = jest.fn();
      manager.on('healthCheck', healthCheckSpy);

      await manager.performHealthCheck();

      expect(mockConnection.sendCommand).toHaveBeenCalled();
      expect(healthCheckSpy).toHaveBeenCalledWith({
        responseTime: expect.any(Number),
        timestamp: expect.any(Number),
        status: 'healthy'
      });
    });

    it('should handle health check failure', async () => {
      mockConnection.sendCommand.mockRejectedValue(new Error('Health check failed'));

      await expect(manager.performHealthCheck()).rejects.toThrow('Health check failed');
    });
  });

  describe('Error Recovery', () => {
    beforeEach(() => {
      manager.connection = mockConnection;
      manager.connectionState = 'connected';
    });

    it('should attempt recovery for recoverable errors', async () => {
      const error = { recoverable: true, category: 'protocol' };
      
      mockConnection.sendCommand.mockResolvedValue({ cmdCode: CAP_RESULT_CODES.OK });
      
      const recoveredSpy = jest.fn();
      manager.on('recovered', recoveredSpy);

      await manager.attemptRecovery(error);

      expect(recoveredSpy).toHaveBeenCalled();
    });

    it('should disconnect for non-recoverable errors', async () => {
      const error = { recoverable: false, category: 'fatal' };
      
      const disconnectSpy = jest.spyOn(manager, 'disconnect');

      await manager.attemptRecovery(error);

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should recover from protocol errors', async () => {
      mockConnection.sendCommand.mockResolvedValue({ cmdCode: CAP_RESULT_CODES.OK });

      await manager.recoverFromProtocolError();

      expect(mockConnection.receiveBuffer).toEqual(Buffer.alloc(0));
      expect(mockConnection.pendingMessages.size).toBe(0);
      expect(mockConnection.sendCommand).toHaveBeenCalled();
    });

    it('should recover from timeout errors', async () => {
      mockConnection.sendCommand.mockResolvedValue({ cmdCode: CAP_RESULT_CODES.OK });

      await manager.recoverFromTimeout();

      expect(mockConnection.pendingMessages.size).toBe(0);
      expect(mockConnection.sendCommand).toHaveBeenCalled();
    });
  });

  describe('Metrics and Status', () => {
    it('should track connection metrics', () => {
      manager.onConnectionSuccess();

      expect(manager.connectionMetrics.totalConnections).toBe(1);
      expect(manager.connectionMetrics.connectTime).toBeDefined();
    });

    it('should track disconnection metrics', () => {
      manager.connectionMetrics.connectTime = Date.now() - 5000;
      manager.onDisconnection();

      expect(manager.connectionMetrics.totalDisconnections).toBe(1);
      expect(manager.connectionMetrics.uptime).toBeGreaterThan(0);
    });

    it('should provide connection status', () => {
      manager.connectionState = 'connected';
      manager.reconnectAttempts = 2;

      const status = manager.getStatus();

      expect(status.state).toBe('connected');
      expect(status.connected).toBe(true);
      expect(status.reconnectAttempts).toBe(2);
      expect(status.metrics).toBeDefined();
    });

    it('should provide connection metrics', () => {
      manager.connectionMetrics.connectTime = Date.now() - 1000;
      manager.connectionState = 'connected';

      const metrics = manager.getMetrics();

      expect(metrics.currentUptime).toBeGreaterThan(0);
    });

    it('should reset metrics', () => {
      manager.connectionMetrics.totalConnections = 5;
      manager.connectionMetrics.totalErrors = 3;

      manager.resetMetrics();

      expect(manager.connectionMetrics.totalConnections).toBe(0);
      expect(manager.connectionMetrics.totalErrors).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should configure connection parameters', () => {
      const config = {
        maxReconnectAttempts: 10,
        reconnectDelay: 5000,
        healthCheckTimeout: 15000
      };

      manager.configure(config);

      expect(manager.maxReconnectAttempts).toBe(10);
      expect(manager.reconnectDelay).toBe(5000);
      expect(manager.healthCheckTimeout).toBe(15000);
    });
  });

  describe('Command Forwarding', () => {
    beforeEach(() => {
      manager.connection = mockConnection;
    });

    it('should forward commands to connection', async () => {
      const cmdCode = 0x0080;
      const data = 'test data';
      const expectedResponse = { cmdCode: CAP_RESULT_CODES.OK };

      mockConnection.sendCommand.mockResolvedValue(expectedResponse);

      const result = await manager.sendCommand(cmdCode, data);

      expect(mockConnection.sendCommand).toHaveBeenCalledWith(cmdCode, data);
      expect(result).toBe(expectedResponse);
    });

    it('should handle command errors', async () => {
      mockConnection.sendCommand.mockRejectedValue(new Error('Command failed'));

      await expect(manager.sendCommand(0x0080)).rejects.toThrow();
    });

    it('should reject commands when not connected', async () => {
      mockConnection.isConnected.mockReturnValue(false);

      await expect(manager.sendCommand(0x0080)).rejects.toThrow('Not connected');
    });
  });

  describe('Event Handling', () => {
    it('should emit connected event on successful connection', () => {
      const connectedSpy = jest.fn();
      manager.on('connected', connectedSpy);

      manager.onConnectionSuccess();

      expect(connectedSpy).toHaveBeenCalled();
    });

    it('should emit disconnected event on disconnection', () => {
      const disconnectedSpy = jest.fn();
      manager.on('disconnected', disconnectedSpy);

      manager.onDisconnection();

      expect(disconnectedSpy).toHaveBeenCalled();
    });

    it('should emit error event on connection error', () => {
      const errorSpy = jest.fn();
      manager.on('error', errorSpy);

      const error = new Error('Test error');
      manager.onConnectionError(error);

      expect(errorSpy).toHaveBeenCalled();
    });

    it('should emit connectionFailed event when retries exhausted', () => {
      manager.reconnectAttempts = 5;
      manager.maxReconnectAttempts = 5;

      const connectionFailedSpy = jest.fn();
      manager.on('connectionFailed', connectionFailedSpy);

      const error = new Error('Connection failed');
      manager.onConnectionFailure(error);

      expect(connectionFailedSpy).toHaveBeenCalled();
    });
  });
});