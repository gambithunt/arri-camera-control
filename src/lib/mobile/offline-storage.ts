/**
 * Offline Storage Manager
 * Manages local storage for app data and user preferences in offline mode
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

export interface StorageConfig {
  enableEncryption: boolean;
  maxStorageSize: number; // in MB
  compressionEnabled: boolean;
  backupEnabled: boolean;
}

export interface StorageStats {
  totalSize: number;
  usedSize: number;
  availableSize: number;
  itemCount: number;
  lastBackup?: string;
}

export interface StorageItem {
  key: string;
  value: any;
  created: string;
  updated: string;
  size: number;
  compressed?: boolean;
  encrypted?: boolean;
}

export class OfflineStorageManager {
  private config: StorageConfig;
  private cache: Map<string, StorageItem> = new Map();
  private initialized = false;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = {
      enableEncryption: false,
      maxStorageSize: 100, // 100MB
      compressionEnabled: true,
      backupEnabled: true,
      ...config
    };
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    console.log('Initializing offline storage manager...');

    try {
      // Initialize storage structure
      await this.initializeStorageStructure();
      
      // Load existing data into cache
      await this.loadCache();
      
      // Set up periodic cleanup
      this.setupPeriodicCleanup();
      
      this.initialized = true;
      console.log('Offline storage manager initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize offline storage:', error);
      return false;
    }
  }

  private async initializeStorageStructure(): Promise<void> {
    const defaultData = {
      version: '1.0.0',
      initialized: new Date().toISOString(),
      settings: {
        theme: 'dark',
        language: 'en',
        hapticFeedback: true,
        autoReconnect: true,
        debugMode: false,
        touchSensitivity: 'medium',
        notifications: {
          enabled: true,
          sound: true,
          vibration: true
        },
        camera: {
          defaultIP: '',
          autoConnect: false,
          connectionTimeout: 5000
        },
        playback: {
          autoPlay: false,
          loopMode: false,
          defaultSpeed: 1.0
        },
        timecode: {
          displayFormat: 'HH:MM:SS:FF',
          syncMode: 'free_run',
          frameRate: 24
        },
        colorGrading: {
          defaultLUT: '',
          autoApply: false,
          previewMode: true
        }
      },
      cameras: [],
      luts: [],
      presets: {
        camera: [],
        colorGrading: [],
        playback: []
      },
      clips: [],
      logs: [],
      cache: {},
      metadata: {
        lastSync: null,
        lastBackup: null,
        totalOperations: 0
      }
    };

    // Check if data already exists
    const existingData = await this.getStorageData('arri-camera-control-data');
    if (!existingData) {
      await this.setStorageData('arri-camera-control-data', defaultData);
      console.log('Initialized storage with default data structure');
    } else {
      // Merge with existing data to add any new fields
      const mergedData = this.mergeData(defaultData, existingData);
      await this.setStorageData('arri-camera-control-data', mergedData);
      console.log('Updated existing storage structure');
    }
  }

  private mergeData(defaultData: any, existingData: any): any {
    const merged = { ...existingData };
    
    // Add any missing top-level keys
    for (const key in defaultData) {
      if (!(key in merged)) {
        merged[key] = defaultData[key];
      } else if (typeof defaultData[key] === 'object' && defaultData[key] !== null) {
        // Recursively merge objects
        merged[key] = this.mergeData(defaultData[key], merged[key] || {});
      }
    }
    
    // Update version and timestamp
    merged.version = defaultData.version;
    merged.lastUpdated = new Date().toISOString();
    
    return merged;
  }

  private async loadCache(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        // Load from device filesystem
        await this.loadCacheFromDevice();
      } else {
        // Load from browser storage
        await this.loadCacheFromBrowser();
      }
      
      console.log(`Loaded ${this.cache.size} items into cache`);
    } catch (error) {
      console.error('Failed to load cache:', error);
    }
  }

  private async loadCacheFromDevice(): Promise<void> {
    try {
      const files = await Filesystem.readdir({
        path: 'storage',
        directory: Directory.Documents
      });

      for (const file of files.files) {
        if (file.name.endsWith('.json')) {
          const key = file.name.replace('.json', '');
          const content = await Filesystem.readFile({
            path: `storage/${file.name}`,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });

          const item: StorageItem = JSON.parse(content.data as string);
          this.cache.set(key, item);
        }
      }
    } catch (error) {
      // Directory might not exist yet, create it
      try {
        await Filesystem.mkdir({
          path: 'storage',
          directory: Directory.Documents,
          recursive: true
        });
      } catch (mkdirError) {
        console.warn('Could not create storage directory:', mkdirError);
      }
    }
  }

  private async loadCacheFromBrowser(): Promise<void> {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arri-storage-')) {
        const storageKey = key.replace('arri-storage-', '');
        const data = localStorage.getItem(key);
        
        if (data) {
          try {
            const item: StorageItem = JSON.parse(data);
            this.cache.set(storageKey, item);
          } catch (error) {
            console.warn(`Failed to parse cached item ${key}:`, error);
          }
        }
      }
    }
  }

  private setupPeriodicCleanup(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000);
  }

  private async performCleanup(): Promise<void> {
    console.log('Performing storage cleanup...');
    
    try {
      const stats = await this.getStats();
      const maxSizeBytes = this.config.maxStorageSize * 1024 * 1024;
      
      if (stats.usedSize > maxSizeBytes * 0.9) { // 90% threshold
        console.log('Storage usage high, cleaning up old items...');
        
        // Sort items by last access time and remove oldest
        const items = Array.from(this.cache.entries())
          .sort((a, b) => new Date(a[1].updated).getTime() - new Date(b[1].updated).getTime());
        
        let freedSpace = 0;
        const targetFreeSpace = maxSizeBytes * 0.2; // Free 20% of max size
        
        for (const [key, item] of items) {
          if (freedSpace >= targetFreeSpace) break;
          
          // Don't delete critical data
          if (this.isCriticalData(key)) continue;
          
          await this.delete(key);
          freedSpace += item.size;
        }
        
        console.log(`Cleanup complete, freed ${freedSpace} bytes`);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  private isCriticalData(key: string): boolean {
    const criticalKeys = [
      'arri-camera-control-data',
      'settings',
      'cameras',
      'user-preferences'
    ];
    
    return criticalKeys.some(criticalKey => key.includes(criticalKey));
  }

  // Public API methods
  async get(key: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Check cache first
      const cachedItem = this.cache.get(key);
      if (cachedItem) {
        // Update access time
        cachedItem.updated = new Date().toISOString();
        await this.updateCacheItem(key, cachedItem);
        
        return this.deserializeValue(cachedItem.value);
      }

      // Load from storage
      const data = await this.getStorageData(key);
      if (data !== null) {
        const item: StorageItem = {
          key,
          value: data,
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          size: this.calculateSize(data)
        };
        
        this.cache.set(key, item);
        await this.updateCacheItem(key, item);
        
        return this.deserializeValue(data);
      }

      return null;
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const serializedValue = this.serializeValue(value);
      const size = this.calculateSize(serializedValue);
      
      // Check storage limits
      const stats = await this.getStats();
      const maxSizeBytes = this.config.maxStorageSize * 1024 * 1024;
      
      if (stats.usedSize + size > maxSizeBytes) {
        console.warn('Storage limit exceeded, performing cleanup...');
        await this.performCleanup();
        
        // Check again after cleanup
        const newStats = await this.getStats();
        if (newStats.usedSize + size > maxSizeBytes) {
          throw new Error('Storage limit exceeded even after cleanup');
        }
      }

      const now = new Date().toISOString();
      const existingItem = this.cache.get(key);
      
      const item: StorageItem = {
        key,
        value: serializedValue,
        created: existingItem?.created || now,
        updated: now,
        size,
        compressed: this.config.compressionEnabled,
        encrypted: this.config.enableEncryption
      };

      // Update cache
      this.cache.set(key, item);
      
      // Persist to storage
      await this.setStorageData(key, serializedValue);
      await this.updateCacheItem(key, item);

      return true;
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error);
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Remove from cache
      this.cache.delete(key);
      
      // Remove from storage
      await this.deleteStorageData(key);
      await this.deleteCacheItem(key);

      return true;
    } catch (error) {
      console.error(`Failed to delete item ${key}:`, error);
      return false;
    }
  }

  async list(): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return Array.from(this.cache.keys());
  }

  async clear(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Clear cache
      this.cache.clear();
      
      // Clear storage
      if (Capacitor.isNativePlatform()) {
        await this.clearDeviceStorage();
      } else {
        await this.clearBrowserStorage();
      }

      return true;
    } catch (error) {
      console.error('Failed to clear storage:', error);
      return false;
    }
  }

  async getStats(): Promise<StorageStats> {
    if (!this.initialized) {
      await this.initialize();
    }

    let totalSize = 0;
    let usedSize = 0;
    
    for (const item of this.cache.values()) {
      usedSize += item.size;
    }
    
    const maxSizeBytes = this.config.maxStorageSize * 1024 * 1024;
    totalSize = maxSizeBytes;

    return {
      totalSize,
      usedSize,
      availableSize: totalSize - usedSize,
      itemCount: this.cache.size,
      lastBackup: await this.getLastBackupTime()
    };
  }

  async backup(): Promise<boolean> {
    if (!this.config.backupEnabled) {
      return false;
    }

    try {
      console.log('Creating storage backup...');
      
      const backupData = {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        items: Array.from(this.cache.entries()).map(([key, item]) => ({
          key,
          ...item
        }))
      };

      const backupKey = `backup-${Date.now()}`;
      await this.setStorageData(backupKey, backupData);
      
      // Update last backup time
      await this.setLastBackupTime(backupData.timestamp);
      
      console.log(`Backup created: ${backupKey}`);
      return true;
    } catch (error) {
      console.error('Backup failed:', error);
      return false;
    }
  }

  async restore(backupKey: string): Promise<boolean> {
    try {
      console.log(`Restoring from backup: ${backupKey}`);
      
      const backupData = await this.getStorageData(backupKey);
      if (!backupData || !backupData.items) {
        throw new Error('Invalid backup data');
      }

      // Clear current data
      await this.clear();
      
      // Restore items
      for (const item of backupData.items) {
        this.cache.set(item.key, {
          key: item.key,
          value: item.value,
          created: item.created,
          updated: item.updated,
          size: item.size,
          compressed: item.compressed,
          encrypted: item.encrypted
        });
        
        await this.setStorageData(item.key, item.value);
      }

      console.log(`Restored ${backupData.items.length} items from backup`);
      return true;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  }

  // Storage abstraction methods
  private async getStorageData(key: string): Promise<any> {
    if (Capacitor.isNativePlatform()) {
      return this.getDeviceData(key);
    } else {
      return this.getBrowserData(key);
    }
  }

  private async setStorageData(key: string, value: any): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.setDeviceData(key, value);
    } else {
      await this.setBrowserData(key, value);
    }
  }

  private async deleteStorageData(key: string): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.deleteDeviceData(key);
    } else {
      await this.deleteBrowserData(key);
    }
  }

  // Device storage methods
  private async getDeviceData(key: string): Promise<any> {
    try {
      const result = await Filesystem.readFile({
        path: `storage/${key}.json`,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      
      return JSON.parse(result.data as string);
    } catch (error) {
      return null;
    }
  }

  private async setDeviceData(key: string, value: any): Promise<void> {
    await Filesystem.writeFile({
      path: `storage/${key}.json`,
      data: JSON.stringify(value),
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });
  }

  private async deleteDeviceData(key: string): Promise<void> {
    try {
      await Filesystem.deleteFile({
        path: `storage/${key}.json`,
        directory: Directory.Documents
      });
    } catch (error) {
      // File might not exist, ignore error
    }
  }

  private async clearDeviceStorage(): Promise<void> {
    try {
      const files = await Filesystem.readdir({
        path: 'storage',
        directory: Directory.Documents
      });

      for (const file of files.files) {
        await Filesystem.deleteFile({
          path: `storage/${file.name}`,
          directory: Directory.Documents
        });
      }
    } catch (error) {
      console.warn('Could not clear device storage:', error);
    }
  }

  // Browser storage methods
  private getBrowserData(key: string): any {
    const data = localStorage.getItem(`arri-storage-${key}`);
    return data ? JSON.parse(data) : null;
  }

  private setBrowserData(key: string, value: any): void {
    localStorage.setItem(`arri-storage-${key}`, JSON.stringify(value));
  }

  private deleteBrowserData(key: string): void {
    localStorage.removeItem(`arri-storage-${key}`);
  }

  private clearBrowserStorage(): void {
    const keysToDelete = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('arri-storage-')) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => localStorage.removeItem(key));
  }

  // Cache management methods
  private async updateCacheItem(key: string, item: StorageItem): Promise<void> {
    // This could be extended to persist cache metadata
  }

  private async deleteCacheItem(key: string): Promise<void> {
    // This could be extended to clean up cache metadata
  }

  private async getLastBackupTime(): Promise<string | undefined> {
    const metadata = await this.get('storage-metadata');
    return metadata?.lastBackup;
  }

  private async setLastBackupTime(timestamp: string): Promise<void> {
    const metadata = await this.get('storage-metadata') || {};
    metadata.lastBackup = timestamp;
    await this.set('storage-metadata', metadata);
  }

  // Utility methods
  private serializeValue(value: any): any {
    // Add compression/encryption here if enabled
    return value;
  }

  private deserializeValue(value: any): any {
    // Add decompression/decryption here if needed
    return value;
  }

  private calculateSize(value: any): number {
    return JSON.stringify(value).length;
  }

  // Convenience methods for common data types
  async getSettings(): Promise<any> {
    const data = await this.get('arri-camera-control-data');
    return data?.settings || {};
  }

  async updateSettings(settings: any): Promise<boolean> {
    const data = await this.get('arri-camera-control-data') || {};
    data.settings = { ...data.settings, ...settings };
    return this.set('arri-camera-control-data', data);
  }

  async getCameras(): Promise<any[]> {
    const data = await this.get('arri-camera-control-data');
    return data?.cameras || [];
  }

  async addCamera(camera: any): Promise<boolean> {
    const data = await this.get('arri-camera-control-data') || {};
    data.cameras = data.cameras || [];
    data.cameras.push(camera);
    return this.set('arri-camera-control-data', data);
  }

  async getLUTs(): Promise<any[]> {
    const data = await this.get('arri-camera-control-data');
    return data?.luts || [];
  }

  async addLUT(lut: any): Promise<boolean> {
    const data = await this.get('arri-camera-control-data') || {};
    data.luts = data.luts || [];
    data.luts.push(lut);
    return this.set('arri-camera-control-data', data);
  }

  async getPresets(type: string): Promise<any[]> {
    const data = await this.get('arri-camera-control-data');
    return data?.presets?.[type] || [];
  }

  async addPreset(type: string, preset: any): Promise<boolean> {
    const data = await this.get('arri-camera-control-data') || {};
    data.presets = data.presets || {};
    data.presets[type] = data.presets[type] || [];
    data.presets[type].push(preset);
    return this.set('arri-camera-control-data', data);
  }
}

// Global instance
export const offlineStorage = new OfflineStorageManager();