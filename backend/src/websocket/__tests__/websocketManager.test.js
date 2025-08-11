/**
 * Unit tests for WebSocket Manager
 */

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

// Mock handlers
jest.mock('../connectionHandler.js', () => ({
  ConnectionHandler: jest.fn().mockImplementation(() => ({
    handleCameraConnect: jest.fn(),
    handleCameraDisconnect: jest.fn(),
    handleCameraStatus: jest.fn()
  }))
}));

jest.mock('../authenticationHandler.js', () => ({
  AuthenticationHandler: jest.fn().mockImplementation(() => ({
    handleAuthentication: jest.fn()
  }))
}));

describe('WebSocketManager', () => {
  let wsManager;
  let mockIO;
  let mockCapManager;
  let mockSocket;

  beforeEach(() => {
    // Mock Socket.io server
    mockIO = {
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      close: jest.fn()
    };

    // Mock CAP manager
    mockCapManager = new EventEmitter();
    mockCapManager.getStatus = jest.fn().mockReturnValue({
      state: 'disconnected',
      connected: false
    });

    // Mock socket
    mockSocket = new EventEmitter();
    mockSocket.id = 'test-socket-id';
    mockSocket.handshake = {
      address: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent',
        'origin': 'http://localhost:3000'
      }
    };
    mockSocket.emit = jest.fn();
    mockSocket.join = jest.fn();
    mockSocket.leave = jest.fn();
    mockSocket.disconnect = jest.fn();
    mockSocket.use = jest.fn((middleware) => {
      // Simulate middleware execution
      middleware(['test'], () => {});
    });
    mockSocket.on = jest.fn();

    wsManager = new WebSocketManager(mockIO, mockCapManager);
  });

  afterEach(() => {
    if (wsManager.cleanupInterval) {
      clearInterval(wsManager.cleanupInterval);
    }
    if (wsManager.metricsInterval) {
      clearInterval(wsManager.metricsInterval);
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await wsManager.initialize();

      expect(wsManager.cleanupInterval).toBeDefined();
      expect(wsManager.metricsInterval).toBeDefined();
    });

    it('should setup CAP event handlers', () => {
      expect(mockCapManager.listenerCount('connected')).toBeGreaterThan(0);
      expect(mockCapManager.listenerCount('disconnected')).toBeGreaterThan(0);
      expect(mockCapManager.listenerCount('error')).toBeGreaterThan(0);
      expect(mockCapManager.listenerCount('message')).toBeGreaterThan(0);
    });
  });

  describe('Connection Handling', () => {
    it('should handle new connections', () => {
      wsManager.handleConnection(mockSocket);

      expect(wsManager.connections.has(mockSocket.id)).toBe(true);
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', expect.objectContaining({
        clientId: mockSocket.id,
        serverTime: expect.any(String),
        capabilities: expect.any(Object)
      }));
    });

    it('should setup socket event handlers', () => {
      wsManager.handleConnection(mockSocket);

      // Verify middleware was set up
      expect(mockSocket.use).toHaveBeenCalled();
    });

    it('should handle disconnections', () => {
      wsManager.handleConnection(mockSocket);
      expect(wsManager.connections.has(mockSocket.id)).toBe(true);

      wsManager.handleDisconnection(mockSocket.id, 'client disconnect');
      expect(wsManager.connections.has(mockSocket.id)).toBe(false);
    });

    it('should track connection metadata', () => {
      wsManager.handleConnection(mockSocket);
      
      const clientInfo = wsManager.connections.get(mockSocket.id);
      expect(clientInfo).toMatchObject({
        id: mockSocket.id,
        connectedAt: expect.any(Date),
        lastActivity: expect.any(Date),
        authenticated: false,
        subscriptions: expect.any(Set),
        metadata: {
          userAgent: 'test-agent',
          address: '127.0.0.1',
          origin: 'http://localhost:3000'
        }
      });
    });
  });

  describe('Subscription Management', () => {
    beforeEach(() => {
      wsManager.handleConnection(mockSocket);
    });

    it('should handle subscription requests', () => {
      const topics = ['camera:status', 'camera:settings'];
      
      wsManager.handleSubscription(mockSocket, { topics });

      const clientInfo = wsManager.connections.get(mockSocket.id);
      expect(clientInfo.subscriptions.has('camera:status')).toBe(true);
      expect(clientInfo.subscriptions.has('camera:settings')).toBe(true);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('subscription:success', expect.objectContaining({
        topics,
        totalSubscriptions: 2
      }));
    });

    it('should handle unsubscription requests', () => {
      const topics = ['camera:status', 'camera:settings'];
      
      // First subscribe
      wsManager.handleSubscription(mockSocket, { topics });
      
      // Then unsubscribe
      wsManager.handleUnsubscription(mockSocket, { topics: ['camera:status'] });

      const clientInfo = wsManager.connections.get(mockSocket.id);
      expect(clientInfo.subscriptions.has('camera:status')).toBe(false);
      expect(clientInfo.subscriptions.has('camera:settings')).toBe(true);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscription:success', expect.objectContaining({
        topics: ['camera:status'],
        totalSubscriptions: 1
      }));
    });

    it('should validate subscription data', () => {
      wsManager.handleSubscription(mockSocket, { topics: 'invalid' });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('subscription:error', expect.objectContaining({
        message: 'Topics must be an array'
      }));
    });

    it('should broadcast to subscribers', () => {
      const topics = ['camera:status'];
      wsManager.handleSubscription(mockSocket, { topics });

      wsManager.broadcastToSubscribers('camera:status', 'camera:update', { data: 'test' });

      expect(mockSocket.emit).toHaveBeenCalledWith('camera:update', { data: 'test' });
    });
  });

  describe('Room Management', () => {
    beforeEach(() => {
      wsManager.handleConnection(mockSocket);
    });

    it('should handle room join requests', () => {
      const room = 'test-room';
      
      wsManager.handleJoinRoom(mockSocket, { room });

      expect(mockSocket.join).toHaveBeenCalledWith(room);
      expect(wsManager.rooms.has(room)).toBe(true);
      expect(wsManager.rooms.get(room).has(mockSocket.id)).toBe(true);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('room:joined', expect.objectContaining({
        room,
        members: 1
      }));
    });

    it('should handle room leave requests', () => {
      const room = 'test-room';
      
      // First join
      wsManager.handleJoinRoom(mockSocket, { room });
      
      // Then leave
      wsManager.handleLeaveRoom(mockSocket, { room });

      expect(mockSocket.leave).toHaveBeenCalledWith(room);
      expect(wsManager.rooms.has(room)).toBe(false);
      
      expect(mockSocket.emit).toHaveBeenCalledWith('room:left', expect.objectContaining({
        room
      }));
    });

    it('should validate room data', () => {
      wsManager.handleJoinRoom(mockSocket, { room: 123 });
      
      expect(mockSocket.emit).toHaveBeenCalledWith('room:error', expect.objectContaining({
        message: 'Room name must be a string'
      }));
    });

    it('should broadcast to room', () => {
      const room = 'test-room';
      wsManager.handleJoinRoom(mockSocket, { room });

      wsManager.broadcastToRoom(room, 'room:message', { data: 'test' });

      expect(mockIO.to).toHaveBeenCalledWith(room);
    });
  });

  describe('CAP Event Forwarding', () => {
    it('should forward CAP connected events', () => {
      mockCapManager.emit('connected');

      expect(mockIO.emit).toHaveBeenCalledWith('camera:connected', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });

    it('should forward CAP disconnected events', () => {
      mockCapManager.emit('disconnected');

      expect(mockIO.emit).toHaveBeenCalledWith('camera:disconnected', expect.objectContaining({
        timestamp: expect.any(String)
      }));
    });

    it('should forward CAP error events', () => {
      const error = {
        message: 'Test error',
        category: 'connection',
        recoverable: true
      };

      mockCapManager.emit('error', error);

      expect(mockIO.emit).toHaveBeenCalledWith('camera:error', expect.objectContaining({
        error: error.message,
        category: error.category,
        recoverable: error.recoverable,
        timestamp: expect.any(String)
      }));
    });

    it('should forward CAP message events', () => {
      const message = { type: 'test', data: 'test data' };

      mockCapManager.emit('message', message);

      expect(mockIO.emit).toHaveBeenCalledWith('camera:message', expect.objectContaining({
        message,
        timestamp: expect.any(String)
      }));
    });
  });

  describe('Statistics and Monitoring', () => {
    beforeEach(() => {
      wsManager.handleConnection(mockSocket);
    });

    it('should provide connection count', () => {
      expect(wsManager.getConnectionCount()).toBe(1);
    });

    it('should provide connection statistics', () => {
      const stats = wsManager.getConnectionStats();

      expect(stats).toMatchObject({
        total: 1,
        authenticated: 0,
        rooms: 0,
        subscriptions: 0,
        averageUptime: expect.any(Number),
        connections: expect.arrayContaining([
          expect.objectContaining({
            id: mockSocket.id,
            connectedAt: expect.any(Date),
            uptime: expect.any(Number),
            authenticated: false,
            subscriptions: 0
          })
        ])
      });
    });

    it('should provide server capabilities', () => {
      const capabilities = wsManager.getServerCapabilities();

      expect(capabilities).toMatchObject({
        version: expect.any(String),
        features: expect.any(Array),
        maxConnections: expect.any(Number),
        supportedProtocols: expect.arrayContaining(['CAP']),
        authentication: expect.any(Object)
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup stale connections', () => {
      wsManager.handleConnection(mockSocket);
      
      // Simulate stale connection by setting old last activity
      const clientInfo = wsManager.connections.get(mockSocket.id);
      clientInfo.lastActivity = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago

      wsManager.cleanupStaleConnections();

      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });

    it('should cleanup resources', async () => {
      wsManager.handleConnection(mockSocket);
      await wsManager.initialize();

      await wsManager.cleanup();

      expect(wsManager.connections.size).toBe(0);
      expect(wsManager.rooms.size).toBe(0);
      expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
    });
  });

  describe('Broadcasting', () => {
    beforeEach(() => {
      wsManager.handleConnection(mockSocket);
    });

    it('should broadcast to all clients', () => {
      wsManager.broadcast('test:event', { data: 'test' });

      expect(mockIO.emit).toHaveBeenCalledWith('test:event', { data: 'test' });
    });

    it('should handle ping/pong', () => {
      wsManager.handleConnection(mockSocket);
      
      // Find and call the ping handler
      const pingCall = mockSocket.on.mock.calls.find(call => call[0] === 'ping');
      expect(pingCall).toBeDefined();
      
      if (pingCall) {
        const pingHandler = pingCall[1];
        pingHandler();
        
        expect(mockSocket.emit).toHaveBeenCalledWith('pong', expect.objectContaining({
          timestamp: expect.any(Number)
        }));
      }
    });
  });
});