/**
 * Authentication Handler
 * Handles WebSocket client authentication (for future use)
 */

const { logger } = require('../utils/logger.js');

class AuthenticationHandler {
  constructor(wsManager) {
    this.wsManager = wsManager;
    this.authenticatedClients = new Set();
  }

  /**
   * Handle client authentication
   * @param {Socket} socket - Socket.io socket instance
   * @param {Object} data - Authentication data
   */
  async handleAuthentication(socket, data) {
    try {
      const { token, method = 'none' } = data;

      logger.info(`Client ${socket.id} attempting authentication`, {
        clientId: socket.id,
        method
      });

      // Get client info
      const clientInfo = this.wsManager.connections.get(socket.id);
      if (!clientInfo) {
        socket.emit('auth:error', {
          message: 'Client not found',
          code: 'CLIENT_NOT_FOUND',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Handle different authentication methods
      let authResult;
      switch (method) {
        case 'none':
          authResult = await this.handleNoAuth(socket);
          break;
        case 'token':
          authResult = await this.handleTokenAuth(socket, token);
          break;
        default:
          socket.emit('auth:error', {
            message: 'Unsupported authentication method',
            code: 'UNSUPPORTED_METHOD',
            method,
            timestamp: new Date().toISOString()
          });
          return;
      }

      if (authResult.success) {
        // Mark client as authenticated
        clientInfo.authenticated = true;
        this.authenticatedClients.add(socket.id);

        socket.emit('auth:success', {
          method,
          clientId: socket.id,
          permissions: authResult.permissions,
          timestamp: new Date().toISOString()
        });

        logger.info(`Client ${socket.id} authenticated successfully`, {
          clientId: socket.id,
          method,
          permissions: authResult.permissions
        });
      } else {
        socket.emit('auth:error', {
          message: authResult.message,
          code: authResult.code,
          method,
          timestamp: new Date().toISOString()
        });

        logger.warn(`Client ${socket.id} authentication failed`, {
          clientId: socket.id,
          method,
          reason: authResult.message
        });
      }

    } catch (error) {
      logger.error(`Authentication error for client ${socket.id}:`, {
        clientId: socket.id,
        error: error.message,
        stack: error.stack
      });

      socket.emit('auth:error', {
        message: 'Authentication failed',
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle no authentication (allow all)
   * @param {Socket} socket - Socket.io socket instance
   * @returns {Object} Authentication result
   */
  async handleNoAuth(socket) {
    return {
      success: true,
      permissions: ['camera:control', 'playback:control', 'settings:read', 'settings:write'],
      message: 'No authentication required'
    };
  }

  /**
   * Handle token-based authentication
   * @param {Socket} socket - Socket.io socket instance
   * @param {string} token - Authentication token
   * @returns {Object} Authentication result
   */
  async handleTokenAuth(socket, token) {
    // For now, this is a placeholder implementation
    // In a real application, you would validate the token against a database or JWT
    
    if (!token) {
      return {
        success: false,
        code: 'MISSING_TOKEN',
        message: 'Authentication token is required'
      };
    }

    // Simple token validation (replace with real implementation)
    const validTokens = process.env.VALID_TOKENS?.split(',') || ['demo-token'];
    
    if (!validTokens.includes(token)) {
      return {
        success: false,
        code: 'INVALID_TOKEN',
        message: 'Invalid authentication token'
      };
    }

    return {
      success: true,
      permissions: ['camera:control', 'playback:control', 'settings:read', 'settings:write'],
      message: 'Token authentication successful'
    };
  }

  /**
   * Check if client is authenticated
   * @param {string} clientId - Client ID
   * @returns {boolean} Whether client is authenticated
   */
  isAuthenticated(clientId) {
    return this.authenticatedClients.has(clientId);
  }

  /**
   * Require authentication for socket event
   * @param {Socket} socket - Socket.io socket instance
   * @param {Function} next - Next function
   */
  requireAuth(socket, next) {
    if (this.isAuthenticated(socket.id)) {
      next();
    } else {
      socket.emit('auth:required', {
        message: 'Authentication required for this operation',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check if client has permission
   * @param {string} clientId - Client ID
   * @param {string} permission - Required permission
   * @returns {boolean} Whether client has permission
   */
  hasPermission(clientId, permission) {
    // For now, all authenticated clients have all permissions
    // In a real application, you would check against stored permissions
    return this.isAuthenticated(clientId);
  }

  /**
   * Revoke authentication for client
   * @param {string} clientId - Client ID
   */
  revokeAuthentication(clientId) {
    this.authenticatedClients.delete(clientId);
    
    const clientInfo = this.wsManager.connections.get(clientId);
    if (clientInfo) {
      clientInfo.authenticated = false;
      clientInfo.socket.emit('auth:revoked', {
        message: 'Authentication has been revoked',
        timestamp: new Date().toISOString()
      });
    }

    logger.info(`Authentication revoked for client ${clientId}`, {
      clientId
    });
  }

  /**
   * Get authentication statistics
   * @returns {Object} Authentication statistics
   */
  getAuthStats() {
    const totalClients = this.wsManager.connections.size;
    const authenticatedClients = this.authenticatedClients.size;
    
    return {
      totalClients,
      authenticatedClients,
      unauthenticatedClients: totalClients - authenticatedClients,
      authenticationRate: totalClients > 0 ? (authenticatedClients / totalClients) * 100 : 0
    };
  }

  /**
   * Clean up authentication data for disconnected client
   * @param {string} clientId - Client ID
   */
  cleanup(clientId) {
    this.authenticatedClients.delete(clientId);
  }
}

module.exports = { AuthenticationHandler };