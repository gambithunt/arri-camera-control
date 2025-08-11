/**
 * WebSocket Communication Integration Tests
 * Tests for real-time communication between frontend and backend
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, type Socket } from 'socket.io-client';
import { setupWebSocketHandlers } from '../../backend/src/websocket/websocketManager';

describe('WebSocket Communication Integration Tests', () => {
  let httpServer: any;
  let io: SocketIOServer;
  let clientSocket: Socket;
  let serverSocket: Socket;
  let port: number;

  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Create Socket.IO server
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Set up WebSocket handlers
    setupWebSocketHandlers(io);

    // Start server
    port = 3002;
    await new Promise<void>((resolve) => {
      httpServer.listen(port, resolve);
    });

    // Set up connection handler
    io.on('connection', (socket) => {
      serverSocket = socket;
    });
  });

  afterAll(async () => {
    io.close();
    httpServer.close();
  });

  beforeEach(async () => {
    clientSocket = Client(`http://localhost:${port}`);
    
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      expect(clientSocket.connected).toBe(true);
      expect(serverSocket).toBeDefined();
    });

    it('should handle connection events', async () => {
      const connectionEvents: string[] = [];
      
      clientSocket.on('connect', () => connectionEvents.push('connect'));
      clientSocket.on('disconnect', () => connectionEvents.push('disconnect'));
      
      // Disconnect and reconnect
      clientSocket.disconnect();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      clientSocket.connect();
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });
      
      expect(connectionEvents).toContain('disconnect');
      expect(connectionEvents).toContain('connect');
    });

    it('should handle multiple concurrent connections', async () => {
      const clients: Socket[] = [];
      const connectionPromises: Promise<void>[] = [];
      
      // Create multiple clients
      for (let i = 0; i < 5; i++) {
        const client = Client(`http://localhost:${port}`);
        clients.push(client);
        
        connectionPromises.push(new Promise<void>((resolve) => {
          client.on('connect', resolve);
        }));
      }
      
      // Wait for all connections
      await Promise.all(connectionPromises);
      
      // All clients should be connected
      clients.forEach(client => {
        expect(client.connected).toBe(true);
      });
      
      // Cleanup
      clients.forEach(client => client.disconnect());
    });
  });

  describe('Camera Control Messages', () => {
    it('should handle camera connection requests', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });
      
      clientSocket.emit('camera:connect', { 
        ip: '127.0.0.1', 
        port: 9999 
      });
      
      const response = await responsePromise;
      expect(response).toHaveProperty('model');
      expect(response).toHaveProperty('serialNumber');
    });

    it('should handle frame rate changes', async () => {
      // First connect to camera
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });
      
      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
      
      // Then change frame rate
      const frameRatePromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:success', resolve);
      });
      
      clientSocket.emit('camera:frameRate:set', { frameRate: 25.0 });
      
      const response = await frameRatePromise;
      expect(response).toMatchObject({ frameRate: 25.0 });
    });

    it('should broadcast state changes to all clients', async () => {
      // Create second client
      const client2 = Client(`http://localhost:${port}`);
      await new Promise<void>((resolve) => {
        client2.on('connect', resolve);
      });
      
      // Both clients listen for frame rate changes
      const client1Updates: any[] = [];
      const client2Updates: any[] = [];
      
      clientSocket.on('camera:frameRate:changed', (data) => {
        client1Updates.push(data);
      });
      
      client2.on('camera:frameRate:changed', (data) => {
        client2Updates.push(data);
      });
      
      // Connect both clients to camera
      await Promise.all([
        new Promise((resolve) => {
          clientSocket.on('camera:connect:success', resolve);
          clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
        }),
        new Promise((resolve) => {
          client2.on('camera:connect:success', resolve);
          client2.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
        })
      ]);
      
      // Change frame rate from client 1
      clientSocket.emit('camera:frameRate:set', { frameRate: 30.0 });
      
      // Wait for broadcasts
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Both clients should receive the update
      expect(client1Updates).toHaveLength(1);
      expect(client2Updates).toHaveLength(1);
      expect(client1Updates[0]).toMatchObject({ frameRate: 30.0 });
      expect(client2Updates[0]).toMatchObject({ frameRate: 30.0 });
      
      client2.disconnect();
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      // Connect to camera before each test
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });
      
      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
    });

    it('should receive real-time timecode updates', async () => {
      const timecodeUpdates: any[] = [];
      
      clientSocket.on('timecode:changed', (data) => {
        timecodeUpdates.push(data);
      });
      
      // Simulate timecode updates from server
      const simulateUpdates = () => {
        let frame = 0;
        const interval = setInterval(() => {
          if (frame >= 10) {
            clearInterval(interval);
            return;
          }
          
          serverSocket.emit('timecode:changed', {
            timecode: `01:23:45:${frame.toString().padStart(2, '0')}`,
            mode: 'free_run'
          });
          
          frame++;
        }, 50);
      };
      
      simulateUpdates();
      
      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(timecodeUpdates).toHaveLength(10);
      expect(timecodeUpdates[0].timecode).toBe('01:23:45:00');
      expect(timecodeUpdates[9].timecode).toBe('01:23:45:09');
    });

    it('should handle high-frequency updates efficiently', async () => {
      const updates: any[] = [];
      const startTime = Date.now();
      
      clientSocket.on('camera:frameRate:changed', (data) => {
        updates.push({ ...data, timestamp: Date.now() });
      });
      
      // Send rapid updates
      for (let i = 0; i < 100; i++) {
        serverSocket.emit('camera:frameRate:changed', {
          frameRate: 24.0 + (i * 0.1)
        });
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Should receive all updates
      expect(updates).toHaveLength(100);
      
      // Should process efficiently
      expect(totalTime).toBeLessThan(1000);
      
      // Updates should be in order
      for (let i = 1; i < updates.length; i++) {
        expect(updates[i].timestamp).toBeGreaterThanOrEqual(updates[i-1].timestamp);
      }
    });

    it('should throttle rapid color grading updates', async () => {
      const cdlUpdates: any[] = [];
      
      clientSocket.on('grading:cdl:changed', (data) => {
        cdlUpdates.push(data);
      });
      
      // Send rapid CDL updates (simulating color wheel adjustments)
      for (let i = 0; i < 50; i++) {
        clientSocket.emit('grading:setCDL', {
          shadows: {
            lift: { r: i * 0.01, g: 0, b: 0 },
            gamma: { r: 1, g: 1, b: 1 },
            gain: { r: 1, g: 1, b: 1 }
          },
          midtones: {
            lift: { r: 0, g: 0, b: 0 },
            gamma: { r: 1, g: 1, b: 1 },
            gain: { r: 1, g: 1, b: 1 }
          },
          highlights: {
            lift: { r: 0, g: 0, b: 0 },
            gamma: { r: 1, g: 1, b: 1 },
            gain: { r: 1, g: 1, b: 1 }
          }
        });
      }
      
      // Wait for throttled updates
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should receive fewer updates due to throttling
      expect(cdlUpdates.length).toBeLessThan(50);
      expect(cdlUpdates.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid message formats', async () => {
      const errorEvents: any[] = [];
      
      clientSocket.on('error', (error) => {
        errorEvents.push(error);
      });
      
      // Send invalid message
      clientSocket.emit('invalid:event', { invalid: 'data' });
      
      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Should handle gracefully without crashing
      expect(clientSocket.connected).toBe(true);
    });

    it('should handle connection timeouts', async () => {
      const timeoutPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:error', resolve);
      });
      
      // Try to connect to non-existent camera
      clientSocket.emit('camera:connect', { 
        ip: '192.168.1.999', 
        port: 9999,
        timeout: 1000
      });
      
      const error = await timeoutPromise;
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('timeout');
    });

    it('should recover from temporary disconnections', async () => {
      const reconnectionEvents: string[] = [];
      
      clientSocket.on('disconnect', () => {
        reconnectionEvents.push('disconnect');
      });
      
      clientSocket.on('connect', () => {
        reconnectionEvents.push('connect');
      });
      
      // Simulate server restart
      io.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Restart server
      io = new SocketIOServer(httpServer, {
        cors: {
          origin: "*",
          methods: ["GET", "POST"]
        }
      });
      
      setupWebSocketHandlers(io);
      
      // Client should reconnect
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(reconnectionEvents).toContain('disconnect');
    });
  });

  describe('Message Ordering and Reliability', () => {
    it('should maintain message order', async () => {
      const receivedMessages: any[] = [];
      
      clientSocket.on('test:sequence', (data) => {
        receivedMessages.push(data);
      });
      
      // Send sequence of messages
      for (let i = 0; i < 20; i++) {
        serverSocket.emit('test:sequence', { sequence: i });
      }
      
      // Wait for all messages
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Messages should be in order
      expect(receivedMessages).toHaveLength(20);
      for (let i = 0; i < 20; i++) {
        expect(receivedMessages[i].sequence).toBe(i);
      }
    });

    it('should handle message acknowledgments', async () => {
      const ackPromise = new Promise((resolve) => {
        clientSocket.emit('camera:frameRate:set', 
          { frameRate: 25.0 }, 
          (response: any) => {
            resolve(response);
          }
        );
      });
      
      const ackResponse = await ackPromise;
      expect(ackResponse).toHaveProperty('success');
    });

    it('should queue messages during disconnection', async () => {
      const queuedMessages: any[] = [];
      
      // Disconnect client
      clientSocket.disconnect();
      
      // Try to send messages while disconnected
      for (let i = 0; i < 5; i++) {
        clientSocket.emit('camera:frameRate:set', { frameRate: 24 + i });
      }
      
      // Reconnect
      clientSocket.connect();
      await new Promise<void>((resolve) => {
        clientSocket.on('connect', resolve);
      });
      
      // Listen for responses
      clientSocket.on('camera:frameRate:success', (data) => {
        queuedMessages.push(data);
      });
      
      // Wait for queued messages to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should process queued messages after reconnection
      expect(queuedMessages.length).toBeGreaterThan(0);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent operations efficiently', async () => {
      const operations = [
        () => clientSocket.emit('camera:frameRate:set', { frameRate: 25.0 }),
        () => clientSocket.emit('camera:whiteBalance:set', { kelvin: 3200, tint: 10 }),
        () => clientSocket.emit('camera:iso:set', { iso: 1600 }),
        () => clientSocket.emit('camera:ndFilter:set', { ndStop: 2.0 }),
        () => clientSocket.emit('timecode:set', { timecode: '01:00:00:00' })
      ];
      
      const responses: any[] = [];
      const responsePromises: Promise<void>[] = [];
      
      // Set up response listeners
      const events = [
        'camera:frameRate:success',
        'camera:whiteBalance:success',
        'camera:iso:success',
        'camera:ndFilter:success',
        'timecode:set:success'
      ];
      
      events.forEach(event => {
        responsePromises.push(new Promise<void>((resolve) => {
          clientSocket.on(event, (data) => {
            responses.push({ event, data });
            resolve();
          });
        }));
      });
      
      // Connect to camera first
      await new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
        clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      });
      
      // Execute all operations concurrently
      const startTime = Date.now();
      operations.forEach(op => op());
      
      // Wait for all responses
      await Promise.all(responsePromises);
      const endTime = Date.now();
      
      // Should complete efficiently
      expect(endTime - startTime).toBeLessThan(2000);
      expect(responses).toHaveLength(5);
    });

    it('should maintain performance with many clients', async () => {
      const clientCount = 10;
      const clients: Socket[] = [];
      const connectionPromises: Promise<void>[] = [];
      
      // Create multiple clients
      for (let i = 0; i < clientCount; i++) {
        const client = Client(`http://localhost:${port}`);
        clients.push(client);
        
        connectionPromises.push(new Promise<void>((resolve) => {
          client.on('connect', resolve);
        }));
      }
      
      // Wait for all connections
      await Promise.all(connectionPromises);
      
      // All clients send messages simultaneously
      const startTime = Date.now();
      const messagePromises: Promise<void>[] = [];
      
      clients.forEach((client, index) => {
        messagePromises.push(new Promise<void>((resolve) => {
          client.on('test:response', resolve);
          client.emit('test:message', { clientId: index });
        }));
      });
      
      // Simulate server broadcasting to all clients
      clients.forEach((_, index) => {
        serverSocket.emit('test:response', { clientId: index });
      });
      
      await Promise.all(messagePromises);
      const endTime = Date.now();
      
      // Should handle multiple clients efficiently
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Cleanup
      clients.forEach(client => client.disconnect());
    });
  });

  describe('Data Validation and Security', () => {
    it('should validate message data', async () => {
      const errorPromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:error', resolve);
      });
      
      // Connect to camera first
      await new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
        clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      });
      
      // Send invalid frame rate
      clientSocket.emit('camera:frameRate:set', { frameRate: 'invalid' });
      
      const error = await errorPromise;
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('validation');
    });

    it('should sanitize input data', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:success', resolve);
      });
      
      // Connect to camera first
      await new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
        clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      });
      
      // Send data with potential XSS
      clientSocket.emit('camera:frameRate:set', { 
        frameRate: 25.0,
        maliciousField: '<script>alert("xss")</script>'
      });
      
      const response = await responsePromise;
      
      // Should only contain expected fields
      expect(response).toHaveProperty('frameRate', 25.0);
      expect(response).not.toHaveProperty('maliciousField');
    });

    it('should rate limit rapid requests', async () => {
      const responses: any[] = [];
      const errors: any[] = [];
      
      clientSocket.on('camera:frameRate:success', (data) => {
        responses.push(data);
      });
      
      clientSocket.on('camera:frameRate:error', (error) => {
        errors.push(error);
      });
      
      // Connect to camera first
      await new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
        clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      });
      
      // Send many rapid requests
      for (let i = 0; i < 100; i++) {
        clientSocket.emit('camera:frameRate:set', { frameRate: 24 + (i % 10) });
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Should have rate limiting in effect
      expect(responses.length + errors.length).toBeLessThan(100);
      
      // Some requests should be rate limited
      const rateLimitErrors = errors.filter(e => 
        e.message && e.message.includes('rate limit')
      );
      expect(rateLimitErrors.length).toBeGreaterThan(0);
    });
  });
});