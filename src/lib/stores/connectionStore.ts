/**
 * Connection State Store
 * Manages WebSocket and camera connection status
 */

import { writable, derived } from 'svelte/store';
import { createPersistedStore } from './storeUtils';

export interface ConnectionState {
  // WebSocket connection
  socketConnected: boolean;
  socketConnecting: boolean;
  socketError: string | null;
  socketReconnectAttempts: number;
  socketLastConnected: Date | null;
  
  // Camera connection
  cameraConnected: boolean;
  cameraConnecting: boolean;
  cameraError: string | null;
  cameraIP: string | null;
  cameraLastConnected: Date | null;
  
  // Server information
  serverUrl: string;
  serverVersion: string | null;
  serverStatus: 'online' | 'offline' | 'unknown';
  
  // Connection history
  connectionHistory: string[];
  autoConnectEnabled: boolean;
  
  // Network status
  networkOnline: boolean;
  networkType: string | null;
  
  // Metadata
  lastUpdate: Date | null;
}

const initialConnectionState: ConnectionState = {
  socketConnected: false,
  socketConnecting: false,
  socketError: null,
  socketReconnectAttempts: 0,
  socketLastConnected: null,
  cameraConnected: false,
  cameraConnecting: false,
  cameraError: null,
  cameraIP: null,
  cameraLastConnected: null,
  serverUrl: 'http://localhost:3001',
  serverVersion: null,
  serverStatus: 'unknown',
  connectionHistory: [],
  autoConnectEnabled: true,
  networkOnline: true,
  networkType: null,
  lastUpdate: null
};

// Main connection state store
const connectionState = writable<ConnectionState>(initialConnectionState);

// Persisted connection settings
const connectionSettings = createPersistedStore('connection-settings', {
  serverUrl: initialConnectionState.serverUrl,
  autoConnectEnabled: initialConnectionState.autoConnectEnabled,
  connectionHistory: initialConnectionState.connectionHistory,
  lastCameraIP: null as string | null
}, {
  validator: (value: any) => {
    return typeof value === 'object' &&
           typeof value.serverUrl === 'string' &&
           typeof value.autoConnectEnabled === 'boolean' &&
           Array.isArray(value.connectionHistory);
  }
});

// Derived stores for specific aspects
const socketStatus = derived(
  connectionState,
  ($connection) => ({
    connected: $connection.socketConnected,
    connecting: $connection.socketConnecting,
    error: $connection.socketError,
    reconnectAttempts: $connection.socketReconnectAttempts,
    lastConnected: $connection.socketLastConnected
  })
);

const cameraStatus = derived(
  connectionState,
  ($connection) => ({
    connected: $connection.cameraConnected,
    connecting: $connection.cameraConnecting,
    error: $connection.cameraError,
    ip: $connection.cameraIP,
    lastConnected: $connection.cameraLastConnected
  })
);

const serverStatus = derived(
  connectionState,
  ($connection) => ({
    url: $connection.serverUrl,
    version: $connection.serverVersion,
    status: $connection.serverStatus,
    online: $connection.serverStatus === 'online'
  })
);

const overallStatus = derived(
  connectionState,
  ($connection) => {
    const isFullyConnected = $connection.socketConnected && $connection.cameraConnected;
    const isConnecting = $connection.socketConnecting || $connection.cameraConnecting;
    const hasError = $connection.socketError || $connection.cameraError;
    
    let status: 'connected' | 'connecting' | 'disconnected' | 'error';
    if (isFullyConnected) {
      status = 'connected';
    } else if (isConnecting) {
      status = 'connecting';
    } else if (hasError) {
      status = 'error';
    } else {
      status = 'disconnected';
    }
    
    return {
      status,
      fullyConnected: isFullyConnected,
      connecting: isConnecting,
      error: hasError ? ($connection.cameraError || $connection.socketError) : null,
      networkOnline: $connection.networkOnline
    };
  }
);

const connectionHistory = derived(
  connectionState,
  ($connection) => ({
    history: $connection.connectionHistory,
    autoConnectEnabled: $connection.autoConnectEnabled
  })
);

