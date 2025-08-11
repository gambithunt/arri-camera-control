/**
 * CAP Protocol Implementation
 * Handles communication with ARRI cameras using the Camera Access Protocol
 */

const net = require('net');
const { EventEmitter } = require('events');

class CAPProtocol extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.host = null;
    this.port = null;
    this.commandTimeout = 5000;
  }

  async connect(host, port) {
    return new Promise((resolve) => {
      try {
        this.host = host;
        this.port = port;
        this.socket = new net.Socket();

        const timeout = setTimeout(() => {
          this.socket.destroy();
          resolve({
            success: false,
            error: 'Connection timeout'
          });
        }, this.commandTimeout);

        this.socket.connect(port, host, () => {
          clearTimeout(timeout);
          this.connected = true;
          this.emit('connected');
          resolve({
            success: true,
            data: {
              host,
              port
            }
          });
        });

        this.socket.on('error', (error) => {
          clearTimeout(timeout);
          this.connected = false;
          resolve({
            success: false,
            error: error.message
          });
        });

        this.socket.on('close', () => {
          this.connected = false;
          this.emit('disconnected');
        });

      } catch (error) {
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }

  async disconnect() {
    return new Promise((resolve) => {
      if (this.socket) {
        this.socket.end();
        this.socket.destroy();
        this.socket = null;
      }
      this.connected = false;
      resolve({ success: true });
    });
  }

  isConnected() {
    return this.connected;
  }

  async sendCommand(command, data = {}) {
    if (!this.connected) {
      return {
        success: false,
        error: 'Not connected to camera'
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Command timeout'
        });
      }, this.commandTimeout);

      const responseHandler = (data) => {
        clearTimeout(timeout);
        this.socket.removeListener('data', responseHandler);
        
        try {
          const response = this.parseResponse(data.toString());
          resolve(response);
        } catch (error) {
          resolve({
            success: false,
            error: 'Failed to parse response'
          });
        }
      };

      this.socket.on('data', responseHandler);
      
      const capCommand = this.formatCAPCommand(command, data);
      this.socket.write(capCommand);
    });
  }

  formatCAPCommand(command, data) {
    let method, path, body = '';

    switch (command) {
      case 'getCameraStatus':
        method = 'GET';
        path = '/camera/status';
        break;
      case 'setFrameRate':
        method = 'PUT';
        path = '/camera/frameRate';
        body = JSON.stringify({ frameRate: data.frameRate });
        break;
      case 'setWhiteBalance':
        method = 'PUT';
        path = '/camera/whiteBalance';
        body = JSON.stringify({ kelvin: data.kelvin });
        break;
      case 'setISO':
        method = 'PUT';
        path = '/camera/iso';
        body = JSON.stringify({ iso: data.iso });
        break;
      case 'setNDFilter':
        method = 'PUT';
        path = '/camera/ndFilter';
        body = JSON.stringify({ ndStop: data.ndStop });
        break;
      case 'setPlaybackMode':
        method = 'PUT';
        path = '/playback/mode';
        body = JSON.stringify({ mode: data.mode });
        break;
      case 'controlPlayback':
        method = 'PUT';
        path = '/playback/control';
        body = JSON.stringify({ action: data.action, ...data.params });
        break;
      case 'getCurrentTimecode':
        method = 'GET';
        path = '/timecode/current';
        break;
      case 'syncTimecode':
        method = 'PUT';
        path = '/timecode/sync';
        break;
      case 'loadLUT':
        method = 'PUT';
        path = '/grading/lut';
        body = JSON.stringify({ lutId: data.lutId });
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }

    let request = `${method} ${path} HTTP/1.1\r\n`;
    request += `Host: ${this.host}\r\n`;
    
    if (body) {
      request += `Content-Type: application/json\r\n`;
      request += `Content-Length: ${body.length}\r\n`;
    }
    
    request += '\r\n';
    
    if (body) {
      request += body;
    }

    return request;
  }

  parseResponse(responseText) {
    const lines = responseText.split('\r\n');
    const statusLine = lines[0];
    const statusMatch = statusLine.match(/HTTP\/1\.1 (\d+) (.+)/);
    
    if (!statusMatch) {
      return {
        success: false,
        error: 'Invalid HTTP response'
      };
    }

    const statusCode = parseInt(statusMatch[1]);
    const statusText = statusMatch[2];

    // Find the JSON body
    const bodyStartIndex = responseText.indexOf('\r\n\r\n') + 4;
    const body = responseText.substring(bodyStartIndex);

    if (statusCode >= 200 && statusCode < 300) {
      try {
        const data = JSON.parse(body);
        return {
          success: true,
          data
        };
      } catch (error) {
        return {
          success: true,
          data: {}
        };
      }
    } else {
      try {
        const errorData = JSON.parse(body);
        return {
          success: false,
          error: errorData.error || { message: statusText },
          code: errorData.error?.code
        };
      } catch (error) {
        return {
          success: false,
          error: statusText
        };
      }
    }
  }

  // Convenience methods
  async getCameraStatus() {
    return this.sendCommand('getCameraStatus');
  }

  async setFrameRate(frameRate) {
    return this.sendCommand('setFrameRate', { frameRate });
  }

  async setWhiteBalance(kelvin) {
    return this.sendCommand('setWhiteBalance', { kelvin });
  }

  async setISO(iso) {
    return this.sendCommand('setISO', { iso });
  }

  async setNDFilter(ndStop) {
    return this.sendCommand('setNDFilter', { ndStop });
  }

  async setPlaybackMode(mode) {
    return this.sendCommand('setPlaybackMode', { mode });
  }

  async controlPlayback(action, params = {}) {
    return this.sendCommand('controlPlayback', { action, params });
  }

  async getCurrentTimecode() {
    return this.sendCommand('getCurrentTimecode');
  }

  async syncTimecode() {
    return this.sendCommand('syncTimecode');
  }

  async loadLUT(lutId) {
    return this.sendCommand('loadLUT', { lutId });
  }

  async sendRawCommand(rawCommand) {
    if (!this.connected) {
      return {
        success: false,
        error: 'Not connected to camera'
      };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Command timeout'
        });
      }, this.commandTimeout);

      const responseHandler = (data) => {
        clearTimeout(timeout);
        this.socket.removeListener('data', responseHandler);
        
        try {
          const response = this.parseResponse(data.toString());
          resolve(response);
        } catch (error) {
          resolve({
            success: false,
            error: 'Failed to parse response'
          });
        }
      };

      this.socket.on('data', responseHandler);
      this.socket.write(rawCommand);
    });
  }
}

module.exports = { CAPProtocol };