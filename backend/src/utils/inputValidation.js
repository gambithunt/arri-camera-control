/**
 * Input Validation Utilities
 * Provides sanitization and validation for camera control inputs
 */

const { logger } = require('./logger.js');

class InputValidator {
  constructor() {
    // Define validation rules
    this.validationRules = {
      frameRate: {
        type: 'number',
        min: 1,
        max: 120,
        allowedValues: [23.98, 24, 25, 29.97, 30, 48, 50, 59.94, 60]
      },
      kelvin: {
        type: 'number',
        min: 2000,
        max: 11000
      },
      tint: {
        type: 'number',
        min: -100,
        max: 100
      },
      iso: {
        type: 'number',
        min: 100,
        max: 25600,
        allowedValues: [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600]
      },
      ndStop: {
        type: 'number',
        min: 0,
        max: 3.0,
        allowedValues: [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4]
      },
      lutName: {
        type: 'string',
        minLength: 1,
        maxLength: 100,
        pattern: /^[a-zA-Z0-9_\-\s\.]+$/
      },
      boolean: {
        type: 'boolean'
      },
      playbackSpeed: {
        type: 'number',
        allowedValues: [-4, -2, -1, -0.5, 0, 0.5, 1, 2, 4]
      },
      shuttlePosition: {
        type: 'number',
        min: 0,
        max: 1
      },
      clipIndex: {
        type: 'number',
        min: 0
      }
    };
  }

  /**
   * Validate and sanitize frame rate input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateFrameRate(value) {
    return this.validateInput(value, this.validationRules.frameRate, 'frameRate');
  }

  /**
   * Validate and sanitize white balance kelvin input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateKelvin(value) {
    return this.validateInput(value, this.validationRules.kelvin, 'kelvin');
  }

  /**
   * Validate and sanitize white balance tint input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateTint(value) {
    return this.validateInput(value, this.validationRules.tint, 'tint');
  }

  /**
   * Validate and sanitize ISO input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateISO(value) {
    return this.validateInput(value, this.validationRules.iso, 'iso');
  }

  /**
   * Validate and sanitize ND stop input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateNDStop(value) {
    return this.validateInput(value, this.validationRules.ndStop, 'ndStop');
  }

  /**
   * Validate and sanitize LUT name input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateLUTName(value) {
    return this.validateInput(value, this.validationRules.lutName, 'lutName');
  }

  /**
   * Validate boolean input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateBoolean(value) {
    return this.validateInput(value, this.validationRules.boolean, 'boolean');
  }

  /**
   * Validate playback speed input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validatePlaybackSpeed(value) {
    return this.validateInput(value, this.validationRules.playbackSpeed, 'playbackSpeed');
  }

  /**
   * Validate shuttle position input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateShuttlePosition(value) {
    return this.validateInput(value, this.validationRules.shuttlePosition, 'shuttlePosition');
  }

  /**
   * Validate clip index input
   * @param {*} value - Input value
   * @returns {Object} Validation result
   */
  validateClipIndex(value) {
    return this.validateInput(value, this.validationRules.clipIndex, 'clipIndex');
  }

  /**
   * Generic input validation
   * @param {*} value - Input value
   * @param {Object} rule - Validation rule
   * @param {string} fieldName - Field name for logging
   * @returns {Object} Validation result
   */
  validateInput(value, rule, fieldName) {
    const result = {
      isValid: false,
      sanitizedValue: null,
      errors: []
    };

    try {
      // Check if value is undefined or null
      if (value === undefined || value === null) {
        result.errors.push(`${fieldName} is required`);
        return result;
      }

      // Type validation
      if (!this.validateType(value, rule.type)) {
        result.errors.push(`${fieldName} must be of type ${rule.type}`);
        return result;
      }

      // Sanitize based on type
      let sanitizedValue = this.sanitizeValue(value, rule.type);

      // Number-specific validations
      if (rule.type === 'number') {
        // Range validation
        if (rule.min !== undefined && sanitizedValue < rule.min) {
          result.errors.push(`${fieldName} must be at least ${rule.min}`);
          return result;
        }

        if (rule.max !== undefined && sanitizedValue > rule.max) {
          result.errors.push(`${fieldName} must be at most ${rule.max}`);
          return result;
        }

        // Allowed values validation
        if (rule.allowedValues && !rule.allowedValues.includes(sanitizedValue)) {
          result.errors.push(`${fieldName} must be one of: ${rule.allowedValues.join(', ')}`);
          return result;
        }
      }

      // String-specific validations
      if (rule.type === 'string') {
        // Length validation
        if (rule.minLength !== undefined && sanitizedValue.length < rule.minLength) {
          result.errors.push(`${fieldName} must be at least ${rule.minLength} characters long`);
          return result;
        }

        if (rule.maxLength !== undefined && sanitizedValue.length > rule.maxLength) {
          result.errors.push(`${fieldName} must be at most ${rule.maxLength} characters long`);
          return result;
        }

        // Pattern validation
        if (rule.pattern && !rule.pattern.test(sanitizedValue)) {
          result.errors.push(`${fieldName} contains invalid characters`);
          return result;
        }
      }

      // If we get here, validation passed
      result.isValid = true;
      result.sanitizedValue = sanitizedValue;

    } catch (error) {
      logger.error(`Input validation error for ${fieldName}:`, {
        fieldName,
        value,
        error: error.message,
        stack: error.stack
      });
      result.errors.push(`Validation error for ${fieldName}`);
    }

    return result;
  }

