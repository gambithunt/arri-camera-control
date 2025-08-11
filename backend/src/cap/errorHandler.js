/**
 * CAP Protocol Error Handler
 * Maps CAP protocol errors to user-friendly messages and provides error recovery strategies
 */

const { logger } = require('../utils/logger.js');
const { CAP_RESULT_CODES } = require('./types.js');

class CAPError extends Error {
  constructor(message, code, originalError = null, recoverable = false) {
    super(message);
    this.name = 'CAPError';
    this.code = code;
    this.originalError = originalError;
    this.recoverable = recoverable;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      timestamp: this.timestamp,
      originalError: this.originalError ? this.originalError.message : null
    };
  }
}

class CAPErrorHandler {
  constructor() {
    this.errorMappings = this.initializeErrorMappings();
    this.errorStats = new Map();
    this.errorHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Initialize error code to user-friendly message mappings
   * @returns {Map} Error mappings
   */
  initializeErrorMappings() {
    const mappings = new Map();

    // Success
    mappings.set(CAP_RESULT_CODES.OK, {
      message: 'Operation completed successfully',
      userMessage: 'Success',
      severity: 'info',
      recoverable: true,
      category: 'success'
    });

    // Command errors
    mappings.set(CAP_RESULT_CODES.NO_SUCH_COMMAND, {
      message: 'Command not recognized by camera',
      userMessage: 'Camera does not support this operation',
      severity: 'error',
      recoverable: false,
      category: 'command',
      suggestion: 'Check camera firmware version and supported features'
    });

    mappings.set(CAP_RESULT_CODES.NOT_ALLOWED, {
      message: 'Operation not allowed in current camera state',
      userMessage: 'Operation not available right now',
      severity: 'warning',
      recoverable: true,
      category: 'state',
      suggestion: 'Check camera mode and try again'
    });

    mappings.set(CAP_RESULT_CODES.NOT_IMPLEMENTED, {
      message: 'Feature not implemented in camera firmware',
      userMessage: 'Feature not available on this camera',
      severity: 'error',
      recoverable: false,
      category: 'feature',
      suggestion: 'Update camera firmware or use alternative method'
    });

    // Variable errors
    mappings.set(CAP_RESULT_CODES.NO_SUCH_VARIABLES, {
      message: 'Variable not found or not supported',
      userMessage: 'Camera setting not available',
      severity: 'error',
      recoverable: false,
      category: 'variable',
      suggestion: 'Check camera model compatibility'
    });

    mappings.set(CAP_RESULT_CODES.WRONG_TYPE, {
      message: 'Invalid data type for variable',
      userMessage: 'Invalid value format',
      severity: 'error',
      recoverable: true,
      category: 'data',
      suggestion: 'Check value format and try again'
    });

    // Authentication errors
    mappings.set(CAP_RESULT_CODES.WRONG_PASSWD, {
      message: 'Invalid camera password',
      userMessage: 'Incorrect camera password. Please check your credentials',
      severity: 'error',
      recoverable: true,
      category: 'authentication',
      suggestion: 'Check camera password and try again'
    });

    mappings.set(CAP_RESULT_CODES.NOT_AUTHORIZED, {
      message: 'Operation requires authentication',
      userMessage: 'Authentication required',
      severity: 'error',
      recoverable: true,
      category: 'authentication',
      suggestion: 'Please authenticate with camera password'
    });

    // Connection errors
    mappings.set(CAP_RESULT_CODES.TOO_MANY_CLIENTS, {
      message: 'Maximum number of clients connected to camera',
      userMessage: 'Too many devices are connected to the camera. Please disconnect other clients and try again',
      severity: 'error',
      recoverable: true,
      category: 'connection',
      suggestion: 'Disconnect other clients and try again'
    });

    mappings.set(CAP_RESULT_CODES.PROTOCOL_ERROR, {
      message: 'Protocol communication error',
      userMessage: 'Communication error with camera',
      severity: 'error',
      recoverable: true,
      category: 'protocol',
      suggestion: 'Check network connection and try again'
    });

    // System errors
    mappings.set(CAP_RESULT_CODES.SYSTEM_ERROR, {
      message: 'Camera system error',
      userMessage: 'Camera system error occurred',
      severity: 'error',
      recoverable: true,
      category: 'system',
      suggestion: 'Try again or restart camera if problem persists'
    });

    mappings.set(CAP_RESULT_CODES.TRY_AGAIN, {
      message: 'Operation failed, retry recommended',
      userMessage: 'Please try again',
      severity: 'warning',
      recoverable: true,
      category: 'retry',
      suggestion: 'Wait a moment and try the operation again'
    });

    // File errors
    mappings.set(CAP_RESULT_CODES.FILE_EXISTS, {
      message: 'File already exists',
      userMessage: 'File already exists',
      severity: 'warning',
      recoverable: true,
      category: 'file',
      suggestion: 'Choose a different name or overwrite existing file'
    });

    mappings.set(CAP_RESULT_CODES.MISSING_FILE, {
      message: 'Required file not found',
      userMessage: 'File not found',
      severity: 'error',
      recoverable: true,
      category: 'file',
      suggestion: 'Check file name and location'
    });

    mappings.set(CAP_RESULT_CODES.NO_SUCH_FILE, {
      message: 'File does not exist',
      userMessage: 'File not found',
      severity: 'error',
      recoverable: true,
      category: 'file',
      suggestion: 'Verify file exists on camera'
    });

    mappings.set(CAP_RESULT_CODES.TOO_MANY_FILES, {
      message: 'File limit exceeded',
      userMessage: 'Too many files',
      severity: 'error',
      recoverable: true,
      category: 'file',
      suggestion: 'Delete unused files and try again'
    });

    // Validation errors
    mappings.set(CAP_RESULT_CODES.INVALID_ARGUMENT, {
      message: 'Invalid parameter value',
      userMessage: 'Invalid value provided',
      severity: 'error',
      recoverable: true,
      category: 'validation',
      suggestion: 'Check parameter value and valid range'
    });

    mappings.set(CAP_RESULT_CODES.NOT_AVAILABLE, {
      message: 'Feature temporarily unavailable',
      userMessage: 'Feature temporarily unavailable',
      severity: 'warning',
      recoverable: true,
      category: 'availability',
      suggestion: 'Try again later or check camera status'
    });

    mappings.set(CAP_RESULT_CODES.TEMP_PROHIBITED, {
      message: 'Operation temporarily prohibited',
      userMessage: 'Operation not allowed right now',
      severity: 'warning',
      recoverable: true,
      category: 'state',
      suggestion: 'Wait for camera to be ready and try again'
    });

    // Monitor errors
    mappings.set(CAP_RESULT_CODES.NO_SUCH_MONITOR, {
      message: 'Monitor output not available',
      userMessage: 'Monitor output not found',
      severity: 'error',
      recoverable: false,
      category: 'monitor',
      suggestion: 'Check monitor configuration'
    });

    // Generic error
    mappings.set(CAP_RESULT_CODES.UNSPECIFIED_ERROR, {
      message: 'Unspecified camera error',
      userMessage: 'An unexpected error occurred. Please try again or restart the camera',
      severity: 'error',
      recoverable: true,
      category: 'unknown',
      suggestion: 'Try again or contact support if problem persists'
    });

    return mappings;
  }

  /**
   * Handle CAP protocol error
   * @param {number|Error} error - Error code or Error object
   * @param {string} context - Context where error occurred
   * @param {Object} metadata - Additional error metadata
   * @returns {Object} Processed error information
   */
  handleError(error, context = 'unknown', metadata = {}) {
    let errorCode;
    let originalError = null;

    // Determine error code
    if (typeof error === 'number') {
      errorCode = error;
    } else if (error instanceof Error) {
      originalError = error;
      errorCode = this.mapErrorMessageToCode(error.message);
    } else {
      errorCode = CAP_RESULT_CODES.UNSPECIFIED_ERROR;
    }

    // Get error mapping
    const errorMapping = this.errorMappings.get(errorCode) || this.errorMappings.get(CAP_RESULT_CODES.UNSPECIFIED_ERROR);

    // Create structured error information
    const errorInfo = {
      code: errorCode,
      context,
      message: errorMapping.message,
      userMessage: errorMapping.userMessage,
      severity: errorMapping.severity,
      category: errorMapping.category,
      suggestion: errorMapping.suggestion,
      recoverable: errorMapping.recoverable,
      timestamp: new Date().toISOString(),
      metadata,
      originalError
    };

    // Add recovery strategy
    const recovery = this.getRecoveryStrategy(errorMapping.category);
    if (recovery) {
      errorInfo.recovery = recovery;
    }

    // Log error
    this.logErrorInfo(errorInfo);

    // Update statistics
    this.updateErrorStatsFromInfo(errorInfo);

    // Add to history
    this.addToHistoryFromInfo(errorInfo);

    return errorInfo;
  }

  /**
   * Get recovery strategy for category
   * @param {string} category - Error category
   * @returns {Object} Recovery strategy
   */
  getRecoveryStrategy(category) {
    const strategies = {
      authentication: {
        autoRetry: false,
        userAction: 'Check password and try again',
        technicalAction: 'Verify credentials and authentication flow'
      },
      connection: {
        autoRetry: true,
        maxRetries: 3,
        retryDelay: 2000,
        userAction: 'Check network connection and camera availability',
        technicalAction: 'Verify network connectivity and camera IP address'
      },
      protocol: {
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 1000,
        userAction: 'Check connection stability',
        technicalAction: 'Verify protocol message format and network stability'
      },
      validation: {
        autoRetry: false,
        userAction: 'Check input values and try again',
        technicalAction: 'Validate input parameters against camera specifications'
      },
      state: {
        autoRetry: true,
        maxRetries: 1,
        retryDelay: 500,
        userAction: 'Wait for camera to be ready and try again',
        technicalAction: 'Check camera state before retrying operation'
      },
      retry: {
        autoRetry: true,
        maxRetries: 2,
        retryDelay: 500,
        userAction: 'Try the operation again',
        technicalAction: 'Retry with same parameters'
      }
    };

    return strategies[category] || null;
  }

  /**
   * Log error information
   * @param {Object} errorInfo - Error information
   */
  logErrorInfo(errorInfo) {
    const logData = {
      code: errorInfo.code,
      context: errorInfo.context,
      category: errorInfo.category,
      recoverable: errorInfo.recoverable,
      metadata: errorInfo.metadata
    };

    switch (errorInfo.severity) {
      case 'error':
        logger.error(`CAP Error: ${errorInfo.message}`, logData);
        break;
      case 'warning':
        logger.warn(`CAP Warning: ${errorInfo.message}`, logData);
        break;
      case 'info':
        logger.info(`CAP Info: ${errorInfo.message}`, logData);
        break;
      default:
        logger.error(`CAP Error: ${errorInfo.message}`, logData);
    }
  }

  /**
   * Update error statistics from error info
   * @param {Object} errorInfo - Error information
   */
  updateErrorStatsFromInfo(errorInfo) {
    const key = `${errorInfo.code}_${errorInfo.category}`;
    const current = this.errorStats.get(key) || { count: 0, lastOccurred: null };
    
    this.errorStats.set(key, {
      count: current.count + 1,
      lastOccurred: errorInfo.timestamp,
      code: errorInfo.code,
      category: errorInfo.category,
      message: errorInfo.message
    });
  }

  /**
   * Add error info to history
   * @param {Object} errorInfo - Error information
   */
  addToHistoryFromInfo(errorInfo) {
    this.errorHistory.unshift({
      timestamp: errorInfo.timestamp,
      code: errorInfo.code,
      message: errorInfo.message,
      context: errorInfo.context,
      category: errorInfo.category,
      recoverable: errorInfo.recoverable
    });

    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Map error message to CAP result code
   * @param {string} message - Error message
   * @returns {number} CAP result code
   */
  mapErrorMessageToCode(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('timeout')) {
      return CAP_RESULT_CODES.TRY_AGAIN;
    }
    if (lowerMessage.includes('connection') || lowerMessage.includes('network')) {
      return CAP_RESULT_CODES.PROTOCOL_ERROR;
    }
    if (lowerMessage.includes('password') || lowerMessage.includes('auth')) {
      return CAP_RESULT_CODES.WRONG_PASSWD;
    }
    if (lowerMessage.includes('not found') || lowerMessage.includes('missing')) {
      return CAP_RESULT_CODES.NO_SUCH_VARIABLES;
    }
    if (lowerMessage.includes('invalid') || lowerMessage.includes('wrong')) {
      return CAP_RESULT_CODES.INVALID_ARGUMENT;
    }
    if (lowerMessage.includes('not allowed') || lowerMessage.includes('prohibited')) {
      return CAP_RESULT_CODES.NOT_ALLOWED;
    }

    return CAP_RESULT_CODES.UNSPECIFIED_ERROR;
  }

  /**
   * Log error with appropriate level
   * @param {CAPError} error - CAP error to log
   */
  logError(error) {
    const logData = {
      code: error.code,
      context: error.context,
      category: error.category,
      recoverable: error.recoverable,
      metadata: error.metadata
    };

    switch (error.severity) {
      case 'error':
        logger.error(`CAP Error: ${error.message}`, logData);
        break;
      case 'warning':
        logger.warn(`CAP Warning: ${error.message}`, logData);
        break;
      case 'info':
        logger.info(`CAP Info: ${error.message}`, logData);
        break;
      default:
        logger.error(`CAP Error: ${error.message}`, logData);
    }
  }

  /**
   * Update error statistics
   * @param {CAPError} error - CAP error
   */
  updateErrorStats(error) {
    const key = `${error.code}_${error.category}`;
    const current = this.errorStats.get(key) || { count: 0, lastOccurred: null };
    
    this.errorStats.set(key, {
      count: current.count + 1,
      lastOccurred: error.timestamp,
      code: error.code,
      category: error.category,
      message: error.message
    });
  }

  /**
   * Add error to history
   * @param {CAPError} error - CAP error
   */
  addToHistory(error) {
    this.errorHistory.unshift({
      timestamp: error.timestamp,
      code: error.code,
      message: error.message,
      context: error.context,
      category: error.category,
      recoverable: error.recoverable
    });

    // Limit history size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get error statistics
   * @returns {Object} Error statistics
   */
  getErrorStats() {
    const stats = {
      totalErrorTypes: this.errorMappings.size,
      categories: Array.from(new Set(Array.from(this.errorMappings.values()).map(m => m.category))),
      retryableErrors: Array.from(this.errorMappings.entries())
        .filter(([code, mapping]) => this.isRetryable(code))
        .length,
      totalErrors: 0,
      errorsByCategory: {},
      errorsByCode: {},
      recentErrors: this.errorHistory.slice(0, 10)
    };

    this.errorStats.forEach((stat) => {
      stats.totalErrors += stat.count;
      
      if (!stats.errorsByCategory[stat.category]) {
        stats.errorsByCategory[stat.category] = 0;
      }
      stats.errorsByCategory[stat.category] += stat.count;
      
      if (!stats.errorsByCode[stat.code]) {
        stats.errorsByCode[stat.code] = 0;
      }
      stats.errorsByCode[stat.code] += stat.count;
    });

    return stats;
  }

  /**
   * Clear error statistics and history
   */
  clearStats() {
    this.errorStats.clear();
    this.errorHistory = [];
    logger.info('CAP error statistics cleared');
  }

  /**
   * Check if error is recoverable
   * @param {number} errorCode - CAP error code
   * @returns {boolean} Whether error is recoverable
   */
  isRecoverable(errorCode) {
    const mapping = this.errorMappings.get(errorCode);
    return mapping ? mapping.recoverable : false;
  }

  /**
   * Get user-friendly error message
   * @param {number} errorCode - CAP error code
   * @returns {string} User-friendly message
   */
  getUserMessage(errorCode) {
    const mapping = this.errorMappings.get(errorCode);
    return mapping ? mapping.userMessage : 'Unknown error occurred';
  }

  /**
   * Get error suggestion
   * @param {number} errorCode - CAP error code
   * @returns {string} Error suggestion
   */
  getSuggestion(errorCode) {
    const mapping = this.errorMappings.get(errorCode);
    return mapping ? mapping.suggestion : 'Please try again or contact support';
  }

  /**
   * Get error category
   * @param {number} errorCode - CAP error code
   * @returns {string} Error category
   */
  getCategory(errorCode) {
    const mapping = this.errorMappings.get(errorCode);
    return mapping ? mapping.category : 'unknown';
  }

  /**
   * Create recovery strategy for error
   * @param {CAPError} error - CAP error
   * @returns {Object} Recovery strategy
   */
  createRecoveryStrategy(error) {
    const strategy = {
      canRecover: error.recoverable,
      actions: [],
      retryable: false,
      retryDelay: 1000
    };

    switch (error.category) {
      case 'connection':
        strategy.actions = ['Check network connection', 'Verify camera IP address', 'Restart connection'];
        strategy.retryable = true;
        strategy.retryDelay = 2000;
        break;

      case 'protocol':
        strategy.actions = ['Check network connection', 'Verify camera IP address', 'Restart connection'];
        strategy.retryable = true;
        strategy.retryDelay = 2000;
        break;

      case 'auth':
        strategy.actions = ['Verify camera password', 'Check authentication settings'];
        strategy.retryable = true;
        break;

      case 'retry':
        strategy.actions = ['Wait and retry operation'];
        strategy.retryable = true;
        strategy.retryDelay = 1000;
        break;

      case 'state':
        strategy.actions = ['Check camera mode', 'Wait for camera to be ready'];
        strategy.retryable = true;
        strategy.retryDelay = 3000;
        break;

      case 'validation':
        strategy.actions = ['Check parameter values', 'Verify value ranges'];
        strategy.retryable = false;
        break;

      case 'file':
        strategy.actions = ['Check file existence', 'Verify file permissions'];
        strategy.retryable = true;
        break;

      default:
        strategy.actions = ['Try operation again', 'Check camera status'];
        strategy.retryable = error.recoverable;
    }

    return strategy;
  }

  // Additional methods expected by tests

  /**
   * Get error category information (alias for getCategory with more details)
   * @param {number} errorCode - CAP error code
   * @returns {Object} Category information
   */
  getErrorCategory(errorCode) {
    const mapping = this.errorMappings.get(errorCode);
    if (!mapping) {
      return { icon: '❓', color: 'red', actionable: false };
    }

    // Map categories to UI information
    const categoryInfo = {
      success: { icon: '✅', color: 'green', actionable: false },
      authentication: { icon: '🔐', color: 'red', actionable: true },
      connection: { icon: '🔌', color: 'red', actionable: true },
      protocol: { icon: '📡', color: 'orange', actionable: true },
      validation: { icon: '⚠️', color: 'orange', actionable: true },
      state: { icon: '🔄', color: 'yellow', actionable: true },
      system: { icon: '⚙️', color: 'red', actionable: false },
      unknown: { icon: '❓', color: 'red', actionable: false }
    };

    return categoryInfo[mapping.category] || categoryInfo.unknown;
  }

  /**
   * Check if error is retryable
   * @param {number} errorCode - CAP error code
   * @returns {boolean} Whether error is retryable
   */
  isRetryable(errorCode) {
    const mapping = this.errorMappings.get(errorCode);
    if (!mapping) return false;

    // Retryable categories (system errors are recoverable but not automatically retryable)
    const retryableCategories = ['retry', 'state', 'connection', 'protocol'];
    return mapping.recoverable && retryableCategories.includes(mapping.category);
  }

  /**
   * Get retry configuration for error
   * @param {number} errorCode - CAP error code
   * @returns {Object|null} Retry configuration or null if not retryable
   */
  getRetryConfig(errorCode) {
    if (!this.isRetryable(errorCode)) return null;

    const mapping = this.errorMappings.get(errorCode);
    const retryConfigs = {
      retry: { maxRetries: 2, retryDelay: 500 },
      state: { maxRetries: 3, retryDelay: 1000 },
      connection: { maxRetries: 3, retryDelay: 2000 },
      protocol: { maxRetries: 2, retryDelay: 1000 },
      system: { maxRetries: 1, retryDelay: 2000 }
    };

    return retryConfigs[mapping.category] || { maxRetries: 1, retryDelay: 1000 };
  }

  /**
   * Handle connection errors specifically
   * @param {Error} error - Connection error
   * @param {string} context - Error context
   * @returns {Object} Structured error information
   */
  handleConnectionError(error, context = 'Connection') {
    let category = 'connection';
    let userMessage = 'Connection error occurred';

    // Categorize connection errors
    if (error.message.includes('timeout')) {
      userMessage = 'Connection timeout. Please check network and camera availability';
    } else if (error.message.includes('refused') || error.message.includes('ECONNREFUSED')) {
      userMessage = 'Cannot connect to camera. Please check IP address and network connection';
    } else if (error.message.includes('EHOSTUNREACH')) {
      userMessage = 'Camera is not reachable. Please check network configuration';
    } else if (error.message.includes('ENOTFOUND')) {
      userMessage = 'Camera not found. Please check IP address';
    }

    return {
      code: 'CONNECTION_ERROR',
      context,
      message: error.message,
      userMessage,
      severity: 'error',
      category,
      timestamp: new Date().toISOString(),
      originalError: error
    };
  }

  /**
   * Create error from CAP response
   * @param {Object} response - CAP response message
   * @param {string} context - Error context
   * @returns {Error} Enhanced error object
   */
  createErrorFromResponse(response, context = 'CAP Operation') {
    const capError = this.handleError(response.cmdCode, context, {
      messageId: response.msgId,
      responseData: response.data
    });

    const error = new Error(capError.userMessage);
    error.capError = capError;
    error.code = response.cmdCode;
    error.context = context;
    return error;
  }

  /**
   * Get user-friendly error message with context
   * @param {number} errorCode - CAP error code
   * @param {string} context - Error context
   * @returns {string} User-friendly error message
   */
  getUserMessage(errorCode, context = '') {
    const mapping = this.errorMappings.get(errorCode);
    let message = mapping ? mapping.userMessage : 'Unknown error occurred';
    
    if (context) {
      message = `${context}: ${message}`;
    }
    
    return message;
  }
}

// Create singleton instance
const errorHandler = new CAPErrorHandler();

module.exports = { CAPError, CAPErrorHandler, errorHandler };