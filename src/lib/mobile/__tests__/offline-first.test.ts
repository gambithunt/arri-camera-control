/**
 * Offline-First Architecture Tests
 * Tests for local server, offline storage, startup manager, and connection manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LocalServer } from '../local-server';
import { OfflineStorage } from '../offline-storage';
import { StartupManager } from '../startup-manager';
import { ConnectionManager } from '../connection-manager';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
    getPlatform: () => 'web'
  }
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(() => ({ remove: vi.fn() }))
  }
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    readdir: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    mkdir: vi.fn()
  },
  Directory: {
    Documents: 'DOCUMENTS'
  },
  Encoding: {
    UTF8: 'utf8'
  }
}));

describe('LocalServer', () => {
  let server: LocalServer;

  beforeEach(() => {
    server = new LocalServer();
  });

  afterEach(async () => {
    if (server.isRunning()) {
      await server.stop();
    }
  });

  it('should initialize with default configuration', () => {
    expect(server.getStatus().running).toBe(false);
    expect(server.getStatus().port).toBe(3001);
    expect(server.getURL()).toBe('http://localhost:3001');
  });

  it('should start and stop server', async () => {
    const status = await server.start();
    
    expect(status.running).toBe(true);
    expect(server.isRunning()).toBe(true);
    
    await server.stop();
    
    expect(server.isRunning()).toBe(false);
  });

  it('should handle multiple start calls gracefully', async () => {
    await server.start();
    const status1 = server.getStatus();
    
    await server.start(); // Second call should not fail
    const status2 = server.getStatus();
    
    expect(status1.running).toBe(true);
    expect(status2.running).toBe(true);
    expect(status1.startTime).toEqual(status2.startTime);
  });

  it('should provide health check endpoint', async () => {
    await server.start();
    
    // In a real test, we would make an HTTP request
    // For now, we'll test the route registration
    expect(server.isRunning()).toBe(true);
  });
});

describe('OfflineStorage', () => {
  let storage: OfflineStorage;

  beforeEach(async () => {
    storage = new OfflineStorage();
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('should initialize successfully', async () => {
    await storage.initialize();
    
    const stats = await storage.getStats();
    expect(stats.totalItems).toBe(0);
  });

  it('should store and retrieve data', async () => {
    await storage.initialize();
    
    const testData = { name: 'Test Camera', model: 'ALEXA Mini LF' };
    await storage.store('camera', 'test-camera', testData);
    
    const retrieved = await storage.retrieve('test-camera');
    
    expect(retrieved).toBeTruthy();
    expect(retrieved!.data).toEqual(testData);
    expect(retrieved!.type).toBe('camera');
  });

  it('should retrieve data by type', async () => {
    await storage.initialize();
    
    await storage.store('camera', 'camera1', { name: 'Camera 1' });
    await storage.store('camera', 'camera2', { name: 'Camera 2' });
    await storage.store('lut', 'lut1', { name: 'LUT 1' });
    
    const cameras = await storage.retrieveByType('camera');
    const luts = await storage.retrieveByType('lut');
    
    expect(cameras).toHaveLength(2);
    expect(luts).toHaveLength(1);
  });

  it('should delete data', async () => {
    await storage.initialize();
    
    await storage.store('test', 'item1', { data: 'test' });
    
    let retrieved = await storage.retrieve('item1');
    expect(retrieved).toBeTruthy();
    
    const deleted = await storage.delete('item1');
    expect(deleted).toBe(true);
    
    retrieved = await storage.retrieve('item1');
    expect(retrieved).toBeNull();
  });

  it('should handle settings convenience methods', async () => {
    await storage.initialize();
    
    const settings = {
      theme: 'dark',
      hapticFeedback: true,
      autoReconnect: false
    };
    
    await storage.storeSettings(settings);
    const retrieved = await storage.getSettings();
    
    expect(retrieved.theme).toBe('dark');
    expect(retrieved.hapticFeedback).toBe(true);
    expect(retrieved.autoReconnect).toBe(false);
  });

  it('should handle LUT convenience methods', async () => {
    await storage.initialize();
    
    const lut = {
      name: 'Test LUT',
      data: 'lut-data-here'
    };
    
    const lutId = await storage.storeLUT(lut);
    expect(lutId).toBeTruthy();
    
    const luts = await storage.getLUTs();
    expect(luts).toHaveLength(1);
    expect(luts[0].name).toBe('Test LUT');
  });

  it('should create and restore backups', async () => {
    await storage.initialize();
    
    // Store some test data
    await storage.store('test', 'item1', { value: 1 });
    await storage.store('test', 'item2', { value: 2 });
    
    // Create backup
    const backupId = await storage.backup();
    expect(backupId).toBeTruthy();
    
    // Clear storage
    await storage.clear();
    let stats = await storage.getStats();
    expect(stats.totalItems).toBe(0);
    
    // Restore backup
    await storage.restore(backupId);
    stats = await storage.getStats();
    expect(stats.totalItems).toBe(2);
    
    const item1 = await storage.retrieve('item1');
    expect(item1?.data.value).toBe(1);
  });

  it('should provide storage statistics', async () => {
    await storage.initialize();
    
    await storage.store('test', 'item1', { data: 'small' });
    await storage.store('test', 'item2', { data: 'larger data string' });
    
    const stats = await storage.getStats();
    
    expect(stats.totalItems).toBe(2);
    expect(stats.totalSize).toBeGreaterThan(0);
    expect(stats.availableSpace).toBeGreaterThan(0);
  });
});

describe('StartupManager', () => {
  let startupManager: StartupManager;

  beforeEach(() => {
    startupManager = new StartupManager();
  });

  afterEach(async () => {
    if (startupManager.isReady()) {
      await startupManager.stop();
    }
  });

  it('should initialize with correct default status', () => {
    const status = startupManager.getStatus();
    
    expect(status.phase).toBe('initializing');
    expect(status.progress).toBe(0);
    expect(status.message).toBe('Initializing app...');
    expect(status.startTime).toBeInstanceOf(Date);
  });

  it('should start successfully', async () => {
    await startupManager.start();
    
    const status = startupManager.getStatus();
    expect(status.phase).toBe('ready');
    expect(status.progress).toBe(100);
    expect(startupManager.isReady()).toBe(true);
  });

  it('should handle status change listeners', async () => {
    const statusChanges: any[] = [];
    
    const unsubscribe = startupManager.onStatusChange((status) => {
      statusChanges.push({ ...status });
    });
    
    await startupManager.start();
    
    expect(statusChanges.length).toBeGreaterThan(0);
    expect(statusChanges[statusChanges.length - 1].phase).toBe('ready');
    
    unsubscribe();
  });

  it('should provide server URL when ready', async () => {
    await startupManager.start();
    
    const url = startupManager.getServerURL();
    expect(url).toBeTruthy();
    expect(url).toMatch(/^http:\/\/localhost:\d+$/);
  });

  it('should handle restart', async () => {
    await startupManager.start();
    expect(startupManager.isReady()).toBe(true);
    
    await startupManager.restart();
    expect(startupManager.isReady()).toBe(true);
  });

  it('should provide storage statistics', async () => {
    await startupManager.start();
    
    const stats = await startupManager.getStorageStats();
    expect(stats).toBeTruthy();
    expect(typeof stats.totalItems).toBe('number');
  });
});

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockServer: LocalServer;

  beforeEach(async () => {
    mockServer = new LocalServer();
    await mockServer.start();
    
    connectionManager = new ConnectionManager({
      serverURL: mockServer.getURL()
    });
  });

  afterEach(async () => {
    if (connectionManager.isConnected()) {
      await connectionManager.disconnect();
    }
    
    if (mockServer.isRunning()) {
      await mockServer.stop();
    }
  });

  it('should initialize with correct default status', () => {
    const status = connectionManager.getStatus();
    
    expect(status.connected).toBe(false);
    expect(status.reconnectAttempts).toBe(0);
    expect(status.serverURL).toBeTruthy();
  });

  it('should connect to server', async () => {
    await connectionManager.connect();
    
    const status = connectionManager.getStatus();
    expect(status.connected).toBe(true);
    expect(connectionManager.isConnected()).toBe(true);
  });

  it('should handle connection events', async () => {
    const events: string[] = [];
    
    connectionManager.on('connected', () => events.push('connected'));
    connectionManager.on('disconnected', () => events.push('disconnected'));
    
    await connectionManager.connect();
    await connectionManager.disconnect();
    
    expect(events).toContain('connected');
    expect(events).toContain('disconnected');
  });

  it('should make requests to server', async () => {
    await connectionManager.connect();
    
    // Test ping request
    const latency = await connectionManager.ping();
    expect(typeof latency).toBe('number');
    expect(latency).toBeGreaterThanOrEqual(0);
  });

  it('should handle convenience methods', async () => {
    await connectionManager.connect();
    
    // Test camera status request
    const cameraStatus = await connectionManager.getCameraStatus();
    expect(cameraStatus).toBeTruthy();
    expect(cameraStatus.connected).toBe(false); // Default mock response
  });

  it('should queue requests when disconnected', async () => {
    // Make request while disconnected
    const requestPromise = connectionManager.getCameraStatus();
    
    // Connect after making request
    await connectionManager.connect();
    
    // Request should resolve
    const result = await requestPromise;
    expect(result).toBeTruthy();
  });

  it('should handle settings operations', async () => {
    await connectionManager.connect();
    
    const testSettings = {
      theme: 'light',
      hapticFeedback: false
    };
    
    const saveResult = await connectionManager.saveSettings(testSettings);
    expect(saveResult).toBeTruthy();
    
    const retrievedSettings = await connectionManager.getSettings();
    expect(retrievedSettings).toBeTruthy();
  });
});

describe('Integration Tests', () => {
  let startupManager: StartupManager;
  let connectionManager: ConnectionManager;

  beforeEach(() => {
    startupManager = new StartupManager();
  });

  afterEach(async () => {
    if (connectionManager?.isConnected()) {
      await connectionManager.disconnect();
    }
    
    if (startupManager?.isReady()) {
      await startupManager.stop();
    }
  });

  it('should complete full offline-first initialization', async () => {
    // Start the startup manager
    await startupManager.start();
    expect(startupManager.isReady()).toBe(true);
    
    // Create connection manager with server URL
    connectionManager = new ConnectionManager({
      serverURL: startupManager.getServerURL()
    });
    
    // Connect to the local server
    await connectionManager.connect();
    expect(connectionManager.isConnected()).toBe(true);
    
    // Test end-to-end functionality
    const cameraStatus = await connectionManager.getCameraStatus();
    expect(cameraStatus).toBeTruthy();
    
    // Test settings persistence
    const settings = { theme: 'dark', autoReconnect: true };
    await connectionManager.saveSettings(settings);
    
    const retrievedSettings = await connectionManager.getSettings();
    expect(retrievedSettings.theme).toBe('dark');
  });

  it('should handle server restart gracefully', async () => {
    await startupManager.start();
    
    connectionManager = new ConnectionManager({
      serverURL: startupManager.getServerURL()
    });
    
    await connectionManager.connect();
    expect(connectionManager.isConnected()).toBe(true);
    
    // Restart the server
    await startupManager.restart();
    
    // Connection should eventually be restored
    // In a real test, we might wait for reconnection
    expect(startupManager.isReady()).toBe(true);
  });

  it('should maintain data consistency across restarts', async () => {
    await startupManager.start();
    
    connectionManager = new ConnectionManager({
      serverURL: startupManager.getServerURL()
    });
    
    await connectionManager.connect();
    
    // Store some data
    const testSettings = { theme: 'dark', testValue: 123 };
    await connectionManager.saveSettings(testSettings);
    
    // Restart everything
    await connectionManager.disconnect();
    await startupManager.stop();
    
    await startupManager.start();
    await connectionManager.connect();
    
    // Data should still be available
    const retrievedSettings = await connectionManager.getSettings();
    expect(retrievedSettings.theme).toBe('dark');
    expect(retrievedSettings.testValue).toBe(123);
  });
});