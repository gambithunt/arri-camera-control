/**
 * ConnectionIndicator Component Tests
 * Tests for the compact connection status indicator
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import ConnectionIndicator from '../ConnectionIndicator.svelte';

// Mock dependencies
vi.mock('$lib/utils/connectionDiagnostics', () => {
  const mockConnectionStatus = writable({
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
      online: true
    },
    lastUpdate: Date.now()
  });

  return {
    connectionStatusStore: mockConnectionStatus,
    isWebSocketConnected: writable(false),
    isCameraConnected: writable(false),
    isFullyConnected: writable(false),
    connectionQuality: writable('unknown'),
    hasConnectionErrors: writable(false)
  };
});

vi.mock('$lib/utils/touchInteractions', () => ({
  triggerHaptic: vi.fn()
}));

vi.mock('$lib/utils/responsiveLayout', () => ({
  screenInfo: writable({
    deviceType: 'desktop',
    screenSize: 'lg',
    orientation: 'landscape'
  })
}));

describe('ConnectionIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default props', () => {
      render(ConnectionIndicator);
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('should render without label when showLabel is false', () => {
      render(ConnectionIndicator, { showLabel: false });
      
      expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
      // Should still show status icon
      expect(screen.getByText('🔴')).toBeInTheDocument();
    });

    it('should render without quality indicator when showQuality is false', () => {
      render(ConnectionIndicator, { showQuality: false });
      
      // Quality indicator should not be visible
      const indicator = screen.getByRole('status');
      expect(indicator).not.toHaveTextContent('📶');
    });

    it('should not be clickable when clickable is false', () => {
      render(ConnectionIndicator, { clickable: false });
      
      const indicator = screen.getByRole('status');
      expect(indicator).not.toHaveAttribute('tabindex');
      expect(indicator).not.toHaveClass('clickable');
    });
  });

  describe('Connection Status Display', () => {
    it('should show connected status', async () => {
      const { component } = render(ConnectionIndicator);
      
      // Mock connected state
      const { isWebSocketConnected, isCameraConnected, isFullyConnected } = await import('$lib/utils/connectionDiagnostics');
      isWebSocketConnected.set(true);
      isCameraConnected.set(true);
      isFullyConnected.set(true);
      
      expect(screen.getByText('🟢')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('should show partial connection status', async () => {
      const { isWebSocketConnected, isCameraConnected } = await import('$lib/utils/connectionDiagnostics');
      isWebSocketConnected.set(true);
      isCameraConnected.set(false);
      
      render(ConnectionIndicator);
      
      expect(screen.getByText('🟡')).toBeInTheDocument();
      expect(screen.getByText('Server Only')).toBeInTheDocument();
    });

    it('should show error status', async () => {
      const { hasConnectionErrors } = await import('$lib/utils/connectionDiagnostics');
      hasConnectionErrors.set(true);
      
      render(ConnectionIndicator);
      
      expect(screen.getByText('❌')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('should show reconnecting indicator', async () => {
      const { connectionStatusStore } = await import('$lib/utils/connectionDiagnostics');
      connectionStatusStore.set({
        websocket: {
          status: 'reconnecting',
          reconnectAttempts: 1,
          maxReconnectAttempts: 5,
          quality: 'unknown'
        },
        camera: {
          status: 'disconnected',
          reconnectAttempts: 0,
          maxReconnectAttempts: 3,
          quality: 'unknown'
        },
        network: { online: true },
        lastUpdate: Date.now()
      });
      
      render(ConnectionIndicator);
      
      expect(screen.getByText('🔄')).toBeInTheDocument();
    });
  });

  describe('Quality Indicator', () => {
    it('should show quality indicator when connected', async () => {
      const { isFullyConnected, connectionQuality } = await import('$lib/utils/connectionDiagnostics');
      isFullyConnected.set(true);
      connectionQuality.set('excellent');
      
      render(ConnectionIndicator, { showQuality: true });
      
      expect(screen.getByText('📶')).toBeInTheDocument();
    });

    it('should use appropriate quality colors', async () => {
      const { isFullyConnected, connectionQuality } = await import('$lib/utils/connectionDiagnostics');
      isFullyConnected.set(true);
      connectionQuality.set('poor');
      
      render(ConnectionIndicator, { showQuality: true });
      
      const qualityIcon = screen.getByTitle('Connection quality: poor');
      expect(qualityIcon).toHaveClass('text-red-400');
    });
  });

  describe('Size Variants', () => {
    it('should render small size', () => {
      render(ConnectionIndicator, { size: 'sm' });
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveClass('text-xs');
    });

    it('should render large size with latency details', async () => {
      const { connectionStatusStore } = await import('$lib/utils/connectionDiagnostics');
      connectionStatusStore.set({
        websocket: {
          status: 'connected',
          latency: 50,
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          quality: 'good'
        },
        camera: {
          status: 'connected',
          latency: 100,
          reconnectAttempts: 0,
          maxReconnectAttempts: 3,
          quality: 'good'
        },
        network: { online: true },
        lastUpdate: Date.now()
      });
      
      render(ConnectionIndicator, { size: 'lg' });
      
      expect(screen.getByText('WS: 50ms')).toBeInTheDocument();
      expect(screen.getByText('Cam: 100ms')).toBeInTheDocument();
    });
  });

  describe('Interaction', () => {
    it('should handle click events when clickable', async () => {
      const { triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      const { component } = render(ConnectionIndicator, { clickable: true });
      
      let clickEvent: any = null;
      component.$on('click', (event) => {
        clickEvent = event;
      });
      
      const indicator = screen.getByRole('button');
      fireEvent.click(indicator);
      
      expect(triggerHaptic).toHaveBeenCalledWith({ type: 'light' });
      expect(clickEvent).toBeTruthy();
      expect(clickEvent.detail.status).toBeDefined();
    });

    it('should handle keyboard events', async () => {
      const { component } = render(ConnectionIndicator, { clickable: true });
      
      let clickEvent: any = null;
      component.$on('click', (event) => {
        clickEvent = event;
      });
      
      const indicator = screen.getByRole('button');
      fireEvent.keyDown(indicator, { key: 'Enter' });
      
      expect(clickEvent).toBeTruthy();
    });

    it('should not handle events when not clickable', () => {
      const { component } = render(ConnectionIndicator, { clickable: false });
      
      let clickEvent: any = null;
      component.$on('click', (event) => {
        clickEvent = event;
      });
      
      const indicator = screen.getByRole('status');
      fireEvent.click(indicator);
      
      expect(clickEvent).toBeNull();
    });
  });

  describe('Tooltip', () => {
    it('should show connection details in tooltip', async () => {
      const { connectionStatusStore } = await import('$lib/utils/connectionDiagnostics');
      connectionStatusStore.set({
        websocket: {
          status: 'connected',
          latency: 50,
          reconnectAttempts: 0,
          maxReconnectAttempts: 5,
          quality: 'good'
        },
        camera: {
          status: 'connected',
          latency: 100,
          reconnectAttempts: 0,
          maxReconnectAttempts: 3,
          quality: 'good'
        },
        network: { online: true },
        lastUpdate: Date.now()
      });
      
      render(ConnectionIndicator);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('title');
      
      const title = indicator.getAttribute('title');
      expect(title).toContain('WebSocket: connected');
      expect(title).toContain('Camera: connected');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(ConnectionIndicator);
      
      const indicator = screen.getByRole('status');
      expect(indicator).toHaveAttribute('aria-label');
    });

    it('should be focusable when clickable', () => {
      render(ConnectionIndicator, { clickable: true });
      
      const indicator = screen.getByRole('button');
      expect(indicator).toHaveAttribute('tabindex', '0');
    });
  });
});