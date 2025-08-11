/**
 * Local Backend Server
 * Embedded server that runs locally on the mobile device for offline operation
 */

import { Capacitor } from '@capacitor/core';

export interface LocalServerConfig {
  port: number;
  host: string;
  enableLogging: boolean;
  maxConnections: number;
}

export interface ServerStatus {
  running: boolean;
  port: number;
  uptime: number;
  connections: number;
  lastError?: string;
}

export class LocalBackendServer {
  private config: LocalServerConfig;
  private status: ServerStatus;
  private startTime: number = 0;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<LocalServerConfig> = {}) {
    this.config = {
      port: 3001,
      host: 'localhost',
      enableLogging: true,
      maxConnections: 10,
      ...config
    };

    this.status = {
      running: false,
      port: this.config.port,
      uptime: 0,
      connections: 0
    };
  }

  async start(): Promise<boolean> {
    try {
      console.log('Starting local backend server...');
      
      if (Capacitor.isNativePlatform()) {
        // On mobile platforms, we'll use a different approach
        // Since we can't run a full Node.js server, we'll simulate it
        return this.startMobileServer();
      } else {
        // On web platforms, we'll use a service worker approach
        return this.startWebServer();
      }
    } catch (error) {
      console.error('Failed to start local server:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  private async startMobileServer(): Promise<boolean> {
    console.log('Starting mobile backend server...');
    
    // For mobile platforms, we'll create a lightweight message handler
    // that simulates the backend API using local storage and in-memory state
    
    this.startTime = Date.now();
    this.status.running = true;
    this.status.uptime = 0;
    
    // Set up periodic status updates
    setInterval(() => {
      if (this.status.running) {
        this.status.uptime = Date.now() - this.startTime;
      }
    }, 1000);

    // Initialize local data storage
    await this.initializeLocalStorage();
    
    // Set up message handlers for API simulation
    this.setupAPIHandlers();
    
    console.log(`Mobile backend server started on port ${this.config.port}`);
    this.emit('server:started', { port: this.config.port });
    
    return true;
  }

  private async startWebServer(): Promise<boolean> {
    console.log('Starting web backend server...');
    
    // For web platforms, we'll use service worker for offline functionality
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service worker registered:', registration);
        
        this.startTime = Date.now();
        this.status.running = true;
        
        this.emit('server:started', { port: this.config.port });
        return true;
      } catch (error) {
        console.error('Service worker registration failed:', error);
        return false;
      }
    }
    
    return false;
  }

  private async initializeLocalStorage(): Promise<void> {
    try {
      // Initialize app data structure
      const appData = {
        version: '1.0.0',
        initialized: new Date().toISOString(),
        settings: {
          theme: 'dark',
          language: 'en',
          hapticFeedback: true,
          autoReconnect: true,
          debugMode: false
        },
        cameras: [],
        luts: [],
        presets: [],
        logs: []
      };

      // Check if data already exists
      const existingData = localStorage.getItem('arri-camera-control-data');
      if (!existingData) {
        localStorage.setItem('arri-camera-control-data', JSON.stringify(appData));
        console.log('Initialized local storage with default data');
      } else {
        console.log('Local storage already initialized');
      }

      // Initialize session data
      sessionStorage.setItem('arri-session-start', new Date().toISOString());
      
    } catch (error) {
      console.error('Failed to initialize local storage:', error);
      throw error;
    }
  }

  private setupAPIHandlers(): void {
    // Set up global message handler for API requests
    (window as any).localAPI = {
      // Camera API endpoints
      camera: {
        connect: this.handleCameraConnect.bind(this),
        disconnect: this.handleCameraDisconnect.bind(this),
        getStatus: this.handleCameraGetStatus.bind(this),
        setFrameRate: this.handleCameraSetFrameRate.bind(this),
        setWhiteBalance: this.handleCameraSetWhiteBalance.bind(this),
        setISO: this.handleCameraSetISO.bind(this),
        setNDFilter: this.handleCameraSetNDFilter.bind(this)
      },
      
      // Playback API endpoints
      playback: {
        getClips: this.handlePlaybackGetClips.bind(this),
        play: this.handlePlaybackPlay.bind(this),
        pause: this.handlePlaybackPause.bind(this),
        stop: this.handlePlaybackStop.bind(this),
        seek: this.handlePlaybackSeek.bind(this)
      },
      
      // Timecode API endpoints
      timecode: {
        getCurrent: this.handleTimecodeGetCurrent.bind(this),
        sync: this.handleTimecodeSync.bind(this),
        setMode: this.handleTimecodeSetMode.bind(this)
      },
      
      // Storage API endpoints
      storage: {
        get: this.handleStorageGet.bind(this),
        set: this.handleStorageSet.bind(this),
        delete: this.handleStorageDelete.bind(this),
        list: this.handleStorageList.bind(this)
      }
    };

    console.log('Local API handlers initialized');
  }

  // Camera API handlers
  private async handleCameraConnect(data: { ip: string }): Promise<any> {
    console.log('Local API: Camera connect', data);
    
    // Simulate camera connection
    await this.delay(1000);
    
    const cameraInfo = {
      model: 'ARRI ALEXA Mini LF',
      serialNumber: 'ALF001234',
      firmwareVersion: '7.2.1',
      ip: data.ip,
      connected: true,
      connectedAt: new Date().toISOString()
    };
    
    // Store camera info
    this.updateLocalData('cameras', [cameraInfo]);
    
    return {
      success: true,
      data: cameraInfo
    };
  }

  private async handleCameraDisconnect(): Promise<any> {
    console.log('Local API: Camera disconnect');
    
    // Clear camera connection
    this.updateLocalData('cameras', []);
    
    return {
      success: true,
      data: { connected: false }
    };
  }

  private async handleCameraGetStatus(): Promise<any> {
    const cameras = this.getLocalData('cameras') || [];
    const camera = cameras[0];
    
    if (!camera) {
      return {
        success: false,
        error: 'No camera connected'
      };
    }
    
    return {
      success: true,
      data: {
        ...camera,
        frameRate: 24,
        whiteBalance: 5600,
        iso: 800,
        ndFilter: 0,
        recording: false,
        batteryLevel: 85,
        temperature: 42
      }
    };
  }

  private async handleCameraSetFrameRate(data: { frameRate: number }): Promise<any> {
    console.log('Local API: Set frame rate', data);
    
    if (data.frameRate < 1 || data.frameRate > 120) {
      return {
        success: false,
        code: 'CAP_003',
        error: 'Invalid frame rate. Must be between 1 and 120 fps.'
      };
    }
    
    await this.delay(200);
    
    return {
      success: true,
      data: { frameRate: data.frameRate }
    };
  }

  private async handleCameraSetWhiteBalance(data: { kelvin: number }): Promise<any> {
    console.log('Local API: Set white balance', data);
    
    if (data.kelvin < 2000 || data.kelvin > 11000) {
      return {
        success: false,
        code: 'CAP_003',
        error: 'Invalid white balance. Must be between 2000K and 11000K.'
      };
    }
    
    await this.delay(200);
    
    return {
      success: true,
      data: { kelvin: data.kelvin }
    };
  }

  private async handleCameraSetISO(data: { iso: number }): Promise<any> {
    console.log('Local API: Set ISO', data);
    
    const validISOs = [100, 200, 400, 800, 1600, 3200, 6400];
    if (!validISOs.includes(data.iso)) {
      return {
        success: false,
        code: 'CAP_003',
        error: `Invalid ISO. Must be one of: ${validISOs.join(', ')}`
      };
    }
    
    await this.delay(200);
    
    return {
      success: true,
      data: { iso: data.iso }
    };
  }

  private async handleCameraSetNDFilter(data: { ndStop: number }): Promise<any> {
    console.log('Local API: Set ND filter', data);
    
    const validStops = [0, 0.6, 1.2, 1.8, 2.4, 3.0];
    if (!validStops.includes(data.ndStop)) {
      return {
        success: false,
        code: 'CAP_003',
        error: `Invalid ND stop. Must be one of: ${validStops.join(', ')}`
      };
    }
    
    await this.delay(200);
    
    return {
      success: true,
      data: { ndStop: data.ndStop }
    };
  }

  // Playback API handlers
  private async handlePlaybackGetClips(): Promise<any> {
    console.log('Local API: Get clips');
    
    // Return mock clips
    const clips = [
      {
        id: 'clip_001',
        name: 'Scene_01_Take_01',
        duration: 120,
        resolution: '4K UHD',
        codec: 'ARRIRAW',
        frameRate: 24,
        size: '2.1 GB',
        created: '2024-01-15T10:30:00Z'
      },
      {
        id: 'clip_002',
        name: 'Scene_01_Take_02',
        duration: 95,
        resolution: '4K UHD',
        codec: 'ARRIRAW',
        frameRate: 24,
        size: '1.8 GB',
        created: '2024-01-15T10:35:00Z'
      }
    ];
    
    return {
      success: true,
      data: { clips }
    };
  }

  private async handlePlaybackPlay(data: { clipId?: string }): Promise<any> {
    console.log('Local API: Play clip', data);
    
    await this.delay(300);
    
    return {
      success: true,
      data: { 
        status: 'playing',
        clipId: data.clipId || 'clip_001',
        position: 0
      }
    };
  }

  private async handlePlaybackPause(): Promise<any> {
    console.log('Local API: Pause playback');
    
    return {
      success: true,
      data: { status: 'paused' }
    };
  }

  private async handlePlaybackStop(): Promise<any> {
    console.log('Local API: Stop playback');
    
    return {
      success: true,
      data: { status: 'stopped', position: 0 }
    };
  }

  private async handlePlaybackSeek(data: { position: number }): Promise<any> {
    console.log('Local API: Seek to position', data);
    
    return {
      success: true,
      data: { position: data.position }
    };
  }

  // Timecode API handlers
  private async handleTimecodeGetCurrent(): Promise<any> {
    const now = new Date();
    const timecode = this.formatTimecode(now);
    
    return {
      success: true,
      data: {
        timecode,
        frameRate: 24,
        mode: 'free_run'
      }
    };
  }

  private async handleTimecodeSync(): Promise<any> {
    console.log('Local API: Sync timecode');
    
    const now = new Date();
    const timecode = this.formatTimecode(now);
    
    return {
      success: true,
      data: {
        timecode,
        frameRate: 24,
        synced: true
      }
    };
  }

  private async handleTimecodeSetMode(data: { mode: string }): Promise<any> {
    console.log('Local API: Set timecode mode', data);
    
    const validModes = ['free_run', 'record_run', 'external', 'time_of_day'];
    if (!validModes.includes(data.mode)) {
      return {
        success: false,
        code: 'CAP_003',
        error: `Invalid timecode mode. Must be one of: ${validModes.join(', ')}`
      };
    }
    
    return {
      success: true,
      data: { mode: data.mode }
    };
  }

  // Storage API handlers
  private async handleStorageGet(data: { key: string }): Promise<any> {
    try {
      const value = localStorage.getItem(data.key);
      return {
        success: true,
        data: { key: data.key, value: value ? JSON.parse(value) : null }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to get storage value'
      };
    }
  }

  private async handleStorageSet(data: { key: string; value: any }): Promise<any> {
    try {
      localStorage.setItem(data.key, JSON.stringify(data.value));
      return {
        success: true,
        data: { key: data.key }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to set storage value'
      };
    }
  }

  private async handleStorageDelete(data: { key: string }): Promise<any> {
    try {
      localStorage.removeItem(data.key);
      return {
        success: true,
        data: { key: data.key }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to delete storage value'
      };
    }
  }

  private async handleStorageList(): Promise<any> {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keys.push(key);
      }
      return {
        success: true,
        data: { keys }
      };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to list storage keys'
      };
    }
  }

  // Utility methods
  private formatTimecode(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const frames = Math.floor(date.getMilliseconds() / 1000 * 24).toString().padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}:${frames}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getLocalData(key: string): any {
    try {
      const data = localStorage.getItem('arri-camera-control-data');
      if (data) {
        const parsed = JSON.parse(data);
        return parsed[key];
      }
    } catch (error) {
      console.error('Failed to get local data:', error);
    }
    return null;
  }

  private updateLocalData(key: string, value: any): void {
    try {
      const data = localStorage.getItem('arri-camera-control-data');
      const parsed = data ? JSON.parse(data) : {};
      parsed[key] = value;
      parsed.lastUpdated = new Date().toISOString();
      localStorage.setItem('arri-camera-control-data', JSON.stringify(parsed));
    } catch (error) {
      console.error('Failed to update local data:', error);
    }
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
      listeners.forEach(callback => callback(data));
    }
  }

  // Public methods
  async stop(): Promise<boolean> {
    console.log('Stopping local backend server...');
    
    this.status.running = false;
    this.status.uptime = 0;
    
    // Clean up global API
    delete (window as any).localAPI;
    
    this.emit('server:stopped');
    
    return true;
  }

  getStatus(): ServerStatus {
    if (this.status.running) {
      this.status.uptime = Date.now() - this.startTime;
    }
    return { ...this.status };
  }

  isRunning(): boolean {
    return this.status.running;
  }

  getConfig(): LocalServerConfig {
    return { ...this.config };
  }
}

// Global instance
export const localServer = new LocalBackendServer();