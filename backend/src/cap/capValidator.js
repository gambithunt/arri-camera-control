/**
 * CAP Protocol Validator
 * Validates CAP protocol messages and payloads
 */

class CAPValidator {
  constructor() {
    this.validCommands = [
      'GET /camera/status',
      'PUT /camera/frameRate',
      'PUT /camera/whiteBalance',
      'PUT /camera/iso',
      'PUT /camera/ndFilter',
      'PUT /playback/mode',
      'PUT /playback/control',
      'GET /timecode/current',
      'PUT /timecode/sync',
      'PUT /grading/lut'
    ];
  }

  validateRequest(request) {
    const lines = request.split('\r\n');
    
    if (lines.length < 2) {
      return {
        valid: false,
        errors: ['Invalid request format - missing headers']
      };
    }

    const requestLine = lines[0];
    const httpMatch = requestLine.match(/^(GET|PUT|POST|DELETE) (.+) HTTP\/1\.1$/);
    
    if (!httpMatch) {
      return {
        valid: false,
        errors: ['Invalid HTTP request line']
      };
    }

    const method = httpMatch[1];
    const path = httpMatch[2];
    const command = `${method} ${path}`;

    const isValidCommand = this.validCommands.some(validCmd => 
      command.startsWith(validCmd)
    );

    if (!isValidCommand) {
      return {
        valid: false,
        errors: [`Unknown command: ${command}`]
      };
    }

    // Check for required Host header
    const hasHostHeader = lines.some(line => 
      line.toLowerCase().startsWith('host:')
    );

    if (!hasHostHeader) {
      return {
        valid: false,
        errors: ['Missing Host header']
      };
    }

    return {
      valid: true,
      command,
      method,
      path
    };
  }

  validateResponse(response) {
    const lines = response.split('\r\n');
    
    if (lines.length < 1) {
      return {
        valid: false,
        errors: ['Invalid response format']
      };
    }

    const statusLine = lines[0];
    const statusMatch = statusLine.match(/^HTTP\/1\.1 (\d{3}) (.+)$/);
    
    if (!statusMatch) {
      return {
        valid: false,
        errors: ['Invalid HTTP status line']
      };
    }

    const statusCode = parseInt(statusMatch[1]);
    const statusText = statusMatch[2];

    if (statusCode < 100 || statusCode > 599) {
      return {
        valid: false,
        errors: ['Invalid HTTP status code']
      };
    }

    return {
      valid: true,
      statusCode,
      statusText
    };
  }

  validatePayload(payload, type) {
    const errors = [];

    switch (type) {
      case 'camera-control':
        if (payload.frameRate !== undefined) {
          if (typeof payload.frameRate !== 'number' || 
              payload.frameRate < 1 || payload.frameRate > 120) {
            errors.push('Frame rate must be a number between 1 and 120');
          }
        }

        if (payload.kelvin !== undefined) {
          if (typeof payload.kelvin !== 'number' || 
              payload.kelvin < 2000 || payload.kelvin > 11000) {
            errors.push('White balance must be a number between 2000 and 11000');
          }
        }

        if (payload.iso !== undefined) {
          const validISOs = [100, 200, 400, 800, 1600, 3200, 6400];
          if (!validISOs.includes(payload.iso)) {
            errors.push(`ISO must be one of: ${validISOs.join(', ')}`);
          }
        }

        if (payload.ndStop !== undefined) {
          const validStops = [0, 0.6, 1.2, 1.8, 2.4, 3.0];
          if (!validStops.includes(payload.ndStop)) {
            errors.push(`ND stop must be one of: ${validStops.join(', ')}`);
          }
        }
        break;

      case 'playback-control':
        if (payload.mode !== undefined) {
          const validModes = ['record', 'playback'];
          if (!validModes.includes(payload.mode)) {
            errors.push(`Mode must be one of: ${validModes.join(', ')}`);
          }
        }

        if (payload.action !== undefined) {
          const validActions = ['play', 'pause', 'stop', 'seek'];
          if (!validActions.includes(payload.action)) {
            errors.push(`Action must be one of: ${validActions.join(', ')}`);
          }
        }
        break;

      case 'timecode':
        if (payload.timecode !== undefined) {
          const timecodePattern = /^\d{2}:\d{2}:\d{2}:\d{2}$/;
          if (!timecodePattern.test(payload.timecode)) {
            errors.push('Timecode must be in format HH:MM:SS:FF');
          }
        }
        break;

      default:
        // Generic JSON validation
        try {
          JSON.stringify(payload);
        } catch (error) {
          errors.push('Invalid JSON payload');
        }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateTimecode(timecode) {
    const pattern = /^(\d{2}):(\d{2}):(\d{2}):(\d{2})$/;
    const match = timecode.match(pattern);
    
    if (!match) {
      return {
        valid: false,
        error: 'Invalid timecode format. Expected HH:MM:SS:FF'
      };
    }

    const [, hours, minutes, seconds, frames] = match;
    
    if (parseInt(hours) > 23) {
      return {
        valid: false,
        error: 'Hours must be 00-23'
      };
    }

    if (parseInt(minutes) > 59) {
      return {
        valid: false,
        error: 'Minutes must be 00-59'
      };
    }

    if (parseInt(seconds) > 59) {
      return {
        valid: false,
        error: 'Seconds must be 00-59'
      };
    }

    if (parseInt(frames) > 29) {
      return {
        valid: false,
        error: 'Frames must be 00-29'
      };
    }

    return {
      valid: true,
      parsed: {
        hours: parseInt(hours),
        minutes: parseInt(minutes),
        seconds: parseInt(seconds),
        frames: parseInt(frames)
      }
    };
  }
}

module.exports = { CAPValidator };