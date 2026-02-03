/**
 * Mobile App Initializer
 * Handles app startup, backend initialization, and mobile-specific setup
 */

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { mobileBackend } from './backend-launcher';
import { connectionManager } from './connection-manager';
import { offlineStorage } from './offline-storage';

export interface InitializationConfig {
  enableNativeFeatures: boolean;
  enableBackend: boolean;
  enableOfflineStorage: boolean;
  enableConnectionManager: boolean;
  splashScreenDelay: number;
  initializationTimeout: number;
}

export interface InitializationStatus {
  initialized: boolean;
  nativeFeaturesReady: boolean;
  backendReady: boolean;
  storageReady: boolean;
  connectionReady: boolean;
  startTime: number;
  initializationTime?: number;
  lastError?: string;
}

export class MobileAppInitializer {
  private config: InitializationConfig;
  private status: InitializationStatus;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<InitializationConfig> = {}) {
    this.config = {
      enableNativeFeatures: true,
      enableBackend: true,
      enableOfflineStorage: true,
      enableConnectionManager: true,
      splashScreenDelay: 2000,
      initializationTimeout: 30000,
      ...config
    };

    this.status = {
      initialized: false,
      nativeFeaturesReady: false,
      backendReady: false,
      storageReady: false,
      connectionReady: false,
      startTime: Date.now()
    };
  }

  async initialize(): Promise<boolean> {
    if (this.status.initialized) {
      return true;
    }

    console.log('Initializing ARRI Camera Control App...');
    console.log('Platform:', Capacitor.getPlatform());
    console.log('Native platform:', Capacitor.isNativePlatform());
    console.log('Configuration:', this.config);

    this.status.startTime = Date.now();

    try {
      // Set up initialization timeout
      const initPromise = this.performInitialization();
      const timeoutPromise = this.createTimeoutPromise();
      
      const result = await Promise.race([initPromise, timeoutPromise]);
      
      if (result === 'timeout') {
        throw new Error('Initialization timeout exceeded');
      }

      this.status.initialized = true;
      this.status.initializationTime = Date.now() - this.status.startTime;
      
      console.log(`App initialization complete in ${this.status.initializationTime}ms`);
      this.emit('app:initialized', this.getStatus());

      return true;
    } catch (error) {
      console.error('App initialization failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.emit('app:initialization-failed', { error: this.status.lastError });
      
      // Attempt partial initialization for graceful degradation
      await this.attemptPartialInitialization();
      
      return false;
    }
  }

  private async performInitialization(): Promise<boolean> {
    // Phase 1: Initialize offline storage first (critical for all other components)
    if (this.config.enableOfflineStorage) {
      console.log('Phase 1: Initializing offline storage...');
      const storageReady = await this.initializeOfflineStorage();
      this.status.storageReady = storageReady;
      
      if (!storageReady) {
        throw new Error('Critical: Offline storage initialization failed');
      }
      
      this.emit('storage:ready');
    }

    // Phase 2: Initialize native features (if on mobile)
    if (this.config.enableNativeFeatures && Capacitor.isNativePlatform()) {
      console.log('Phase 2: Initializing native features...');
      const nativeReady = await this.initializeNativeFeatures();
      this.status.nativeFeaturesReady = nativeReady;
      
      if (nativeReady) {
        this.emit('native:ready');
      }
    } else {
      this.status.nativeFeaturesReady = true; // Not applicable for web
    }

    // Phase 3: Initialize backend server
    if (this.config.enableBackend) {
      console.log('Phase 3: Initializing backend server...');
      const backendReady = await this.initializeBackend();
      this.status.backendReady = backendReady;
      
      if (!backendReady) {
        throw new Error('Critical: Backend server initialization failed');
      }
      
      this.emit('backend:ready');
    }

    // Phase 4: Initialize connection manager
    if (this.config.enableConnectionManager) {
      console.log('Phase 4: Initializing connection manager...');
      const connectionReady = await this.initializeConnectionManager();
      this.status.connectionReady = connectionReady;
      
      if (!connectionReady) {
        console.warn('Connection manager initialization failed, continuing with limited functionality');
      } else {
        this.emit('connection:ready');
      }
    }

    // Phase 5: Initialize app-wide features
    console.log('Phase 5: Initializing app features...');
    await this.initializeAppFeatures();

    // Phase 6: Finalize initialization
    console.log('Phase 6: Finalizing initialization...');
    await this.finalizeInitialization();

    return true;
  }

  private createTimeoutPromise(): Promise<string> {
    return new Promise((resolve) => {
      setTimeout(() => resolve('timeout'), this.config.initializationTimeout);
    });
  }

  private async initializeOfflineStorage(): Promise<boolean> {
    try {
      console.log('Initializing offline storage system...');
      
      await offlineStorage.initialize();

      // Verify storage functionality
      await this.verifyStorageFunctionality();

      console.log('Offline storage initialized successfully');
      return true;
    } catch (error) {
      console.error('Offline storage initialization failed:', error);
      return false;
    }
  }

  private async verifyStorageFunctionality(): Promise<void> {
    try {
      // Test basic storage operations
      const testKey = 'init-test';
      const testValue = { timestamp: Date.now(), test: true };
      
      await offlineStorage.store('test', testKey, testValue);
      const retrieved = await offlineStorage.retrieve(testKey);
      
      if (!retrieved || retrieved.data.timestamp !== testValue.timestamp) {
        throw new Error('Storage verification failed');
      }
      
      await offlineStorage.delete(testKey);
      console.log('Storage functionality verified');
    } catch (error) {
      console.error('Storage verification failed:', error);
      throw error;
    }
  }

  private async initializeNativeFeatures(): Promise<boolean> {
    try {
      console.log('Initializing native mobile features...');

      // Configure status bar
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#1a1a1a' });
        console.log('Status bar configured');
      } catch (error) {
        console.warn('Status bar configuration failed:', error);
      }

      // Set up haptic feedback
      this.setupHapticFeedback();

      // Configure splash screen
      this.configureSplashScreen();

      console.log('Native features initialized successfully');
      return true;
    } catch (error) {
      console.error('Native features initialization failed:', error);
      return false;
    }
  }

  private configureSplashScreen(): void {
    // Hide splash screen after initialization delay
    setTimeout(async () => {
      try {
        await SplashScreen.hide();
        console.log('Splash screen hidden');
      } catch (error) {
        console.warn('Failed to hide splash screen:', error);
      }
    }, this.config.splashScreenDelay);
  }

  private setupHapticFeedback(): void {
    try {
      // Add haptic feedback to global scope for easy access
      (window as any).triggerHaptic = async (style: ImpactStyle = ImpactStyle.Medium) => {
        try {
          await Haptics.impact({ style });
        } catch (error) {
          console.warn('Haptic feedback not available:', error);
        }
      };

      // Test haptic feedback availability
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {
        console.warn('Haptic feedback not supported on this device');
      });

      console.log('Haptic feedback configured');
    } catch (error) {
      console.warn('Haptic feedback setup failed:', error);
    }
  }

  private async initializeBackend(): Promise<boolean> {
    try {
      console.log('Initializing offline-first backend server...');

      // Start the startup manager which handles all backend initialization
      await startupManager.start();

      // Verify backend functionality
      await this.verifyBackendFunctionality();

      console.log('Backend server initialized successfully at:', startupManager.getServerURL());
      return true;
    } catch (error) {
      console.error('Backend initialization failed:', error);
      return false;
    }
  }

  private async verifyBackendFunctionality(): Promise<void> {
    try {
      // Test basic backend API through startup manager
      const serverStatus = startupManager.getStatus();
      if (!serverStatus.phase === 'ready') {
        throw new Error('Backend server not ready');
      }

      // Test HTTP endpoint
      const response = await fetch(`${startupManager.getServerURL()}/health`);
      if (!response.ok) {
        throw new Error(`Backend health check failed: ${response.status}`);
      }
      
      const healthData = await response.json();
      if (healthData.status !== 'ok') {
        throw new Error('Backend health check returned non-ok status');
      }
      
      console.log('Backend HTTP functionality verified');
    } catch (error) {
      console.error('Backend verification failed:', error);
      throw error;
    }
  }

  private async initializeConnectionManager(): Promise<boolean> {
    try {
      console.log('Initializing connection manager...');

      // Connect to the local backend
      await connectionManager.connect();

      // Set up connection event listeners
      this.setupConnectionEventListeners();

      console.log('Connection manager initialized successfully');
      return true;
    } catch (error) {
      console.error('Connection manager initialization failed:', error);
      return false;
    }
  }

  private setupConnectionEventListeners(): void {
    connectionManager.on('connected', (data: any) => {
      console.log('Connection established:', data);
      this.emit('app:connection-established', data);
    });

    connectionManager.on('disconnected', (data: any) => {
      console.warn('Connection lost:', data);
      this.emit('app:connection-lost', data);
    });

    connectionManager.on('error', (data: any) => {
      console.error('Connection error:', data);
      this.emit('app:connection-error', data);
    });
  }

  private async initializeAppFeatures(): Promise<void> {
    try {
      console.log('Initializing app-wide features...');

      // Set up global error handling
      this.setupErrorHandling();

      // Initialize performance monitoring
      this.setupPerformanceMonitoring();

      // Set up app lifecycle handlers
      this.setupAppLifecycleHandlers();

      console.log('App features initialized successfully');
    } catch (error) {
      console.error('App features initialization failed:', error);
      throw error;
    }
  }

  private setupErrorHandling(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.handleError(event.error, 'global-error');
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.handleError(event.reason, 'unhandled-rejection');
    });

    console.log('Global error handling configured');
  }

  private setupPerformanceMonitoring(): void {
    // Monitor app performance
    if ('performance' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            console.log('Navigation timing:', entry);
          }
        }
      });

      try {
        observer.observe({ entryTypes: ['navigation', 'measure'] });
        console.log('Performance monitoring enabled');
      } catch (error) {
        console.warn('Performance monitoring not supported:', error);
      }
    }
  }

  private setupAppLifecycleHandlers(): void {
    // Handle app visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('App went to background');
        this.emit('app:background');
      } else {
        console.log('App came to foreground');
        this.emit('app:foreground');
      }
    });

    // Handle page unload
    window.addEventListener('beforeunload', () => {
      console.log('App is unloading');
      this.cleanup().catch(console.error);
    });

    console.log('App lifecycle handlers configured');
  }

  private async finalizeInitialization(): Promise<void> {
    try {
      // Store initialization metadata
      await offlineStorage.store('app-metadata', 'initialization', {
        timestamp: new Date().toISOString(),
        platform: Capacitor.getPlatform(),
        version: '1.0.0',
        initializationTime: Date.now() - this.status.startTime,
        features: {
          nativeFeatures: this.status.nativeFeaturesReady,
          backend: this.status.backendReady,
          storage: this.status.storageReady,
          connection: this.status.connectionReady
        }
      });

      console.log('Initialization metadata stored');
    } catch (error) {
      console.warn('Failed to store initialization metadata:', error);
    }
  }

  private async attemptPartialInitialization(): Promise<void> {
    console.log('Attempting partial initialization for graceful degradation...');

    try {
      // Ensure at least storage is working
      if (!this.status.storageReady) {
        this.status.storageReady = await this.initializeOfflineStorage();
      }

      // Try to get basic app functionality working
      if (this.status.storageReady) {
        await this.initializeAppFeatures();
        console.log('Partial initialization successful - app will run with limited functionality');
      }
    } catch (error) {
      console.error('Partial initialization also failed:', error);
    }
  }

  private handleError(error: any, context: string): void {
    // Log error with context
    console.error(`App error (${context}):`, error);

    // Store error for debugging
    try {
      const errorData = {
        timestamp: new Date().toISOString(),
        context,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        platform: Capacitor.getPlatform(),
        userAgent: navigator.userAgent
      };

      // Store in offline storage for later analysis
      offlineStorage.store('error-log', `error-${Date.now()}`, errorData).catch(console.warn);
    } catch (storageError) {
      console.warn('Failed to store error data:', storageError);
    }

    // Emit error event for app-level handling
    this.emit('app:error', { error, context });
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

  // Public methods
  async cleanup(): Promise<void> {
    console.log('Cleaning up app initializer...');
    
    try {
      // Disconnect from local backend
      if (this.status.connectionReady) {
        await connectionManager.disconnect();
      }

      // Stop the startup manager and all services
      if (this.status.backendReady) {
        await startupManager.stop();
      }

      // Clear event listeners
      this.eventListeners.clear();
      
      console.log('App initializer cleanup complete');
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  getStatus(): InitializationStatus {
    return { ...this.status };
  }

  getConfig(): InitializationConfig {
    return { ...this.config };
  }

  isInitialized(): boolean {
    return this.status.initialized;
  }

  isFullyReady(): boolean {
    return this.status.initialized && 
           this.status.storageReady && 
           this.status.backendReady;
  }

  getBackendUrl(): string {
    return startupManager.getServerURL();
  }

  getInitializationTime(): number | undefined {
    return this.status.initializationTime;
  }
}

// Global instance
export const appInitializer = new MobileAppInitializer();