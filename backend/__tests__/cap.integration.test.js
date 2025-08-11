/**
 * CAP Protocol Integration Tests
 * Tests for CAP (Camera Access Protocol) implementation
 */

const { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } = require('@jest/globals');
const net = require('net');
const { CAPProtocol } = require('../src/cap/capProtocol');
const { CommandQueue } = require('../src/cap/commandQueue');
const { CAPValidator } = require('../src/cap/capValidator');

// Mock camera server for testing
class MockCameraServer {
  constructor(port = 7755) {
    this.port = port;
    this.server = null;
    this.clients = new Set();
    this.responses = new Map();
    this.commandLog = [];
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.clients.add(socket);
        
        socket.on('data', (data) => {
          this.handleCommand(socket, data.toString());
        });
        
        socket.on('close', () => {
          this.clients.delete(socket);
        });
        
        socket.on('error', (error) => {
          console.error('Mock camera socket error:', error);
        });
      });
      
      this.server.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.clients.forEach(client => client.destroy());
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  handleCommand(socket, command) {
    const trimmedCommand = command.trim();
    this.commandLog.push(trimmedCommand);
    
    // Simulate camera responses based on CAP protocol
    let response = '';
    
    if (trimmedCommand.startsWith('GET /camera/status')) {
      response = this.getCameraStatusResponse();
    } else if (trimmedCommand.startsWith('PUT /camera/frameRate')) {
      response = this.setFrameRateResponse(trimmedCommand);
    } else if (trimmedCommand.startsWith('PUT /camera/whiteBalance')) {
      response = this.setWhiteBalanceResponse(trimmedCommand);
    } else if (trimmedCommand.startsWith('PUT /camera/iso')) {
      response = this.setISOResponse(trimmedCommand);
    } else if (trimmedCommand.startsWith('PUT /camera/ndFilter')) {
      response = this.setNDFilterResponse(trimmedCommand);
    } else if (trimmedCommand.startsWith('PUT /playback/mode')) {
      response = this.setPlaybackModeResponse(trimmedCommand);
    } else if (trimmedCommand.startsWith('PUT /playback/control')) {
      response = this.setPlaybackControlResponse(trimmedCommand);
    } else if (trimmedCommand.startsWith('GET /timecode/current')) {
      response = this.getTimecodeResponse();
    } else if (trimmedCommand.startsWith('PUT /timecode/sync')) {
      response = this.syncTimecodeResponse();
    } else if (trimmedCommand.startsWith('PUT /grading/lut')) {
      response = this.setLUTResponse(trimmedCommand);
    } else {
      response = this.getErrorResponse('CAP_002', 'Unknown command');
    }
    
    // Send response after a short delay to simulate network latency
    setTimeout(() => {
      socket.write(response);
    }, 10);
  }

  getCameraStatusResponse() {
    return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "model": "ARRI ALEXA Mini LF",
  "serialNumber": "ALF001234",
  "firmwareVersion": "7.2.1",
  "recording": false,
  "batteryLevel": 85,
  "temperature": 42
}`;
  }

  setFrameRateResponse(command) {
    const match = command.match(/"frameRate":\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const frameRate = parseFloat(match[1]);
      if (frameRate >= 1 && frameRate <= 120) {
        return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "frameRate": ${frameRate}
}`;
      } else {
        return this.getErrorResponse('CAP_003', 'Invalid frame rate', 'Frame rate must be between 1 and 120 fps');
      }
    }
    return this.getErrorResponse('CAP_003', 'Invalid frame rate format');
  }

  setWhiteBalanceResponse(command) {
    const match = command.match(/"kelvin":\s*(\d+)/);
    if (match) {
      const kelvin = parseInt(match[1]);
      if (kelvin >= 2000 && kelvin <= 11000) {
        return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "kelvin": ${kelvin}
}`;
      } else {
        return this.getErrorResponse('CAP_003', 'Invalid white balance', 'White balance must be between 2000K and 11000K');
      }
    }
    return this.getErrorResponse('CAP_003', 'Invalid white balance format');
  }

  setISOResponse(command) {
    const match = command.match(/"iso":\s*(\d+)/);
    if (match) {
      const iso = parseInt(match[1]);
      const validISOs = [100, 200, 400, 800, 1600, 3200, 6400];
      if (validISOs.includes(iso)) {
        return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "iso": ${iso}
}`;
      } else {
        return this.getErrorResponse('CAP_003', 'Invalid ISO value', `ISO must be one of: ${validISOs.join(', ')}`);
      }
    }
    return this.getErrorResponse('CAP_003', 'Invalid ISO format');
  }

  setNDFilterResponse(command) {
    const match = command.match(/"ndStop":\s*(\d+(?:\.\d+)?)/);
    if (match) {
      const ndStop = parseFloat(match[1]);
      const validStops = [0, 0.6, 1.2, 1.8, 2.4, 3.0];
      if (validStops.includes(ndStop)) {
        return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "ndStop": ${ndStop}
}`;
      } else {
        return this.getErrorResponse('CAP_003', 'Invalid ND filter value', `ND stop must be one of: ${validStops.join(', ')}`);
      }
    }
    return this.getErrorResponse('CAP_003', 'Invalid ND filter format');
  }

  setPlaybackModeResponse(command) {
    const match = command.match(/"mode":\s*"(\w+)"/);
    if (match) {
      const mode = match[1];
      if (['record', 'playback'].includes(mode)) {
        return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "mode": "${mode}"
}`;
      } else {
        return this.getErrorResponse('CAP_003', 'Invalid playback mode', 'Mode must be "record" or "playback"');
      }
    }
    return this.getErrorResponse('CAP_003', 'Invalid playback mode format');
  }

  setPlaybackControlResponse(command) {
    const match = command.match(/"action":\s*"(\w+)"/);
    if (match) {
      const action = match[1];
      if (['play', 'pause', 'stop', 'seek'].includes(action)) {
        return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "action": "${action}",
  "status": "${action === 'play' ? 'playing' : action === 'pause' ? 'paused' : 'stopped'}"
}`;
      } else {
        return this.getErrorResponse('CAP_003', 'Invalid playback action');
      }
    }
    return this.getErrorResponse('CAP_003', 'Invalid playback control format');
  }

  getTimecodeResponse() {
    return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "timecode": "01:23:45:12",
  "frameRate": 24
}`;
  }

  syncTimecodeResponse() {
    return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "timecode": "01:23:45:12",
  "frameRate": 24,
  "synced": true
}`;
  }

  setLUTResponse(command) {
    const match = command.match(/"lutId":\s*"([^"]+)"/);
    if (match) {
      const lutId = match[1];
      return `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "lutId": "${lutId}",
  "loaded": true
}`;
    }
    return this.getErrorResponse('CAP_003', 'Invalid LUT format');
  }

  getErrorResponse(code, message, details = '') {
    return `HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\n\r\n{
  "error": {
    "code": "${code}",
    "message": "${message}",
    "details": "${details}"
  }
}`;
  }

  getCommandLog() {
    return [...this.commandLog];
  }

  clearCommandLog() {
    this.commandLog = [];
  }
}

describe('CAP Protocol Integration Tests', () => {
  let mockCamera;
  let capProtocol;
  let commandQueue;
  const cameraIP = '127.0.0.1';
  const cameraPort = 7755;

  beforeAll(async () => {
    // Start mock camera server
    mockCamera = new MockCameraServer(cameraPort);
    await mockCamera.start();
  });

  afterAll(async () => {
    // Stop mock camera server
    if (mockCamera) {
      await mockCamera.stop();
    }
  });

  beforeEach(() => {
    // Initialize CAP protocol and command queue
    capProtocol = new CAPProtocol();
    commandQueue = new CommandQueue();
    mockCamera.clearCommandLog();
  });

  afterEach(async () => {
    // Clean up connections
    if (capProtocol) {
      await capProtocol.disconnect();
    }
    if (commandQueue) {
      commandQueue.clear();
    }
  });

  describe('Connection Management', () => {
    it('should establish CAP connection to camera', async () => {
      const result = await capProtocol.connect(cameraIP, cameraPort);
      
      expect(result.success).toBe(true);
      expect(capProtocol.isConnected()).toBe(true);
    });

    it('should handle connection timeout', async () => {
      // Try to connect to non-existent camera
      const result = await capProtocol.connect('192.168.1.999', 7755);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should disconnect properly', async () => {
      await capProtocol.connect(cameraIP, cameraPort);
      
      const result = await capProtocol.disconnect();
      
      expect(result.success).toBe(true);
      expect(capProtocol.isConnected()).toBe(false);
    });
  });

  describe('Camera Control Commands', () => {
    beforeEach(async () => {
      await capProtocol.connect(cameraIP, cameraPort);
    });

    afterEach(async () => {
      await capProtocol.disconnect();
    });

    it('should set valid frame rate', async () => {
      const result = await capProtocol.setFrameRate(24);
      
      expect(result.success).toBe(true);
      expect(result.data.frameRate).toBe(24);
    });

    it('should handle concurrent commands', async () => {
      const promises = [
        capProtocol.setFrameRate(24),
        capProtocol.setWhiteBalance(5600),
        capProtocol.setISO(800)
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});