/**
 * Store Manager
 * Coordinates all application stores and manages state synchronization
 */

import { derived } from 'svelte/store';
import { browser } from '$app/environment';

import { cameraStore } from './cameraStore';
import { playbackStore } from './playbackStore';
import { connectionStore } from './connectionStore';
import { userSettingsStore } from './userSettingsStore';
import { appStateStore } from './appStateStore';
import { notificationStore } from './notificationStore';

class StoreManager {
  private initialized = false;
  private subscriptions: (() => void)[] = [];

  /**
   * Initialize all stores and set up cross-store synchronization
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Initialize app state
      appStateStore.setLoading(true);

      // Load persisted settings
      if (browser) {
        userSettingsStore.loadPersistedSettings?.();
        connectionStore.loadPersistedSettings();
        appStateStore.loadPersistedPreferences();
        cameraStore.loadPersistedSettings();
      }

      // Set up cross-store synchronization
      this.setupCrossStoreSync();

      // Initialize stores
      appStateStore.initialize();
      
      this.initialized = true;
      
      console.log('Store manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize store manager:', error);
      appStateStore.setError('Failed to initialize application state');
      throw error;
    }
  }

  /**
   * Set up synchronization between stores
   */
  private setupCrossStoreSync() {
    // Sync connection status between connection store and camera store
    const connectionSub = connectionStore.overallStatus.subscribe((status) => {
      cameraStore.setConnectionStatus(
        status.fullyConnected,
        status.connecting
      );
    });
    this.subscriptions.push(connectionSub);

    // Sync camera connection status to connection store
    const cameraSub = cameraStore.connectionStatus.subscribe((status) => {
      connectionStore.updateCameraStatus({
        cameraConnected: status.connected,
        cameraConnecting: status.connecting
      });
    });
    this.subscriptions.push(cameraSub);

    // Show notifications for connection events
    const connectionNotificationSub = connectionStore.overallStatus.subscribe((status) => {
      if (status.fullyConnected) {
        notificationStore.connectionSuccess();
      } else if (status.error) {
        notificationStore.connectionError(status.error);
      }
    });
    this.subscriptions.push(connectionNotificationSub);

    // Sync offline status
    const offlineSub = connectionStore.subscribe((connection) => {
      appStateStore.setOffline(!connection.networkOnline);
      
      if (!connection.networkOnline) {
        notificationStore.offlineMode();
      } else if (appStateStore.offlineState.subscribe(s => s.offline)()) {
        notificationStore.onlineMode();
      }
    });
    this.subscriptions.push(offlineSub);

    // Apply user settings to app behavior
    const settingsSub = userSettingsStore.performanceSettings.subscribe((settings) => {
      appStateStore.updateFeatures({
        debugMode: userSettingsStore.debugSettings.subscribe(s => s.enableDebugMode)()
      });
    });
    this.subscriptions.push(settingsSub);

    // Sync playback mode changes
    const playbackSub = playbackStore.playbackMode.subscribe((mode) => {
      if (mode.isInPlaybackMode) {
        notificationStore.playbackModeEntered();
      } else if (!mode.enteringPlaybackMode) {
        notificationStore.playbackModeExited();
      }
    });
    this.subscriptions.push(playbackSub);
  }

  /**
   * Get combined application state
   */
  getCombinedState() {
    return derived(
      [
        cameraStore,
        playbackStore,
        connectionStore,
        userSettingsStore,
        appStateStore
      ],
      ([camera, playback, connection, settings, app]) => ({
        camera,
        playback,
        connection,
        settings,
        app,
        timestamp: new Date()
      })
    );
  }

  /**
   * Get application health status
   */
  getHealthStatus() {
    return derived(
      [
        connectionStore.overallStatus,
        appStateStore.loadingState,
        cameraStore.connectionStatus
      ],
      ([connection, app, camera]) => {
        const issues: string[] = [];
        
        if (app.error) issues.push(`App error: ${app.error}`);
        if (connection.error) issues.push(`Connection error: ${connection.error}`);
        if (!connection.networkOnline) issues.push('Network offline');
        if (!camera.connected) issues.push('Camera disconnected');
        
        return {
          healthy: issues.length === 0,
          issues,
          status: issues.length === 0 ? 'healthy' : 'degraded',
          lastCheck: new Date()
        };
      }
    );
  }

  /**
   * Reset all stores to initial state
   */
  resetAll() {
    cameraStore.reset();
    playbackStore.reset();
    connectionStore.reset();
    appStateStore.reset();
    notificationStore.clear();
    
    notificationStore.info('Application Reset', 'All data has been reset to defaults');
  }

  /**
   * Export all application data
   */
  exportData() {
    return derived(
      this.getCombinedState(),
      (state) => ({
        ...state,
        exportedAt: new Date().toISOString(),
        version: '1.0.0'
      })
    );
  }

  /**
   * Import application data
   */
  async importData(data: any) {
    try {
      if (data.settings) {
        userSettingsStore.importSettings(data.settings);
      }
      
      // Note: Connection and camera state should not be imported
      // as they represent runtime state
      
      notificationStore.success('Data Imported', 'Settings have been restored');
      return true;
    } catch (error) {
      notificationStore.error('Import Failed', 'Failed to import data');
      return false;
    }
  }

  /**
   * Get store statistics
   */
  getStatistics() {
    return derived(
      [
        notificationStore.notificationCount,
        connectionStore,
        cameraStore,
        playbackStore
      ],
      ([notificationCount, connection, camera, playback]) => ({
        notifications: {
          active: notificationCount
        },
        connection: {
          reconnectAttempts: connection.socketReconnectAttempts,
          historySize: connection.connectionHistory.length
        },
        camera: {
          lastUpdate: camera.lastUpdate,
          connected: camera.connected
        },
        playback: {
          clipCount: playback.totalClips,
          inPlaybackMode: playback.isInPlaybackMode
        },
        memory: {
          subscriptions: this.subscriptions.length
        }
      })
    );
  }

  /**
   * Cleanup resources
   */
  destroy() {
    // Unsubscribe from all cross-store subscriptions
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
    this.initialized = false;
  }

  /**
   * Check if store manager is initialized
   */
  isInitialized() {
    return this.initialized;
  }
}

// Export singleton instance
export const storeManager = new StoreManager();

/**
 * Initialize store manager on app startup
 */
export async function initializeStores(): Promise<void> {
  if (!browser) return;

  try {
    await storeManager.initialize();
    console.log('Global state management initialized');
  } catch (error) {
    console.error('Store initialization failed:', error);
    throw error;
  }
}