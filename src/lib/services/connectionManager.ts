/**
 * Connection Manager Service
 * Handles initialization and management of WebSocket connections
 */

import { browser } from '$app/environment';
import { socketClient } from '$lib/websocket/socketClient';
import { cameraApi } from '$lib/api/cameraApi';
import { writable } from 'svelte/store';

export interface ConnectionManagerState {
  initialized: boolean;
  autoConnectEnabled: boolean;
  lastCameraIP: string | null;
  connectionHistory: string[];
}

class ConnectionManager {
  private state = writable<ConnectionManagerState>({
    initialized: false,
    autoConnectEnabled: true,
    lastCameraIP: null,
    connectionHistory: []
  });

  private storageKey = 'arri-camera-control-connection';

  /**
   * Initialize the connection manager
   */
  async initialize(): Promise<void> {
    if (!browser) return;

    try {
      // Load saved settings
      this.loadSettings();

      // Initialize socket client
      await this.initializeSocket();

      // Mark as initialized
      this.state.update(s => ({ ...s, initialized: true }));

      console.log('Connection manager initialized');
    } catch (error) {
      console.error('Failed to initialize connection manager:', error);
    }
  }

  /**
   * Initialize socket connection
   */
  private async initializeSocket(): Promise<void> {
    // Set up automatic reconnection handling
    socketClient.connectionStatus.subscribe((status) => {
      if (status.connected) {
        console.log('Socket connected to server');
      } else if (status.error) {
        console.warn('Socket connection error:', status.error);
      }
    });

    // Auto-connect if enabled and we have server available
    const currentState = await this.getCurrentState();
    if (currentState.autoConnectEnabled) {
      try {
        await socketClient.connect();
      } catch (error) {
        console.warn('Auto-connect failed:', error);
      }
    }
  }

  /**
   * Connect to camera with optional IP
   */
  async connectToCamera(cameraIP?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Ensure socket is connected first
      if (!socketClient.isConnected()) {
        const socketConnected = await socketClient.connect();
        if (!socketConnected) {
          return {
            success: false,
            error: 'Failed to connect to server'
          };
        }
      }

      // Connect to camera
      const result = await cameraApi.connect(cameraIP);
      
      if (result.success && cameraIP) {
        // Save successful connection
        this.saveConnectionHistory(cameraIP);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Disconnect from camera
   */
  async disconnectFromCamera(): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await cameraApi.disconnect();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get connection manager state
   */
  getState() {
    return this.state;
  }

  /**
   * Get current state (non-reactive)
   */
  private async getCurrentState(): Promise<ConnectionManagerState> {
    return new Promise((resolve) => {
      const unsubscribe = this.state.subscribe((state) => {
        unsubscribe();
        resolve(state);
      });
    });
  }

  /**
   * Enable/disable auto-connect
   */
  setAutoConnect(enabled: boolean): void {
    this.state.update(s => ({ ...s, autoConnectEnabled: enabled }));
    this.saveSettings();
  }

  /**
   * Get connection history
   */
  getConnectionHistory(): Promise<string[]> {
    return this.getCurrentState().then(state => state.connectionHistory);
  }

  /**
   * Clear connection history
   */
  clearConnectionHistory(): void {
    this.state.update(s => ({ ...s, connectionHistory: [] }));
    this.saveSettings();
  }

  /**
   * Save connection to history
   */
  private saveConnectionHistory(cameraIP: string): void {
    this.state.update(state => {
      const history = [...state.connectionHistory];
      
      // Remove if already exists
      const existingIndex = history.indexOf(cameraIP);
      if (existingIndex > -1) {
        history.splice(existingIndex, 1);
      }
      
      // Add to beginning
      history.unshift(cameraIP);
      
      // Keep only last 10
      if (history.length > 10) {
        history.splice(10);
      }
      
      return {
        ...state,
        lastCameraIP: cameraIP,
        connectionHistory: history
      };
    });
    
    this.saveSettings();
  }

  /**
   * Load settings from localStorage
   */
  private loadSettings(): void {
    if (!browser) return;

    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const settings = JSON.parse(saved);
        this.state.update(state => ({
          ...state,
          autoConnectEnabled: settings.autoConnectEnabled ?? true,
          lastCameraIP: settings.lastCameraIP || null,
          connectionHistory: settings.connectionHistory || []
        }));
      }
    } catch (error) {
      console.warn('Failed to load connection settings:', error);
    }
  }

  /**
   * Save settings to localStorage
   */
  private saveSettings(): void {
    if (!browser) return;

    this.getCurrentState().then(state => {
      try {
        const settings = {
          autoConnectEnabled: state.autoConnectEnabled,
          lastCameraIP: state.lastCameraIP,
          connectionHistory: state.connectionHistory
        };
        localStorage.setItem(this.storageKey, JSON.stringify(settings));
      } catch (error) {
        console.warn('Failed to save connection settings:', error);
      }
    });
  }

  /**
   * Get server configuration
   */
  getServerConfig() {
    return {
      url: socketClient.connectionStatus,
      isConnected: socketClient.isConnected()
    };
  }

  /**
   * Reconnect to server
   */
  async reconnectToServer(): Promise<boolean> {
    try {
      return await socketClient.reconnect();
    } catch (error) {
      console.error('Server reconnection failed:', error);
      return false;
    }
  }

  /**
   * Reset connection attempts
   */
  resetConnectionAttempts(): void {
    socketClient.resetReconnectionAttempts();
  }
}

// Export singleton instance
export const connectionManager = new ConnectionManager();

/**
 * Initialize connection manager on app startup
 */
export async function initializeConnectionManager(): Promise<void> {
  if (!browser) return;

  try {
    await connectionManager.initialize();
    console.log('Connection manager ready');
  } catch (error) {
    console.error('Connection manager initialization failed:', error);
  }
}