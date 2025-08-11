/**
 * Mock CAP Server
 * Simulates ARRI camera CAP protocol for testing
 */

const net = require('net');
const EventEmitter = require('events');

class MockCAPServer extends EventEmitter {
  constructor(port = 9999) {
    super();
    this.port = port;
    this.server = null;
    this.clients = new Set();
    this.cameraState = {
      model: 'ALEXA 35',
      serialNumber: 'A35-12345',
      firmwareVersion: '1.2.3',
      frameRate: 24.0,
      whiteBalance: { kelvin: 5600, tint: 0 },
      iso: 800,
      ndFilter: 0,
      recording: false,
      timecode: { current: '01:00:00:00', mode: 'free_run' },
      frameLinesEnabled: false,
      currentLUT: 'Rec709',
      cdl: {
        shadows: {
          lift: { r: 0, g: 0, b: 0 },
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
      },
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
      ],
      playback: {
        mode: false,
        playing: false,
        currentClip: null,
        position: 0
      }
    };
    
    this.commandHandlers = this.setupCommandHandlers();
    this.setupTimecodeUpdates();
  }

  setupCommandHandlers() {
    return {
      // Camera info
      'GET /camera/model': () => ({
        status: 'OK',
        data: {
          model: this.cameraState.model,
          serialNumber: this.cameraState.serialNumber,
          firmwareVersion: this.cameraState.firmwareVersion
        }
      }),

      // Frame rate
      'GET /camera/frameRate': () => ({
        status: 'OK',
        data: { frameRate: this.cameraState.frameRate }
      }),

      'SET /camera/frameRate': (params) => {
        if (params.frameRate && params.frameRate > 0 && params.frameRate <= 120) {
          this.cameraState.frameRate = params.frameRate;
          return {
            status: 'OK',
            data: { frameRate: this.cameraState.frameRate }
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid frame rate',
          code: 'CAP_007'
        };
      },

      // White balance
      'GET /camera/whiteBalance': () => ({
        status: 'OK',
        data: this.cameraState.whiteBalance
      }),

      'SET /camera/whiteBalance': (params) => {
        if (params.kelvin && params.kelvin >= 2000 && params.kelvin <= 11000) {
          this.cameraState.whiteBalance.kelvin = params.kelvin;
          if (params.tint !== undefined) {
            this.cameraState.whiteBalance.tint = Math.max(-100, Math.min(100, params.tint));
          }
          return {
            status: 'OK',
            data: this.cameraState.whiteBalance
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid white balance values',
          code: 'CAP_007'
        };
      },

      // ISO
      'GET /camera/iso': () => ({
        status: 'OK',
        data: { iso: this.cameraState.iso }
      }),

      'SET /camera/iso': (params) => {
        if (params.iso && params.iso >= 160 && params.iso <= 6400) {
          this.cameraState.iso = params.iso;
          return {
            status: 'OK',
            data: { iso: this.cameraState.iso }
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid ISO value',
          code: 'CAP_007'
        };
      },

      // ND Filter
      'GET /camera/ndFilter': () => ({
        status: 'OK',
        data: { ndStop: this.cameraState.ndFilter }
      }),

      'SET /camera/ndFilter': (params) => {
        if (params.ndStop !== undefined && params.ndStop >= 0 && params.ndStop <= 8) {
          this.cameraState.ndFilter = params.ndStop;
          return {
            status: 'OK',
            data: { ndStop: this.cameraState.ndFilter }
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid ND filter value',
          code: 'CAP_007'
        };
      },

      // Frame lines
      'GET /camera/frameLines': () => ({
        status: 'OK',
        data: { enabled: this.cameraState.frameLinesEnabled }
      }),

      'SET /camera/frameLines': (params) => {
        this.cameraState.frameLinesEnabled = Boolean(params.enabled);
        return {
          status: 'OK',
          data: { enabled: this.cameraState.frameLinesEnabled }
        };
      },

      // LUT
      'GET /camera/lut': () => ({
        status: 'OK',
        data: { lutName: this.cameraState.currentLUT }
      }),

      'SET /camera/lut': (params) => {
        if (params.lutName) {
          this.cameraState.currentLUT = params.lutName;
          return {
            status: 'OK',
            data: { lutName: this.cameraState.currentLUT }
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid LUT name',
          code: 'CAP_007'
        };
      },

      // Playback
      'GET /playback/clips': () => ({
        status: 'OK',
        data: { clips: this.cameraState.clips }
      }),

      'SET /playback/enter': () => {
        this.cameraState.playback.mode = true;
        return {
          status: 'OK',
          data: { playbackMode: true }
        };
      },

      'SET /playback/exit': () => {
        this.cameraState.playback.mode = false;
        this.cameraState.playback.playing = false;
        this.cameraState.playback.currentClip = null;
        return {
          status: 'OK',
          data: { playbackMode: false }
        };
      },

      'SET /playback/play': (params) => {
        if (params.clipId) {
          const clip = this.cameraState.clips.find(c => c.id === params.clipId);
          if (clip) {
            this.cameraState.playback.playing = true;
            this.cameraState.playback.currentClip = clip;
            return {
              status: 'OK',
              data: { playing: true, clipId: params.clipId }
            };
          }
          return {
            status: 'ERROR',
            error: 'Clip not found',
            code: 'CAP_004'
          };
        }
        return {
          status: 'ERROR',
          error: 'Missing clip ID',
          code: 'CAP_007'
        };
      },

      'SET /playback/pause': () => {
        this.cameraState.playback.playing = false;
        return {
          status: 'OK',
          data: { playing: false }
        };
      },

      'SET /playback/stop': () => {
        this.cameraState.playback.playing = false;
        this.cameraState.playback.position = 0;
        return {
          status: 'OK',
          data: { playing: false, position: 0 }
        };
      },

      // Timecode
      'GET /timecode/current': () => ({
        status: 'OK',
        data: this.cameraState.timecode
      }),

      'SET /timecode/set': (params) => {
        if (params.timecode && /^\d{2}:\d{2}:\d{2}:\d{2}$/.test(params.timecode)) {
          this.cameraState.timecode.current = params.timecode;
          return {
            status: 'OK',
            data: this.cameraState.timecode
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid timecode format',
          code: 'CAP_007'
        };
      },

      'SET /timecode/setMode': (params) => {
        const validModes = ['free_run', 'record_run', 'external'];
        if (params.mode && validModes.includes(params.mode)) {
          this.cameraState.timecode.mode = params.mode;
          return {
            status: 'OK',
            data: this.cameraState.timecode
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid timecode mode',
          code: 'CAP_007'
        };
      },

      'SET /timecode/syncToTimeOfDay': () => {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const frames = '00'; // Simplified
        
        this.cameraState.timecode.current = `${hours}:${minutes}:${seconds}:${frames}`;
        return {
          status: 'OK',
          data: this.cameraState.timecode
        };
      },

      // Color grading
      'SET /grading/setCDL': (params) => {
        if (params.cdl) {
          this.cameraState.cdl = { ...this.cameraState.cdl, ...params.cdl };
          return {
            status: 'OK',
            data: { cdl: this.cameraState.cdl }
          };
        }
        return {
          status: 'ERROR',
          error: 'Invalid CDL data',
          code: 'CAP_007'
        };
      },

      'GET /grading/getCDL': () => ({
        status: 'OK',
        data: { cdl: this.cameraState.cdl }
      }),

      'SET /grading/saveLUT': (params) => {
        if (params.name) {
          return {
            status: 'OK',
            data: { 
              name: params.name,
              id: `lut_${Date.now()}`,
              saved: true 
            }
          };
        }
        return {
          status: 'ERROR',
          error: 'Missing LUT name',
          code: 'CAP_007'
        };
      }
    };
  }

  setupTimecodeUpdates() {
    // Simulate real-time timecode updates
    setInterval(() => {
      if (this.cameraState.timecode.mode === 'free_run') {
        const [hours, minutes, seconds, frames] = this.cameraState.timecode.current.split(':').map(Number);
        
        let newFrames = frames + 1;
        let newSeconds = seconds;
        let newMinutes = minutes;
        let newHours = hours;
        
        if (newFrames >= 24) { // Assuming 24fps
          newFrames = 0;
          newSeconds++;
          
          if (newSeconds >= 60) {
            newSeconds = 0;
            newMinutes++;
            
            if (newMinutes >= 60) {
              newMinutes = 0;
              newHours++;
              
              if (newHours >= 24) {
                newHours = 0;
              }
            }
          }
        }
        
        this.cameraState.timecode.current = 
          `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}:${newSeconds.toString().padStart(2, '0')}:${newFrames.toString().padStart(2, '0')}`;
      }
    }, 1000 / 24); // 24fps
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.clients.add(socket);
        console.log(`Mock CAP Server: Client connected (${this.clients.size} total)`);
        
        socket.on('data', (data) => {
          try {
            const message = data.toString().trim();
            const response = this.processCommand(message);
            socket.write(JSON.stringify(response) + '\n');
          } catch (error) {
            console.error('Mock CAP Server: Error processing command:', error);
            socket.write(JSON.stringify({
              status: 'ERROR',
              error: 'Invalid command format',
              code: 'CAP_001'
            }) + '\n');
          }
        });
        
        socket.on('close', () => {
          this.clients.delete(socket);
          console.log(`Mock CAP Server: Client disconnected (${this.clients.size} total)`);
        });
        
        socket.on('error', (error) => {
          console.error('Mock CAP Server: Socket error:', error);
          this.clients.delete(socket);
        });
      });
      
      this.server.listen(this.port, () => {
        console.log(`Mock CAP Server: Listening on port ${this.port}`);
        resolve();
      });
      
      this.server.on('error', (error) => {
        console.error('Mock CAP Server: Server error:', error);
        reject(error);
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        // Close all client connections
        this.clients.forEach(client => {
          client.destroy();
        });
        this.clients.clear();
        
        this.server.close(() => {
          console.log('Mock CAP Server: Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  processCommand(commandString) {
    try {
      const command = JSON.parse(commandString);
      const key = `${command.method} ${command.path}`;
      const handler = this.commandHandlers[key];
      
      if (handler) {
        const result = handler(command.params || {});
        return {
          id: command.id,
          ...result
        };
      }
      
      return {
        id: command.id,
        status: 'ERROR',
        error: 'Command not found',
        code: 'CAP_002'
      };
      
    } catch (error) {
      return {
        status: 'ERROR',
        error: 'Invalid JSON format',
        code: 'CAP_001'
      };
    }
  }

  // Simulate camera state changes
  simulateStateChange(type, data) {
    switch (type) {
      case 'frameRate':
        this.cameraState.frameRate = data.frameRate;
        break;
      case 'whiteBalance':
        this.cameraState.whiteBalance = { ...this.cameraState.whiteBalance, ...data };
        break;
      case 'iso':
        this.cameraState.iso = data.iso;
        break;
      // Add more state changes as needed
    }
    
    // Broadcast state change to all connected clients
    const stateUpdate = {
      type: 'state_change',
      data: { type, ...data }
    };
    
    this.clients.forEach(client => {
      try {
        client.write(JSON.stringify(stateUpdate) + '\n');
      } catch (error) {
        console.error('Mock CAP Server: Failed to broadcast state change:', error);
      }
    });
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new MockCAPServer();
  
  server.start().then(() => {
    console.log('Mock CAP Server started successfully');
  }).catch((error) => {
    console.error('Failed to start Mock CAP Server:', error);
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('Mock CAP Server: Received SIGTERM, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Mock CAP Server: Received SIGINT, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });
}

module.exports = MockCAPServer;