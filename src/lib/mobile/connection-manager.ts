/**
 * Connection Manager
 * Manages connections between frontend and local backend server
 */

import { Capacitor } from '@capacitor/core';
import { localServer } from './local-server';

export interface ConnectionConfig {
  serverUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  enableHeartbeat: boolean;
  heartbeatInterval: number;
}

export interface ConnectionStatus {
  connected: boolean;
  serverRunning: boolean;
  lastConnected?: string;
  lastError?: string;
  retryCount: number;
  latency?: number;
}

export class LocalConnectionManager {
  private config: ConnectionConfig;
  private status: ConnectionStatus;
  private heartbeatTimer?: NodeJS.Timeout;
  private reconnectTimer?: NodeJS.Timeout;
  private eventListeners: Map<string, Function[]> = new Map();

  constructor(config: Partial<ConnectionConfig> = {}) {
    this.config = {
      serverUrl: 'http://localhost:3001',
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableHeartbeat: true,
      heartbeatInterval: 30000,
      ...config
    };

    this.status = {
      connected: false,
      serverRunning: false,
      retryCount: 0
    };
  }

  async initialize(): Promise<boolean> {
    console.log('Initializing connection manager...');

    try {
      // Check if local server is already running (started by backend launcher)
      if (!localServer.isRunning()) {
        console.log('Local server not running, starting it...');
        const serverStarted = await localServer.start();
        if (!serverStarted) {
          throw new Error('Failed to start local server');
        }
      } else {
        console.log('Local server already running');
      }

      this.status.serverRunning = true;

      // Wait a moment for server to be fully ready
      await this.delay(500);

      // Establish connection to local server
      const connected = await this.connect();
      if (!connected) {
        console.warn('Initial connection failed, will retry automatically');
        // Don't throw error here - let the retry mechanism handle it
      }

      // Start heartbeat if enabled
      if (this.config.enableHeartbeat) {
        this.startHeartbeat();
      }

      // Set up automatic reconnection on server events
      this.setupServerEventListeners();

      console.log('Connection manager initialized successfully');
      this.emit('manager:initialized');

      return true;
    } catch (error) {
      console.error('Failed to initialize connection manager:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      return false;
    }
  }

  private setupServerEventListeners(): void {
    // Listen for server events
    localServer.on('server:started', () => {
      console.log('Local server started, attempting connection...');
      this.status.serverRunning = true;
      this.connect().catch(error => {
        console.warn('Auto-connection after server start failed:', error);
      });
    });

    localServer.on('server:stopped', () => {
      console.log('Local server stopped');
      this.status.serverRunning = false;
      this.status.connected = false;
      this.emit('connection:server-stopped');
    });

    localServer.on('server:restarted', () => {
      console.log('Local server restarted, reconnecting...');
      this.status.serverRunning = true;
      this.connect().catch(error => {
        console.warn('Auto-connection after server restart failed:', error);
      });
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async connect(): Promise<boolean> {
    console.log('Connecting to local backend...');

    try {
      if (Capacitor.isNativePlatform()) {
        // On mobile, we connect directly to the local API
        return this.connectToLocalAPI();
      } else {
        // On web, we connect via HTTP/WebSocket
        return this.connectToWebAPI();
      }
    } catch (error) {
      console.error('Connection failed:', error);
      this.status.lastError = error instanceof Error ? error.message : 'Unknown error';
      this.status.connected = false;
      return false;
    }
  }

  private async connectToLocalAPI(): Promise<boolean> {
    console.log('Connecting to local API...');

    // Check if local API is available
    if (!(window as any).localAPI) {
      throw new Error('Local API not available');
    }

    // Test the connection with a simple API call
    try {
      const startTime = Date.now();
      const response = await (window as any).localAPI.storage.get({ key: 'test' });
      const endTime = Date.now();

      this.status.connected = true;
      this.status.lastConnected = new Date().toISOString();
      this.status.latency = endTime - startTime;
      this.status.retryCount = 0;

      console.log('Connected to local API successfully');
      this.emit('connection:established', { latency: this.status.latency });

      return true;
    } catch (error) {
      console.error('Local API test failed:', error);
      return false;
    }
  }

  private async connectToWebAPI(): Promise<boolean> {
    console.log('Connecting to web API...');

    try {
      const startTime = Date.now();
      const response = await fetch(`${this.config.serverUrl}/health`, {
        method: 'GET',
        timeout: this.config.timeout
      } as any);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const endTime = Date.now();

      this.status.connected = true;
      this.status.lastConnected = new Date().toISOString();
      this.status.latency = endTime - startTime;
      this.status.retryCount = 0;

      console.log('Connected to web API successfully');
      this.emit('connection:established', { latency: this.status.latency });

      return true;
    } catch (error) {
      console.error('Web API connection failed:', error);
      return false;
    }
  }

  async disconnect(): Promise<boolean> {
    console.log('Disconnecting from backend...');

    try {
      // Stop heartbeat
      this.stopHeartbeat();

      // Stop reconnection attempts
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
        this.reconnectTimer = undefined;
      }

      this.status.connected = false;
      this.status.lastConnected = undefined;

      console.log('Disconnected successfully');
      this.emit('connection:disconnected');

      return true;
    } catch (error) {
      console.error('Disconnect failed:', error);
      return false;
    }
  }

  async apiCall(endpoint: string, method: string = 'GET', data?: any): Promise<any> {
    if (!this.status.connected) {
      throw new Error('Not connected to backend');
    }

    try {
      if (Capacitor.isNativePlatform()) {
        return this.callLocalAPI(endpoint, method, data);
      } else {
        return this.callWebAPI(endpoint, method, data);
      }
    } catch (error) {
      console.error('API call failed:', error);
      
      // If connection is lost, attempt to reconnect
      if (this.isConnectionError(error)) {
        this.status.connected = false;
        this.attemptReconnect();
      }
      
      throw error;
    }
  }

  private async callLocalAPI(endpoint: string, method: string, data?: any): Promise<any> {
    const localAPI = (window as any).localAPI;
    if (!localAPI) {
      throw new Error('Local API not available');
    }

    // Parse endpoint to determine API call
    const parts = endpoint.split('/').filter(p => p);
    if (parts.length < 2) {
      throw new Error('Invalid endpoint format');
    }

    const [category, action] = parts;
    
    if (!localAPI[category] || !localAPI[category][action]) {
      throw new Error(`API endpoint not found: ${endpoint}`);
    }

    return localAPI[category][action](data || {});
  }

  private async callWebAPI(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.config.serverUrl}${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: this.config.timeout
    } as any;

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private isConnectionError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('network') || 
             message.includes('connection') || 
             message.includes('timeout') ||
             message.includes('not available');
    }
    return false;
  }

  private startHeartbeat(): void {
    console.log('Starting heartbeat...');
    
    this.heartbeatTimer = setInterval(async () => {
      try {
        const startTime = Date.now();
        
        if (Capacitor.isNativePlatform()) {
          await (window as any).localAPI?.storage.get({ key: 'heartbeat' });
        } else {
          await fetch(`${this.config.serverUrl}/health`);
        }
        
        const endTime = Date.now();
        this.status.latency = endTime - startTime;
        
        this.emit('heartbeat:success', { latency: this.status.latency });
      } catch (error) {
        console.warn('Heartbeat failed:', error);
        this.status.connected = false;
        this.attemptReconnect();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
      console.log('Heartbeat stopped');
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already attempting to reconnect
    }

    if (this.status.retryCount >= this.config.retryAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('connection:failed', { 
        reason: 'Max retry attempts reached',
        retryCount: this.status.retryCount 
      });
      return;
    }

    this.status.retryCount++;
    const delay = this.config.retryDelay * Math.pow(2, this.status.retryCount - 1); // Exponential backoff

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.status.retryCount}/${this.config.retryAttempts})`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      
      try {
        const connected = await this.connect();
        if (connected) {
          console.log('Reconnection successful');
          this.emit('connection:restored');
          
          // Restart heartbeat
          if (this.config.enableHeartbeat) {
            this.startHeartbeat();
          }
        } else {
          // Try again
          this.attemptReconnect();
        }
      } catch (error) {
        console.error('Reconnection failed:', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  // Convenience methods for common API calls
  async cameraConnect(ip: string): Promise<any> {
    return this.apiCall('/camera/connect', 'POST', { ip });
  }

  async cameraDisconnect(): Promise<any> {
    return this.apiCall('/camera/disconnect', 'POST');
  }

  async cameraGetStatus(): Promise<any> {
    return this.apiCall('/camera/getStatus', 'GET');
  }

  async cameraSetFrameRate(frameRate: number): Promise<any> {
    return this.apiCall('/camera/setFrameRate', 'POST', { frameRate });
  }

  async cameraSetWhiteBalance(kelvin: number): Promise<any> {
    return this.apiCall('/camera/setWhiteBalance', 'POST', { kelvin });
  }

  async cameraSetISO(iso: number): Promise<any> {
    return this.apiCall('/camera/setISO', 'POST', { iso });
  }

  async playbackGetClips(): Promise<any> {
    return this.apiCall('/playback/getClips', 'GET');
  }

  async playbackPlay(clipId?: string): Promise<any> {
    return this.apiCall('/playback/play', 'POST', { clipId });
  }

  async timecodeGetCurrent(): Promise<any> {
    return this.apiCall('/timecode/getCurrent', 'GET');
  }

  async storageGet(key: string): Promise<any> {
    return this.apiCall('/storage/get', 'GET', { key });
  }

  async storageSet(key: string, value: any): Promise<any> {
    return this.apiCall('/storage/set', 'POST', { key, value });
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

  // Public getters
  getStatus(): ConnectionStatus {
    return { ...this.status };
  }

  getConfig(): ConnectionConfig {
    return { ...this.config };
  }

  isConnected(): boolean {
    return this.status.connected;
  }

  isServerRunning(): boolean {
    return this.status.serverRunning;
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up connection manager...');
    
    await this.disconnect();
    
    // Stop local server
    if (this.status.serverRunning) {
      await localServer.stop();
      this.status.serverRunning = false;
    }
    
    // Clear all event listeners
    this.eventListeners.clear();
    
    console.log('Connection manager cleanup complete');
  }
}

// Global instance
export const connectionManager = new LocalConnectionManager();