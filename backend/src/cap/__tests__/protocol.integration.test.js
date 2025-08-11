/**
 * Integration tests for CAP protocol with mock server
 */

const { CAPProtocolHandler } = require('../protocol.js');
const { MockCAPServer } = require('./mockCAPServer.helper.js');
const { CAP_VARIABLES } = require('../types.js');

describe('CAP Protocol Integration Tests', () => {
  let mockServer;
  let protocolHandler;
  const TEST_PORT = 7778;

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
    protocolHandler = new CAPProtocolHandler();
  });

  afterEach(async () => {
    if (protocolHandler && protocolHandler.isConnected()) {
      protocolHandler.disconnect();
    }
    
    // Wait a bit for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Connection and Authentication', () => {
    it('should connect to mock camera successfully', async () => {
      const connected = await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
      
      expect(connected).toBe(true);
      expect(protocolHandler.isConnected()).toBe(true);
    });

    it('should receive camera information after connection', (done) => {
      protocolHandler.on('cameraInfo', (info) => {
        expect(info.type).toBe('Alexa 35');
        expect(info.serial).toBe('A35001');
        done();
      });

      protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should handle connection to non-existent server', async () => {
      await expect(protocolHandler.connect('localhost', 9999, 'TestClient'))
        .rejects.toThrow();
    });
  });

  describe('Variable Operations', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should get camera type variable', async () => {
      const response = await protocolHandler.getVariable(CAP_VARIABLES.CAMERA_TYPE);
      expect(response.cmdCode).toBe(0x0000); // OK
    });

    it('should get sensor FPS variable', async () => {
      const response = await protocolHandler.getVariable(CAP_VARIABLES.SENSOR_FPS);
      expect(response.cmdCode).toBe(0x0000); // OK
    });

    it('should set sensor FPS variable', async () => {
      const response = await protocolHandler.setVariable(CAP_VARIABLES.SENSOR_FPS, 25.0);
      expect(response.cmdCode).toBe(0x0000); // OK
    });

    it('should handle invalid variable ID', async () => {
      await expect(protocolHandler.getVariable(0x9999))
        .rejects.toThrow();
    });
  });

  describe('Variable Subscriptions', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should subscribe to variables successfully', async () => {
      const variableIds = [
        CAP_VARIABLES.SENSOR_FPS,
        CAP_VARIABLES.SHUTTER_ANGLE,
        CAP_VARIABLES.EXPOSURE_INDEX
      ];

      await protocolHandler.subscribeToVariables(variableIds);
      
      const subscribed = protocolHandler.getSubscribedVariables();
      expect(subscribed.size).toBe(3);
      expect(subscribed.has(CAP_VARIABLES.SENSOR_FPS)).toBe(true);
    });

    it('should unsubscribe from variables successfully', async () => {
      const variableIds = [CAP_VARIABLES.SENSOR_FPS];

      await protocolHandler.subscribeToVariables(variableIds);
      expect(protocolHandler.getSubscribedVariables().size).toBe(1);

      await protocolHandler.unsubscribeFromVariables(variableIds);
      expect(protocolHandler.getSubscribedVariables().size).toBe(0);
    });

    it('should receive variable updates', (done) => {
      const variableIds = [CAP_VARIABLES.SENSOR_FPS];

      protocolHandler.on('variableUpdate', (update) => {
        expect(update.variableId).toBe(CAP_VARIABLES.SENSOR_FPS);
        expect(update.timestamp).toBeDefined();
        done();
      });

      protocolHandler.subscribeToVariables(variableIds).then(() => {
        // Simulate variable update from mock server
        const fpsBuffer = Buffer.alloc(4);
        fpsBuffer.writeFloatBE(30.0, 0);
        mockServer.broadcastVariableUpdate(CAP_VARIABLES.SENSOR_FPS, fpsBuffer);
      });
    });
  });

  describe('Camera Control Commands', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should start recording successfully', async () => {
      await expect(protocolHandler.startRecording()).resolves.not.toThrow();
    });

    it('should stop recording successfully', async () => {
      await protocolHandler.stopRecording();
      // Should not throw
    });

    it('should trigger auto white balance', async () => {
      await expect(protocolHandler.autoWhiteBalance()).resolves.not.toThrow();
    });
  });

  describe('Data Parsing', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should parse string variables correctly', async () => {
      const response = await protocolHandler.getVariable(CAP_VARIABLES.CAMERA_TYPE);
      const parsed = protocolHandler.parseVariableData(CAP_VARIABLES.CAMERA_TYPE, response.data);
      expect(parsed).toBe('Alexa 35');
    });

    it('should parse float variables correctly', async () => {
      const response = await protocolHandler.getVariable(CAP_VARIABLES.SENSOR_FPS);
      const parsed = protocolHandler.parseVariableData(CAP_VARIABLES.SENSOR_FPS, response.data);
      expect(parsed).toBe(24.0);
    });

    it('should parse integer variables correctly', async () => {
      const response = await protocolHandler.getVariable(CAP_VARIABLES.EXPOSURE_INDEX);
      const parsed = protocolHandler.parseVariableData(CAP_VARIABLES.EXPOSURE_INDEX, response.data);
      expect(parsed).toBe(800);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should handle disconnection gracefully', (done) => {
      protocolHandler.on('disconnected', () => {
        expect(protocolHandler.isConnected()).toBe(false);
        done();
      });

      // Simulate disconnection
      protocolHandler.disconnect();
    });

    it('should clear subscriptions on disconnection', async () => {
      await protocolHandler.subscribeToVariables([CAP_VARIABLES.SENSOR_FPS]);
      expect(protocolHandler.getSubscribedVariables().size).toBe(1);

      protocolHandler.disconnect();
      
      // Wait for disconnection to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(protocolHandler.getSubscribedVariables().size).toBe(0);
    });
  });

  describe('Caching', () => {
    beforeEach(async () => {
      await protocolHandler.connect('localhost', TEST_PORT, 'TestClient');
    });

    it('should cache variable values from updates', (done) => {
      const variableId = CAP_VARIABLES.SENSOR_FPS;
      const testValue = 30.0;

      protocolHandler.on('variableUpdate', (update) => {
        const cached = protocolHandler.getCachedVariable(variableId);
        expect(cached).toBe(testValue);
        done();
      });

      protocolHandler.subscribeToVariables([variableId]).then(() => {
        const fpsBuffer = Buffer.alloc(4);
        fpsBuffer.writeFloatBE(testValue, 0);
        mockServer.broadcastVariableUpdate(variableId, fpsBuffer);
      });
    });

    it('should return all cached variables', async () => {
      await protocolHandler.subscribeToVariables([CAP_VARIABLES.SENSOR_FPS]);
      
      // Simulate variable update
      const fpsBuffer = Buffer.alloc(4);
      fpsBuffer.writeFloatBE(25.0, 0);
      mockServer.broadcastVariableUpdate(CAP_VARIABLES.SENSOR_FPS, fpsBuffer);
      
      // Wait for update to process
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const allCached = protocolHandler.getAllCachedVariables();
      expect(allCached.size).toBeGreaterThan(0);
    });
  });
});