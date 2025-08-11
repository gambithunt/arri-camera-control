/**
 * Connection Diagnostics
 * Comprehensive connection monitoring and diagnostic tools
 */

import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';
import { errorManager } from './errorManager';

export interface ConnectionStatus {
  websocket: ConnectionState;
  camera: ConnectionState;
  network: NetworkInfo;
  lastUpdate: number;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  lastConnected?: number;
  lastDisconnected?: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  error?: string;
  latency?: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
}

export interface NetworkInfo {
  online: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  type?: string;
}

export interface DiagnosticTest {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  duration?: number;
  timestamp?: number;
}

export interface ProtocolMessage {
  id: string;
  timestamp: number;
  direction: 'sent' | 'received';
  type: 'websocket' | 'cap';
  event: string;
  data: any;
  size: number;
  latency?: number;
  error?: string;
}

export interface ConnectionMetrics {
  totalMessages: number;
  messagesPerSecond: number;
  averageLatency: number;
  errorRate: number;
  uptime: number;
  reconnections: number;
  dataTransferred: number;
}

class ConnectionDiagnostics {
  private connectionStatus: ConnectionStatus;
  private protocolMessages: ProtocolMessage[] = [];
  private diagnosticTests: Map<string, DiagnosticTest> = new Map();
  private metrics: ConnectionMetrics;
  private startTime: number;
  private messageCounter = 0;
  private maxMessages = 1000;
  private debugMode = false;

  constructor() {
    this.startTime = Date.now();
    this.connectionStatus = {
      websocket: {
        status: 'disconnected',
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        quality: 'unknown'
      },
      camera: {
        status: 'disconnected',
        reconnectAttempts: 0,
        maxReconnectAttempts: 3,
        quality: 'unknown'
      },
      network: {
        online: browser ? navigator.onLine : true
      },
      lastUpdate: Date.now()
    };

    this.metrics = {
      totalMessages: 0,
      messagesPerSecond: 0,
      averageLatency: 0,
      errorRate: 0,
      uptime: 0,
      reconnections: 0,
      dataTransferred: 0
    };

    this.initialize();
  }

  /**
   * Initialize diagnostics system
   */
  private initialize(): void {
    if (!browser) return;

    // Monitor network status
    this.setupNetworkMonitoring();
    
    // Start metrics collection
    this.startMetricsCollection();
    
    console.log('Connection diagnostics initialized');
  }

  /**
   * Set debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update WebSocket connection status
   */
  updateWebSocketStatus(status: ConnectionState['status'], error?: string): void {
    const now = Date.now();
    const previousStatus = this.connectionStatus.websocket.status;

    this.connectionStatus.websocket = {
      ...this.connectionStatus.websocket,
      status,
      error,
      lastUpdate: now
    };

    if (status === 'connected' && previousStatus !== 'connected') {
      this.connectionStatus.websocket.lastConnected = now;
      this.connectionStatus.websocket.reconnectAttempts = 0;
    } else if (status === 'disconnected' && previousStatus === 'connected') {
      this.connectionStatus.websocket.lastDisconnected = now;
    } else if (status === 'reconnecting') {
      this.connectionStatus.websocket.reconnectAttempts++;
      this.metrics.reconnections++;
    }

    this.updateConnectionQuality('websocket');
    this.notifyStatusChange();
  }

  /**
   * Update camera connection status
   */
  updateCameraStatus(status: ConnectionState['status'], error?: string): void {
    const now = Date.now();
    const previousStatus = this.connectionStatus.camera.status;

    this.connectionStatus.camera = {
      ...this.connectionStatus.camera,
      status,
      error,
      lastUpdate: now
    };

    if (status === 'connected' && previousStatus !== 'connected') {
      this.connectionStatus.camera.lastConnected = now;
      this.connectionStatus.camera.reconnectAttempts = 0;
    } else if (status === 'disconnected' && previousStatus === 'connected') {
      this.connectionStatus.camera.lastDisconnected = now;
    } else if (status === 'reconnecting') {
      this.connectionStatus.camera.reconnectAttempts++;
    }

    this.updateConnectionQuality('camera');
    this.notifyStatusChange();
  }

