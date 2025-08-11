/**
 * Integration tests for CAP error scenarios and recovery
 */

const { CAPProtocolHandler } = require('../protocol.js');
const { CAPConnectionManager } = require('../connectionManager.js');
const { errorHandler } = require('../errorHandler.js');
const { MockCAPServer } = require('./mockCAPServer.helper.js');
const { CAP_RESULT_CODES, CAP_COMMANDS } = require('../types.js');

describe('CAP Error Scenarios and Recovery', () => {
  let mockServer;
  let connectionManager;
  let protocolHandler;
  const TEST_PORT = 7779;

  beforeAll(async () => {
    // Start mock server
    mockServer = new MockCAPServer(TEST_PORT);
    await mockServer.start();
  });

  afterAll(async () => {
    // Stop mock server
    if (mockServer) {
      await mockServer.stop();
    }
  });

  beforeEach(() => {
    connectionManager = new CAPConnectionManager();
    protocolHandler = new CAPProtocolHandler();
    
    // Clear error handler stats
    errorHandler.clearStats();
  });

  afterEach(async () => {
    if (connectionManager && connectionManager.isConnected()) {
      connectionManager.disconnect();
    }
    
    if (protocolHandler && protocolHandler.isConnected()) {
      protocolHandler.disconnect();
    }
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Connection Error Scenarios', () => {
    it('should handle connection timeout gracefully', async () => {
      const config = {
        host: '192.168.1.999', // Non-existent IP
        port: TEST_PORT,
        clientName: 'TestClient'
      };

      await expect(connectionManager.connect(config)).rejects.toThrow();
      
      const status = connectionManager.getStatus();
      expect(status.state).toBe('disconnected');
      expect(status.lastError).toBeDefined();
    });

    it('should handle connection refused error', async () => {
      const config = {
        host: 'localhost',
        port: 9999, // Non-existent port
        clientName: 'TestClient'
      };

      await expect(connectionManager.connect(config)).rejects.toThrow();
      
      const metrics = connectionManager.getMetrics();
      expect(metrics.totalErrors).toBeGreaterThan(0);
    });

    it('should attempt reconnection on connection loss', (done) => {
      const config = {
        host: 'localhost',
        port: TEST_PORT,
        clientName: 'TestClient'
      };

      connectionManager.configure({ maxReconnectAttempts: 2, reconnectDelay: 100 });

      connectionManager.on('reconnecting', (event) => {
        expect(event.attempt).toBeGreaterThan(0);
        expect(event.maxAttempts).toBe(2);
        done();
      });

      // Simulate connection and then disconnection
      connectionManager.connect(config).then(() => {
        // Simulate connection loss
        connectionManager.onDisconnection();
      }).catch(() => {
        // Connection might fail, but we still want to test reconnection logic
      });
    });

    it('should stop reconnection after max attempts', (done) => {
      connectionManager.configure({ maxReconnectAttempts: 1, reconnectDelay: 50 });

      connectionManager.on('connectionFailed', (error) => {
        expect(error).toBeDefined();
        expect(connectionManager.reconnectAttempts).toBe(1);
        done();
      });

      // Simulate repeated connection failures
      const error = new Error('Connection failed');
      connectionManager.onConnectionFailure(error);
    });
  });

  describe('Protocol Error Scenarios', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should handle invalid command errors', async () => {
      // Mock server should return NOT_IMPLEMENTED for unknown commands
      try {
        await protocolHandler.connection.sendCommand(0x9999); // Invalid command
      } catch (error) {
        const capError = errorHandler.handleError(error, 'invalid_command');
        expect(capError.category).toBeDefined();
        expect(capError.recoverable).toBeDefined();
      }
    });

    it('should handle variable not found errors', async () => {
      try {
        await protocolHandler.getVariable(0x9999); // Invalid variable
      } catch (error) {
        const capError = errorHandler.handleError(error, 'invalid_variable');
        expect(capError.code).toBeDefined();
        expect(capError.userMessage).toBeDefined();
      }
    });

    it('should handle authentication errors', async () => {
      // Test with wrong password scenario
      try {
        await protocolHandler.authenticate('wrong_password');
      } catch (error) {
        const capError = errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'auth');
        expect(capError.category).toBe('auth');
        expect(capError.recoverable).toBe(true);
        expect(capError.suggestion).toContain('password');
      }
    });

    it('should handle system errors with retry strategy', async () => {
      const systemError = errorHandler.handleError(CAP_RESULT_CODES.SYSTEM_ERROR, 'system');
      const strategy = errorHandler.createRecoveryStrategy(systemError);
      
      expect(strategy.canRecover).toBe(true);
      expect(strategy.retryable).toBe(true);
      expect(strategy.actions).toContain('Try again or restart camera if problem persists');
    });
  });

  describe('Error Recovery Mechanisms', () => {
    beforeEach(async () => {
      await connectionManager.connect({
        host: 'localhost',
        port: TEST_PORT,
        clientName: 'TestClient'
      });
    });

    it('should recover from protocol errors', async () => {
      const recoveredSpy = jest.fn();
      connectionManager.on('recovered', recoveredSpy);

      const protocolError = { recoverable: true, category: 'protocol' };
      await connectionManager.attemptRecovery(protocolError);

      expect(recoveredSpy).toHaveBeenCalled();
    });

    it('should perform health checks and detect issues', (done) => {
      connectionManager.configure({ healthCheckTimeout: 100 });

      connectionManager.on('healthCheck', (status) => {
        expect(status.responseTime).toBeDefined();
        expect(status.status).toBe('healthy');
        done();
      });

      connectionManager.startHealthCheck();
    });

    it('should clear pending messages during recovery', async () => {
      // Add some pending messages
      if (connectionManager.connection) {
        connectionManager.connection.pendingMessages.set(1, { resolve: jest.fn(), reject: jest.fn() });
        connectionManager.connection.pendingMessages.set(2, { resolve: jest.fn(), reject: jest.fn() });
      }

      await connectionManager.recoverFromTimeout();

      expect(connectionManager.connection.pendingMessages.size).toBe(0);
    });
  });

  describe('Error Statistics and Monitoring', () => {
    it('should track error statistics over time', () => {
      // Generate various errors
      errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'auth1');
      errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'auth2');
      errorHandler.handleError(CAP_RESULT_CODES.NOT_ALLOWED, 'state1');
      errorHandler.handleError(CAP_RESULT_CODES.SYSTEM_ERROR, 'system1');

      const stats = errorHandler.getErrorStats();

      expect(stats.totalErrors).toBe(4);
      expect(stats.errorsByCategory.auth).toBe(2);
      expect(stats.errorsByCategory.state).toBe(1);
      expect(stats.errorsByCategory.system).toBe(1);
      expect(stats.recentErrors.length).toBe(4);
    });

    it('should maintain error history with timestamps', () => {
      const error1 = errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'test1');
      const error2 = errorHandler.handleError(CAP_RESULT_CODES.NOT_ALLOWED, 'test2');

      expect(errorHandler.errorHistory.length).toBe(2);
      expect(errorHandler.errorHistory[0].context).toBe('test2'); // Most recent first
      expect(errorHandler.errorHistory[0].timestamp).toBeDefined();
      expect(errorHandler.errorHistory[1].context).toBe('test1');
    });

    it('should provide error categorization and suggestions', () => {
      const authError = errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'auth');
      const connectionError = errorHandler.handleError(CAP_RESULT_CODES.PROTOCOL_ERROR, 'connection');
      const validationError = errorHandler.handleError(CAP_RESULT_CODES.INVALID_ARGUMENT, 'validation');

      expect(authError.category).toBe('auth');
      expect(authError.suggestion).toContain('password');

      expect(connectionError.category).toBe('protocol');
      expect(connectionError.suggestion).toContain('network');

      expect(validationError.category).toBe('validation');
      expect(validationError.suggestion).toContain('parameter');
    });
  });

  describe('User-Friendly Error Messages', () => {
    it('should provide user-friendly messages for technical errors', () => {
      const errors = [
        { code: CAP_RESULT_CODES.PROTOCOL_ERROR, expected: 'Communication error with camera' },
        { code: CAP_RESULT_CODES.TOO_MANY_CLIENTS, expected: 'Camera connection limit reached' },
        { code: CAP_RESULT_CODES.SYSTEM_ERROR, expected: 'Camera system error occurred' },
        { code: CAP_RESULT_CODES.NOT_IMPLEMENTED, expected: 'Feature not available on this camera' }
      ];

      errors.forEach(({ code, expected }) => {
        const userMessage = errorHandler.getUserMessage(code);
        expect(userMessage).toBe(expected);
      });
    });

    it('should provide actionable suggestions for common errors', () => {
      const suggestions = [
        { code: CAP_RESULT_CODES.WRONG_PASSWD, shouldContain: 'password' },
        { code: CAP_RESULT_CODES.NOT_ALLOWED, shouldContain: 'camera mode' },
        { code: CAP_RESULT_CODES.INVALID_ARGUMENT, shouldContain: 'value format' },
        { code: CAP_RESULT_CODES.TOO_MANY_CLIENTS, shouldContain: 'Disconnect other clients' }
      ];

      suggestions.forEach(({ code, shouldContain }) => {
        const suggestion = errorHandler.getSuggestion(code);
        expect(suggestion.toLowerCase()).toContain(shouldContain.toLowerCase());
      });
    });
  });

  describe('Error Context and Metadata', () => {
    it('should preserve error context and metadata', () => {
      const metadata = {
        userId: 'test_user',
        operation: 'set_frame_rate',
        value: 25.0
      };

      const error = errorHandler.handleError(
        CAP_RESULT_CODES.INVALID_ARGUMENT,
        'parameter_validation',
        metadata
      );

      expect(error.context).toBe('parameter_validation');
      expect(error.metadata).toEqual(metadata);
    });

    it('should serialize errors to JSON with all information', () => {
      const originalError = new Error('Original error message');
      const capError = errorHandler.handleError(originalError, 'test_context', { key: 'value' });

      const json = capError.toJSON();

      expect(json.name).toBe('CAPError');
      expect(json.code).toBeDefined();
      expect(json.timestamp).toBeDefined();
      expect(json.originalError).toBe('Original error message');
    });
  });
});