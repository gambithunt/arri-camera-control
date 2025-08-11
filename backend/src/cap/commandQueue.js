/**
 * CAP Command Queue System
 * Provides reliable command delivery with retry logic and prioritization
 */

const EventEmitter = require('events');
const { logger } = require('../utils/logger.js');

class CommandQueue extends EventEmitter {
  constructor(protocolHandler) {
    super();
    this.protocolHandler = protocolHandler;
    this.queue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second
    this.maxQueueSize = 100;
  }

  /**
   * Add command to queue
   * @param {Object} command - Command object
   * @param {number} command.cmdCode - Command code
   * @param {*} command.data - Command data
   * @param {number} command.priority - Command priority (lower = higher priority)
   * @param {number} command.retries - Number of retries attempted
   * @returns {Promise<*>} Command result
   */
  async enqueue(command) {
    return new Promise((resolve, reject) => {
      // Check queue size
      if (this.queue.length >= this.maxQueueSize) {
        reject(new Error('Command queue is full'));
        return;
      }

      // Create command entry
      const commandEntry = {
        id: this.generateCommandId(),
        cmdCode: command.cmdCode,
        data: command.data || null,
        priority: command.priority || 5,
        retries: 0,
        maxRetries: command.maxRetries || this.maxRetries,
        timestamp: Date.now(),
        resolve,
        reject
      };

      // Insert command based on priority
      this.insertByPriority(commandEntry);

      logger.debug(`Command queued: ${commandEntry.id} (${commandEntry.cmdCode.toString(16)})`);

      // Start processing if not already running
      this.processQueue();
    });
  }

  /**
   * Insert command into queue based on priority
   * @param {Object} commandEntry - Command entry
   */
  insertByPriority(commandEntry) {
    let insertIndex = this.queue.length;

    // Find insertion point based on priority
    for (let i = 0; i < this.queue.length; i++) {
      if (commandEntry.priority < this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    this.queue.splice(insertIndex, 0, commandEntry);
  }

  /**
   * Process command queue
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const command = this.queue.shift();

      try {
        await this.executeCommand(command);
      } catch (error) {
        await this.handleCommandError(command, error);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Execute a single command
   * @param {Object} command - Command to execute
   */
  async executeCommand(command) {
    try {
      logger.debug(`Executing command: ${command.id} (${command.cmdCode.toString(16)})`);

      // Check if connection is available
      if (!this.protocolHandler.isConnected()) {
        throw new Error('Not connected to camera');
      }

      // Execute command
      const result = await this.protocolHandler.connection.sendCommand(
        command.cmdCode,
        command.data
      );

      // Resolve promise with result
      command.resolve(result);

      logger.debug(`Command completed: ${command.id}`);

      this.emit('commandCompleted', {
        commandId: command.id,
        cmdCode: command.cmdCode,
        result
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle command execution error
   * @param {Object} command - Failed command
   * @param {Error} error - Error that occurred
   */
  async handleCommandError(command, error) {
    command.retries++;

    logger.warn(`Command failed: ${command.id} (${error.message}), retry ${command.retries}/${command.maxRetries}`);

    // Check if we should retry
    if (command.retries < command.maxRetries && this.shouldRetry(error)) {
      // Add delay before retry
      await this.delay(this.retryDelay * command.retries);

      // Re-queue command
      this.insertByPriority(command);

      logger.debug(`Command re-queued: ${command.id}`);

      this.emit('commandRetry', {
        commandId: command.id,
        cmdCode: command.cmdCode,
        retries: command.retries,
        error: error.message
      });

    } else {
      // Max retries reached or non-retryable error
      command.reject(error);

      logger.error(`Command failed permanently: ${command.id} (${error.message})`);

      this.emit('commandFailed', {
        commandId: command.id,
        cmdCode: command.cmdCode,
        retries: command.retries,
        error: error.message
      });
    }
  }

  /**
   * Determine if error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} Whether error is retryable
   */
  shouldRetry(error) {
    const retryableErrors = [
      'Message timeout',
      'Connection lost',
      'System error',
      'Try again'
    ];

    return retryableErrors.some(retryableError =>
      error.message.toLowerCase().includes(retryableError.toLowerCase())
    );
  }

  /**
   * Clear all pending commands
   */
  clear() {
    const clearedCommands = this.queue.length;

    // Reject all pending commands
    this.queue.forEach(command => {
      command.reject(new Error('Command queue cleared'));
    });

    this.queue = [];

    logger.info(`Cleared ${clearedCommands} pending commands`);

    this.emit('queueCleared', { clearedCommands });
  }

  /**
   * Get queue status
   * @returns {Object} Queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      maxQueueSize: this.maxQueueSize
    };
  }

  /**
   * Set queue configuration
   * @param {Object} config - Configuration options
   */
  configure(config) {
    if (config.maxRetries !== undefined) {
      this.maxRetries = config.maxRetries;
    }

    if (config.retryDelay !== undefined) {
      this.retryDelay = config.retryDelay;
    }

    if (config.maxQueueSize !== undefined) {
      this.maxQueueSize = config.maxQueueSize;
    }

    logger.info(`Command queue configured: maxRetries=${this.maxRetries}, retryDelay=${this.retryDelay}, maxQueueSize=${this.maxQueueSize}`);
  }

  /**
   * Generate unique command ID
   * @returns {string} Unique command ID
   */
  generateCommandId() {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Add high priority command (bypasses normal queue)
   * @param {Object} command - Command object
   * @returns {Promise<*>} Command result
   */
  async enqueueHighPriority(command) {
    return this.enqueue({
      ...command,
      priority: 1
    });
  }

  /**
   * Add low priority command
   * @param {Object} command - Command object
   * @returns {Promise<*>} Command result
   */
  async enqueueLowPriority(command) {
    return this.enqueue({
      ...command,
      priority: 10
    });
  }
}

module.exports = { CommandQueue };