// Store actions
const connectionActions = {
  /**
   * Update socket connection status
   */
  updateSocketStatus(updates: Partial<Pick<ConnectionState, 'socketConnected' | 'socketConnecting' | 'socketError' | 'socketReconnectAttempts'>>) {
    connectionState.update(state => ({
      ...state,
      ...updates,
      socketLastConnected: updates.socketConnected ? new Date() : state.socketLastConnected,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update camera connection status
   */
  updateCameraStatus(updates: Partial<Pick<ConnectionState, 'cameraConnected' | 'cameraConnecting' | 'cameraError' | 'cameraIP'>>) {
    connectionState.update(state => ({
      ...state,
      ...updates,
      cameraLastConnected: updates.cameraConnected ? new Date() : state.cameraLastConnected,
      lastUpdate: new Date()
    }));

    // Save successful camera IP to history
    if (updates.cameraConnected && updates.cameraIP) {
      connectionActions.addToHistory(updates.cameraIP);
    }
  },

  /**
   * Update server information
   */
  updateServerInfo(updates: Partial<Pick<ConnectionState, 'serverUrl' | 'serverVersion' | 'serverStatus'>>) {
    connectionState.update(state => ({
      ...state,
      ...updates,
      lastUpdate: new Date()
    }));

    // Persist server URL changes
    if (updates.serverUrl) {
      connectionSettings.update(settings => ({
        ...settings,
        serverUrl: updates.serverUrl!
      }));
    }
  },

  /**
   * Update network status
   */
  updateNetworkStatus(online: boolean, type: string | null = null) {
    connectionState.update(state => ({
      ...state,
      networkOnline: online,
      networkType: type,
      lastUpdate: new Date()
    }));
  },

  /**
   * Add IP to connection history
   */
  addToHistory(ip: string) {
    connectionState.update(state => {
      const history = [...state.connectionHistory];
      
      // Remove if already exists
      const existingIndex = history.indexOf(ip);
      if (existingIndex > -1) {
        history.splice(existingIndex, 1);
      }
      
      // Add to beginning
      history.unshift(ip);
      
      // Keep only last 10
      if (history.length > 10) {
        history.splice(10);
      }
      
      return {
        ...state,
        connectionHistory: history,
        lastUpdate: new Date()
      };
    });

    // Persist to settings
    connectionSettings.update(settings => ({
      ...settings,
      connectionHistory: [...connectionState.subscribe(s => s.connectionHistory)],
      lastCameraIP: ip
    }));
  },

  /**
   * Clear connection history
   */
  clearHistory() {
    connectionState.update(state => ({
      ...state,
      connectionHistory: [],
      lastUpdate: new Date()
    }));

    connectionSettings.update(settings => ({
      ...settings,
      connectionHistory: [],
      lastCameraIP: null
    }));
  },

  /**
   * Set auto-connect preference
   */
  setAutoConnect(enabled: boolean) {
    connectionState.update(state => ({
      ...state,
      autoConnectEnabled: enabled,
      lastUpdate: new Date()
    }));

    connectionSettings.update(settings => ({
      ...settings,
      autoConnectEnabled: enabled
    }));
  },

  /**
   * Reset connection state
   */
  reset() {
    connectionState.update(state => ({
      ...initialConnectionState,
      serverUrl: state.serverUrl,
      connectionHistory: state.connectionHistory,
      autoConnectEnabled: state.autoConnectEnabled,
      networkOnline: state.networkOnline,
      networkType: state.networkType
    }));
  },

  /**
   * Reset reconnection attempts
   */
  resetReconnectAttempts() {
    connectionState.update(state => ({
      ...state,
      socketReconnectAttempts: 0,
      lastUpdate: new Date()
    }));
  },

  /**
   * Load persisted settings
   */
  loadPersistedSettings() {
    connectionSettings.subscribe(settings => {
      connectionState.update(state => ({
        ...state,
        serverUrl: settings.serverUrl,
        autoConnectEnabled: settings.autoConnectEnabled,
        connectionHistory: settings.connectionHistory,
        cameraIP: settings.lastCameraIP || state.cameraIP
      }));
    });
  },

  /**
   * Get connection diagnostics
   */
  getDiagnostics() {
    return derived(connectionState, ($connection) => ({
      socket: {
        connected: $connection.socketConnected,
        error: $connection.socketError,
        reconnectAttempts: $connection.socketReconnectAttempts,
        lastConnected: $connection.socketLastConnected
      },
      camera: {
        connected: $connection.cameraConnected,
        error: $connection.cameraError,
        ip: $connection.cameraIP,
        lastConnected: $connection.cameraLastConnected
      },
      server: {
        url: $connection.serverUrl,
        version: $connection.serverVersion,
        status: $connection.serverStatus
      },
      network: {
        online: $connection.networkOnline,
        type: $connection.networkType
      }
    }));
  }
};

// Initialize network status monitoring
if (typeof window !== 'undefined') {
  // Monitor online/offline status
  window.addEventListener('online', () => {
    connectionActions.updateNetworkStatus(true);
  });

  window.addEventListener('offline', () => {
    connectionActions.updateNetworkStatus(false);
  });

  // Monitor connection type if available
  if ('connection' in navigator) {
    const connection = (navigator as any).connection;
    connectionActions.updateNetworkStatus(navigator.onLine, connection?.effectiveType || null);
    
    connection?.addEventListener('change', () => {
      connectionActions.updateNetworkStatus(navigator.onLine, connection.effectiveType || null);
    });
  } else {
    connectionActions.updateNetworkStatus(navigator.onLine);
  }
}

// Export the store and related utilities
export const connectionStore = {
  // Main store
  subscribe: connectionState.subscribe,
  
  // Derived stores
  socketStatus,
  cameraStatus,
  serverStatus,
  overallStatus,
  connectionHistory,
  
  // Actions
  ...connectionActions
};

export type { ConnectionState };