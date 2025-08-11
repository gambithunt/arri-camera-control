/**
 * Offline Manager
 * Handles offline functionality, caching, and data persistence
 */

import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

export interface OfflineStatus {
  isOnline: boolean;
  isAppCached: boolean;
  lastSync: number | null;
  cacheSize: number;
  pendingOperations: number;
}

export interface CacheConfig {
  version: string;
  staticCacheName: string;
  dynamicCacheName: string;
  maxDynamicCacheSize: number;
  offlinePages: string[];
  cacheableRoutes: RegExp[];
  excludeRoutes: RegExp[];
}

export interface PendingOperation {
  id: string;
  type: 'camera-command' | 'settings-update' | 'lut-save' | 'clip-action';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

// Default cache configuration
const DEFAULT_CACHE_CONFIG: CacheConfig = {
  version: '1.0.0',
  staticCacheName: 'arri-camera-static-v1',
  dynamicCacheName: 'arri-camera-dynamic-v1',
  maxDynamicCacheSize: 50,
  offlinePages: [
    '/',
    '/camera',
    '/playback',
    '/timecode',
    '/grading',
    '/offline'
  ],
  cacheableRoutes: [
    /^\/$/,
    /^\/camera/,
    /^\/playback/,
    /^\/timecode/,
    /^\/grading/,
    /\.(js|css|png|jpg|jpeg|svg|woff|woff2)$/
  ],
  excludeRoutes: [
    /\/api\//,
    /\/socket\.io\//,
    /\/debug/
  ]
};

class OfflineManager {
  private config: CacheConfig;
  private dbName = 'arri-camera-offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private pendingOperations: Map<string, PendingOperation> = new Map();
  private syncInProgress = false;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CACHE_CONFIG, ...config };
  }

  /**
   * Initialize offline manager
   */
  async initialize(): Promise<void> {
    if (!browser) return;

    try {
      // Initialize IndexedDB
      await this.initializeDB();
      
      // Register service worker
      await this.registerServiceWorker();
      
      // Load pending operations
      await this.loadPendingOperations();
      
      // Set up online/offline event listeners
      this.setupNetworkListeners();
      
      // Initial sync if online
      if (navigator.onLine) {
        this.syncPendingOperations();
      }
      
      console.log('Offline manager initialized');
    } catch (error) {
      console.error('Failed to initialize offline manager:', error);
    }
  }

  /**
   * Initialize IndexedDB for offline storage
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores
        if (!db.objectStoreNames.contains('settings')) {
          const settingsStore = db.createObjectStore('settings', { keyPath: 'key' });
          settingsStore.createIndex('timestamp', 'timestamp');
        }
        
        if (!db.objectStoreNames.contains('cameraState')) {
          const cameraStore = db.createObjectStore('cameraState', { keyPath: 'id' });
          cameraStore.createIndex('timestamp', 'timestamp');
        }
        
        if (!db.objectStoreNames.contains('pendingOperations')) {
          const operationsStore = db.createObjectStore('pendingOperations', { keyPath: 'id' });
          operationsStore.createIndex('timestamp', 'timestamp');
          operationsStore.createIndex('type', 'type');
        }
        
        if (!db.objectStoreNames.contains('clipCache')) {
          const clipStore = db.createObjectStore('clipCache', { keyPath: 'id' });
          clipStore.createIndex('timestamp', 'timestamp');
        }
        
        if (!db.objectStoreNames.contains('lutCache')) {
          const lutStore = db.createObjectStore('lutCache', { keyPath: 'id' });
          lutStore.createIndex('timestamp', 'timestamp');
        }
      };
    });
  }

  /**
   * Register service worker
   */
  private async registerServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      
      console.log('Service Worker registered:', registration);
      
      // Handle service worker updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New version available
              this.notifyAppUpdate();
            }
          });
        }
      });
      
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network: Online');
      offlineStatus.update(status => ({ ...status, isOnline: true }));
      this.syncPendingOperations();
    });
    
    window.addEventListener('offline', () => {
      console.log('Network: Offline');
      offlineStatus.update(status => ({ ...status, isOnline: false }));
    });
    
    // Initial status
    offlineStatus.update(status => ({ ...status, isOnline: navigator.onLine }));
  }

  /**
   * Store data in IndexedDB
   */
  async storeData(storeName: string, data: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      
      const request = store.put({
        ...data,
        timestamp: Date.now()
      });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve data from IndexedDB
   */
  async getData(storeName: string, key: string): Promise<any> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all data from a store
   */
  async getAllData(storeName: string): Promise<any[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete data from IndexedDB
   */
  async deleteData(storeName: string, key: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Add operation to pending queue
   */
  async addPendingOperation(operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<string> {
    const id = `${operation.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const pendingOp: PendingOperation = {
      id,
      timestamp: Date.now(),
      retryCount: 0,
      ...operation
    };
    
    this.pendingOperations.set(id, pendingOp);
    await this.storeData('pendingOperations', pendingOp);
    
    offlineStatus.update(status => ({
      ...status,
      pendingOperations: this.pendingOperations.size
    }));
    
    // Try to sync immediately if online
    if (navigator.onLine) {
      this.syncPendingOperations();
    }
    
    return id;
  }

  /**
   * Load pending operations from storage
   */
  private async loadPendingOperations(): Promise<void> {
    try {
      const operations = await this.getAllData('pendingOperations');
      this.pendingOperations.clear();
      
      operations.forEach(op => {
        this.pendingOperations.set(op.id, op);
      });
      
      offlineStatus.update(status => ({
        ...status,
        pendingOperations: this.pendingOperations.size
      }));
      
    } catch (error) {
      console.error('Failed to load pending operations:', error);
    }
  }

  /**
   * Sync pending operations when online
   */
  private async syncPendingOperations(): Promise<void> {
    if (this.syncInProgress || !navigator.onLine || this.pendingOperations.size === 0) {
      return;
    }
    
    this.syncInProgress = true;
    console.log(`Syncing ${this.pendingOperations.size} pending operations`);
    
    const operations = Array.from(this.pendingOperations.values());
    const syncPromises = operations.map(op => this.syncOperation(op));
    
    try {
      await Promise.allSettled(syncPromises);
      
      offlineStatus.update(status => ({
        ...status,
        lastSync: Date.now(),
        pendingOperations: this.pendingOperations.size
      }));
      
    } catch (error) {
      console.error('Sync failed:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Sync individual operation
   */
  private async syncOperation(operation: PendingOperation): Promise<void> {
    try {
      // Simulate API call based on operation type
      let success = false;
      
      switch (operation.type) {
        case 'camera-command':
          success = await this.syncCameraCommand(operation.data);
          break;
        case 'settings-update':
          success = await this.syncSettingsUpdate(operation.data);
          break;
        case 'lut-save':
          success = await this.syncLUTSave(operation.data);
          break;
        case 'clip-action':
          success = await this.syncClipAction(operation.data);
          break;
      }
      
      if (success) {
        // Remove from pending operations
        this.pendingOperations.delete(operation.id);
        await this.deleteData('pendingOperations', operation.id);
        console.log(`Synced operation: ${operation.id}`);
      } else {
        // Increment retry count
        operation.retryCount++;
        if (operation.retryCount >= operation.maxRetries) {
          // Max retries reached, remove operation
          this.pendingOperations.delete(operation.id);
          await this.deleteData('pendingOperations', operation.id);
          console.warn(`Operation failed after max retries: ${operation.id}`);
        } else {
          // Update retry count
          await this.storeData('pendingOperations', operation);
        }
      }
      
    } catch (error) {
      console.error(`Failed to sync operation ${operation.id}:`, error);
      operation.retryCount++;
      await this.storeData('pendingOperations', operation);
    }
  }

  /**
   * Sync camera command
   */
  private async syncCameraCommand(data: any): Promise<boolean> {
    // This would integrate with the actual camera API
    // For now, simulate success/failure
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() > 0.1), 1000);
    });
  }

  /**
   * Sync settings update
   */
  private async syncSettingsUpdate(data: any): Promise<boolean> {
    // This would sync settings with server/camera
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 500);
    });
  }

  /**
   * Sync LUT save operation
   */
  private async syncLUTSave(data: any): Promise<boolean> {
    // This would upload LUT to server/camera
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() > 0.05), 2000);
    });
  }

  /**
   * Sync clip action
   */
  private async syncClipAction(data: any): Promise<boolean> {
    // This would sync clip operations
    return new Promise(resolve => {
      setTimeout(() => resolve(true), 800);
    });
  }

  /**
   * Cache user settings
   */
  async cacheUserSettings(settings: any): Promise<void> {
    await this.storeData('settings', {
      key: 'userSettings',
      data: settings
    });
  }

  /**
   * Get cached user settings
   */
  async getCachedUserSettings(): Promise<any> {
    const result = await this.getData('settings', 'userSettings');
    return result?.data || null;
  }

  /**
   * Cache camera state
   */
  async cacheCameraState(state: any): Promise<void> {
    await this.storeData('cameraState', {
      id: 'current',
      data: state
    });
  }

  /**
   * Get cached camera state
   */
  async getCachedCameraState(): Promise<any> {
    const result = await this.getData('cameraState', 'current');
    return result?.data || null;
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ size: number; entries: number }> {
    if (!this.db) return { size: 0, entries: 0 };
    
    try {
      const stores = ['settings', 'cameraState', 'pendingOperations', 'clipCache', 'lutCache'];
      let totalEntries = 0;
      
      for (const storeName of stores) {
        const data = await this.getAllData(storeName);
        totalEntries += data.length;
      }
      
      // Estimate size (rough calculation)
      const estimatedSize = totalEntries * 1024; // 1KB per entry estimate
      
      return { size: estimatedSize, entries: totalEntries };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return { size: 0, entries: 0 };
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    if (!this.db) return;
    
    const stores = ['settings', 'cameraState', 'pendingOperations', 'clipCache', 'lutCache'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    this.pendingOperations.clear();
    
    offlineStatus.update(status => ({
      ...status,
      cacheSize: 0,
      pendingOperations: 0
    }));
  }

  /**
   * Notify about app update
   */
  private notifyAppUpdate(): void {
    // This would trigger a notification to the user about app update
    console.log('New app version available');
    
    // Dispatch custom event
    if (browser) {
      window.dispatchEvent(new CustomEvent('app-update-available'));
    }
  }

  /**
   * Update app to new version
   */
  async updateApp(): Promise<void> {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  }

  /**
   * Check if app is cached and ready for offline use
   */
  async isAppCached(): Promise<boolean> {
    if (!('serviceWorker' in navigator)) return false;
    
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration?.active;
    } catch {
      return false;
    }
  }
}

// Create singleton instance
export const offlineManager = new OfflineManager();

// Create reactive store for offline status
function createOfflineStatusStore() {
  const { subscribe, set, update } = writable<OfflineStatus>({
    isOnline: browser ? navigator.onLine : true,
    isAppCached: false,
    lastSync: null,
    cacheSize: 0,
    pendingOperations: 0
  });

  return {
    subscribe,
    set,
    update,
    async refresh() {
      if (!browser) return;
      
      const isAppCached = await offlineManager.isAppCached();
      const cacheStats = await offlineManager.getCacheStats();
      
      update(status => ({
        ...status,
        isOnline: navigator.onLine,
        isAppCached,
        cacheSize: cacheStats.size
      }));
    }
  };
}

export const offlineStatus = createOfflineStatusStore();

// Derived stores
export const isOnline = derived(offlineStatus, $status => $status.isOnline);
export const isOffline = derived(offlineStatus, $status => !$status.isOnline);
export const hasPendingOperations = derived(offlineStatus, $status => $status.pendingOperations > 0);
export const isAppReady = derived(offlineStatus, $status => $status.isAppCached);

// Utility functions
export function addOfflineOperation(
  type: PendingOperation['type'],
  data: any,
  maxRetries: number = 3
): Promise<string> {
  return offlineManager.addPendingOperation({ type, data, maxRetries });
}

export function cacheUserSettings(settings: any): Promise<void> {
  return offlineManager.cacheUserSettings(settings);
}

export function getCachedUserSettings(): Promise<any> {
  return offlineManager.getCachedUserSettings();
}

export function cacheCameraState(state: any): Promise<void> {
  return offlineManager.cacheCameraState(state);
}

export function getCachedCameraState(): Promise<any> {
  return offlineManager.getCachedCameraState();
}

export function clearOfflineCache(): Promise<void> {
  return offlineManager.clearCache();
}

export function updateToNewVersion(): Promise<void> {
  return offlineManager.updateApp();
}