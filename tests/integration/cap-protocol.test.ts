/**
 * CAP Protocol Integration Tests
 * Tests for CAP protocol communication with mock camera
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client, type Socket } from 'socket.io-client';
import net from 'net';

// Mock CAP server for testing
class MockCAPServer {
  private server: net.Server;
  private clients: net.Socket[] = [];
  private port: number;
  private responses: Map<string, any> = new Map();

  constructor(port: number = 9999) {
    this.port = port;
    this.server = net.createServer();
    this.setupDefaultResponses();
  }

  private setupDefaultResponses() {
    // Mock camera responses
    this.responses.set('GET /camera/model', {
      status: 'OK',
      data: { model: 'ALEXA 35', serialNumber: 'A35-12345', firmwareVersion: '1.2.3' }
    });
    
    this.responses.set('GET /camera/frameRate', {
      status: 'OK',
      data: { frameRate: 24.0 }
    });
    
    this.responses.set('SET /camera/frameRate', {
      status: 'OK',
      data: { frameRate: 25.0 }
    });
    
    this.responses.set('GET /camera/whiteBalance', {
      status: 'OK',
      data: { kelvin: 5600, tint: 0 }
    });
    
    this.responses.set('SET /camera/whiteBalance', {
      status: 'OK',
      data: { kelvin: 3200, tint: 10 }
    });
    
    this.responses.set('GET /camera/iso', {
      status: 'OK',
      data: { iso: 800 }
    });
    
    this.responses.set('SET /camera/iso', {
      status: 'OK',
      data: { iso: 1600 }
    });
    
    this.responses.set('GET /playback/clips', {
      status: 'OK',
      data: {
        clips: [
          {
            id: 'clip-001',
            name: 'A001_C001_0101AB',
            duration: 120.5,
            frameRate: 24.0,
            resolution: '4096x2160',
            codec: 'ARRIRAW',
            timecode: '01:00:00:00'
          },
          {
            id: 'clip-002',
            name: 'A001_C002_0102CD',
            duration: 95.2,
            frameRate: 24.0,
            resolution: '4096x2160',
            codec: 'ARRIRAW',
            timecode: '01:02:00:12'
          }
        ]
      }
    });
    
    this.responses.set('SET /playback/play', {
      status: 'OK',
      data: { playing: true, clipId: 'clip-001' }
    });
    
    this.responses.set('GET /timecode/current', {
      status: 'OK',
      data: { timecode: '01:23:45:12', mode: 'free_run' }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.on('connection', (socket) => {
        this.clients.push(socket);
        
        socket.on('data', (data) => {
          const message = data.toString().trim();
          const response = this.processCommand(message);
          socket.write(JSON.stringify(response) + '\n');
        });
        
        socket.on('close', () => {
          const index = this.clients.indexOf(socket);
          if (index > -1) {
            this.clients.splice(index, 1);
          }
        });
      });
      
      this.server.listen(this.port, () => {
        resolve();
      });
      
      this.server.on('error', reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.clients.forEach(client => client.destroy());
      this.clients = [];
      
      this.server.close(() => {
        resolve();
      });
    });
  }

  private processCommand(command: string): any {
    try {
      const parsed = JSON.parse(command);
      const key = `${parsed.method} ${parsed.path}`;
      
      const response = this.responses.get(key);
      if (response) {
        return {
          id: parsed.id,
          ...response
        };
      }
      
      return {
        id: parsed.id,
        status: 'ERROR',
        error: 'Command not found',
        code: 'CAP_002'
      };
    } catch (error) {
      return {
        status: 'ERROR',
        error: 'Invalid JSON',
        code: 'CAP_001'
      };
    }
  }

  setResponse(command: string, response: any): void {
    this.responses.set(command, response);
  }

  simulateError(command: string, error: any): void {
    this.responses.set(command, {
      status: 'ERROR',
      error: error.message,
      code: error.code || 'CAP_000'
    });
  }
}

describe('CAP Protocol Integration Tests', () => {
  let mockCAPServer: MockCAPServer;
  let httpServer: any;
  let io: SocketIOServer;
  let clientSocket: Socket;
  let serverSocket: Socket;

  beforeAll(async () => {
    // Start mock CAP server
    mockCAPServer = new MockCAPServer(9999);
    await mockCAPServer.start();

    // Start WebSocket server
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(3001, resolve);
    });

    // Set up WebSocket connection
    io.on('connection', (socket) => {
      serverSocket = socket;
    });
  });

  afterAll(async () => {
    await mockCAPServer.stop();
    io.close();
    httpServer.close();
  });

  beforeEach(async () => {
    clientSocket = Client('http://localhost:3001');
    
    await new Promise<void>((resolve) => {
      clientSocket.on('connect', resolve);
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Camera Connection', () => {
    it('should establish connection to camera', async () => {
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });

      const response = await connectionPromise;
      expect(response).toMatchObject({
        model: 'ALEXA 35',
        serialNumber: 'A35-12345',
        firmwareVersion: '1.2.3'
      });
    });

    it('should handle connection failures', async () => {
      const errorPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:error', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '192.168.1.999', port: 9999 });

      const error = await errorPromise;
      expect(error).toHaveProperty('message');
      expect(error).toHaveProperty('code');
    });

    it('should disconnect from camera', async () => {
      // First connect
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;

      // Then disconnect
      const disconnectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:disconnect:success', resolve);
      });

      clientSocket.emit('camera:disconnect');

      const response = await disconnectionPromise;
      expect(response).toHaveProperty('success', true);
    });
  });

  describe('Camera Settings Control', () => {
    beforeEach(async () => {
      // Establish connection before each test
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
    });

    it('should get current frame rate', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:current', resolve);
      });

      clientSocket.emit('camera:frameRate:get');

      const response = await responsePromise;
      expect(response).toMatchObject({
        frameRate: 24.0
      });
    });

    it('should set frame rate', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:success', resolve);
      });

      clientSocket.emit('camera:frameRate:set', { frameRate: 25.0 });

      const response = await responsePromise;
      expect(response).toMatchObject({
        frameRate: 25.0
      });
    });

    it('should handle invalid frame rate', async () => {
      mockCAPServer.simulateError('SET /camera/frameRate', {
        message: 'Invalid frame rate',
        code: 'CAP_007'
      });

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:error', resolve);
      });

      clientSocket.emit('camera:frameRate:set', { frameRate: 999 });

      const error = await errorPromise;
      expect(error).toMatchObject({
        message: 'Invalid frame rate',
        code: 'CAP_007'
      });
    });

    it('should set white balance', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:whiteBalance:success', resolve);
      });

      clientSocket.emit('camera:whiteBalance:set', { kelvin: 3200, tint: 10 });

      const response = await responsePromise;
      expect(response).toMatchObject({
        kelvin: 3200,
        tint: 10
      });
    });

    it('should set ISO', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:iso:success', resolve);
      });

      clientSocket.emit('camera:iso:set', { iso: 1600 });

      const response = await responsePromise;
      expect(response).toMatchObject({
        iso: 1600
      });
    });
  });

  describe('Playback Control', () => {
    beforeEach(async () => {
      // Establish connection before each test
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
    });

    it('should get clip list', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('playback:clipList:success', resolve);
      });

      clientSocket.emit('playback:clipList:get');

      const response = await responsePromise;
      expect(response).toHaveProperty('clips');
      expect(response.clips).toHaveLength(2);
      expect(response.clips[0]).toMatchObject({
        id: 'clip-001',
        name: 'A001_C001_0101AB',
        duration: 120.5,
        frameRate: 24.0,
        resolution: '4096x2160',
        codec: 'ARRIRAW',
        timecode: '01:00:00:00'
      });
    });

    it('should start playback', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('playback:start:success', resolve);
      });

      clientSocket.emit('playback:start', { clipId: 'clip-001' });

      const response = await responsePromise;
      expect(response).toMatchObject({
        playing: true,
        clipId: 'clip-001'
      });
    });

    it('should handle playback errors', async () => {
      mockCAPServer.simulateError('SET /playback/play', {
        message: 'Clip not found',
        code: 'CAP_004'
      });

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('playback:start:error', resolve);
      });

      clientSocket.emit('playback:start', { clipId: 'invalid-clip' });

      const error = await errorPromise;
      expect(error).toMatchObject({
        message: 'Clip not found',
        code: 'CAP_004'
      });
    });
  });

  describe('Timecode Management', () => {
    beforeEach(async () => {
      // Establish connection before each test
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
    });

    it('should get current timecode', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('timecode:current', resolve);
      });

      clientSocket.emit('timecode:get');

      const response = await responsePromise;
      expect(response).toMatchObject({
        timecode: '01:23:45:12',
        mode: 'free_run'
      });
    });

    it('should set timecode', async () => {
      mockCAPServer.setResponse('SET /timecode/set', {
        status: 'OK',
        data: { timecode: '02:00:00:00', mode: 'free_run' }
      });

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('timecode:set:success', resolve);
      });

      clientSocket.emit('timecode:set', { timecode: '02:00:00:00' });

      const response = await responsePromise;
      expect(response).toMatchObject({
        timecode: '02:00:00:00',
        mode: 'free_run'
      });
    });

    it('should sync timecode to time of day', async () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const expectedTimecode = `${hours}:${minutes}:${seconds}:00`;

      mockCAPServer.setResponse('SET /timecode/syncToTimeOfDay', {
        status: 'OK',
        data: { timecode: expectedTimecode, mode: 'free_run' }
      });

      const responsePromise = new Promise((resolve) => {
        clientSocket.on('timecode:syncToTimeOfDay:success', resolve);
      });

      clientSocket.emit('timecode:syncToTimeOfDay');

      const response = await responsePromise;
      expect(response).toHaveProperty('timecode');
      expect(response.timecode).toMatch(/^\d{2}:\d{2}:\d{2}:\d{2}$/);
    });
  });

  describe('Real-time Updates', () => {
    beforeEach(async () => {
      // Establish connection before each test
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
    });

    it('should receive real-time timecode updates', async () => {
      const updates: any[] = [];
      
      clientSocket.on('timecode:changed', (data) => {
        updates.push(data);
      });

      // Simulate timecode updates from camera
      const simulateTimecodeUpdates = () => {
        let frame = 0;
        const interval = setInterval(() => {
          if (frame >= 5) {
            clearInterval(interval);
            return;
          }
          
          serverSocket.emit('timecode:changed', {
            timecode: `01:23:45:${frame.toString().padStart(2, '0')}`,
            mode: 'free_run'
          });
          
          frame++;
        }, 100);
      };

      simulateTimecodeUpdates();

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(updates).toHaveLength(5);
      expect(updates[0]).toMatchObject({
        timecode: '01:23:45:00',
        mode: 'free_run'
      });
      expect(updates[4]).toMatchObject({
        timecode: '01:23:45:04',
        mode: 'free_run'
      });
    });

    it('should receive camera state changes', async () => {
      const stateChanges: any[] = [];
      
      clientSocket.on('camera:frameRate:changed', (data) => {
        stateChanges.push({ type: 'frameRate', data });
      });
      
      clientSocket.on('camera:iso:changed', (data) => {
        stateChanges.push({ type: 'iso', data });
      });

      // Simulate camera state changes
      serverSocket.emit('camera:frameRate:changed', { frameRate: 30.0 });
      serverSocket.emit('camera:iso:changed', { iso: 3200 });

      // Wait for updates
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(stateChanges).toHaveLength(2);
      expect(stateChanges[0]).toMatchObject({
        type: 'frameRate',
        data: { frameRate: 30.0 }
      });
      expect(stateChanges[1]).toMatchObject({
        type: 'iso',
        data: { iso: 3200 }
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle connection timeout', async () => {
      const errorPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:error', resolve);
      });

      // Try to connect to non-existent server
      clientSocket.emit('camera:connect', { ip: '192.168.1.999', port: 8888 });

      const error = await errorPromise;
      expect(error).toHaveProperty('message');
      expect(error.message).toContain('timeout');
    });

    it('should handle protocol errors gracefully', async () => {
      // First establish connection
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;

      // Simulate protocol error
      mockCAPServer.simulateError('SET /camera/frameRate', {
        message: 'Camera busy',
        code: 'CAP_004'
      });

      const errorPromise = new Promise((resolve) => {
        clientSocket.on('camera:frameRate:error', resolve);
      });

      clientSocket.emit('camera:frameRate:set', { frameRate: 24 });

      const error = await errorPromise;
      expect(error).toMatchObject({
        message: 'Camera busy',
        code: 'CAP_004'
      });
    });

    it('should attempt reconnection on connection loss', async () => {
      // First establish connection
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;

      // Simulate connection loss
      const disconnectPromise = new Promise((resolve) => {
        clientSocket.on('camera:connection:lost', resolve);
      });

      // Stop the mock server to simulate connection loss
      await mockCAPServer.stop();

      // Emit an event that would trigger reconnection detection
      serverSocket.emit('camera:connection:lost', {
        reason: 'Connection lost',
        timestamp: Date.now()
      });

      const disconnectEvent = await disconnectPromise;
      expect(disconnectEvent).toHaveProperty('reason', 'Connection lost');

      // Restart server for cleanup
      mockCAPServer = new MockCAPServer(9999);
      await mockCAPServer.start();
    });
  });

  describe('Performance and Load Testing', () => {
    beforeEach(async () => {
      // Establish connection before each test
      const connectionPromise = new Promise((resolve) => {
        clientSocket.on('camera:connect:success', resolve);
      });

      clientSocket.emit('camera:connect', { ip: '127.0.0.1', port: 9999 });
      await connectionPromise;
    });

    it('should handle rapid command sequences', async () => {
      const responses: any[] = [];
      const commandCount = 10;

      clientSocket.on('camera:frameRate:success', (data) => {
        responses.push(data);
      });

      // Send rapid sequence of commands
      const startTime = Date.now();
      for (let i = 0; i < commandCount; i++) {
        clientSocket.emit('camera:frameRate:set', { frameRate: 24 + i });
      }

      // Wait for all responses
      await new Promise(resolve => {
        const checkResponses = () => {
          if (responses.length >= commandCount) {
            resolve(undefined);
          } else {
            setTimeout(checkResponses, 10);
          }
        };
        checkResponses();
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(responses).toHaveLength(commandCount);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should maintain responsiveness under load', async () => {
      const responsePromise = new Promise((resolve) => {
        clientSocket.on('camera:iso:success', resolve);
      });

      // Send a command that should be processed quickly
      const startTime = Date.now();
      clientSocket.emit('camera:iso:set', { iso: 800 });

      const response = await responsePromise;
      const responseTime = Date.now() - startTime;

      expect(response).toMatchObject({ iso: 800 });
      expect(responseTime).toBeLessThan(100); // Should respond within 100ms
    });
  });
});