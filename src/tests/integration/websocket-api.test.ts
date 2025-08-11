/**
 * WebSocket API Integration Tests
 * Standalone integration tests for WebSocket communication
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';

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
                  message: 'Invalid frame rate'
                }
              })
            });
          }
          break;

        case 'camera:whiteBalance:set':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:whiteBalance:success',
              data: { kelvin: message.data.kelvin }
            })
          });
          break;

        case 'camera:iso:set':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:iso:success',
              data: { iso: message.data.iso }
            })
          });
          break;

        default:
          this.emit('message', {
            data: JSON.stringify({
              event: `${message.event}:error`,
              data: {
                code: 'CAP_002',
                message: 'Unknown command'
              }
            })
          });
      }
    }, 50);
  }

  static getInstances() {
    return MockWebSocket.instances;
  }

  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

// Simple WebSocket API client for testing
class WebSocketAPIClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Map<string, Function[]> = new Map();

  async connect(url: string): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Connection timeout' });
      }, 5000);

      this.ws.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve({ success: true });
      });

      this.ws.addEventListener('error', (error) => {
        clearTimeout(timeout);
        resolve({ success: false, error: 'Connection failed' });
      });

      this.ws.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          const handlers = this.messageHandlers.get(message.event) || [];
          handlers.forEach(handler => handler(message));
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, handler: Function) {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);
  }

  async sendCommand(event: string, data: any): Promise<{ success: boolean; data?: any; error?: string; code?: string }> {
    return new Promise((resolve) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      const timeout = setTimeout(() => {
        resolve({ success: false, error: 'Command timeout' });
      }, 5000);

      const successHandler = (message: any) => {
        clearTimeout(timeout);
        this.messageHandlers.get(`${event}:success`)?.splice(
          this.messageHandlers.get(`${event}:success`)!.indexOf(successHandler), 1
        );
        this.messageHandlers.get(`${event}:error`)?.splice(
          this.messageHandlers.get(`${event}:error`)!.indexOf(errorHandler), 1
        );
        resolve({ success: true, data: message.data });
      };

      const errorHandler = (message: any) => {
        clearTimeout(timeout);
        this.messageHandlers.get(`${event}:success`)?.splice(
          this.messageHandlers.get(`${event}:success`)!.indexOf(successHandler), 1
        );
        this.messageHandlers.get(`${event}:error`)?.splice(
          this.messageHandlers.get(`${event}:error`)!.indexOf(errorHandler), 1
        );
        resolve({ 
          success: false, 
          error: message.data.message,
          code: message.data.code
        });
      };

      this.on(`${event}:success`, successHandler);
      this.on(`${event}:error`, errorHandler);

      this.ws.send(JSON.stringify({ event, data }));
    });
  }
}

// Mock the global WebSocket
global.WebSocket = MockWebSocket as any;

describe('WebSocket API Integration Tests', () => {
  let client: WebSocketAPIClient;

  beforeAll(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  beforeEach(() => {
    MockWebSocket.clearInstances();
    client = new WebSocketAPIClient();
    vi.clearAllMocks();
  });

  afterEach(() => {
    client.disconnect();
    MockWebSocket.getInstances().forEach(ws => ws.close());
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const result = await client.connect('ws://localhost:3001');
      
      expect(result.success).toBe(true);
    });

    it('should handle connection failure', async () => {
      // Mock connection failure
      const originalConstructor = global.WebSocket;
      global.WebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.emit('error', new Error('Connection failed'));
          }, 10);
        }
      } as any;
      
      const result = await client.connect('ws://localhost:3001');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      
      // Restore original WebSocket
      global.WebSocket = originalConstructor;
    });
  });

  describe('Camera Connection Commands', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:3001');
    });

    it('should handle camera connect command', async () => {
      const result = await client.sendCommand('camera:connect', { ip: '192.168.1.100' });
      
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        model: 'ARRI ALEXA Mini LF',
        serialNumber: 'ALF001234',
        firmwareVersion: '7.2.1'
      });
    });
  });

  describe('Camera Control Commands', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:3001');
      // Establish camera connection first
      await client.sendCommand('camera:connect', { ip: '192.168.1.100' });
    });

    describe('Frame Rate Control', () => {
      it('should set valid frame rate', async () => {
        const result = await client.sendCommand('camera:frameRate:set', { frameRate: 24 });
        
        expect(result.success).toBe(true);
        expect(result.data?.frameRate).toBe(24);
      });

      it('should reject invalid frame rate', async () => {
        const result = await client.sendCommand('camera:frameRate:set', { frameRate: 150 });
        
        expect(result.success).toBe(false);
        expect(result.code).toBe('CAP_003');
        expect(result.error).toBe('Invalid frame rate');
      });

      it('should handle frame rate boundaries', async () => {
        // Test minimum valid value
        const minResult = await client.sendCommand('camera:frameRate:set', { frameRate: 1 });
        expect(minResult.success).toBe(true);
        
        // Test maximum valid value
        const maxResult = await client.sendCommand('camera:frameRate:set', { frameRate: 120 });
        expect(maxResult.success).toBe(true);
        
        // Test below minimum
        const belowMinResult = await client.sendCommand('camera:frameRate:set', { frameRate: 0 });
        expect(belowMinResult.success).toBe(false);
        
        // Test above maximum
        const aboveMaxResult = await client.sendCommand('camera:frameRate:set', { frameRate: 121 });
        expect(aboveMaxResult.success).toBe(false);
      });
    });

    describe('White Balance Control', () => {
      it('should set white balance', async () => {
        const result = await client.sendCommand('camera:whiteBalance:set', { kelvin: 5600 });
        
        expect(result.success).toBe(true);
        expect(result.data?.kelvin).toBe(5600);
      });
    });

    describe('ISO Control', () => {
      it('should set ISO', async () => {
        const result = await client.sendCommand('camera:iso:set', { iso: 800 });
        
        expect(result.success).toBe(true);
        expect(result.data?.iso).toBe(800);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:3001');
    });

    it('should handle unknown commands', async () => {
      const result = await client.sendCommand('unknown:command', {});
      
      expect(result.success).toBe(false);
      expect(result.code).toBe('CAP_002');
      expect(result.error).toBe('Unknown command');
    });

    it('should handle command timeouts', async () => {
      // Mock a command that doesn't respond
      const originalSimulate = MockWebSocket.prototype['simulateServerResponse'];
      MockWebSocket.prototype['simulateServerResponse'] = vi.fn();
      
      const result = await client.sendCommand('camera:frameRate:set', { frameRate: 24 });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Command timeout');
      
      // Restore original method
      MockWebSocket.prototype['simulateServerResponse'] = originalSimulate;
    }, 10000);
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:3001');
      await client.sendCommand('camera:connect', { ip: '192.168.1.100' });
    });

    it('should handle multiple simultaneous commands', async () => {
      const promises = [
        client.sendCommand('camera:frameRate:set', { frameRate: 24 }),
        client.sendCommand('camera:whiteBalance:set', { kelvin: 5600 }),
        client.sendCommand('camera:iso:set', { iso: 800 })
      ];
      
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should queue commands properly', async () => {
      // Send multiple commands in sequence
      const result1 = await client.sendCommand('camera:frameRate:set', { frameRate: 24 });
      const result2 = await client.sendCommand('camera:frameRate:set', { frameRate: 25 });
      const result3 = await client.sendCommand('camera:frameRate:set', { frameRate: 30 });
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);
      
      expect(result1.data?.frameRate).toBe(24);
      expect(result2.data?.frameRate).toBe(25);
      expect(result3.data?.frameRate).toBe(30);
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await client.connect('ws://localhost:3001');
      await client.sendCommand('camera:connect', { ip: '192.168.1.100' });
    });

    it('should handle rapid command sequences', async () => {
      const startTime = Date.now();
      const commands = [];
      
      // Send 10 rapid commands
      for (let i = 0; i < 10; i++) {
        commands.push(client.sendCommand('camera:frameRate:set', { frameRate: 24 + i }));
      }
      
      const results = await Promise.all(commands);
      const endTime = Date.now();
      
      // All commands should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
      
      // Should complete within reasonable time (less than 2 seconds)
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });
});