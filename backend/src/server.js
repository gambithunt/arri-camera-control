/**
 * ARRI Camera Control Backend Server
 * Express server with Socket.io integration for real-time camera control
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { logger } = require('./utils/logger.js');
const { WebSocketManager } = require('./websocket/websocketManager.js');
// Mock CAP Connection Manager for testing without camera
class MockCAPConnectionManager {
  constructor(options = {}) {
    this.options = options;
    this.connected = false;
  }
  
  getStatus() {
    return {
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
    };
  }
  
  disconnect() {
    this.connected = false;
  }
}

// Load environment variables
require('dotenv').config();

class ArriCameraControlServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.port = process.env.PORT || 3001;
    
    // Initialize Socket.io with CORS configuration
    this.io = new Server(this.server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "http://localhost:5174",
          process.env.FRONTEND_URL
        ].filter(Boolean),
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Initialize managers
    this.capManager = new MockCAPConnectionManager({
      maxReconnectAttempts: 5,
      reconnectDelay: 2000,
      healthCheckTimeout: 10000,
      logging: {
        enabled: true,
        logLevel: process.env.LOG_LEVEL || 'info'
      }
    });

    this.wsManager = new WebSocketManager(this.server);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
    this.setupErrorHandling();
  }

  /**
   * Configure Express middleware
   */
  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        process.env.FRONTEND_URL
      ].filter(Boolean),
      credentials: true
    }));

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        connections: {
          websocket: this.wsManager.getConnectionCount(),
          cap: this.capManager.getStatus()
        }
      };
      res.json(health);
    });

    // API info endpoint
    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'ARRI Camera Control API',
        version: '1.0.0',
        description: 'WebSocket API for ARRI camera control',
        endpoints: {
          health: '/health',
          websocket: '/socket.io/'
        }
      });
    });

    // Camera status endpoint
    this.app.get('/api/camera/status', (req, res) => {
      const status = this.capManager.getStatus();
      res.json(status);
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.originalUrl} not found`,
        timestamp: new Date().toISOString()
      });
    });
  }

  /**
   * Setup Socket.io event handlers
   */
  setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`, {
        clientId: socket.id,
        address: socket.handshake.address,
        userAgent: socket.handshake.headers['user-agent']
      });

      // Handle client disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id}`, {
          clientId: socket.id,
          reason
        });
      });

      // Handle connection errors
      socket.on('error', (error) => {
        logger.error(`Socket error for client ${socket.id}:`, {
          clientId: socket.id,
          error: error.message,
          stack: error.stack
        });
      });

      // Register socket with WebSocket manager
      this.wsManager.handleConnection(socket);
    });

    // Global Socket.io error handling
    this.io.engine.on('connection_error', (err) => {
      logger.error('Socket.io connection error:', {
        code: err.code,
        message: err.message,
        context: err.context,
        type: err.type
      });
    });
  }

  /**
   * Setup global error handling
   */
  setupErrorHandling() {
    // Express error handler
    this.app.use((err, req, res, next) => {
      logger.error('Express error:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
      });

      res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
        timestamp: new Date().toISOString()
      });
    });

    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Promise Rejection:', {
        reason: reason.toString(),
        stack: reason.stack,
        promise: promise.toString()
      });
    });

    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', {
        error: error.message,
        stack: error.stack
      });
      
      // Graceful shutdown
      this.shutdown();
    });

    // Graceful shutdown signals
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, starting graceful shutdown');
      this.shutdown();
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, starting graceful shutdown');
      this.shutdown();
    });
  }

  /**
   * Start the server
   */
  async start() {
    try {
      // Start HTTP server
      this.server.listen(this.port, () => {
        logger.info(`ARRI Camera Control Server started`, {
          port: this.port,
          environment: process.env.NODE_ENV || 'development',
          frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173"
        });
      });

      // Initialize WebSocket manager
      await this.wsManager.initialize();

      logger.info('Server initialization complete');

    } catch (error) {
      logger.error('Failed to start server:', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Starting graceful shutdown...');

    try {
      // Close Socket.io connections
      this.io.close(() => {
        logger.info('Socket.io server closed');
      });

      // Close HTTP server
      this.server.close(() => {
        logger.info('HTTP server closed');
      });

      // Cleanup WebSocket manager
      if (this.wsManager) {
        await this.wsManager.cleanup();
      }

      // Cleanup CAP connection
      if (this.capManager) {
        this.capManager.disconnect();
      }

      logger.info('Graceful shutdown complete');
      process.exit(0);

    } catch (error) {
      logger.error('Error during shutdown:', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    }
  }

  /**
   * Get server instance for testing
   */
  getApp() {
    return this.app;
  }

  /**
   * Get Socket.io instance for testing
   */
  getIO() {
    return this.io;
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new ArriCameraControlServer();
  server.start();
}

module.exports = { ArriCameraControlServer };