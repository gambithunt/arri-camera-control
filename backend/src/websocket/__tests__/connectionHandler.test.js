/**
 * Unit tests for Connection Handler
 */

const { ConnectionHandler } = require('../connectionHandler.js');
const { EventEmitter } = require('events');

// Mock logger
jest.mock('../../utils/logger.js', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('ConnectionHandler', () => {
  let connectionHandler;
  let mockWsManager;
  let mockCapManager;
  let mockSocket;

  beforeEach(() => {
    // Mock CAP manager
    mockCapManager = new EventEmitter();
    mockCapManager.connect = jest.fn();
    mockCapManager.disconnect = jest.fn();
    mockCapManager.isConnected = jest.fn().mockReturnValue(false);
    mockCapManager.isAuthenticated = jest.fn().mockReturnValue(false);
    mockCapManager.authenticate = jest.fn();
    mockCapManager.sendCommand = jest.fn();
    mockCapManager.performHealthCheck = jest.fn();
    mockCapManager.getStatus = jest.fn().mockReturnValue({
      state: 'disconnected',
      connected: false,
      authenticated: false
    });
    mockCapManager.getMetrics = jest.fn().mockReturnValue({
      totalConnections: 0,
      uptime: 0
    });

    // Mock WebSocket manager
    mockWsManager = {
      capManager: mockCapManager
    };

    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn()
    };

    connectionHandler = new ConnectionHandler(mockWsManager);
  });

  describe('Camera Connection', () => {
    it('should handle successful camera connection', async () => {
      const connectionData = {
        host: '192.168.1.100',
        port: 7777,
        clientName: 'Test Client',
        password: 'test123'
      };

      mockCapManager.connect.mockResolvedValue();

      await connectionHandler.handleCameraConnect(mockSocket, connectionData);

      expect(mockCapManager.connect).toHaveBeenCalledWith({
        host: '192.168.1.100',
        port: 7777,
        clientName: 'Test Client',
        password: 'test123',
        connectionTimeout: 30000,
        messageTimeout: 5000
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:connecting', expect.objectContaining({
        host: '192.168.1.100',
        port: 7777
      }));

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:connect:success', expect.objectContaining({
        host: '192.168.1.100',
        port: 7777,
        clientName: 'Test Client'
      }));
    });

    it('should handle camera connection failure', async () => {
      const connectionData = {
        host: '192.168.1.100',
        port: 7777
      };

      const error = new Error('Connection failed');
      error.code = 'ECONNREFUSED';
      mockCapManager.connect.mockRejectedValue(error);

      await connectionHandler.handleCameraConnect(mockSocket, connectionData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:connect:error', expect.objectContaining({
        message: 'Connection failed',
        code: 'ECONNREFUSED'
      }));
    });

    it('should validate connection parameters', async () => {
      const connectionData = {}; // Missing host

      await connectionHandler.handleCameraConnect(mockSocket, connectionData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:connect:error', expect.objectContaining({
        message: 'Camera host is required',
        code: 'MISSING_HOST'
      }));

      expect(mockCapManager.connect).not.toHaveBeenCalled();
    });

    it('should prevent duplicate connections', async () => {
      const connectionData = {
        host: '192.168.1.100'
      };

      mockCapManager.isConnected.mockReturnValue(true);

      await connectionHandler.handleCameraConnect(mockSocket, connectionData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:connect:error', expect.objectContaining({
        message: 'Already connected to camera',
        code: 'ALREADY_CONNECTED'
      }));

      expect(mockCapManager.connect).not.toHaveBeenCalled();
    });
  });

  describe('Camera Disconnection', () => {
    it('should handle successful camera disconnection', async () => {
      mockCapManager.isConnected.mockReturnValue(true);

      await connectionHandler.handleCameraDisconnect(mockSocket);

      expect(mockCapManager.disconnect).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:disconnect:success', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });

    it('should handle disconnection when not connected', async () => {
      mockCapManager.isConnected.mockReturnValue(false);

      await connectionHandler.handleCameraDisconnect(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:disconnect:error', expect.objectContaining({
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED'
      }));

      expect(mockCapManager.disconnect).not.toHaveBeenCalled();
    });

    it('should handle disconnection errors', async () => {
      mockCapManager.isConnected.mockReturnValue(true);
      mockCapManager.disconnect.mockImplementation(() => {
        throw new Error('Disconnection failed');
      });

      await connectionHandler.handleCameraDisconnect(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:disconnect:error', expect.objectContaining({
        message: 'Disconnection failed',
        code: 'DISCONNECTION_FAILED'
      }));
    });
  });

  describe('Camera Status', () => {
    it('should return camera status', () => {
      const mockStatus = {
        state: 'connected',
        connected: true,
        authenticated: true
      };
      const mockMetrics = {
        totalConnections: 1,
        uptime: 12345
      };

      mockCapManager.getStatus.mockReturnValue(mockStatus);
      mockCapManager.getMetrics.mockReturnValue(mockMetrics);

      connectionHandler.handleCameraStatus(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:status', expect.objectContaining({
        ...mockStatus,
        metrics: mockMetrics,
        timestamp: expect.any(String)
      }));
    });

    it('should handle status errors', () => {
      mockCapManager.getStatus.mockImplementation(() => {
        throw new Error('Status error');
      });

      connectionHandler.handleCameraStatus(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:status:error', expect.objectContaining({
        message: 'Failed to get camera status',
        code: 'STATUS_ERROR'
      }));
    });
  });

  describe('Camera Commands', () => {
    it('should execute camera commands successfully', async () => {
      const commandData = {
        command: 'SET_FRAME_RATE',
        parameters: { frameRate: 24 }
      };

      mockCapManager.isConnected.mockReturnValue(true);
      mockCapManager.sendCommand.mockResolvedValue({ success: true });

      await connectionHandler.handleCameraCommand(mockSocket, commandData);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith('SET_FRAME_RATE', { frameRate: 24 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:command:success', expect.objectContaining({
        command: 'SET_FRAME_RATE',
        parameters: { frameRate: 24 },
        result: { success: true }
      }));
    });

    it('should validate command parameters', async () => {
      const commandData = {}; // Missing command

      await connectionHandler.handleCameraCommand(mockSocket, commandData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:command:error', expect.objectContaining({
        message: 'Command is required',
        code: 'MISSING_COMMAND'
      }));

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should check connection before executing commands', async () => {
      const commandData = {
        command: 'SET_FRAME_RATE'
      };

      mockCapManager.isConnected.mockReturnValue(false);

      await connectionHandler.handleCameraCommand(mockSocket, commandData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:command:error', expect.objectContaining({
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED'
      }));

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should handle command execution errors', async () => {
      const commandData = {
        command: 'SET_FRAME_RATE',
        parameters: { frameRate: 24 }
      };

      mockCapManager.isConnected.mockReturnValue(true);
      const error = new Error('Command failed');
      error.code = 'INVALID_PARAMETER';
      mockCapManager.sendCommand.mockRejectedValue(error);

      await connectionHandler.handleCameraCommand(mockSocket, commandData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:command:error', expect.objectContaining({
        command: 'SET_FRAME_RATE',
        message: 'Command failed',
        code: 'INVALID_PARAMETER'
      }));
    });
  });

  describe('Camera Authentication', () => {
    it('should handle successful authentication', async () => {
      const authData = {
        password: 'test123'
      };

      mockCapManager.isConnected.mockReturnValue(true);
      mockCapManager.authenticate.mockResolvedValue();

      await connectionHandler.handleCameraAuth(mockSocket, authData);

      expect(mockCapManager.authenticate).toHaveBeenCalledWith('test123');
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:auth:success', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });

    it('should validate authentication parameters', async () => {
      const authData = {}; // Missing password

      await connectionHandler.handleCameraAuth(mockSocket, authData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:auth:error', expect.objectContaining({
        message: 'Password is required',
        code: 'MISSING_PASSWORD'
      }));

      expect(mockCapManager.authenticate).not.toHaveBeenCalled();
    });

    it('should check connection before authentication', async () => {
      const authData = {
        password: 'test123'
      };

      mockCapManager.isConnected.mockReturnValue(false);

      await connectionHandler.handleCameraAuth(mockSocket, authData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:auth:error', expect.objectContaining({
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED'
      }));

      expect(mockCapManager.authenticate).not.toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      const authData = {
        password: 'wrong123'
      };

      mockCapManager.isConnected.mockReturnValue(true);
      const error = new Error('Invalid password');
      error.code = 'WRONG_PASSWD';
      mockCapManager.authenticate.mockRejectedValue(error);

      await connectionHandler.handleCameraAuth(mockSocket, authData);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:auth:error', expect.objectContaining({
        message: 'Invalid password',
        code: 'WRONG_PASSWD'
      }));
    });
  });

  describe('Camera Health Check', () => {
    it('should perform health check successfully', async () => {
      const healthStatus = {
        status: 'healthy',
        responseTime: 150,
        timestamp: Date.now()
      };

      mockCapManager.isConnected.mockReturnValue(true);
      mockCapManager.performHealthCheck.mockResolvedValue(healthStatus);

      await connectionHandler.handleCameraHealthCheck(mockSocket);

      expect(mockCapManager.performHealthCheck).toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:health', expect.objectContaining({
        ...healthStatus,
        timestamp: expect.any(String)
      }));
    });

    it('should check connection before health check', async () => {
      mockCapManager.isConnected.mockReturnValue(false);

      await connectionHandler.handleCameraHealthCheck(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:health:error', expect.objectContaining({
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED'
      }));

      expect(mockCapManager.performHealthCheck).not.toHaveBeenCalled();
    });

    it('should handle health check errors', async () => {
      mockCapManager.isConnected.mockReturnValue(true);
      mockCapManager.performHealthCheck.mockRejectedValue(new Error('Health check failed'));

      await connectionHandler.handleCameraHealthCheck(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:health:error', expect.objectContaining({
        message: 'Health check failed',
        code: 'HEALTH_CHECK_FAILED'
      }));
    });
  });
});