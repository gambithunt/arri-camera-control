/**
 * Unit tests for CAP error handler
 */
const { CAPErrorHandler } = require('../errorHandler.js');
const { CAP_RESULT_CODES } = require('../types.js');

describe('CAPErrorHandler', () => {
  let errorHandler;

  beforeEach(() => {
    errorHandler = new CAPErrorHandler();
  });

  describe('Error Message Mapping', () => {
    it('should return correct error info for known error codes', () => {
      const errorInfo = errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'Authentication');
      
      expect(errorInfo.code).toBe(CAP_RESULT_CODES.WRONG_PASSWD);
      expect(errorInfo.context).toBe('Authentication');
      expect(errorInfo.severity).toBe('error');
      expect(errorInfo.category).toBe('authentication');
      expect(errorInfo.userMessage).toContain('password');
    });

    it('should handle unknown error codes', () => {
      const errorInfo = errorHandler.handleError(0x9999, 'Test');
      
      expect(errorInfo.code).toBe(0x9999);
      expect(errorInfo.category).toBe('unknown');
      expect(errorInfo.userMessage).toContain('unexpected error');
    });

    it('should include timestamp and context', () => {
      const errorInfo = errorHandler.handleError(CAP_RESULT_CODES.NOT_ALLOWED, 'Test Context');
      
      expect(errorInfo.timestamp).toBeDefined();
      expect(errorInfo.context).toBe('Test Context');
      expect(new Date(errorInfo.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe('Error Categories', () => {
    it('should categorize authentication errors correctly', () => {
      const category = errorHandler.getErrorCategory(CAP_RESULT_CODES.WRONG_PASSWD);
      
      expect(category.icon).toBe('🔐');
      expect(category.color).toBe('red');
      expect(category.actionable).toBe(true);
    });

    it('should categorize connection errors correctly', () => {
      const category = errorHandler.getErrorCategory(CAP_RESULT_CODES.TOO_MANY_CLIENTS);
      
      expect(category.icon).toBe('🔌');
      expect(category.color).toBe('red');
      expect(category.actionable).toBe(true);
    });

    it('should categorize system errors correctly', () => {
      const category = errorHandler.getErrorCategory(CAP_RESULT_CODES.SYSTEM_ERROR);
      
      expect(category.icon).toBe('⚙️');
      expect(category.color).toBe('red');
      expect(category.actionable).toBe(false);
    });
  });

  describe('Retry Logic', () => {
    it('should identify retryable errors', () => {
      expect(errorHandler.isRetryable(CAP_RESULT_CODES.TRY_AGAIN)).toBe(true);
      expect(errorHandler.isRetryable(CAP_RESULT_CODES.TEMP_PROHIBITED)).toBe(true);
      expect(errorHandler.isRetryable(CAP_RESULT_CODES.SYSTEM_ERROR)).toBe(false);
    });

    it('should provide retry configuration for retryable errors', () => {
      const retryConfig = errorHandler.getRetryConfig(CAP_RESULT_CODES.TRY_AGAIN);
      
      expect(retryConfig).not.toBeNull();
      expect(retryConfig.maxRetries).toBeDefined();
      expect(retryConfig.retryDelay).toBeDefined();
    });

    it('should return null retry config for non-retryable errors', () => {
      const retryConfig = errorHandler.getRetryConfig(CAP_RESULT_CODES.WRONG_PASSWD);
      
      expect(retryConfig).toBeNull();
    });

    it('should not retry authentication errors', () => {
      expect(errorHandler.isRetryable(CAP_RESULT_CODES.WRONG_PASSWD)).toBe(false);
      expect(errorHandler.isRetryable(CAP_RESULT_CODES.NOT_AUTHORIZED)).toBe(false);
    });
  });

  describe('User-Friendly Messages', () => {
    it('should provide user-friendly messages', () => {
      const message = errorHandler.getUserMessage(CAP_RESULT_CODES.TOO_MANY_CLIENTS);
      
      expect(message).not.toContain('CAP_RESULT_CODES');
      expect(message).toContain('devices');
      expect(message).toContain('connected');
    });

    it('should include context in user messages', () => {
      const message = errorHandler.getUserMessage(
        CAP_RESULT_CODES.NOT_ALLOWED,
        'Camera Control'
      );
      
      expect(message).toContain('Camera Control:');
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle connection timeout errors', () => {
      const error = new Error('Connection timeout');
      const errorInfo = errorHandler.handleConnectionError(error, 'Connection Test');
      
      expect(errorInfo.category).toBe('connection');
      expect(errorInfo.userMessage).toContain('timeout');
      expect(errorInfo.context).toBe('Connection Test');
    });

    it('should handle connection refused errors', () => {
      const error = new Error('ECONNREFUSED');
      const errorInfo = errorHandler.handleConnectionError(error, 'Connection Test');
      
      expect(errorInfo.category).toBe('connection');
      expect(errorInfo.userMessage).toContain('Cannot connect');
    });

    it('should handle host unreachable errors', () => {
      const error = new Error('EHOSTUNREACH');
      const errorInfo = errorHandler.handleConnectionError(error, 'Connection Test');
      
      expect(errorInfo.category).toBe('connection');
      expect(errorInfo.userMessage).toContain('not reachable');
    });

    it('should handle DNS resolution errors', () => {
      const error = new Error('ENOTFOUND');
      const errorInfo = errorHandler.handleConnectionError(error, 'Connection Test');
      
      expect(errorInfo.category).toBe('connection');
      expect(errorInfo.userMessage).toContain('not found');
    });
  });

  describe('Error Creation from CAP Response', () => {
    it('should create enhanced error from CAP response', () => {
      const response = {
        msgId: 123,
        cmdCode: CAP_RESULT_CODES.WRONG_PASSWD,
        data: null
      };

      const error = errorHandler.createErrorFromResponse(response, 'Authentication Test');
      
      expect(error).toBeInstanceOf(Error);
      expect(error.capError).toBeDefined();
      expect(error.code).toBe(CAP_RESULT_CODES.WRONG_PASSWD);
      expect(error.context).toBe('Authentication Test');
      expect(error.message).toContain('password');
    });
  });

  describe('Error Statistics', () => {
    it('should provide error statistics', () => {
      const stats = errorHandler.getErrorStats();
      
      expect(stats.totalErrorTypes).toBeGreaterThan(0);
      expect(Array.isArray(stats.categories)).toBe(true);
      expect(typeof stats.retryableErrors).toBe('number');
    });
  });

  describe('Recovery Strategies', () => {
    it('should provide recovery strategies for actionable errors', () => {
      const errorInfo = errorHandler.handleError(CAP_RESULT_CODES.WRONG_PASSWD, 'Auth');
      
      expect(errorInfo.recovery).toBeDefined();
      expect(errorInfo.recovery.userAction).toBeDefined();
      expect(errorInfo.recovery.technicalAction).toBeDefined();
      expect(errorInfo.recovery.autoRetry).toBe(false);
    });

    it('should provide retry strategies for retryable errors', () => {
      const errorInfo = errorHandler.handleError(CAP_RESULT_CODES.TRY_AGAIN, 'Operation');
      
      expect(errorInfo.recovery).toBeDefined();
      expect(errorInfo.recovery.autoRetry).toBe(true);
      expect(errorInfo.recovery.maxRetries).toBeDefined();
      expect(errorInfo.recovery.retryDelay).toBeDefined();
    });
  });

  describe('Error Severity Levels', () => {
    it('should assign correct severity levels', () => {
      const errorError = errorHandler.handleError(CAP_RESULT_CODES.SYSTEM_ERROR, 'Test');
      expect(errorError.severity).toBe('error');

      const warningError = errorHandler.handleError(CAP_RESULT_CODES.NOT_ALLOWED, 'Test');
      expect(warningError.severity).toBe('warning');

      const infoError = errorHandler.handleError(CAP_RESULT_CODES.OK, 'Test');
      expect(infoError.severity).toBe('info');
    });
  });
});