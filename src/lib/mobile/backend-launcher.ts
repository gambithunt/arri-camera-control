/**
 * Mobile Backend Launcher
 * Manages the embedded backend server for offline mobile operation
 */

import { Capacitor } from '@capacitor/core';
import { localServer } from './local-server';
import { offlineStorage } from './offline-storage';

export interface BackendConfig {
  port: number;
  host: string;
  autoStart: boolean;
  enableLogging: boolean;
  maxRetries: number;
  retryDelay: number;
}

export interface BackendStatus {
  running: boolean;
  initialized: boolean;
  port: number;
  uptime: number;
  lastError?: string;
  storageReady: boolean;
}

export class MobileBackendLauncher {
  private config: BackendConfig;
  private status: BackendStatus;
  private startTime: number = 0;
  private retryCount: number = 0;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<BackendConfig> = {}) {
    this.config = {
      port: 3001,
      host: 'localhost',
      autoStart: true,
      enableLogging: true,
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };

    this.status = {
      running: false,
      initialized: false,
      port: this.config.port,
      uptime: 0,
      storageReady: false
    };

    // Auto-initialize if configured
    if (this.config.autoStart) {
      this.initialize().catch(error => {
        console.error('Auto-initialization failed:', error);
      });
    }
  }

  async initialize(): Promise<boolean> {
    if (this.status.initialized) {
      return this.status.running;
    }

    console.log('Initializing mobile backend launcher...');

    try {
      // Initialize offline storage first
      const storageReady = await offlineStorage.initialize();
      this.status.storageReady = storageReady;

      if (!storageReady) {
        throw new Error('Failed to initialize offline storage');
      }

      // Start the local server
      const serverStarted = await this.startServer();
      if (!serverStarted) {
        throw new Error('Failed to start local server');
      }

      this.status.initialized = true;
      this.status.running = true;
      this.startTime = Date.now();

      // Set up periodic status updates
      this.setupStatusUpdates();

      console.log('Mobile backend launcher initialized successfully');
      this.emit('backend:initialized', this.getStatus());

      return true;
    } catch (error) {
      console.error('Backend initialization failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      
      // Attempt retry if configured
      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++;
        console.log(`Retrying initialization (${this.retryCount}/${this.config.maxRetries})...`);
        
        await this.delay(this.config.retryDelay * this.retryCount);
        return this.initialize();
      }

      return false;
    }
  }

  private async startServer(): Promise<boolean> {
    console.log('Starting embedded backend server...');

    try {
      if (Capacitor.isNativePlatform()) {
        // On mobile platforms, start the local server
        return this.startMobileServer();
      } else {
        // On web platforms, start with service worker support
        return this.startWebServer();
      }
    } catch (error) {
      console.error('Server startup failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  private async startMobileServer(): Promise<boolean> {
    console.log('Starting mobile backend server...');

    try {
      // Start the local server instance
      const serverStarted = await localServer.start();
      if (!serverStarted) {
        throw new Error('Local server failed to start');
      }

      // Verify server is responding
      const serverReady = await this.verifyServerHealth();
      if (!serverReady) {
        throw new Error('Server health check failed');
      }

      console.log(`Mobile backend server started successfully on port ${this.config.port}`);
      this.emit('server:started', { port: this.config.port });

      return true;
    } catch (error) {
      console.error('Mobile server startup failed:', error);
      return false;
    }
  }

  private async startWebServer(): Promise<boolean> {
    console.log('Starting web backend server...');

    try {
      // For web platforms, we rely on service worker and local storage
      if ('serviceWorker' in navigator) {
        // Register service worker for offline functionality
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered:', registration);

        // Start local server for API simulation
        const serverStarted = await localServer.start();
        if (!serverStarted) {
          throw new Error('Local server failed to start');
        }

        console.log('Web backend server started successfully');
        this.emit('server:started', { port: this.config.port });

        return true;
      } else {
        console.warn('Service worker not supported, using fallback mode');
        
        // Fallback to local server only
        return localServer.start();
      }
    } catch (error) {
      console.error('Web server startup failed:', error);
      return false;
    }
  }

  private async verifyServerHealth(): Promise<boolean> {
    try {
      // Test basic server functionality
      const testResponse = await this.makeHealthCheck();
      return testResponse.success === true;
    } catch (error) {
      console.warn('Server health check failed:', error);
      return false;
    }
  }

  private async makeHealthCheck(): Promise<any> {
    try {
      if (Capacitor.isNativePlatform() && (window as any).localAPI) {
        // Use local API for health check
        return (window as any).localAPI.storage.get({ key: 'health-check' });
      } else {
        // Use HTTP request for web platforms
        const response = await fetch(`http://${this.config.host}:${this.config.port}/health`, {
          method: 'GET',
          timeout: 5000
        } as any);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.json();
      }
    } catch (error) {
      console.error('Health check request failed:', error);
      throw error;
    }
  }

  private setupStatusUpdates(): void {
    // Update status every second
    setInterval(() => {
      if (this.status.running) {
        this.status.uptime = Date.now() - this.startTime;
      }
    }, 1000);

    // Periodic health checks every 30 seconds
    setInterval(async () => {
      if (this.status.running) {
        try {
          await this.verifyServerHealth();
        } catch (error) {
          console.warn('Periodic health check failed:', error);
          this.handleServerFailure(error);
        }
      }
    }, 30000);
  }

  private handleServerFailure(error: any): void {
    console.error('Server failure detected:', error);
    
    this.status.running = false;
    this.status.lastError = error instanceof Error ? error.message : 'Server failure';
    
    this.emit('server:failed', { error: this.status.lastError });

    // Attempt automatic restart
    if (this.retryCount < this.config.maxRetries) {
      this.retryCount++;
      console.log(`Attempting server restart (${this.retryCount}/${this.config.maxRetries})...`);
      
      setTimeout(async () => {
        try {
          const restarted = await this.restart();
          if (restarted) {
            console.log('Server restart successful');
            this.retryCount = 0; // Reset retry count on success
            this.emit('server:restarted');
          }
        } catch (restartError) {
          console.error('Server restart failed:', restartError);
        }
      }, this.config.retryDelay * this.retryCount);
    } else {
      console.error('Max restart attempts reached, server remains offline');
      this.emit('server:offline');
    }
  }

  async restart(): Promise<boolean> {
    console.log('Restarting backend server...');

    try {
      // Stop current server
      await this.stop();
      
      // Wait a moment before restart
      await this.delay(1000);
      
      // Start server again
      const started = await this.startServer();
      if (started) {
        this.status.running = true;
        this.startTime = Date.now();
        this.status.uptime = 0;
        this.status.lastError = undefined;
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Server restart failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Restart failed';
      return false;
    }
  }

  async stop(): Promise<boolean> {
    console.log('Stopping backend server...');

    try {
      // Stop the local server
      const stopped = await localServer.stop();
      
      this.status.running = false;
      this.status.uptime = 0;
      
      console.log('Backend server stopped successfully');
      this.emit('server:stopped');
      
      return stopped;
    } catch (error) {
      console.error('Failed to stop server:', error);
      return false;
    }
  }

  async waitForServer(timeout: number = 10000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      const checkServer = () => {
        if (this.status.running && this.status.initialized) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          console.warn('Server startup timeout reached');
          resolve(false);
        } else {
          setTimeout(checkServer, 100);
        }
      };
      
      checkServer();
    });
  }

  // Utility methods
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
  getServerUrl(): string {
    return `http://${this.config.host}:${this.config.port}`;
  }

  getStatus(): BackendStatus {
    return { ...this.status };
  }

  getConfig(): BackendConfig {
    return { ...this.config };
  }

  isRunning(): boolean {
    return this.status.running;
  }

  isInitialized(): boolean {
    return this.status.initialized;
  }

  isStorageReady(): boolean {
    return this.status.storageReady;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up backend launcher...');
    
    try {
      await this.stop();
      this.eventListeners.clear();
      
      console.log('Backend launcher cleanup complete');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

// Global instance
export const mobileBackend = new MobileBackendLauncher();