/**
 * Unit tests for ARRI Camera Control Server
 */

const request = require('supertest');
const { ArriCameraControlServer } = require('../server.js');
const { io: Client } = require('socket.io-client');

// Mock the CAP connection manager
jest.mock('../cap/connectionManager.js', () => ({
  CAPConnectionManager: jest.fn().mockImplementation(() => ({
    getStatus: jest.fn().mockReturnValue({
      state: 'disconnected',
      connected: false,
      authenticated: false,
      reconnectAttempts: 0,
      maxReconnectAttempts: 5,
      lastError: null,
      metrics: {
        connectTime: null,
        disconnectTime: null,
        totalConnections: 0,
        totalDisconnections: 0,
        totalErrors: 0,
        uptime: 0
      }
    }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(false),
    isAuthenticated: jest.fn().mockReturnValue(false),
    on: jest.fn(),
    emit: jest.fn()
  }))
}));

// Mock the WebSocket manager
jest.mock('../websocket/websocketManager.js', () => ({
  WebSocketManager: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(),
    cleanup: jest.fn().mockResolvedValue(),
    getConnectionCount: jest.fn().mockReturnValue(0),
    handleConnection: jest.fn()
  }))
}));

describe('ArriCameraControlServer', () => {
  let server;
  let app;

  beforeEach(() => {
    server = new ArriCameraControlServer();
    app = server.getApp();
  });

  afterEach(async () => {
    if (server.server && server.server.listening) {
      await new Promise((resolve) => {
        server.server.close(resolve);
      });
    }
  });

  describe('HTTP Endpoints', () => {
    describe('GET /health', () => {
      it('should return health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body).toMatchObject({
          status: 'ok',
          timestamp: expect.any(String),
          uptime: expect.any(Number),
          memory: expect.any(Object),
          connections: expect.any(Object)
        });
      });

      it('should include connection information', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body.connections).toHaveProperty('websocket');
        expect(response.body.connections).toHaveProperty('cap');
      });
    });

    describe('GET /api/info', () => {
      it('should return API information', async () => {
        const response = await request(app)
          .get('/api/info')
          .expect(200);

        expect(response.body).toMatchObject({
          name: 'ARRI Camera Control API',
          version: '1.0.0',
          description: expect.any(String),
          endpoints: expect.any(Object)
        });
      });
    });

    describe('GET /api/camera/status', () => {
      it('should return camera status', async () => {
        const response = await request(app)
          .get('/api/camera/status')
          .expect(200);

        expect(response.body).toMatchObject({
          state: 'disconnected',
          connected: false,
          authenticated: false,
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          lastError: null,
          metrics: expect.any(Object)
        });
      });
    });

    describe('404 Handler', () => {
      it('should return 404 for unknown routes', async () => {
        const response = await request(app)
          .get('/unknown-route')
          .expect(404);

        expect(response.body).toMatchObject({
          error: 'Not Found',
          message: expect.stringContaining('/unknown-route'),
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should handle preflight requests', async () => {
      await request(app)
        .options('/api/info')
        .expect(204);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(response.headers).toHaveProperty('x-frame-options', 'DENY');
      expect(response.headers).toHaveProperty('x-xss-protection', '1; mode=block');
    });
  });

  describe('Error Handling', () => {
    it('should handle server errors gracefully', async () => {
      // Mock an error in the health endpoint
      const originalGetStatus = server.capManager.getStatus;
      server.capManager.getStatus = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await request(app)
        .get('/health')
        .expect(500);

      expect(response.body).toMatchObject({
        error: 'Internal Server Error',
        timestamp: expect.any(String)
      });

      // Restore original method
      server.capManager.getStatus = originalGetStatus;
    });
  });

  describe('Server Lifecycle', () => {
    it('should start server successfully', async () => {
      const mockListen = jest.fn((port, callback) => {
        callback();
      });
      server.server.listen = mockListen;

      await server.start();

      expect(mockListen).toHaveBeenCalledWith(
        expect.any(Number),
        expect.any(Function)
      );
    });

    it('should handle startup errors', async () => {
      const mockListen = jest.fn((port, callback) => {
        throw new Error('Port already in use');
      });
      server.server.listen = mockListen;

      // Mock process.exit to prevent test from actually exiting
      const originalExit = process.exit;
      process.exit = jest.fn();

      await server.start();

      expect(process.exit).toHaveBeenCalledWith(1);

      // Restore original process.exit
      process.exit = originalExit;
    });
  });
});

describe('Socket.io Integration', () => {
  let server;
  let clientSocket;
  let serverSocket;

  beforeAll((done) => {
    server = new ArriCameraControlServer();
    server.server.listen(() => {
      const port = server.server.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      
      server.getIO().on('connection', (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    server.getIO().close();
    clientSocket.close();
    server.server.close();
  });

  it('should connect successfully', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('should receive connection acknowledgment', (done) => {
    clientSocket.on('connected', (data) => {
      expect(data).toMatchObject({
        clientId: expect.any(String),
        serverTime: expect.any(String),
        capabilities: expect.any(Object)
      });
      done();
    });
  });

  it('should handle ping/pong', (done) => {
    clientSocket.emit('ping');
    clientSocket.on('pong', (data) => {
      expect(data).toHaveProperty('timestamp');
      expect(typeof data.timestamp).toBe('number');
      done();
    });
  });

  it('should handle subscription requests', (done) => {
    const topics = ['camera:status', 'camera:settings'];
    
    clientSocket.emit('subscribe', { topics });
    clientSocket.on('subscription:success', (data) => {
      expect(data).toMatchObject({
        topics,
        totalSubscriptions: expect.any(Number),
        timestamp: expect.any(String)
      });
      done();
    });
  });

  it('should handle room join requests', (done) => {
    const room = 'test-room';
    
    clientSocket.emit('join:room', { room });
    clientSocket.on('room:joined', (data) => {
      expect(data).toMatchObject({
        room,
        members: expect.any(Number),
        timestamp: expect.any(String)
      });
      done();
    });
  });

  it('should validate subscription data', (done) => {
    clientSocket.emit('subscribe', { topics: 'invalid' });
    clientSocket.on('subscription:error', (data) => {
      expect(data).toMatchObject({
        message: 'Topics must be an array',
        timestamp: expect.any(String)
      });
      done();
    });
  });

  it('should validate room data', (done) => {
    clientSocket.emit('join:room', { room: 123 });
    clientSocket.on('room:error', (data) => {
      expect(data).toMatchObject({
        message: 'Room name must be a string',
        timestamp: expect.any(String)
      });
      done();
    });
  });
});