  /**
   * Validate type of input
   * @param {*} value - Input value
   * @param {string} expectedType - Expected type
   * @returns {boolean} Whether type is valid
   */
  validateType(value, expectedType) {
    switch (expectedType) {
      case 'number':
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
      case 'string':
        return typeof value === 'string';
      case 'boolean':
        return typeof value === 'boolean';
      default:
        return false;
    }
  }

  /**
   * Sanitize input value based on type
   * @param {*} value - Input value
   * @param {string} type - Expected type
   * @returns {*} Sanitized value
   */
  sanitizeValue(value, type) {
    switch (type) {
      case 'number':
        // Round to reasonable precision for camera values
        return Math.round(value * 100) / 100;
      case 'string':
        // Trim whitespace and limit length
        return value.toString().trim().substring(0, 1000);
      case 'boolean':
        return Boolean(value);
      default:
        return value;
    }
  }

  /**
   * Validate multiple inputs at once
   * @param {Object} inputs - Object with input values
   * @param {Object} rules - Object with validation rules
   * @returns {Object} Validation results
   */
  validateMultiple(inputs, rules) {
    const results = {
      isValid: true,
      sanitizedInputs: {},
      errors: {}
    };

    Object.keys(rules).forEach(fieldName => {
      const value = inputs[fieldName];
      const rule = rules[fieldName];
      
      const fieldResult = this.validateInput(value, rule, fieldName);
      
      if (fieldResult.isValid) {
        results.sanitizedInputs[fieldName] = fieldResult.sanitizedValue;
      } else {
        results.isValid = false;
        results.errors[fieldName] = fieldResult.errors;
      }
    });

    return results;
  }

  /**
   * Validate camera control data
   * @param {Object} data - Camera control data
   * @param {string} controlType - Type of control (frameRate, whiteBalance, etc.)
   * @returns {Object} Validation result
   */
  validateCameraControl(data, controlType) {
    const validationRules = {
      frameRate: {
        frameRate: this.validationRules.frameRate
      },
      whiteBalance: {
        kelvin: { ...this.validationRules.kelvin, required: false },
        tint: { ...this.validationRules.tint, required: false }
      },
      iso: {
        iso: this.validationRules.iso
      },
      ndFilter: {
        ndStop: this.validationRules.ndStop
      },
      frameLines: {
        enabled: this.validationRules.boolean
      },
      lut: {
        lutName: this.validationRules.lutName
      },
      playbackSpeed: {
        speed: this.validationRules.playbackSpeed
      },
      playbackShuttle: {
        position: this.validationRules.shuttlePosition
      },
      clipSkip: {
        clipIndex: this.validationRules.clipIndex
      }
    };

    const rules = validationRules[controlType];
    if (!rules) {
      return {
        isValid: false,
        errors: { general: [`Unknown control type: ${controlType}`] }
      };
    }

    // Handle optional fields for white balance
    if (controlType === 'whiteBalance') {
      const filteredData = {};
      const filteredRules = {};
      
      if (data.kelvin !== undefined) {
        filteredData.kelvin = data.kelvin;
        filteredRules.kelvin = rules.kelvin;
      }
      
      if (data.tint !== undefined) {
        filteredData.tint = data.tint;
        filteredRules.tint = rules.tint;
      }
      
      if (Object.keys(filteredData).length === 0) {
        return {
          isValid: false,
          errors: { general: ['At least one white balance parameter (kelvin or tint) is required'] }
        };
      }
      
      return this.validateMultiple(filteredData, filteredRules);
    }

    return this.validateMultiple(data, rules);
  }

  /**
   * Sanitize object by removing potentially dangerous properties
   * @param {Object} obj - Object to sanitize
   * @returns {Object} Sanitized object
   */
  sanitizeObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return {};
    }

    const sanitized = {};
    const allowedKeys = [
      'frameRate', 'kelvin', 'tint', 'iso', 'ndStop', 'enabled', 'lutName',
      'speed', 'position', 'clipIndex', 'refresh',
      'clientId', 'timestamp', 'messageId'
    ];

    Object.keys(obj).forEach(key => {
      if (allowedKeys.includes(key) && obj[key] !== undefined) {
        sanitized[key] = obj[key];
      }
    });

    return sanitized;
  }

  /**
   * Get validation rules for a specific control type
   * @param {string} controlType - Control type
   * @returns {Object} Validation rules
   */
  getValidationRules(controlType) {
    const rules = {
      frameRate: { frameRate: this.validationRules.frameRate },
      whiteBalance: { 
        kelvin: this.validationRules.kelvin,
        tint: this.validationRules.tint
      },
      iso: { iso: this.validationRules.iso },
      ndFilter: { ndStop: this.validationRules.ndStop },
      frameLines: { enabled: this.validationRules.boolean },
      lut: { lutName: this.validationRules.lutName }
    };

    return rules[controlType] || {};
  }
}

// Create singleton instance
const inputValidator = new InputValidator();

module.exports = { InputValidator, inputValidator };