/**
 * CAP Protocol Logger
 * Provides detailed logging for CAP protocol communications with debugging capabilities
 */
const { logger } = require('../utils/logger.js');
const { CAP_COMMANDS, CAP_VARIABLES, CAP_MESSAGE_TYPES } = require('./types.js');

class CAPProtocolLogger {
  constructor(options = {}) {
    this.enabled = options.enabled !== false;
    this.logLevel = options.logLevel || 'debug';
    this.logRawData = options.logRawData || false;
    this.maxDataLength = options.maxDataLength || 256;
    this.sessionId = this.generateSessionId();
    this.messageCounter = 0;
    this.commandNames = this.initializeCommandNames();
    this.variableNames = this.initializeVariableNames();
  }

  /**
   * Generate unique session ID for this logging session
   * @returns {string} Session ID
   */
  generateSessionId() {
    return `cap_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
  }

  /**
   * Initialize command name mappings for readable logging
   * @returns {Map<number, string>} Command code to name mapping
   */
  initializeCommandNames() {
    const names = new Map();
    // Reverse lookup from CAP_COMMANDS
    Object.entries(CAP_COMMANDS).forEach(([name, code]) => {
      names.set(code, name);
    });
    return names;
  }

  /**
   * Initialize variable name mappings for readable logging
   * @returns {Map<number, string>} Variable ID to name mapping
   */
  initializeVariableNames() {
    const names = new Map();
    // Reverse lookup from CAP_VARIABLES
    Object.entries(CAP_VARIABLES).forEach(([name, id]) => {
      names.set(id, name);
    });
    return names;
  }

  /**
   * Log outgoing CAP message
   * @param {CAPMessage} message - Message being sent
   * @param {string} destination - Destination (IP:port)
   */
  logOutgoingMessage(message, destination = 'camera') {
    if (!this.enabled) return;

    this.messageCounter++;
    const logData = {
      sessionId: this.sessionId,
      messageNumber: this.messageCounter,
      direction: 'OUTGOING',
      destination,
      msgType: this.getMessageTypeName(message.msgType),
      msgId: message.msgId,
      cmdCode: `0x${message.cmdCode.toString(16).padStart(4, '0')}`,
      cmdName: this.getCommandName(message.cmdCode),
      dataSize: message.data ? (Buffer.isBuffer(message.data) ? message.data.length : JSON.stringify(message.data).length) : 0,
      timestamp: new Date().toISOString()
    };

    if (this.logRawData && message.data) {
      logData.rawData = this.formatRawData(message.data);
    }

    logger[this.logLevel]('CAP Protocol - Outgoing Message', logData);
  }

  /**
   * Log incoming CAP message
   * @param {CAPMessage} message - Message received
   * @param {string} source - Source (IP:port)
   */
  logIncomingMessage(message, source = 'camera') {
    if (!this.enabled) return;

    this.messageCounter++;
    const logData = {
      sessionId: this.sessionId,
      messageNumber: this.messageCounter,
      direction: 'INCOMING',
      source,
      msgType: this.getMessageTypeName(message.msgType),
      msgId: message.msgId,
      cmdCode: `0x${message.cmdCode.toString(16).padStart(4, '0')}`,
      cmdName: this.getCommandName(message.cmdCode) || this.getVariableName(message.cmdCode),
      dataSize: message.data ? (Buffer.isBuffer(message.data) ? message.data.length : JSON.stringify(message.data).length) : 0,
      timestamp: new Date().toISOString()
    };

    if (this.logRawData && message.data) {
      logData.rawData = this.formatRawData(message.data);
    }

    logger[this.logLevel]('CAP Protocol - Incoming Message', logData);
  }

  /**
   * Log connection events
   * @param {string} event - Event type (connect, disconnect, error)
   * @param {Object} details - Event details
   */
  logConnectionEvent(event, details = {}) {
    if (!this.enabled) return;

    const logData = {
      sessionId: this.sessionId,
      event: event.toUpperCase(),
      timestamp: new Date().toISOString(),
      ...details
    };

    switch (event) {
      case 'connect':
        logger.info('CAP Protocol - Connection Established', logData);
        break;
      case 'disconnect':
        logger.info('CAP Protocol - Connection Closed', logData);
        break;
      case 'error':
        logger.error('CAP Protocol - Connection Error', logData);
        break;
      case 'timeout':
        logger.warn('CAP Protocol - Connection Timeout', logData);
        break;
      default:
        logger.debug(`CAP Protocol - ${event}`, logData);
        break;
    }
  }

  /**
   * Log authentication flow
   * @param {string} step - Authentication step
   * @param {boolean} success - Whether step was successful
   * @param {Object} details - Additional details
   */
  logAuthenticationStep(step, success, details = {}) {
    if (!this.enabled) return;

    const logData = {
      sessionId: this.sessionId,
      authStep: step,
      success,
      timestamp: new Date().toISOString(),
      ...details
    };

    if (success) {
      logger.info(`CAP Protocol - Authentication: ${step} successful`, logData);
    } else {
      logger.warn(`CAP Protocol - Authentication: ${step} failed`, logData);
    }
  }

  /**
   * Log variable subscription events
   * @param {string} action - Action (subscribe, unsubscribe, update)
   * @param {number[]} variableIds - Variable IDs
   * @param {Object} details - Additional details
   */
  logVariableSubscription(action, variableIds, details = {}) {
    if (!this.enabled) return;

    const variableNames = variableIds.map(id => {
      const name = this.getVariableName(id);
      // If we have a known name, use it, otherwise just use hex format
      return name && !name.startsWith('UNKNOWN_VAR') ? name : `0x${id.toString(16)}`;
    });
    const logData = {
      sessionId: this.sessionId,
      action: action.toUpperCase(),
      variableCount: variableIds.length,
      variables: variableNames,
      timestamp: new Date().toISOString(),
      ...details
    };

    logger.info(`CAP Protocol - Variable ${action}`, logData);
  }

  /**
   * Log variable value changes
   * @param {number} variableId - Variable ID
   * @param {*} oldValue - Previous value
   * @param {*} newValue - New value
   */
  logVariableChange(variableId, oldValue, newValue) {
    if (!this.enabled) return;

    const logData = {
      sessionId: this.sessionId,
      variableId: `0x${variableId.toString(16).padStart(4, '0')}`,
      variableName: this.getVariableName(variableId),
      oldValue: this.formatValue(oldValue),
      newValue: this.formatValue(newValue),
      timestamp: new Date().toISOString()
    };

    logger.debug('CAP Protocol - Variable Change', logData);
  }

  /**
   * Log protocol errors with context
   * @param {Error} error - Error object
   * @param {string} context - Error context
   * @param {Object} additionalInfo - Additional error information
   */
  logProtocolError(error, context, additionalInfo = {}) {
    if (!this.enabled) return;

    const logData = {
      sessionId: this.sessionId,
      context,
      errorMessage: error.message,
      errorCode: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      ...additionalInfo
    };

    logger.error('CAP Protocol - Error', logData);
  }

  /**
   * Log performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {Object} metrics - Additional metrics
   */
  logPerformanceMetrics(operation, duration, metrics = {}) {
    if (!this.enabled) return;

    const logData = {
      sessionId: this.sessionId,
      operation,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      ...metrics
    };

    if (duration > 1000) {
      logger.warn('CAP Protocol - Slow Operation', logData);
    } else {
      logger.debug('CAP Protocol - Performance', logData);
    }
  }

  /**
   * Get message type name
   * @param {number} msgType - Message type code
   * @returns {string} Message type name
   */
  getMessageTypeName(msgType) {
    switch (msgType) {
      case CAP_MESSAGE_TYPES.COMMAND: return 'COMMAND';
      case CAP_MESSAGE_TYPES.REPLY: return 'REPLY';
      case CAP_MESSAGE_TYPES.EVENT: return 'EVENT';
      default: return `UNKNOWN(${msgType})`;
    }
  }

  /**
   * Get command name from code
   * @param {number} cmdCode - Command code
   * @returns {string} Command name
   */
  getCommandName(cmdCode) {
    return this.commandNames.get(cmdCode) || `UNKNOWN_CMD(0x${cmdCode.toString(16)})`;
  }

  /**
   * Get variable name from ID
   * @param {number} variableId - Variable ID
   * @returns {string} Variable name
   */
  getVariableName(variableId) {
    return this.variableNames.get(variableId) || `UNKNOWN_VAR(0x${variableId.toString(16)})`;
  }

  /**
   * Format raw data for logging
   * @param {*} data - Raw data
   * @returns {string} Formatted data
   */
  formatRawData(data) {
    if (!data) return 'null';

    if (Buffer.isBuffer(data)) {
      const truncated = data.length > this.maxDataLength ? data.slice(0, this.maxDataLength) : data;
      const hex = truncated.toString('hex').match(/.{2}/g).join(' ');
      const suffix = data.length > this.maxDataLength ? ` ... (${data.length - this.maxDataLength} more bytes)` : '';
      return `${hex}${suffix}`;
    }

    const str = JSON.stringify(data);
    if (str.length > this.maxDataLength) {
      return str.substring(0, this.maxDataLength) + '...';
    }
    return str;
  }

  /**
   * Format value for logging
   * @param {*} value - Value to format
   * @returns {string} Formatted value
   */
  formatValue(value) {
    if (value === null || value === undefined) return 'null';
    if (Buffer.isBuffer(value)) return `Buffer(${value.length} bytes)`;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Enable/disable logging
   * @param {boolean} enabled - Whether to enable logging
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    logger.info(`CAP Protocol logging ${enabled ? 'enabled' : 'disabled'}`, {
      sessionId: this.sessionId
    });
  }

  /**
   * Set log level
   * @param {string} level - Log level (debug, info, warn, error)
   */
  setLogLevel(level) {
    this.logLevel = level;
    logger.info(`CAP Protocol log level set to ${level}`, {
      sessionId: this.sessionId
    });
  }

  /**
   * Get logging statistics
   * @returns {Object} Logging statistics
   */
  getStats() {
    return {
      sessionId: this.sessionId,
      messageCount: this.messageCounter,
      enabled: this.enabled,
      logLevel: this.logLevel,
      logRawData: this.logRawData
    };
  }

  /**
   * Create a child logger for specific component
   * @param {string} component - Component name
   * @returns {Object} Child logger
   */
  createChildLogger(component) {
    return {
      logOutgoing: (message, destination) => {
        this.logOutgoingMessage(message, `${component}->${destination}`);
      },
      logIncoming: (message, source) => {
        this.logIncomingMessage(message, `${source}->${component}`);
      },
      logError: (error, context, info) => {
        this.logProtocolError(error, `${component}: ${context}`, info);
      },
      logPerformance: (operation, duration, metrics) => {
        this.logPerformanceMetrics(`${component}: ${operation}`, duration, metrics);
      }
    };
  }
}

module.exports = { CAPProtocolLogger };