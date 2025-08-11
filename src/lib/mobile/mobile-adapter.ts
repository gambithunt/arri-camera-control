/**
 * Mobile Adapter
 * Provides a unified interface for mobile-specific functionality and offline-first architecture
 */

import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { appInitializer } from './app-initializer';
import { mobileBackend } from './backend-launcher';
import { connectionManager } from './connection-manager';
import { offlineStorage } from './offline-storage';

export interface MobileAdapterConfig {
  enableOfflineMode: boolean;
  enableAutoReconnect: boolean;
  enableBackgroundSync: boolean;
  enableDataPersistence: boolean;
  maxOfflineOperations: number;
  syncInterval: number;
}

export interface MobileAdapterStatus {
  initialized: boolean;
  offlineMode: boolean;
  backendRunning: boolean;
  connectionActive: boolean;
  storageReady: boolean;
  networkOnline: boolean;
  pendingOperations: number;
  lastSync?: string;
}

export class MobileAdapter {
  private config: MobileAdapterConfig;
  private status: MobileAdapterStatus;
  private pendingOperations: Map<string, any> = new Map();
  private syncTimer?: NodeJS.Timeout;
  private networkListener: any;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<MobileAdapterConfig> = {}) {
    this.config = {
      enableOfflineMode: true,
      enableAutoReconnect: true,
      enableBackgroundSync: true,
      enableDataPersistence: true,
      maxOfflineOperations: 1000,
      syncInterval: 30000, // 30 seconds
      ...config
    };

    this.status = {
      initialized: false,
      offlineMode: false,
      backendRunning: false,
      connectionActive: false,
      storageReady: false,
      networkOnline: true,
      pendingOperations: 0
    };

    // Initialize network monitoring
    if (Capacitor.isNativePlatform()) {
      this.initializeNetworkMonitoring();
    }
  }

  async initialize(): Promise<boolean> {
    if (this.status.initialized) {
      return true;
    }

    console.log('Initializing mobile adapter...');

    try {
      // Initialize the app first
      const appReady = await appInitializer.initialize();
      if (!appReady) {
        console.warn('App initialization failed, continuing with limited functionality');
      }

      // Check component status
      this.updateStatus();

      // Set up event listeners
      this.setupEventListeners();

      // Start background sync if enabled
      if (this.config.enableBackgroundSync) {
        this.startBackgroundSync();
      }

      // Load pending operations from storage
      await this.loadPendingOperations();

      this.status.initialized = true;
      console.log('Mobile adapter initialized successfully');
      this.emit('adapter:initialized', this.getStatus());

      return true;
    } catch (error) {
      console.error('Mobile adapter initialization failed:', error);
      return false;
    }
  }

  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // Get initial network status
      const status = await Network.getStatus();
      this.status.networkOnline = status.connected;

      // Listen for network changes
      this.networkListener = Network.addListener('networkStatusChange', (status) => {
        this.status.networkOnline = status.connected;
        this.handleNetworkChange(status.connected);
      });

      console.log('Network monitoring initialized. Online:', this.status.networkOnline);
    } catch (error) {
      console.warn('Network monitoring not available:', error);
    }
  }

  private handleNetworkChange(isOnline: boolean): void {
    console.log('Network status changed:', isOnline ? 'online' : 'offline');
    
    this.updateStatus();
    
    if (isOnline && this.config.enableAutoReconnect) {
      // Network came back online, try to reconnect
      this.attemptReconnection();
    } else if (!isOnline) {
      // Network went offline, enable offline mode
      this.enableOfflineMode();
    }

    // Dispatch custom event for app to handle
    window.dispatchEvent(new CustomEvent('networkchange', {
      detail: { isOnline }
    }));

    this.emit('adapter:network-change', { isOnline });
  }

  private async attemptReconnection(): Promise<void> {
    try {
      console.log('Attempting reconnection after network recovery...');
      
      // Try to reconnect to backend
      if (!this.status.backendRunning) {
        await mobileBackend.restart();
      }
      
      // Try to establish connection
      if (!this.status.connectionActive) {
        await connectionManager.connect();
      }
      
      this.updateStatus();
      
      if (!this.status.offlineMode) {
        // Process pending operations
        await this.processPendingOperations();
      }
    } catch (error) {
      console.warn('Reconnection attempt failed:', error);
    }
  }

  private updateStatus(): void {
    this.status.backendRunning = mobileBackend.isRunning();
    this.status.connectionActive = connectionManager.isConnected();
    this.status.storageReady = appInitializer.getStatus().storageReady;
    
    // Determine offline mode based on multiple factors
    this.status.offlineMode = !this.status.networkOnline || 
                             !this.status.connectionActive || 
                             !this.status.backendRunning;
    
    this.status.pendingOperations = this.pendingOperations.size;
  }

  private setupEventListeners(): void {
    // Listen to app initializer events
    appInitializer.on('app:initialized', () => {
      this.updateStatus();
      this.emit('adapter:app-ready');
    });

    appInitializer.on('app:error', (data) => {
      this.emit('adapter:error', data);
    });

    // Listen to backend events
    mobileBackend.on('backend:initialized', () => {
      this.updateStatus();
      this.emit('adapter:backend-ready');
    });

    mobileBackend.on('server:failed', () => {
      this.updateStatus();
      this.enableOfflineMode();
    });

    mobileBackend.on('server:restarted', () => {
      this.updateStatus();
      this.disableOfflineMode();
    });

    // Listen to connection events
    connectionManager.on('connection:established', () => {
      this.updateStatus();
      this.disableOfflineMode();
      this.processPendingOperations();
    });

    connectionManager.on('connection:lost', () => {
      this.updateStatus();
      this.enableOfflineMode();
    });

    connectionManager.on('connection:restored', () => {
      this.updateStatus();
      this.disableOfflineMode();
      this.processPendingOperations();
    });
  }

  private enableOfflineMode(): void {
    if (!this.status.offlineMode) {
      console.log('Enabling offline mode');
      this.status.offlineMode = true;
      this.emit('adapter:offline-mode-enabled');
    }
  }

  private disableOfflineMode(): void {
    if (this.status.offlineMode && this.status.networkOnline && this.status.connectionActive && this.status.backendRunning) {
      console.log('Disabling offline mode');
      this.status.offlineMode = false;
      this.emit('adapter:offline-mode-disabled');
    }
  }

  private startBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (!this.status.offlineMode && this.pendingOperations.size > 0) {
        await this.processPendingOperations();
      }
    }, this.config.syncInterval);

    console.log('Background sync started');
  }

  private async loadPendingOperations(): Promise<void> {
    try {
      const stored = await offlineStorage.get('pending-operations');
      if (stored && Array.isArray(stored)) {
        for (const op of stored) {
          this.pendingOperations.set(op.id, op);
        }
        console.log(`Loaded ${stored.length} pending operations from storage`);
      }
    } catch (error) {
      console.error('Failed to load pending operations:', error);
    }
  }

  private async savePendingOperations(): Promise<void> {
    try {
      const operations = Array.from(this.pendingOperations.values());
      await offlineStorage.set('pending-operations', operations);
    } catch (error) {
      console.error('Failed to save pending operations:', error);
    }
  }

  private async processPendingOperations(): Promise<void> {
    if (this.pendingOperations.size === 0) {
      return;
    }

    console.log(`Processing ${this.pendingOperations.size} pending operations...`);

    const operations = Array.from(this.pendingOperations.entries());
    let processed = 0;
    let failed = 0;

    for (const [id, operation] of operations) {
      try {
        await this.executeOperation(operation);
        this.pendingOperations.delete(id);
        processed++;
      } catch (error) {
        console.error(`Failed to process operation ${id}:`, error);
        failed++;
        
        // Increment retry count
        operation.retries = (operation.retries || 0) + 1;
        
        // Remove operations that are too old or have failed too many times
        if (this.shouldDiscardOperation(operation)) {
          console.warn(`Discarding operation ${id} due to age or retry limit`);
          this.pendingOperations.delete(id);
        }
      }
    }

    // Update storage
    await this.savePendingOperations();

    // Update status
    this.updateStatus();
    this.status.lastSync = new Date().toISOString();

    console.log(`Sync complete: ${processed} processed, ${failed} failed, ${this.pendingOperations.size} remaining`);
    this.emit('adapter:sync-complete', { processed, failed, remaining: this.pendingOperations.size });
  }

  private shouldDiscardOperation(operation: any): boolean {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const maxRetries = 5;
    
    const age = Date.now() - new Date(operation.timestamp).getTime();
    const retries = operation.retries || 0;
    
    return age > maxAge || retries > maxRetries;
  }

  private async executeOperation(operation: any): Promise<any> {
    const { type, endpoint, method, data } = operation;
    
    switch (type) {
      case 'api-call':
        return connectionManager.apiCall(endpoint, method, data);
      
      case 'camera-command':
        return this.executeCameraCommand(operation);
      
      case 'storage-operation':
        return this.executeStorageOperation(operation);
      
      default:
        throw new Error(`Unknown operation type: ${type}`);
    }
  }

  private async executeCameraCommand(operation: any): Promise<any> {
    const { command, params } = operation;
    
    switch (command) {
      case 'connect':
        return connectionManager.cameraConnect(params.ip);
      case 'setFrameRate':
        return connectionManager.cameraSetFrameRate(params.frameRate);
      case 'setWhiteBalance':
        return connectionManager.cameraSetWhiteBalance(params.kelvin);
      case 'setISO':
        return connectionManager.cameraSetISO(params.iso);
      default:
        throw new Error(`Unknown camera command: ${command}`);
    }
  }

  private async executeStorageOperation(operation: any): Promise<any> {
    const { action, key, value } = operation;
    
    switch (action) {
      case 'set':
        return offlineStorage.set(key, value);
      case 'delete':
        return offlineStorage.delete(key);
      default:
        throw new Error(`Unknown storage action: ${action}`);
    }
  }

  // Public API methods
  async apiCall(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    if (!this.status.offlineMode && this.status.connectionActive) {
      // Online mode - execute immediately
      try {
        return await connectionManager.apiCall(endpoint, method, data);
      } catch (error) {
        // If call fails, queue it for later if offline mode is enabled
        if (this.config.enableOfflineMode) {
          await this.queueOperation('api-call', { endpoint, method, data });
        }
        throw error;
      }
    } else if (this.config.enableOfflineMode) {
      // Offline mode - queue operation
      return this.queueOperation('api-call', { endpoint, method, data });
    } else {
      throw new Error('No connection available and offline mode is disabled');
    }
  }

  async cameraCommand(command: string, params: any = {}): Promise<any> {
    if (!this.status.offlineMode && this.status.connectionActive) {
      // Online mode - execute immediately
      try {
        return await this.executeCameraCommand({ command, params });
      } catch (error) {
        // If command fails, queue it for later if offline mode is enabled
        if (this.config.enableOfflineMode) {
          await this.queueOperation('camera-command', { command, params });
        }
        throw error;
      }
    } else if (this.config.enableOfflineMode) {
      // Offline mode - queue operation
      return this.queueOperation('camera-command', { command, params });
    } else {
      throw new Error('No connection available and offline mode is disabled');
    }
  }

  async storageOperation(action: string, key: string, value?: any): Promise<any> {
    // Storage operations can always be executed locally
    try {
      return await this.executeStorageOperation({ action, key, value });
    } catch (error) {
      // If local storage fails, queue for retry
      if (this.config.enableOfflineMode) {
        await this.queueOperation('storage-operation', { action, key, value });
      }
      throw error;
    }
  }

  private async queueOperation(type: string, data: any): Promise<string> {
    if (this.pendingOperations.size >= this.config.maxOfflineOperations) {
      throw new Error('Maximum offline operations limit reached');
    }

    const operationId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const operation = {
      id: operationId,
      type,
      timestamp: new Date().toISOString(),
      retries: 0,
      ...data
    };

    this.pendingOperations.set(operationId, operation);
    await this.savePendingOperations();
    
    this.updateStatus();
    this.emit('adapter:operation-queued', { id: operationId, type });

    console.log(`Operation queued: ${operationId} (${type})`);
    return operationId;
  }

  async clearPendingOperations(): Promise<void> {
    this.pendingOperations.clear();
    await this.savePendingOperations();
    this.updateStatus();
    console.log('All pending operations cleared');
    this.emit('adapter:operations-cleared');
  }

  async forcSync(): Promise<void> {
    if (this.status.offlineMode) {
      throw new Error('Cannot sync while in offline mode');
    }
    
    await this.processPendingOperations();
  }

  // Legacy methods for backward compatibility
  public isNetworkOnline(): boolean {
    return this.status.networkOnline;
  }

  public async saveToDevice(filename: string, data: string): Promise<boolean> {
    try {
      await offlineStorage.set(filename, data);
      return true;
    } catch (error) {
      console.error('Failed to save to device:', error);
      return false;
    }
  }

  public async loadFromDevice(filename: string): Promise<string | null> {
    try {
      return await offlineStorage.get(filename);
    } catch (error) {
      console.error('Failed to load from device:', error);
      return null;
    }
  }

  public async deleteFromDevice(filename: string): Promise<boolean> {
    try {
      await offlineStorage.delete(filename);
      return true;
    } catch (error) {
      console.error('Failed to delete from device:', error);
      return false;
    }
  }

  public async listDeviceFiles(): Promise<string[]> {
    try {
      return await offlineStorage.list();
    } catch (error) {
      console.error('Failed to list device files:', error);
      return [];
    }
  }

  public getPlatform(): string {
    return Capacitor.getPlatform();
  }

  public isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  // Convenience methods
  async getSettings(): Promise<any> {
    return offlineStorage.getSettings();
  }

  async updateSettings(settings: any): Promise<boolean> {
    return offlineStorage.updateSettings(settings);
  }

  async getCameras(): Promise<any[]> {
    return offlineStorage.getCameras();
  }

  async addCamera(camera: any): Promise<boolean> {
    return offlineStorage.addCamera(camera);
  }

  async getLUTs(): Promise<any[]> {
    return offlineStorage.getLUTs();
  }

  async addLUT(lut: any): Promise<boolean> {
    return offlineStorage.addLUT(lut);
  }

  // Event system
  on(event: string, callback: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  off(event: string, callback: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
  }

  // Public getters
  getStatus(): MobileAdapterStatus {
    return { ...this.status };
  }

  getConfig(): MobileAdapterConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.status.initialized;
  }

  isOffline(): boolean {
    return this.status.offlineMode;
  }

  isOnline(): boolean {
    return !this.status.offlineMode;
  }

  getPendingOperationsCount(): number {
    return this.pendingOperations.size;
  }

  getBackendUrl(): string {
    return mobileBackend.getServerUrl();
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up mobile adapter...');
    
    try {
      // Stop background sync
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = undefined;
      }

      // Remove network listener
      if (this.networkListener) {
        this.networkListener.remove();
        this.networkListener = undefined;
      }

      // Save pending operations
      await this.savePendingOperations();

      // Clean up components
      await appInitializer.cleanup();

      // Clear event listeners
      this.eventListeners.clear();
      
      console.log('Mobile adapter cleanup complete');
    } catch (error) {
      console.error('Mobile adapter cleanup failed:', error);
    }
  }
}

// Global instance
export const mobileAdapter = new MobileAdapter();