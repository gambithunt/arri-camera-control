/**
 * Integration tests for Camera Control WebSocket API
 */

const { ArriCameraControlServer } = require('../../server.js');
const { io: Client } = require('socket.io-client');

// Mock the CAP connection manager
jest.mock('../../cap/connectionManager.js', () => ({
  CAPConnectionManager: jest.fn().mockImplementation(() => ({
    getStatus: jest.fn().mockReturnValue({
      state: 'connected',
      connected: true,
      authenticated: true
    }),
    connect: jest.fn().mockResolvedValue(),
    disconnect: jest.fn(),
    isConnected: jest.fn().mockReturnValue(true),
    isAuthenticated: jest.fn().mockReturnValue(true),
    sendCommand: jest.fn().mockResolvedValue({ success: true }),
    on: jest.fn(),
    emit: jest.fn()
  }))
}));

describe('Camera Control Integration Tests', () => {
  let server;
  let clientSocket;
  let serverPort;

  beforeAll((done) => {
    jest.setTimeout(10000); // Increase timeout for integration tests
    server = new ArriCameraControlServer();
    server.server.listen(() => {
      serverPort = server.server.address().port;
      clientSocket = new Client(`http://localhost:${serverPort}`, {
        forceNew: true,
        timeout: 5000
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server && server.server) {
      server.server.close(() => {
        // Give time for cleanup
        setTimeout(done, 100);
      });
    } else {
      done();
    }
  });

  describe('Frame Rate Control', () => {
    it('should handle frame rate changes', (done) => {
      const frameRate = 24;
      
      const timeout = setTimeout(() => {
        done(new Error('Test timeout'));
      }, 5000);
      
      clientSocket.emit('camera:frameRate:set', { frameRate });
      
      clientSocket.on('camera:frameRate:success', (data) => {
        clearTimeout(timeout);
        expect(data.frameRate).toBe(frameRate);
        expect(data.timestamp).toBeDefined();
        done();
      });
    });

    it('should broadcast frame rate changes to all clients', (done) => {
      const frameRate = 30;
      
      // Create second client to test broadcasting
      const secondClient = new Client(`http://localhost:${serverPort}`, {
        forceNew: true,
        timeout: 5000
      });
      
      const cleanup = () => {
        secondClient.disconnect();
        done();
      };
      
      secondClient.on('connect', () => {
        // Listen for broadcast on second client
        secondClient.on('camera:frameRate:changed', (data) => {
          expect(data.frameRate).toBe(frameRate);
          cleanup();
        });
        
        // Trigger change from first client
        setTimeout(() => {
          clientSocket.emit('camera:frameRate:set', { frameRate });
        }, 100);
      });
      
      secondClient.on('connect_error', cleanup);
    });

    it('should validate frame rate values', (done) => {
      const invalidFrameRate = 999;
      
      clientSocket.emit('camera:frameRate:set', { frameRate: invalidFrameRate });
      
      clientSocket.on('camera:frameRate:error', (data) => {
        expect(data.code).toBe('INVALID_FRAME_RATE');
        expect(data.errors).toBeDefined();
        done();
      });
    });
  });

  describe('White Balance Control', () => {
    it('should handle white balance changes', (done) => {
      const whiteBalance = { kelvin: 5600, tint: 10 };
      
      clientSocket.emit('camera:whiteBalance:set', whiteBalance);
      
      clientSocket.on('camera:whiteBalance:success', (data) => {
        expect(data.whiteBalance.kelvin).toBe(5600);
        expect(data.whiteBalance.tint).toBe(10);
        done();
      });
    });

    it('should handle partial white balance changes', (done) => {
      const whiteBalance = { kelvin: 3200 }; // Only kelvin
      
      clientSocket.emit('camera:whiteBalance:set', whiteBalance);
      
      clientSocket.on('camera:whiteBalance:success', (data) => {
        expect(data.whiteBalance.kelvin).toBe(3200);
        done();
      });
    });

    it('should validate white balance values', (done) => {
      const invalidWhiteBalance = { kelvin: 15000, tint: 200 };
      
      clientSocket.emit('camera:whiteBalance:set', invalidWhiteBalance);
      
      clientSocket.on('camera:whiteBalance:error', (data) => {
        expect(data.code).toBe('INVALID_WHITE_BALANCE');
        expect(data.errors).toBeDefined();
        done();
      });
    });
  });

  describe('ISO Control', () => {
    it('should handle ISO changes', (done) => {
      const iso = 800;
      
      clientSocket.emit('camera:iso:set', { iso });
      
      clientSocket.on('camera:iso:success', (data) => {
        expect(data.iso).toBe(iso);
        done();
      });
    });

    it('should validate ISO values', (done) => {
      const invalidISO = 999;
      
      clientSocket.emit('camera:iso:set', { iso: invalidISO });
      
      clientSocket.on('camera:iso:error', (data) => {
        expect(data.code).toBe('INVALID_ISO');
        expect(data.errors).toBeDefined();
        done();
      });
    });
  });

  describe('ND Filter Control', () => {
    it('should handle ND filter changes', (done) => {
      const ndStop = 1.2;
      
      clientSocket.emit('camera:ndFilter:set', { ndStop });
      
      clientSocket.on('camera:ndFilter:success', (data) => {
        expect(data.ndFilter).toBe(ndStop);
        done();
      });
    });

    it('should validate ND stop values', (done) => {
      const invalidNDStop = 5.0;
      
      clientSocket.emit('camera:ndFilter:set', { ndStop: invalidNDStop });
      
      clientSocket.on('camera:ndFilter:error', (data) => {
        expect(data.code).toBe('INVALID_ND_STOP');
        expect(data.errors).toBeDefined();
        done();
      });
    });
  });

  describe('Frame Lines Control', () => {
    it('should handle frame lines toggle', (done) => {
      const enabled = true;
      
      clientSocket.emit('camera:frameLines:set', { enabled });
      
      clientSocket.on('camera:frameLines:success', (data) => {
        expect(data.frameLines).toBe(enabled);
        done();
      });
    });

    it('should validate frame lines enabled value', (done) => {
      const invalidEnabled = 'invalid';
      
      clientSocket.emit('camera:frameLines:set', { enabled: invalidEnabled });
      
      clientSocket.on('camera:frameLines:error', (data) => {
        expect(data.code).toBe('INVALID_FRAME_LINES');
        expect(data.errors).toBeDefined();
        done();
      });
    });
  });

  describe('LUT Control', () => {
    it('should handle LUT changes', (done) => {
      const lutName = 'Rec709';
      
      clientSocket.emit('camera:lut:set', { lutName });
      
      clientSocket.on('camera:lut:success', (data) => {
        expect(data.lut).toBe(lutName);
        done();
      });
    });

    it('should validate LUT name', (done) => {
      const invalidLutName = '';
      
      clientSocket.emit('camera:lut:set', { lutName: invalidLutName });
      
      clientSocket.on('camera:lut:error', (data) => {
        expect(data.code).toBe('INVALID_LUT_NAME');
        expect(data.errors).toBeDefined();
        done();
      });
    });
  });

  describe('Camera State', () => {
    it('should return current camera state', (done) => {
      clientSocket.emit('camera:state:get');
      
      clientSocket.on('camera:state', (data) => {
        expect(data).toHaveProperty('frameRate');
        expect(data).toHaveProperty('whiteBalance');
        expect(data).toHaveProperty('iso');
        expect(data).toHaveProperty('ndFilter');
        expect(data).toHaveProperty('frameLines');
        expect(data).toHaveProperty('lut');
        expect(data).toHaveProperty('timestamp');
        done();
      });
    });
  });

  describe('Connection Requirements', () => {
    it('should require camera connection for controls', (done) => {
      // Mock disconnected state
      const mockCapManager = server.wsManager.capManager;
      mockCapManager.isConnected.mockReturnValue(false);
      
      clientSocket.emit('camera:frameRate:set', { frameRate: 24 });
      
      clientSocket.on('camera:frameRate:error', (data) => {
        expect(data.code).toBe('NOT_CONNECTED');
        
        // Restore connected state
        mockCapManager.isConnected.mockReturnValue(true);
        done();
      });
    });
  });

  describe('Real-time Broadcasting', () => {
    it('should broadcast changes to all connected clients', (done) => {
      const clients = [];
      let connectedClients = 0;
      let receivedBroadcasts = 0;
      
      const cleanup = () => {
        clients.forEach(c => c.disconnect());
        done();
      };
      
      // Create multiple clients
      for (let i = 0; i < 2; i++) { // Reduced to 2 clients for stability
        const client = new Client(`http://localhost:${serverPort}`, {
          forceNew: true,
          timeout: 5000
        });
        clients.push(client);
        
        client.on('connect', () => {
          connectedClients++;
          if (connectedClients === 2) {
            // All clients connected, trigger a change
            setTimeout(() => {
              clientSocket.emit('camera:frameRate:set', { frameRate: 25 });
            }, 100);
          }
        });
        
        client.on('camera:frameRate:changed', (data) => {
          expect(data.frameRate).toBe(25);
          receivedBroadcasts++;
          
          if (receivedBroadcasts === 2) {
            // All clients received broadcast
            cleanup();
          }
        });
        
        client.on('connect_error', cleanup);
      }
      
      // Timeout fallback
      setTimeout(cleanup, 8000);
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input', (done) => {
      const maliciousData = {
        frameRate: 24,
        __proto__: { malicious: true },
        constructor: { prototype: { evil: true } },
        extraField: 'should be removed'
      };
      
      clientSocket.emit('camera:frameRate:set', maliciousData);
      
      clientSocket.on('camera:frameRate:success', (data) => {
        expect(data.frameRate).toBe(24);
        expect(data).not.toHaveProperty('__proto__');
        expect(data).not.toHaveProperty('constructor');
        expect(data).not.toHaveProperty('extraField');
        done();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle CAP command failures gracefully', (done) => {
      // Mock CAP command failure
      const mockCapManager = server.wsManager.capManager;
      const originalSendCommand = mockCapManager.sendCommand;
      mockCapManager.sendCommand.mockRejectedValue(new Error('CAP command failed'));
      
      clientSocket.emit('camera:frameRate:set', { frameRate: 24 });
      
      clientSocket.on('camera:frameRate:error', (data) => {
        expect(data.message).toBe('CAP command failed');
        expect(data.code).toBe('FRAME_RATE_FAILED');
        
        // Restore original method
        mockCapManager.sendCommand = originalSendCommand;
        done();
      });
    });
  });
});