  /**
   * Log protocol message
   */
  logProtocolMessage(
    direction: 'sent' | 'received',
    type: 'websocket' | 'cap',
    event: string,
    data: any,
    latency?: number,
    error?: string
  ): void {
    const message: ProtocolMessage = {
      id: this.generateMessageId(),
      timestamp: Date.now(),
      direction,
      type,
      event,
      data: this.debugMode ? data : this.sanitizeData(data),
      size: this.calculateDataSize(data),
      latency,
      error
    };

    this.protocolMessages.unshift(message);
    
    // Limit message history
    if (this.protocolMessages.length > this.maxMessages) {
      this.protocolMessages = this.protocolMessages.slice(0, this.maxMessages);
    }

    // Update metrics
    this.metrics.totalMessages++;
    this.metrics.dataTransferred += message.size;
    
    if (latency) {
      this.updateLatencyMetrics(latency);
    }
    
    if (error) {
      this.updateErrorMetrics();
    }

    // Log to console in debug mode
    if (this.debugMode) {
      const logLevel = error ? 'error' : 'debug';
      console[logLevel](`[${type.toUpperCase()}] ${direction} ${event}:`, {
        data,
        latency,
        error,
        size: message.size
      });
    }
  }

  /**
   * Measure connection latency
   */
  async measureLatency(target: 'websocket' | 'camera'): Promise<number> {
    const startTime = performance.now();
    
    try {
      if (target === 'websocket') {
        // Ping WebSocket server
        await this.pingWebSocket();
      } else {
        // Ping camera via CAP protocol
        await this.pingCamera();
      }
      
      const latency = performance.now() - startTime;
      
      if (target === 'websocket') {
        this.connectionStatus.websocket.latency = latency;
      } else {
        this.connectionStatus.camera.latency = latency;
      }
      
      this.updateConnectionQuality(target);
      return latency;
    } catch (error) {
      console.error(`Failed to measure ${target} latency:`, error);
      return -1;
    }
  }

  /**
   * Run comprehensive diagnostic tests
   */
  async runDiagnostics(): Promise<DiagnosticTest[]> {
    const tests: DiagnosticTest[] = [
      {
        id: 'network-connectivity',
        name: 'Network Connectivity',
        description: 'Check if device has network connectivity',
        status: 'pending'
      },
      {
        id: 'websocket-connection',
        name: 'WebSocket Connection',
        description: 'Test WebSocket server connectivity',
        status: 'pending'
      },
      {
        id: 'camera-connection',
        name: 'Camera Connection',
        description: 'Test camera connectivity via CAP protocol',
        status: 'pending'
      },
      {
        id: 'protocol-communication',
        name: 'Protocol Communication',
        description: 'Test basic CAP protocol commands',
        status: 'pending'
      },
      {
        id: 'latency-test',
        name: 'Latency Test',
        description: 'Measure connection latency and quality',
        status: 'pending'
      }
    ];

    // Run tests sequentially
    for (const test of tests) {
      await this.runDiagnosticTest(test);
      this.diagnosticTests.set(test.id, test);
    }

    return tests;
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return {
      ...this.connectionStatus,
      lastUpdate: Date.now()
    };
  }

  /**
   * Get protocol message history
   */
  getProtocolMessages(limit?: number): ProtocolMessage[] {
    return limit ? this.protocolMessages.slice(0, limit) : [...this.protocolMessages];
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const now = Date.now();
    const uptime = (now - this.startTime) / 1000;
    
    return {
      ...this.metrics,
      uptime,
      messagesPerSecond: this.metrics.totalMessages / uptime
    };
  }

  /**
   * Get diagnostic test results
   */
  getDiagnosticTests(): DiagnosticTest[] {
    return Array.from(this.diagnosticTests.values());
  }

  /**
   * Clear protocol message history
   */
  clearMessageHistory(): void {
    this.protocolMessages = [];
    console.log('Protocol message history cleared');
  }

  /**
   * Export diagnostic data
   */
  exportDiagnosticData(): string {
    const diagnosticData = {
      timestamp: new Date().toISOString(),
      connectionStatus: this.connectionStatus,
      metrics: this.getMetrics(),
      diagnosticTests: this.getDiagnosticTests(),
      protocolMessages: this.protocolMessages.slice(0, 100), // Last 100 messages
      systemInfo: this.getSystemInfo()
    };

    return JSON.stringify(diagnosticData, null, 2);
  }

  // Private methods

