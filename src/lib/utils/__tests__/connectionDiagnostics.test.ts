/**
 * Connection Diagnostics Tests
 * Tests for connection monitoring and diagnostic functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  connectionDiagnostics,
  connectionStatusStore,
  protocolMessagesStore,
  isWebSocketConnected,
  isCameraConnected,
  isFullyConnected,
  connectionQuality,
  hasConnectionErrors,
  updateWebSocketStatus,
  updateCameraStatus,
  logProtocolMessage,
  setDebugMode,
  runDiagnostics,
  exportDiagnosticData,
  clearMessageHistory,
  type ConnectionStatus,
  type ProtocolMessage,
  type DiagnosticTest
} from '../connectionDiagnostics';

// Mock browser environment
Object.defineProperty(window, 'navigator', {
  value: {
    onLine: true,
    userAgent: 'Mozilla/5.0 (Test Browser)',
    platform: 'Test Platform',
    language: 'en-US',
    cookieEnabled: true
  },
  writable: true
});

Object.defineProperty(window, 'screen', {
  value: {
    width: 1920,
    height: 1080,
    colorDepth: 24
  },
  writable: true
});

Object.defineProperty(window, 'performance', {
  value: {
    now: () => Date.now()
  },
  writable: true
});

// Mock fetch for health checks
global.fetch = vi.fn();

describe('ConnectionDiagnostics', () => {
  beforeEach(() => {
    // Reset connection diagnostics state
    connectionDiagnostics.clearMessageHistory();
    
    // Reset mock fetch
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up
    setDebugMode(false);
  });

  describe('Connection Status Management', () => {
    it('should initialize with disconnected status', () => {
      const status = get(connectionStatusStore);
      
      expect(status.websocket.status).toBe('disconnected');
      expect(status.camera.status).toBe('disconnected');
      expect(status.network.online).toBe(true);
    });

    it('should update WebSocket status', () => {
      updateWebSocketStatus('connecting');
      
      let status = get(connectionStatusStore);
      expect(status.websocket.status).toBe('connecting');
      
      updateWebSocketStatus('connected');
      
      status = get(connectionStatusStore);
      expect(status.websocket.status).toBe('connected');
      expect(status.websocket.lastConnected).toBeDefined();
    });

    it('should update camera status', () => {
      updateCameraStatus('connecting');
      
      let status = get(connectionStatusStore);
      expect(status.camera.status).toBe('connecting');
      
      updateCameraStatus('connected');
      
      status = get(connectionStatusStore);
      expect(status.camera.status).toBe('connected');
      expect(status.camera.lastConnected).toBeDefined();
    });

    it('should track reconnection attempts', () => {
      updateWebSocketStatus('reconnecting');
      updateWebSocketStatus('reconnecting');
      
      const status = get(connectionStatusStore);
      expect(status.websocket.reconnectAttempts).toBe(2);
    });

    it('should handle connection errors', () => {
      updateWebSocketStatus('error', 'Connection failed');
      
      const status = get(connectionStatusStore);
      expect(status.websocket.status).toBe('error');
      expect(status.websocket.error).toBe('Connection failed');
    });
  });

  describe('Derived Stores', () => {
    it('should indicate WebSocket connection status', () => {
      expect(get(isWebSocketConnected)).toBe(false);
      
      updateWebSocketStatus('connected');
      
      expect(get(isWebSocketConnected)).toBe(true);
    });

    it('should indicate camera connection status', () => {
      expect(get(isCameraConnected)).toBe(false);
      
      updateCameraStatus('connected');
      
      expect(get(isCameraConnected)).toBe(true);
    });

    it('should indicate full connection status', () => {
      expect(get(isFullyConnected)).toBe(false);
      
      updateWebSocketStatus('connected');
      expect(get(isFullyConnected)).toBe(false);
      
      updateCameraStatus('connected');
      expect(get(isFullyConnected)).toBe(true);
    });

    it('should determine connection quality', () => {
      expect(get(connectionQuality)).toBe('unknown');
      
      updateWebSocketStatus('connected');
      updateCameraStatus('connected');
      
      // Quality should be determined by latency
      expect(get(connectionQuality)).toBe('good'); // Default for connected without latency
    });

    it('should detect connection errors', () => {
      expect(get(hasConnectionErrors)).toBe(false);
      
      updateWebSocketStatus('error', 'Test error');
      
      expect(get(hasConnectionErrors)).toBe(true);
    });
  });

  describe('Protocol Message Logging', () => {
    it('should log protocol messages', () => {
      const testData = { command: 'test', value: 123 };
      
      logProtocolMessage('sent', 'websocket', 'test:command', testData);
      
      const messages = get(protocolMessagesStore);
      expect(messages).toHaveLength(1);
      
      const message = messages[0];
      expect(message.direction).toBe('sent');
      expect(message.type).toBe('websocket');
      expect(message.event).toBe('test:command');
      expect(message.data).toEqual(testData);
      expect(message.size).toBeGreaterThan(0);
    });

    it('should log messages with latency', () => {
      logProtocolMessage('received', 'cap', 'response', {}, 150);
      
      const messages = get(protocolMessagesStore);
      expect(messages[0].latency).toBe(150);
    });

    it('should log messages with errors', () => {
      logProtocolMessage('sent', 'websocket', 'failed:command', {}, undefined, 'Command failed');
      
      const messages = get(protocolMessagesStore);
      expect(messages[0].error).toBe('Command failed');
    });

    it('should limit message history', () => {
      // Log more messages than the limit
      for (let i = 0; i < 1100; i++) {
        logProtocolMessage('sent', 'websocket', `test:${i}`, { index: i });
      }
      
      const messages = get(protocolMessagesStore);
      expect(messages.length).toBeLessThanOrEqual(1000);
    });

    it('should sanitize sensitive data', () => {
      const sensitiveData = {
        username: 'test',
        password: 'secret123',
        token: 'abc123',
        normalData: 'visible'
      };
      
      logProtocolMessage('sent', 'websocket', 'auth', sensitiveData);
      
      const messages = get(protocolMessagesStore);
      const loggedData = messages[0].data;
      
      expect(loggedData.password).toBe('[REDACTED]');
      expect(loggedData.token).toBe('[REDACTED]');
      expect(loggedData.normalData).toBe('visible');
    });

    it('should clear message history', () => {
      logProtocolMessage('sent', 'websocket', 'test1', {});
      logProtocolMessage('sent', 'websocket', 'test2', {});
      
      expect(get(protocolMessagesStore)).toHaveLength(2);
      
      clearMessageHistory();
      
      expect(get(protocolMessagesStore)).toHaveLength(0);
    });
  });

  describe('Debug Mode', () => {
    it('should enable debug mode', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      setDebugMode(true);
      logProtocolMessage('sent', 'websocket', 'debug:test', { test: true });
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should include full data in debug mode', () => {
      setDebugMode(true);
      
      const sensitiveData = { password: 'secret', data: 'test' };
      logProtocolMessage('sent', 'websocket', 'debug:auth', sensitiveData);
      
      const messages = get(protocolMessagesStore);
      expect(messages[0].data.password).toBe('secret'); // Not redacted in debug mode
    });
  });

  describe('Diagnostic Tests', () => {
    it('should run network connectivity test', async () => {
      // Mock successful fetch
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200
      });
      
      const tests = await runDiagnostics();
      
      const networkTest = tests.find(t => t.id === 'network-connectivity');
      expect(networkTest?.status).toBe('passed');
      expect(networkTest?.result).toBe('Network connectivity confirmed');
    });

    it('should handle network connectivity failure', async () => {
      // Mock fetch failure
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const tests = await runDiagnostics();
      
      const networkTest = tests.find(t => t.id === 'network-connectivity');
      expect(networkTest?.status).toBe('failed');
      expect(networkTest?.result).toBe('Failed to reach server');
    });

    it('should test WebSocket connection', async () => {
      updateWebSocketStatus('connected');
      
      const tests = await runDiagnostics();
      
      const wsTest = tests.find(t => t.id === 'websocket-connection');
      expect(wsTest?.status).toBe('passed');
      expect(wsTest?.result).toBe('WebSocket connection active');
    });

    it('should test camera connection', async () => {
      updateCameraStatus('connected');
      
      const tests = await runDiagnostics();
      
      const cameraTest = tests.find(t => t.id === 'camera-connection');
      expect(cameraTest?.status).toBe('passed');
      expect(cameraTest?.result).toBe('Camera connection active');
    });

    it('should measure test duration', async () => {
      const tests = await runDiagnostics();
      
      tests.forEach(test => {
        expect(test.duration).toBeDefined();
        expect(test.duration).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Export', () => {
    it('should export diagnostic data', () => {
      // Set up some test data
      updateWebSocketStatus('connected');
      updateCameraStatus('connected');
      logProtocolMessage('sent', 'websocket', 'test', { data: 'test' });
      
      const exportedData = exportDiagnosticData();
      const parsedData = JSON.parse(exportedData);
      
      expect(parsedData.timestamp).toBeDefined();
      expect(parsedData.connectionStatus).toBeDefined();
      expect(parsedData.metrics).toBeDefined();
      expect(parsedData.protocolMessages).toBeDefined();
      expect(parsedData.systemInfo).toBeDefined();
    });

    it('should include system information in export', () => {
      const exportedData = exportDiagnosticData();
      const parsedData = JSON.parse(exportedData);
      
      expect(parsedData.systemInfo.userAgent).toBe('Mozilla/5.0 (Test Browser)');
      expect(parsedData.systemInfo.platform).toBe('Test Platform');
      expect(parsedData.systemInfo.screen).toBeDefined();
      expect(parsedData.systemInfo.viewport).toBeDefined();
    });

    it('should limit exported messages', () => {
      // Log many messages
      for (let i = 0; i < 200; i++) {
        logProtocolMessage('sent', 'websocket', `test:${i}`, { index: i });
      }
      
      const exportedData = exportDiagnosticData();
      const parsedData = JSON.parse(exportedData);
      
      // Should only export last 100 messages
      expect(parsedData.protocolMessages.length).toBe(100);
    });
  });

  describe('Connection Quality Assessment', () => {
    it('should assess excellent quality', async () => {
      updateWebSocketStatus('connected');
      updateCameraStatus('connected');
      
      // Mock low latency
      const mockMeasureLatency = vi.spyOn(connectionDiagnostics as any, 'measureLatency')
        .mockResolvedValue(30);
      
      await connectionDiagnostics.measureLatency('websocket');
      await connectionDiagnostics.measureLatency('camera');
      
      const quality = get(connectionQuality);
      expect(quality).toBe('excellent');
      
      mockMeasureLatency.mockRestore();
    });

    it('should assess poor quality', async () => {
      updateWebSocketStatus('connected');
      updateCameraStatus('connected');
      
      // Mock high latency
      const mockMeasureLatency = vi.spyOn(connectionDiagnostics as any, 'measureLatency')
        .mockResolvedValue(300);
      
      await connectionDiagnostics.measureLatency('websocket');
      await connectionDiagnostics.measureLatency('camera');
      
      const quality = get(connectionQuality);
      expect(quality).toBe('poor');
      
      mockMeasureLatency.mockRestore();
    });
  });

  describe('Metrics Collection', () => {
    it('should collect connection metrics', () => {
      // Log some messages
      logProtocolMessage('sent', 'websocket', 'test1', { size: 100 });
      logProtocolMessage('received', 'cap', 'test2', { size: 200 }, 50);
      logProtocolMessage('sent', 'websocket', 'test3', {}, undefined, 'Error');
      
      const metrics = connectionDiagnostics.getMetrics();
      
      expect(metrics.totalMessages).toBe(3);
      expect(metrics.dataTransferred).toBeGreaterThan(0);
      expect(metrics.averageLatency).toBeGreaterThan(0);
      expect(metrics.errorRate).toBeGreaterThan(0);
      expect(metrics.uptime).toBeGreaterThan(0);
    });

    it('should calculate messages per second', () => {
      const metrics = connectionDiagnostics.getMetrics();
      
      if (metrics.uptime > 0) {
        expect(metrics.messagesPerSecond).toBe(metrics.totalMessages / metrics.uptime);
      }
    });
  });

  describe('Network Monitoring', () => {
    it('should detect online status', () => {
      const status = get(connectionStatusStore);
      expect(status.network.online).toBe(true);
    });

    it('should handle offline events', () => {
      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true });
      window.dispatchEvent(new Event('offline'));
      
      const status = get(connectionStatusStore);
      expect(status.network.online).toBe(false);
    });

    it('should handle online events', () => {
      // Simulate coming back online
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true });
      window.dispatchEvent(new Event('online'));
      
      const status = get(connectionStatusStore);
      expect(status.network.online).toBe(true);
    });
  });
});