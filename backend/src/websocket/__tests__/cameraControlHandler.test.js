/**
 * Unit tests for Camera Control Handler
 */

const { CameraControlHandler } = require('../cameraControlHandler.js');
const { CAP_COMMANDS, CAP_VARIABLES } = require('../../cap/types.js');
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

describe('CameraControlHandler', () => {
  let cameraControlHandler;
  let mockWsManager;
  let mockCapManager;
  let mockSocket;

  beforeEach(() => {
    // Mock CAP manager
    mockCapManager = new EventEmitter();
    mockCapManager.sendCommand = jest.fn().mockResolvedValue({ success: true });
    mockCapManager.isConnected = jest.fn().mockReturnValue(true);

    // Mock WebSocket manager
    mockWsManager = {
      capManager: mockCapManager,
      broadcast: jest.fn()
    };

    // Mock socket
    mockSocket = {
      id: 'test-socket-id',
      emit: jest.fn()
    };

    cameraControlHandler = new CameraControlHandler(mockWsManager);
  });

  describe('Frame Rate Control', () => {
    it('should handle valid frame rate changes', async () => {
      const data = { frameRate: 24 };

      await cameraControlHandler.handleFrameRateControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.SENSOR_FPS,
        value: 24
      });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:frameRate:changed', {
        frameRate: 24,
        timestamp: expect.any(String)
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:success', {
        frameRate: 24,
        timestamp: expect.any(String)
      });
    });

    it('should validate frame rate values', async () => {
      const data = { frameRate: 999 }; // Invalid frame rate

      await cameraControlHandler.handleFrameRateControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:error', {
        message: 'Invalid frame rate data',
        code: 'INVALID_FRAME_RATE',
        errors: expect.any(Object),
        supportedValues: expect.any(Array),
        timestamp: expect.any(String)
      });
    });

    it('should check connection before setting frame rate', async () => {
      mockCapManager.isConnected.mockReturnValue(false);
      const data = { frameRate: 24 };

      await cameraControlHandler.handleFrameRateControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:error', {
        message: 'Not connected to camera',
        code: 'NOT_CONNECTED',
        timestamp: expect.any(String)
      });
    });

    it('should handle CAP command errors', async () => {
      const data = { frameRate: 24 };
      const error = new Error('Command failed');
      error.code = 'COMMAND_ERROR';
      mockCapManager.sendCommand.mockRejectedValue(error);

      await cameraControlHandler.handleFrameRateControl(mockSocket, data);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameRate:error', {
        message: 'Command failed',
        code: 'COMMAND_ERROR',
        category: 'command',
        timestamp: expect.any(String)
      });
    });
  });

  describe('White Balance Control', () => {
    it('should handle valid white balance changes', async () => {
      const data = { kelvin: 5600, tint: 10 };

      await cameraControlHandler.handleWhiteBalanceControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.COLOR_TEMPERATURE,
        value: 5600
      });

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.TINT,
        value: 10
      });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:whiteBalance:changed', {
        whiteBalance: { kelvin: 5600, tint: 10 },
        timestamp: expect.any(String)
      });
    });

    it('should handle partial white balance changes', async () => {
      const data = { kelvin: 3200 }; // Only kelvin, no tint

      await cameraControlHandler.handleWhiteBalanceControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.COLOR_TEMPERATURE,
        value: 3200
      });

      // Should not call tint command
      expect(mockCapManager.sendCommand).not.toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.TINT,
        value: expect.any(Number)
      });
    });

    it('should validate white balance values', async () => {
      const data = { kelvin: 15000, tint: 200 }; // Invalid values

      await cameraControlHandler.handleWhiteBalanceControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:whiteBalance:error', {
        message: 'Invalid white balance data',
        code: 'INVALID_WHITE_BALANCE',
        errors: expect.any(Object),
        supportedRanges: expect.any(Object),
        timestamp: expect.any(String)
      });
    });
  });

  describe('ISO Control', () => {
    it('should handle valid ISO changes', async () => {
      const data = { iso: 800 };

      await cameraControlHandler.handleISOControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.EXPOSURE_INDEX,
        value: 800
      });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:iso:changed', {
        iso: 800,
        timestamp: expect.any(String)
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:iso:success', {
        iso: 800,
        timestamp: expect.any(String)
      });
    });

    it('should validate ISO values', async () => {
      const data = { iso: 999 }; // Invalid ISO

      await cameraControlHandler.handleISOControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:iso:error', {
        message: 'Invalid ISO value',
        code: 'INVALID_ISO',
        supportedValues: expect.any(Array),
        timestamp: expect.any(String)
      });
    });
  });

  describe('ND Filter Control', () => {
    it('should handle valid ND filter changes', async () => {
      const data = { ndStop: 1.2 };

      await cameraControlHandler.handleNDFilterControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.ND_FILTER,
        value: 1.2
      });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:ndFilter:changed', {
        ndFilter: 1.2,
        timestamp: expect.any(String)
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:ndFilter:success', {
        ndFilter: 1.2,
        timestamp: expect.any(String)
      });
    });

    it('should validate ND stop values', async () => {
      const data = { ndStop: 5.0 }; // Invalid ND stop

      await cameraControlHandler.handleNDFilterControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:ndFilter:error', {
        message: 'Invalid ND filter stop value',
        code: 'INVALID_ND_STOP',
        supportedValues: expect.any(Array),
        timestamp: expect.any(String)
      });
    });
  });

  describe('Frame Lines Control', () => {
    it('should handle frame lines enable/disable', async () => {
      const data = { enabled: true };

      await cameraControlHandler.handleFrameLinesControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.LOOK_SWITCH_EVF,
        value: true
      });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:frameLines:changed', {
        frameLines: true,
        timestamp: expect.any(String)
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameLines:success', {
        frameLines: true,
        timestamp: expect.any(String)
      });
    });

    it('should validate frame lines enabled value', async () => {
      const data = { enabled: 'invalid' }; // Not a boolean

      await cameraControlHandler.handleFrameLinesControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:frameLines:error', {
        message: 'Frame lines enabled must be a boolean value',
        code: 'INVALID_FRAME_LINES',
        timestamp: expect.any(String)
      });
    });
  });

  describe('LUT Control', () => {
    it('should handle valid LUT changes', async () => {
      const data = { lutName: 'Rec709' };

      await cameraControlHandler.handleLUTControl(mockSocket, data);

      expect(mockCapManager.sendCommand).toHaveBeenCalledWith(CAP_COMMANDS.SET_VARIABLE, {
        variableId: CAP_VARIABLES.LOOK_FILENAME,
        value: 'Rec709'
      });

      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:lut:changed', {
        lut: 'Rec709',
        timestamp: expect.any(String)
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:lut:success', {
        lut: 'Rec709',
        timestamp: expect.any(String)
      });
    });

    it('should validate LUT name', async () => {
      const data = { lutName: '' }; // Empty string

      await cameraControlHandler.handleLUTControl(mockSocket, data);

      expect(mockCapManager.sendCommand).not.toHaveBeenCalled();
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:lut:error', {
        message: 'LUT name must be a non-empty string',
        code: 'INVALID_LUT_NAME',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Camera State Management', () => {
    it('should return current camera state', () => {
      // Set some state
      cameraControlHandler.cameraState.frameRate = 24;
      cameraControlHandler.cameraState.iso = 800;

      cameraControlHandler.handleGetCameraState(mockSocket);

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:state', {
        frameRate: 24,
        whiteBalance: { kelvin: null, tint: null },
        iso: 800,
        ndFilter: null,
        frameLines: false,
        lut: null,
        lastUpdate: null,
        timestamp: expect.any(String)
      });
    });

    it('should handle state errors', () => {
      // Mock emit to throw error on first call, succeed on second
      let callCount = 0;
      mockSocket.emit.mockImplementation((event) => {
        callCount++;
        if (callCount === 1 && event === 'camera:state') {
          throw new Error('Emit failed');
        }
      });

      cameraControlHandler.handleGetCameraState(mockSocket);

      // Should handle error gracefully and emit error response
      expect(mockSocket.emit).toHaveBeenCalledWith('camera:state:error', {
        message: 'Failed to get camera state',
        code: 'STATE_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('CAP Variable Updates', () => {
    it('should update state from CAP variable changes', () => {
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.SENSOR_FPS, 30);

      expect(cameraControlHandler.cameraState.frameRate).toBe(30);
      expect(mockWsManager.broadcast).toHaveBeenCalledWith('camera:frameRate:changed', {
        frameRate: 30,
        timestamp: expect.any(String)
      });
    });

    it('should not broadcast if value unchanged', () => {
      // Set initial value
      cameraControlHandler.cameraState.frameRate = 24;
      
      // Update with same value
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.SENSOR_FPS, 24);

      expect(mockWsManager.broadcast).not.toHaveBeenCalled();
    });

    it('should handle white balance updates', () => {
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.COLOR_TEMPERATURE, 5600);
      cameraControlHandler.updateStateFromCAP(CAP_VARIABLES.TINT, 15);

      expect(cameraControlHandler.cameraState.whiteBalance.kelvin).toBe(5600);
      expect(cameraControlHandler.cameraState.whiteBalance.tint).toBe(15);
      expect(mockWsManager.broadcast).toHaveBeenCalledTimes(2);
    });
  });

  describe('Validation Methods', () => {
    it('should validate frame rates correctly', () => {
      expect(cameraControlHandler.isValidFrameRate(24)).toBe(true);
      expect(cameraControlHandler.isValidFrameRate(999)).toBe(false);
      expect(cameraControlHandler.isValidFrameRate('24')).toBe(false);
    });

    it('should validate white balance correctly', () => {
      expect(cameraControlHandler.isValidWhiteBalance(5600, 10)).toBe(true);
      expect(cameraControlHandler.isValidWhiteBalance(15000, 10)).toBe(false);
      expect(cameraControlHandler.isValidWhiteBalance(5600, 200)).toBe(false);
      expect(cameraControlHandler.isValidWhiteBalance(5600, undefined)).toBe(true);
    });

    it('should validate ISO correctly', () => {
      expect(cameraControlHandler.isValidISO(800)).toBe(true);
      expect(cameraControlHandler.isValidISO(999)).toBe(false);
      expect(cameraControlHandler.isValidISO('800')).toBe(false);
    });

    it('should validate ND stops correctly', () => {
      expect(cameraControlHandler.isValidNDStop(1.2)).toBe(true);
      expect(cameraControlHandler.isValidNDStop(5.0)).toBe(false);
      expect(cameraControlHandler.isValidNDStop('1.2')).toBe(false);
    });
  });

  describe('Supported Values', () => {
    it('should return supported values', () => {
      const supportedValues = cameraControlHandler.getSupportedValues();

      expect(supportedValues).toHaveProperty('frameRates');
      expect(supportedValues).toHaveProperty('isoValues');
      expect(supportedValues).toHaveProperty('ndStops');
      expect(supportedValues).toHaveProperty('kelvinRange');
      expect(supportedValues).toHaveProperty('tintRange');
      
      expect(Array.isArray(supportedValues.frameRates)).toBe(true);
      expect(Array.isArray(supportedValues.isoValues)).toBe(true);
      expect(Array.isArray(supportedValues.ndStops)).toBe(true);
    });
  });
});