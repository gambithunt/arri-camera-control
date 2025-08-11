/**
 * Simplified Camera Control Integration Tests
 */

const { CameraControlHandler } = require('../cameraControlHandler.js');
const { WebSocketManager } = require('../websocketManager.js');
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

describe('Camera Control API Integration', () => {
  let cameraControlHandler;
  let mockWsManager;
  let mockCapManager;
  let mockSocket;
  let mockIO;

  beforeEach(() => {
    // Mock Socket.io server
    mockIO = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() })
    };

    // Mock CAP manager
    mockCapManager = new EventEmitter();
    mockCapManager.sendCommand = jest.fn().mockResolvedValue({ success: true });
    mockCapManager.isConnected = jest.fn().mockReturnValue(true);
    mockCapManager.getStatus = jest.fn().mockReturnValue({
      state: 'connected',
      connected: true
    });

    // Mock WebSocket manager
    mockWsManager = {
      io: mockIO,
      capManager: mockCapManager,
      broadcast: jest.fn(),
      connections: new Map()
    };

    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn(),
      join: jest.fn(),
      leave: jest.fn()
    };

    cameraControlHandler = new CameraControlHandler(mockWsManager);
  });

  describe('Complete Camera Control Workflow', () => {
    it('should handle complete camera setup workflow', async () => {
      // Test frame rate setting
      await cameraControlHandler.handleFrameRateControl(mockSocket, { frameRate: 24 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:success', expect.objectContaining({
        frameRate: 24
      }));

      // Test white balance setting
      await cameraControlHandler.handleWhiteBalanceControl(mockSocket, { kelvin: 5600, tint: 10 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:whiteBalance:success', expect.objectContaining({
        whiteBalance: { kelvin: 5600, tint: 10 }
      }));

      // Test ISO setting
      await cameraControlHandler.handleISOControl(mockSocket, { iso: 800 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:iso:success', expect.objectContaining({
        iso: 800
      }));

      // Test ND filter setting
      await cameraControlHandler.handleNDFilterControl(mockSocket, { ndStop: 1.2 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:ndFilter:success', expect.objectContaining({
        ndFilter: 1.2
      }));

      // Test frame lines toggle
      await cameraControlHandler.handleFrameLinesControl(mockSocket, { enabled: true });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameLines:success', expect.objectContaining({
        frameLines: true
      }));

      // Test LUT setting
      await cameraControlHandler.handleLUTControl(mockSocket, { lutName: 'Rec709' });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:lut:success', expect.objectContaining({
        lut: 'Rec709'
      }));

      // Verify all CAP commands were sent (white balance sends 2 commands: kelvin + tint)
      expect(mockCapManager.sendCommand).toHaveBeenCalledTimes(7);
      
      // Verify all broadcasts were made
      expect(mockWsManager.broadcast).toHaveBeenCalledTimes(6);
    });

    it('should maintain camera state correctly', async () => {
      // Set initial state
      await cameraControlHandler.handleFrameRateControl(mockSocket, { frameRate: 30 });
      await cameraControlHandler.handleISOControl(mockSocket, { iso: 1600 });

      // Get current state
      cameraControlHandler.handleGetCameraState(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:state', expect.objectContaining({
        frameRate: 30,
        iso: 1600,
        whiteBalance: { kelvin: null, tint: null },
        ndFilter: null,
        frameLines: false,
        lut: null
      }));
    });

    it('should handle validation errors for all controls', async () => {
      // Test invalid frame rate
      await cameraControlHandler.handleFrameRateControl(mockSocket, { frameRate: 999 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:error', expect.objectContaining({
        code: 'INVALID_FRAME_RATE'
      }));

      // Test invalid white balance
      await cameraControlHandler.handleWhiteBalanceControl(mockSocket, { kelvin: 15000 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:whiteBalance:error', expect.objectContaining({
        code: 'INVALID_WHITE_BALANCE'
      }));

      // Test invalid ISO
      await cameraControlHandler.handleISOControl(mockSocket, { iso: 999 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:iso:error', expect.objectContaining({
        code: 'INVALID_ISO'
      }));

      // Test invalid ND stop
      await cameraControlHandler.handleNDFilterControl(mockSocket, { ndStop: 5.0 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:ndFilter:error', expect.objectContaining({
        code: 'INVALID_ND_STOP'
      }));

      // Test invalid frame lines
      await cameraControlHandler.handleFrameLinesControl(mockSocket, { enabled: 'invalid' });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameLines:error', expect.objectContaining({
        code: 'INVALID_FRAME_LINES'
      }));

      // Test invalid LUT name
      await cameraControlHandler.handleLUTControl(mockSocket, { lutName: '' });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:lut:error', expect.objectContaining({
        code: 'INVALID_LUT_NAME'
      }));

      // No CAP commands should have been sent for invalid inputs
      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should handle disconnected camera state', async () => {
      mockCapManager.isConnected.mockReturnValue(false);

      // Try to set frame rate when disconnected
      await cameraControlHandler.handleFrameRateControl(mockSocket, { frameRate: 24 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:error', expect.objectContaining({
        code: 'NOT_CONNECTED'
      }));

      // Try to set white balance when disconnected
      await cameraControlHandler.handleWhiteBalanceControl(mockSocket, { kelvin: 5600 });
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:whiteBalance:error', expect.objectContaining({
        code: 'NOT_CONNECTED'
      }));

      // No CAP commands should have been sent
      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
    });

    it('should handle CAP command failures', async () => {
      const error = new Error('CAP command failed');
      error.code = 'COMMAND_ERROR';
      mockCapManager.sendCommand.mockRejectedValue(error);

      await cameraControlHandler.handleFrameRateControl(mockSocket, { frameRate: 24 });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:error', expect.objectContaining({
        message: 'CAP command failed',
        code: 'COMMAND_ERROR'
      }));
    });
  });

  describe('Real-time State Updates', () => {
    it('should update state from CAP variable changes', () => {
      const { CAP_VARIABLES } = require('../../cap/types.js');

      // Simulate CAP variable updates
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.SENSOR_FPS, 25);
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.EXPOSURE_INDEX, 1600);
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.COLOR_TEMPERATURE, 3200);

      // Verify state was updated
      expect(cameraControlHandler.cameraState.frameRate).toBe(25);
      expect(cameraControlHandler.cameraState.iso).toBe(1600);
      expect(cameraControlHandler.cameraState.whiteBalance.kelvin).toBe(3200);

      // Verify broadcasts were sent
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:frameRate:changed', expect.objectContaining({
        frameRate: 25
      }));
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:iso:changed', expect.objectContaining({
        iso: 1600
      }));
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:whiteBalance:changed', expect.objectContaining({
        whiteBalance: { kelvin: 3200, tint: null }
      }));
    });

    it('should not broadcast unchanged values', () => {
      const { CAP_VARIABLES } = require('../../cap/types.js');

      // Set initial value
      cameraControlHandler.cameraState.frameRate = 24;

      // Update with same value
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.SENSOR_FPS, 24);

      // Should not broadcast
      expect(mockWsManager.broadcast).not.toHaveBeenCalled();
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize all camera control inputs', async () => {
      // Test with potentially malicious input
      const maliciousData = {
        frameRate: 24,
        __proto__: { malicious: true },
        constructor: { prototype: { evil: true } },
        extraField: 'should be removed'
      };

      await cameraControlHandler.handleFrameRateControl(mockSocket, maliciousData);

      // Should succeed with sanitized input
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:success', expect.objectContaining({
        frameRate: 24
      }));

      // Verify CAP command was called with clean data
      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          value: 24
        })
      );
    });
  });

  describe('Supported Values', () => {
    it('should provide supported values for all controls', () => {
      const supportedValues = cameraControlHandler.getSupportedValues();

      expect(supportedValues).toHaveProperty('frameRates');
      expect(supportedValues).toHaveProperty('isoValues');
      expect(supportedValues).toHaveProperty('ndStops');
      expect(supportedValues).toHaveProperty('kelvinRange');
      expect(supportedValues).toHaveProperty('tintRange');

      expect(Array.isArray(supportedValues.frameRates)).toBe(true);
      expect(Array.isArray(supportedValues.isoValues)).toBe(true);
      expect(Array.isArray(supportedValues.ndStops)).toBe(true);
      expect(typeof supportedValues.kelvinRange).toBe('object');
      expect(typeof supportedValues.tintRange).toBe('object');
    });
  });
});