#!/usr/bin/env node

/**
 * ARRI Camera Control Server Startup Script
 */

const { ArriCameraControlServer } = require('../src/server.js');

// Handle startup
async function startServer() {
  try {
    console.log('🎬 Starting ARRI Camera Control Server...');
    
    const server = new ArriCameraControlServer();
    await server.start();
    
    console.log('✅ Server started successfully!');
    console.log(`📡 WebSocket endpoint: ws://localhost:${process.env.PORT || 3001}/socket.io/`);
    console.log(`🌐 Health check: http://localhost:${process.env.PORT || 3001}/health`);
    console.log('🔄 Ready for camera connections');
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();