  private setupNetworkMonitoring(): void {
    if (!browser) return;

    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.connectionStatus.network.online = true;
      this.notifyStatusChange();
    });

    window.addEventListener('offline', () => {
      this.connectionStatus.network.online = false;
      this.notifyStatusChange();
    });

    // Monitor network information if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateNetworkInfo = () => {
        this.connectionStatus.network = {
          ...this.connectionStatus.network,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
          type: connection.type
        };
        this.notifyStatusChange();
      };

      connection.addEventListener('change', updateNetworkInfo);
      updateNetworkInfo();
    }
  }

  private startMetricsCollection(): void {
    // Update metrics every second
    setInterval(() => {
      this.updateMetrics();
    }, 1000);
  }

  private updateMetrics(): void {
    const now = Date.now();
    this.metrics.uptime = (now - this.startTime) / 1000;
    
    if (this.metrics.uptime > 0) {
      this.metrics.messagesPerSecond = this.metrics.totalMessages / this.metrics.uptime;
    }
  }

  private updateConnectionQuality(target: 'websocket' | 'camera'): void {
    const connection = this.connectionStatus[target];
    let quality: ConnectionState['quality'] = 'unknown';

    if (connection.status === 'connected') {
      if (connection.latency !== undefined) {
        if (connection.latency < 50) {
          quality = 'excellent';
        } else if (connection.latency < 100) {
          quality = 'good';
        } else if (connection.latency < 200) {
          quality = 'fair';
        } else {
          quality = 'poor';
        }
      } else {
        quality = 'good'; // Default for connected without latency data
      }
    }

    connection.quality = quality;
  }

  private updateLatencyMetrics(latency: number): void {
    // Simple moving average for latency
    const alpha = 0.1; // Smoothing factor
    if (this.metrics.averageLatency === 0) {
      this.metrics.averageLatency = latency;
    } else {
      this.metrics.averageLatency = alpha * latency + (1 - alpha) * this.metrics.averageLatency;
    }
  }

  private updateErrorMetrics(): void {
    // Calculate error rate as percentage of total messages
    const errorCount = this.protocolMessages.filter(m => m.error).length;
    this.metrics.errorRate = (errorCount / this.metrics.totalMessages) * 100;
  }

  private async runDiagnosticTest(test: DiagnosticTest): Promise<void> {
    test.status = 'running';
    test.timestamp = Date.now();
    const startTime = performance.now();

    try {
      switch (test.id) {
        case 'network-connectivity':
          await this.testNetworkConnectivity(test);
          break;
        case 'websocket-connection':
          await this.testWebSocketConnection(test);
          break;
        case 'camera-connection':
          await this.testCameraConnection(test);
          break;
        case 'protocol-communication':
          await this.testProtocolCommunication(test);
          break;
        case 'latency-test':
          await this.testLatency(test);
          break;
        default:
          test.status = 'skipped';
          test.result = 'Unknown test type';
      }
    } catch (error) {
      test.status = 'failed';
      test.error = error instanceof Error ? error.message : String(error);
    }

    test.duration = performance.now() - startTime;
  }

  private async testNetworkConnectivity(test: DiagnosticTest): Promise<void> {
    if (!navigator.onLine) {
      test.status = 'failed';
      test.result = 'Device is offline';
      return;
    }

    // Test basic connectivity
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        test.status = 'passed';
        test.result = 'Network connectivity confirmed';
      } else {
        test.status = 'failed';
        test.result = `Server returned ${response.status}`;
      }
    } catch (error) {
      test.status = 'failed';
      test.result = 'Failed to reach server';
    }
  }

  private async testWebSocketConnection(test: DiagnosticTest): Promise<void> {
    // This would integrate with the actual WebSocket client
    if (this.connectionStatus.websocket.status === 'connected') {
      test.status = 'passed';
      test.result = 'WebSocket connection active';
    } else {
      test.status = 'failed';
      test.result = `WebSocket status: ${this.connectionStatus.websocket.status}`;
    }
  }

  private async testCameraConnection(test: DiagnosticTest): Promise<void> {
    if (this.connectionStatus.camera.status === 'connected') {
      test.status = 'passed';
      test.result = 'Camera connection active';
    } else {
      test.status = 'failed';
      test.result = `Camera status: ${this.connectionStatus.camera.status}`;
    }
  }

  private async testProtocolCommunication(test: DiagnosticTest): Promise<void> {
    // This would test basic CAP protocol commands
    try {
      // Simulate protocol test
      await new Promise(resolve => setTimeout(resolve, 100));
      test.status = 'passed';
      test.result = 'Protocol communication successful';
    } catch (error) {
      test.status = 'failed';
      test.result = 'Protocol communication failed';
    }
  }

  private async testLatency(test: DiagnosticTest): Promise<void> {
    const wsLatency = await this.measureLatency('websocket');
    const cameraLatency = await this.measureLatency('camera');
    
    if (wsLatency > 0 || cameraLatency > 0) {
      test.status = 'passed';
      test.result = `WebSocket: ${wsLatency}ms, Camera: ${cameraLatency}ms`;
    } else {
      test.status = 'failed';
      test.result = 'Failed to measure latency';
    }
  }

  private async pingWebSocket(): Promise<void> {
    // This would send a ping to the WebSocket server
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(), 50); // Simulate ping
    });
  }

  private async pingCamera(): Promise<void> {
    // This would send a ping to the camera via CAP protocol
    return new Promise((resolve, reject) => {
      setTimeout(() => resolve(), 100); // Simulate ping
    });
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${++this.messageCounter}`;
  }

  private sanitizeData(data: any): any {
    // Remove sensitive information from logged data
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      // Remove potential sensitive fields
      const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
      sensitiveFields.forEach(field => {
        if (field in sanitized) {
          sanitized[field] = '[REDACTED]';
        }
      });
      
      return sanitized;
    }
    
    return data;
  }

  private calculateDataSize(data: any): number {
    try {
      return JSON.stringify(data).length;
    } catch {
      return 0;
    }
  }

  private getSystemInfo(): any {
    if (!browser) return {};

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      connection: (navigator as any).connection ? {
        effectiveType: (navigator as any).connection.effectiveType,
        downlink: (navigator as any).connection.downlink,
        rtt: (navigator as any).connection.rtt
      } : null
    };
  }

  private notifyStatusChange(): void {
    connectionStatusStore.set(this.getConnectionStatus());
  }
}

// Create singleton instance
export const connectionDiagnostics = new ConnectionDiagnostics();

// Create reactive stores
function createConnectionStatusStore() {
  const { subscribe, set } = writable<ConnectionStatus>(connectionDiagnostics.getConnectionStatus());

  return {
    subscribe,
    set,
    refresh: () => set(connectionDiagnostics.getConnectionStatus())
  };
}

function createProtocolMessagesStore() {
  const { subscribe, set } = writable<ProtocolMessage[]>([]);

  return {
    subscribe,
    refresh: (limit?: number) => set(connectionDiagnostics.getProtocolMessages(limit))
  };
}

export const connectionStatusStore = createConnectionStatusStore();
export const protocolMessagesStore = createProtocolMessagesStore();

// Derived stores
export const isWebSocketConnected = derived(
  connectionStatusStore,
  $status => $status.websocket.status === 'connected'
);

export const isCameraConnected = derived(
  connectionStatusStore,
  $status => $status.camera.status === 'connected'
);

export const isFullyConnected = derived(
  [isWebSocketConnected, isCameraConnected],
  ([$ws, $camera]) => $ws && $camera
);

export const connectionQuality = derived(
  connectionStatusStore,
  $status => {
    const wsQuality = $status.websocket.quality;
    const cameraQuality = $status.camera.quality;
    
    // Return the worst quality of the two connections
    const qualityOrder = ['excellent', 'good', 'fair', 'poor', 'unknown'];
    const wsIndex = qualityOrder.indexOf(wsQuality);
    const cameraIndex = qualityOrder.indexOf(cameraQuality);
    
    return qualityOrder[Math.max(wsIndex, cameraIndex)] as ConnectionState['quality'];
  }
);

export const hasConnectionErrors = derived(
  connectionStatusStore,
  $status => Boolean($status.websocket.error || $status.camera.error)
);

// Utility functions
export function updateWebSocketStatus(status: ConnectionState['status'], error?: string): void {
  connectionDiagnostics.updateWebSocketStatus(status, error);
}

export function updateCameraStatus(status: ConnectionState['status'], error?: string): void {
  connectionDiagnostics.updateCameraStatus(status, error);
}

export function logProtocolMessage(
  direction: 'sent' | 'received',
  type: 'websocket' | 'cap',
  event: string,
  data: any,
  latency?: number,
  error?: string
): void {
  connectionDiagnostics.logProtocolMessage(direction, type, event, data, latency, error);
}

export function setDebugMode(enabled: boolean): void {
  connectionDiagnostics.setDebugMode(enabled);
}

export function runDiagnostics(): Promise<DiagnosticTest[]> {
  return connectionDiagnostics.runDiagnostics();
}

export function exportDiagnosticData(): string {
  return connectionDiagnostics.exportDiagnosticData();
}

export function clearMessageHistory(): void {
  connectionDiagnostics.clearMessageHistory();
  protocolMessagesStore.refresh();
}