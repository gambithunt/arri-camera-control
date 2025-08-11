/**
 * Camera API Integration Tests
 * Tests for camera API endpoints and WebSocket communication
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { get } from 'svelte/store';
import { cameraApi, initializeCameraApi } from '../cameraApi';

// Mock WebSocket for testing
class MockWebSocket {
  public readyState = WebSocket.CONNECTING;
  public url: string;
  private listeners: Map<string, Function[]> = new Map();
  private static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.emit('open', {});
    }, 10);
  }

  addEventListener(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  removeEventListener(event: string, listener: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  send(data: string) {
    const message = JSON.parse(data);
    this.simulateServerResponse(message);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close', {});
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  private simulateServerResponse(message: any) {
    setTimeout(() => {
      switch (message.event) {
        case 'camera:connect':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:connect:success',
              data: {
                model: 'ARRI ALEXA Mini LF',
                serialNumber: 'ALF001234',
                firmwareVersion: '7.2.1'
              }
            })
          });
          break;

        case 'camera:frameRate:set':
          if (message.data.frameRate >= 1 && message.data.frameRate <= 120) {
            this.emit('message', {
              data: JSON.stringify({
                event: 'camera:frameRate:success',
                data: { frameRate: message.data.frameRate }
              })
            });
          } else {
            this.emit('message', {
              data: JSON.stringify({
                event: 'camera:frameRate:error',
                data: {
                  code: 'CAP_003',
                  message: 'Invalid frame rate',
                  details: 'Frame rate must be between 1 and 120 fps'
                }
              })
            });
          }
          break;

        case 'camera:whiteBalance:set':
          if (message.data.kelvin >= 2000 && message.data.kelvin <= 11000) {
            this.emit('message', {
              data: JSON.stringify({
                event: 'camera:whiteBalance:success',
                data: { kelvin: message.data.kelvin }
              })
            });
          } else {
            this.emit('message', {
              data: JSON.stringify({
                event: 'camera:whiteBalance:error',
                data: {
                  code: 'CAP_003',
                  message: 'Invalid white balance',
                  details: 'White balance must be between 2000K and 11000K'
                }
              })
            });
          }
          break;

        case 'camera:iso:set':
          const validISOs = [100, 200, 400, 800, 1600, 3200, 6400];
          if (validISOs.includes(message.data.iso)) {
            this.emit('message', {
              data: JSON.stringify({
                event: 'camera:iso:success',
                data: { iso: message.data.iso }
              })
            });
          } else {
            this.emit('message', {
              data: JSON.stringify({
                event: 'camera:iso:error',
                data: {
                  code: 'CAP_003',
                  message: 'Invalid ISO value',
                  details: `ISO must be one of: ${validISOs.join(', ')}`
                }
              })
            });
          }
          break;

        default:
          // Simulate timeout for unknown commands
          setTimeout(() => {
            this.emit('message', {
              data: JSON.stringify({
                event: `${message.event}:error`,
                data: {
                  code: 'CAP_002',
                  message: 'Unknown command',
                  details: `Command ${message.event} not recognized`
                }
              })
            });
          }, 100);
      }
    }, 50); // Simulate network delay
  }

  static getInstances() {
    return MockWebSocket.instances;
  }

  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

// Mock the WebSocket globally
global.WebSocket = MockWebSocket as any;

describe('Camera API Integration Tests', () => {
  beforeAll(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  beforeEach(() => {
    MockWebSocket.clearInstances();
    vi.clearAllMocks();
  });

  afterEach(() => {
    MockWebSocket.getInstances().forEach(ws => ws.close());
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const result = await cameraApi.connect();
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        model: 'ARRI ALEXA Mini LF',
        serialNumber: 'ALF001234',
        firmwareVersion: '7.2.1'
      });
    });

    it('should handle connection timeout', async () => {
      // Override the mock to not respond
      const originalSimulate = MockWebSocket.prototype['simulateServerResponse'];
      MockWebSocket.prototype['simulateServerResponse'] = vi.fn();
      
      const result = await cameraApi.connect();
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      
      // Restore original method
      MockWebSocket.prototype['simulateServerResponse'] = originalSimulate;
    }, 15000);

    it('should disconnect properly', async () => {
      await cameraApi.connect();
      
      const result = await cameraApi.disconnect();
      
      expect(result.success).toBe(true);
    });
  });

  describe('Camera Control Commands', () => {
    beforeEach(async () => {
      // Ensure connection is established before each test
      await cameraApi.connect();
    });

    describe('Frame Rate Control', () => {
      it('should set valid frame rate', async () => {
        const result = await cameraApi.setFrameRate(24);
        
        expect(result.success).toBe(true);
        expect(result.data?.frameRate).toBe(24);
      });

      it('should reject invalid frame rate', async () => {
        const result = await cameraApi.setFrameRate(150);
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('CAP_003');
        expect(result.error).toContain('Invalid frame rate');
      });

      it('should handle frame rate boundaries', async () => {
        // Test minimum valid value
        const minResult = await cameraApi.setFrameRate(1);
        expect(minResult.success).toBe(true);
        
        // Test maximum valid value
        const maxResult = await cameraApi.setFrameRate(120);
        expect(maxResult.success).toBe(true);
        
        // Test below minimum
        const belowMinResult = await cameraApi.setFrameRate(0);
        expect(belowMinResult.success).toBe(false);
        
        // Test above maximum
        const aboveMaxResult = await cameraApi.setFrameRate(121);
        expect(aboveMaxResult.success).toBe(false);
      });
    });

    describe('White Balance Control', () => {
      it('should set valid white balance', async () => {
        const result = await cameraApi.setWhiteBalance(5600);
        
        expect(result.success).toBe(true);
        expect(result.data?.kelvin).toBe(5600);
      });

      it('should reject invalid white balance', async () => {
        const result = await cameraApi.setWhiteBalance(1500);
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('CAP_003');
        expect(result.error).toContain('Invalid white balance');
      });
    });

    describe('ISO Control', () => {
      it('should set valid ISO', async () => {
        const result = await cameraApi.setISO(800);
        
        expect(result.success).toBe(true);
        expect(result.data?.iso).toBe(800);
      });

      it('should reject invalid ISO', async () => {
        const result = await cameraApi.setISO(500);
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('CAP_003');
        expect(result.error).toContain('Invalid ISO value');
      });

      it('should handle all valid ISO values', async () => {
        const validISOs = [100, 200, 400, 800, 1600, 3200, 6400];
        
        for (const iso of validISOs) {
          const result = await cameraApi.setISO(iso);
          expect(result.success).toBe(true);
          expect(result.data?.iso).toBe(iso);
        }
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await cameraApi.connect();
    });

    it('should handle unknown commands', async () => {
      // Try to call a non-existent method
      const result = await (cameraApi as any).unknownCommand();
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('CAP_002');
      expect(result.error).toContain('Unknown command');
    });

    it('should handle command timeouts', async () => {
      // Mock a command that doesn't respond
      const originalSimulate = MockWebSocket.prototype['simulateServerResponse'];
      MockWebSocket.prototype['simulateServerResponse'] = vi.fn();
      
      const result = await cameraApi.setFrameRate(24);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
      
      // Restore original method
      MockWebSocket.prototype['simulateServerResponse'] = originalSimulate;
    }, 10000);
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await cameraApi.connect();
    });

    it('should handle multiple simultaneous commands', async () => {
      const promises = [
        cameraApi.setFrameRate(24),
        cameraApi.setWhiteBalance(5600),
        cameraApi.setISO(800)
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Custom Socket Client', () => {
    it('should work with custom socket client', async () => {
      const customApi = initializeCameraApi(new MockWebSocket('ws://custom:8080') as any);
      
      const result = await customApi.connect();
      
      expect(result.success).toBe(true);
      expect(result.data?.model).toBe('ARRI ALEXA Mini LF');
    });
  });
});