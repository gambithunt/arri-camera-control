/**
 * Unit tests for CAP command queue
 */

const { CommandQueue } = require('../commandQueue.js');
const { CAP_COMMANDS } = require('../types.js');

// Mock protocol handler
const createMockProtocolHandler = () => ({
  isConnected: jest.fn(() => true),
  connection: {
    sendCommand: jest.fn()
  }
});

describe('CommandQueue', () => {
  let commandQueue;
  let mockProtocolHandler;

  beforeEach(() => {
    mockProtocolHandler = createMockProtocolHandler();
    commandQueue = new CommandQueue(mockProtocolHandler);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Basic Queue Operations', () => {
    it('should initialize with empty queue', () => {
      const status = commandQueue.getStatus();
      expect(status.queueLength).toBe(0);
      expect(status.isProcessing).toBe(false);
    });

    it('should enqueue commands successfully', async () => {
      mockProtocolHandler.connection.sendCommand.mockResolvedValue({ cmdCode: 0x0000 });

      const commandPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE
      });

      // Process the queue
      await jest.runAllTimersAsync();
      
      const result = await commandPromise;
      expect(result.cmdCode).toBe(0x0000);
      expect(mockProtocolHandler.connection.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.LIVE, null);
    });

    it('should process commands in priority order', async () => {
      mockProtocolHandler.connection.sendCommand.mockResolvedValue({ cmdCode: 0x0000 });

      // Enqueue commands with different priorities
      const lowPriorityPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE,
        priority: 10
      });

      const highPriorityPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.RECORD_START,
        priority: 1
      });

      const mediumPriorityPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.AUTO_WHITE_BALANCE,
        priority: 5
      });

      await jest.runAllTimersAsync();

      await Promise.all([lowPriorityPromise, highPriorityPromise, mediumPriorityPromise]);

      // Check call order - high priority should be first
      const calls = mockProtocolHandler.connection.sendCommand.mock.calls;
      expect(calls[0][0]).toBe(CAP_COMMANDS.RECORD_START); // Priority 1
      expect(calls[1][0]).toBe(CAP_COMMANDS.AUTO_WHITE_BALANCE); // Priority 5
      expect(calls[2][0]).toBe(CAP_COMMANDS.LIVE); // Priority 10
    });

    it('should reject commands when queue is full', async () => {
      commandQueue.configure({ maxQueueSize: 2 });

      // Fill the queue
      const promise1 = commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      const promise2 = commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      
      // This should be rejected
      await expect(commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE }))
        .rejects.toThrow('Command queue is full');
    });
  });

  describe('Error Handling and Retries', () => {
    it('should retry failed commands', async () => {
      // First call fails, second succeeds
      mockProtocolHandler.connection.sendCommand
        .mockRejectedValueOnce(new Error('Message timeout'))
        .mockResolvedValueOnce({ cmdCode: 0x0000 });

      const commandPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE
      });

      // Process initial attempt and retry
      await jest.runAllTimersAsync();

      const result = await commandPromise;
      expect(result.cmdCode).toBe(0x0000);
      expect(mockProtocolHandler.connection.sendCommand).toHaveBeenCalledTimes(2);
    });

    it('should fail permanently after max retries', async () => {
      mockProtocolHandler.connection.sendCommand.mockRejectedValue(new Error('Message timeout'));

      const commandPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE,
        maxRetries: 2
      });

      await jest.runAllTimersAsync();

      await expect(commandPromise).rejects.toThrow('Message timeout');
      expect(mockProtocolHandler.connection.sendCommand).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });

    it('should not retry non-retryable errors', async () => {
      mockProtocolHandler.connection.sendCommand.mockRejectedValue(new Error('Invalid command'));

      const commandPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE
      });

      await jest.runAllTimersAsync();

      await expect(commandPromise).rejects.toThrow('Invalid command');
      expect(mockProtocolHandler.connection.sendCommand).toHaveBeenCalledTimes(1); // No retry
    });

    it('should handle disconnection errors', async () => {
      mockProtocolHandler.isConnected.mockReturnValue(false);

      const commandPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE
      });

      await jest.runAllTimersAsync();

      await expect(commandPromise).rejects.toThrow('Not connected to camera');
    });
  });

  describe('Queue Management', () => {
    it('should clear all pending commands', async () => {
      // Add commands to queue but don't process them
      const promise1 = commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      const promise2 = commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });

      expect(commandQueue.getStatus().queueLength).toBe(2);

      commandQueue.clear();

      expect(commandQueue.getStatus().queueLength).toBe(0);
      
      await expect(promise1).rejects.toThrow('Command queue cleared');
      await expect(promise2).rejects.toThrow('Command queue cleared');
    });

    it('should configure queue parameters', () => {
      commandQueue.configure({
        maxRetries: 5,
        retryDelay: 2000,
        maxQueueSize: 50
      });

      expect(commandQueue.maxRetries).toBe(5);
      expect(commandQueue.retryDelay).toBe(2000);
      expect(commandQueue.maxQueueSize).toBe(50);
    });

    it('should provide queue status', () => {
      const status = commandQueue.getStatus();
      
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('maxQueueSize');
    });
  });

  describe('Priority Helpers', () => {
    it('should enqueue high priority commands', async () => {
      mockProtocolHandler.connection.sendCommand.mockResolvedValue({ cmdCode: 0x0000 });

      const normalPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.LIVE
      });

      const highPriorityPromise = commandQueue.enqueueHighPriority({
        cmdCode: CAP_COMMANDS.RECORD_START
      });

      await jest.runAllTimersAsync();

      await Promise.all([normalPromise, highPriorityPromise]);

      // High priority should be processed first
      const calls = mockProtocolHandler.connection.sendCommand.mock.calls;
      expect(calls[0][0]).toBe(CAP_COMMANDS.RECORD_START);
      expect(calls[1][0]).toBe(CAP_COMMANDS.LIVE);
    });

    it('should enqueue low priority commands', async () => {
      mockProtocolHandler.connection.sendCommand.mockResolvedValue({ cmdCode: 0x0000 });

      const lowPriorityPromise = commandQueue.enqueueLowPriority({
        cmdCode: CAP_COMMANDS.LIVE
      });

      const normalPromise = commandQueue.enqueue({
        cmdCode: CAP_COMMANDS.RECORD_START
      });

      await jest.runAllTimersAsync();

      await Promise.all([lowPriorityPromise, normalPromise]);

      // Normal priority should be processed first
      const calls = mockProtocolHandler.connection.sendCommand.mock.calls;
      expect(calls[0][0]).toBe(CAP_COMMANDS.RECORD_START);
      expect(calls[1][0]).toBe(CAP_COMMANDS.LIVE);
    });
  });

  describe('Events', () => {
    it('should emit commandCompleted event', (done) => {
      mockProtocolHandler.connection.sendCommand.mockResolvedValue({ cmdCode: 0x0000 });

      commandQueue.on('commandCompleted', (event) => {
        expect(event.cmdCode).toBe(CAP_COMMANDS.LIVE);
        expect(event.result.cmdCode).toBe(0x0000);
        done();
      });

      commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      jest.runAllTimersAsync();
    });

    it('should emit commandFailed event', (done) => {
      mockProtocolHandler.connection.sendCommand.mockRejectedValue(new Error('Test error'));

      commandQueue.on('commandFailed', (event) => {
        expect(event.cmdCode).toBe(CAP_COMMANDS.LIVE);
        expect(event.error).toBe('Test error');
        done();
      });

      commandQueue.enqueue({ 
        cmdCode: CAP_COMMANDS.LIVE,
        maxRetries: 0 
      });
      jest.runAllTimersAsync();
    });

    it('should emit commandRetry event', (done) => {
      mockProtocolHandler.connection.sendCommand
        .mockRejectedValueOnce(new Error('Message timeout'))
        .mockResolvedValueOnce({ cmdCode: 0x0000 });

      commandQueue.on('commandRetry', (event) => {
        expect(event.cmdCode).toBe(CAP_COMMANDS.LIVE);
        expect(event.retries).toBe(1);
        done();
      });

      commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      jest.runAllTimersAsync();
    });

    it('should emit queueCleared event', (done) => {
      commandQueue.on('queueCleared', (event) => {
        expect(event.clearedCommands).toBe(2);
        done();
      });

      commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      commandQueue.enqueue({ cmdCode: CAP_COMMANDS.LIVE });
      commandQueue.clear();
    });
  });
});