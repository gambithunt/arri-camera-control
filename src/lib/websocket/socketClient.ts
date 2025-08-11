/**
 * Socket.io Client Connection Manager
 * Handles WebSocket connection to the backend server with automatic reconnection
 */

import { io, type Socket } from 'socket.io-client';
import { writable, type Writable } from 'svelte/store';

export interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  lastConnected: Date | null;
  serverUrl: string;
}

export interface SocketClientConfig {
  serverUrl: string;
  reconnectionAttempts: number;
  reconnectionDelay: number;
  maxReconnectionDelay: number;
  timeout: number;
}

class SocketClient {
  private socket: Socket | null = null;
  private config: SocketClientConfig;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private connectionAttempts = 0;
  
  // Reactive stores
  public connectionStatus: Writable<ConnectionStatus>;
  
  // Event handlers
  private eventHandlers: Map<string, Set<Function>> = new Map();

  constructor(config: Partial<SocketClientConfig> = {}) {
    this.config = {
      serverUrl: config.serverUrl || 'http://localhost:3001',
      reconnectionAttempts: config.reconnectionAttempts || 10,
      reconnectionDelay: config.reconnectionDelay || 1000,
      maxReconnectionDelay: config.maxReconnectionDelay || 30000,
      timeout: config.timeout || 5000,
      ...config
    };

    this.connectionStatus = writable<ConnectionStatus>({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0,
      lastConnected: null,
      serverUrl: this.config.serverUrl
    });
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<boolean> {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return true;
    }

    this.updateStatus({ connecting: true, error: null });

    try {
      this.socket = io(this.config.serverUrl, {
        timeout: this.config.timeout,
        autoConnect: false,
        reconnection: false, // We handle reconnection manually
        transports: ['websocket', 'polling']
      });

      this.setupEventHandlers();
      this.socket.connect();

      // Wait for connection or timeout
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.updateStatus({ 
            connecting: false, 
            error: 'Connection timeout' 
          });
          resolve(false);
        }, this.config.timeout);

        this.socket!.once('connect', () => {
          clearTimeout(timeout);
          this.connectionAttempts = 0;
          this.updateStatus({
            connected: true,
            connecting: false,
            error: null,
            reconnectAttempts: 0,
            lastConnected: new Date()
          });
          resolve(true);
        });

        this.socket!.once('connect_error', (error) => {
          clearTimeout(timeout);
          this.updateStatus({
            connecting: false,
            error: error.message || 'Connection failed'
          });
          resolve(false);
        });
      });
    } catch (error) {
      this.updateStatus({
        connecting: false,
        error: error instanceof Error ? error.message : 'Unknown connection error'
      });
      return false;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.updateStatus({
      connected: false,
      connecting: false,
      error: null,
      reconnectAttempts: 0
    });
  }

  /**
   * Emit an event to the server
   */
  emit(event: string, data?: any): boolean {
    if (!this.socket?.connected) {
      console.warn(`Cannot emit ${event}: socket not connected`);
      return false;
    }

    this.socket.emit(event, data);
    return true;
  }

  /**
   * Listen for events from the server
   */
  on(event: string, handler: Function): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    
    this.eventHandlers.get(event)!.add(handler);

    // If socket exists, add the handler immediately
    if (this.socket) {
      this.socket.on(event, handler as any);
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(event);
        }
      }
      
      if (this.socket) {
        this.socket.off(event, handler as any);
      }
    };
  }

  /**
   * Listen for an event once
   */
  once(event: string, handler: Function): void {
    if (!this.socket?.connected) {
      console.warn(`Cannot listen for ${event}: socket not connected`);
      return;
    }

    this.socket.once(event, handler as any);
  }

  /**
   * Get current connection state
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get the socket instance (for advanced usage)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('Socket connected to', this.config.serverUrl);
      this.connectionAttempts = 0;
      this.updateStatus({
        connected: true,
        connecting: false,
        error: null,
        reconnectAttempts: 0,
        lastConnected: new Date()
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.updateStatus({
        connected: false,
        connecting: false,
        error: `Disconnected: ${reason}`
      });

      // Auto-reconnect unless it was a manual disconnect
      if (reason !== 'io client disconnect') {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.updateStatus({
        connected: false,
        connecting: false,
        error: error.message || 'Connection error'
      });
      this.scheduleReconnect();
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket reconnection error:', error);
      this.updateStatus({
        error: error.message || 'Reconnection error'
      });
    });

    // Re-attach all event handlers
    for (const [event, handlers] of this.eventHandlers) {
      for (const handler of handlers) {
        this.socket.on(event, handler as any);
      }
    }
  }

  /**
   * Schedule automatic reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.connectionAttempts >= this.config.reconnectionAttempts) {
      this.updateStatus({
        error: `Max reconnection attempts (${this.config.reconnectionAttempts}) reached`
      });
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      this.config.reconnectionDelay * Math.pow(2, this.connectionAttempts),
      this.config.maxReconnectionDelay
    );

    this.connectionAttempts++;
    this.updateStatus({
      reconnectAttempts: this.connectionAttempts
    });

    console.log(`Scheduling reconnection attempt ${this.connectionAttempts} in ${delay}ms`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Update connection status
   */
  private updateStatus(updates: Partial<ConnectionStatus>): void {
    this.connectionStatus.update(current => ({
      ...current,
      ...updates
    }));
  }

  /**
   * Manually trigger reconnection
   */
  reconnect(): Promise<boolean> {
    this.disconnect();
    return this.connect();
  }

  /**
   * Reset connection attempts counter
   */
  resetReconnectionAttempts(): void {
    this.connectionAttempts = 0;
    this.updateStatus({ reconnectAttempts: 0 });
  }
}

// Export singleton instance
export const socketClient = new SocketClient();

/**
 * Initialize socket connection with custom config
 */
export function initializeSocket(config?: Partial<SocketClientConfig>): SocketClient {
  if (config) {
    return new SocketClient(config);
  }
  return socketClient;
}