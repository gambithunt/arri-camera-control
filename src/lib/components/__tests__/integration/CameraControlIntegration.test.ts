/**
 * Camera Control Integration Tests
 * Tests for integrated camera control functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CameraControlPanel from '../../CameraControlPanel.svelte';
import { cameraApi } from '../../../api/cameraApi';
import { cameraStore } from '../../../stores/cameraStore';

// Mock WebSocket for testing
class MockWebSocket {
  public readyState = WebSocket.CONNECTING;
  public url: string;
  private listeners: Map<string, Function[]> = new Map();
  private static instances: MockWebSocket[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.emit('open', {});
    }, 10);
  }

  addEventListener(event: string, listener: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  removeEventListener(event: string, listener: Function) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  send(data: string) {
    const message = JSON.parse(data);
    this.simulateServerResponse(message);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    this.emit('close', {});
  }

  private emit(event: string, data: any) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.forEach(listener => listener(data));
    }
  }

  private simulateServerResponse(message: any) {
    setTimeout(() => {
      switch (message.event) {
        case 'camera:connect':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:connect:success',
              data: {
                model: 'ARRI ALEXA Mini LF',
                serialNumber: 'ALF001234',
                firmwareVersion: '7.2.1'
              }
            })
          });
          break;

        case 'camera:frameRate:set':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:frameRate:success',
              data: { frameRate: message.data.frameRate }
            })
          });
          break;

        case 'camera:whiteBalance:set':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:whiteBalance:success',
              data: { kelvin: message.data.kelvin }
            })
          });
          break;

        case 'camera:iso:set':
          this.emit('message', {
            data: JSON.stringify({
              event: 'camera:iso:success',
              data: { iso: message.data.iso }
            })
          });
          break;
      }
    }, 50);
  }

  static getInstances() {
    return MockWebSocket.instances;
  }

  static clearInstances() {
    MockWebSocket.instances = [];
  }
}

// Mock the global WebSocket
global.WebSocket = MockWebSocket as any;

describe('Camera Control Integration Tests', () => {
  beforeAll(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
  });

  beforeEach(() => {
    MockWebSocket.clearInstances();
    vi.clearAllMocks();
  });

  afterEach(() => {
    MockWebSocket.getInstances().forEach(ws => ws.close());
    MockWebSocket.clearInstances();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  describe('Camera Connection Integration', () => {
    it('should connect to camera and update UI state', async () => {
      const { component } = render(CameraControlPanel);
      
      // Find and click connect button
      const connectButton = screen.getByRole('button', { name: /connect/i });
      await fireEvent.click(connectButton);
      
      // Wait for connection to establish
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.connected).toBe(true);
      });
      
      // Verify UI shows connected state
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
      expect(screen.getByText(/ARRI ALEXA Mini LF/i)).toBeInTheDocument();
    });

    it('should handle connection failure gracefully', async () => {
      // Mock connection failure
      const originalConnect = cameraApi.connect;
      cameraApi.connect = vi.fn().mockResolvedValue({
        success: false,
        error: 'Connection failed'
      });
      
      const { component } = render(CameraControlPanel);
      
      const connectButton = screen.getByRole('button', { name: /connect/i });
      await fireEvent.click(connectButton);
      
      // Wait for error state
      await waitFor(() => {
        expect(screen.getByText(/connection failed/i)).toBeInTheDocument();
      });
      
      // Restore original method
      cameraApi.connect = originalConnect;
    });
  });

  describe('Camera Control Integration', () => {
    beforeEach(async () => {
      // Establish connection before each test
      await cameraApi.connect();
    });

    afterEach(async () => {
      await cameraApi.disconnect();
    });

    it('should control frame rate through UI', async () => {
      const { component } = render(CameraControlPanel);
      
      // Find frame rate control
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      
      // Change frame rate
      await fireEvent.input(frameRateSlider, { target: { value: '30' } });
      
      // Wait for API call and state update
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.frameRate).toBe(30);
      });
      
      // Verify UI reflects the change
      expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    });

    it('should control white balance through UI', async () => {
      const { component } = render(CameraControlPanel);
      
      // Find white balance control
      const whiteBalanceSlider = screen.getByLabelText(/white balance/i);
      
      // Change white balance
      await fireEvent.input(whiteBalanceSlider, { target: { value: '5600' } });
      
      // Wait for API call and state update
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.whiteBalance).toBe(5600);
      });
      
      // Verify UI reflects the change
      expect(screen.getByDisplayValue('5600')).toBeInTheDocument();
    });

    it('should control ISO through UI', async () => {
      const { component } = render(CameraControlPanel);
      
      // Find ISO control
      const isoSelect = screen.getByLabelText(/iso/i);
      
      // Change ISO
      await fireEvent.change(isoSelect, { target: { value: '800' } });
      
      // Wait for API call and state update
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.iso).toBe(800);
      });
      
      // Verify UI reflects the change
      expect(screen.getByDisplayValue('800')).toBeInTheDocument();
    });

    it('should handle multiple simultaneous control changes', async () => {
      const { component } = render(CameraControlPanel);
      
      // Find controls
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      const whiteBalanceSlider = screen.getByLabelText(/white balance/i);
      const isoSelect = screen.getByLabelText(/iso/i);
      
      // Change multiple settings simultaneously
      await Promise.all([
        fireEvent.input(frameRateSlider, { target: { value: '25' } }),
        fireEvent.input(whiteBalanceSlider, { target: { value: '3200' } }),
        fireEvent.change(isoSelect, { target: { value: '1600' } })
      ]);
      
      // Wait for all changes to be applied
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.frameRate).toBe(25);
        expect(state.whiteBalance).toBe(3200);
        expect(state.iso).toBe(1600);
      });
    });

    it('should show validation errors for invalid inputs', async () => {
      const { component } = render(CameraControlPanel);
      
      // Mock API to return validation error
      const originalSetFrameRate = cameraApi.setFrameRate;
      cameraApi.setFrameRate = vi.fn().mockResolvedValue({
        success: false,
        code: 'CAP_003',
        error: 'Invalid frame rate'
      });
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      
      // Try to set invalid frame rate
      await fireEvent.input(frameRateSlider, { target: { value: '150' } });
      
      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/invalid frame rate/i)).toBeInTheDocument();
      });
      
      // Restore original method
      cameraApi.setFrameRate = originalSetFrameRate;
    });
  });

  describe('Real-time Updates Integration', () => {
    beforeEach(async () => {
      await cameraApi.connect();
    });

    afterEach(async () => {
      await cameraApi.disconnect();
    });

    it('should update UI when receiving real-time camera status', async () => {
      const { component } = render(CameraControlPanel);
      
      // Simulate real-time status update from camera
      const instances = MockWebSocket.getInstances();
      if (instances.length > 0) {
        instances[0]['emit']('message', {
          data: JSON.stringify({
            event: 'camera:status:update',
            data: {
              recording: true,
              batteryLevel: 75,
              temperature: 45
            }
          })
        });
      }
      
      // Wait for UI to update
      await waitFor(() => {
        expect(screen.getByText(/recording/i)).toBeInTheDocument();
        expect(screen.getByText(/75%/)).toBeInTheDocument();
        expect(screen.getByText(/45°C/)).toBeInTheDocument();
      });
    });

    it('should handle connection loss and recovery', async () => {
      const { component } = render(CameraControlPanel);
      
      // Simulate connection loss
      const instances = MockWebSocket.getInstances();
      if (instances.length > 0) {
        instances[0].close();
      }
      
      // Wait for disconnected state
      await waitFor(() => {
        expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
      });
      
      // Simulate reconnection
      const reconnectButton = screen.getByRole('button', { name: /reconnect/i });
      await fireEvent.click(reconnectButton);
      
      // Wait for connected state
      await waitFor(() => {
        expect(screen.getByText(/connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(async () => {
      await cameraApi.connect();
    });

    afterEach(async () => {
      await cameraApi.disconnect();
    });

    it('should display error notifications for failed commands', async () => {
      const { component } = render(CameraControlPanel);
      
      // Mock API to return error
      const originalSetFrameRate = cameraApi.setFrameRate;
      cameraApi.setFrameRate = vi.fn().mockResolvedValue({
        success: false,
        code: 'CAP_001',
        error: 'Camera not responding'
      });
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      await fireEvent.input(frameRateSlider, { target: { value: '24' } });
      
      // Wait for error notification
      await waitFor(() => {
        expect(screen.getByText(/camera not responding/i)).toBeInTheDocument();
      });
      
      // Error should be dismissible
      const dismissButton = screen.getByRole('button', { name: /dismiss/i });
      await fireEvent.click(dismissButton);
      
      await waitFor(() => {
        expect(screen.queryByText(/camera not responding/i)).not.toBeInTheDocument();
      });
      
      // Restore original method
      cameraApi.setFrameRate = originalSetFrameRate;
    });

    it('should retry failed commands automatically', async () => {
      const { component } = render(CameraControlPanel);
      
      // Mock API to fail first time, succeed second time
      let callCount = 0;
      const originalSetFrameRate = cameraApi.setFrameRate;
      cameraApi.setFrameRate = vi.fn().mockImplementation(async (frameRate) => {
        callCount++;
        if (callCount === 1) {
          return {
            success: false,
            code: 'CAP_004',
            error: 'Temporary failure'
          };
        }
        return originalSetFrameRate(frameRate);
      });
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      await fireEvent.input(frameRateSlider, { target: { value: '24' } });
      
      // Wait for retry and success
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.frameRate).toBe(24);
      });
      
      expect(callCount).toBe(2); // Should have retried once
      
      // Restore original method
      cameraApi.setFrameRate = originalSetFrameRate;
    });
  });

  describe('Performance Integration', () => {
    beforeEach(async () => {
      await cameraApi.connect();
    });

    afterEach(async () => {
      await cameraApi.disconnect();
    });

    it('should handle rapid UI interactions without blocking', async () => {
      const { component } = render(CameraControlPanel);
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      
      // Simulate rapid slider movements
      const values = [24, 25, 30, 29, 24];
      const startTime = Date.now();
      
      for (const value of values) {
        await fireEvent.input(frameRateSlider, { target: { value: value.toString() } });
        // Small delay to simulate user interaction
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const endTime = Date.now();
      
      // Should complete quickly (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);
      
      // Final state should reflect last value
      await waitFor(() => {
        const state = get(cameraStore);
        expect(state.frameRate).toBe(24);
      });
    });

    it('should debounce rapid control changes', async () => {
      const { component } = render(CameraControlPanel);
      
      // Spy on API calls
      const setFrameRateSpy = vi.spyOn(cameraApi, 'setFrameRate');
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      
      // Rapid changes
      await fireEvent.input(frameRateSlider, { target: { value: '24' } });
      await fireEvent.input(frameRateSlider, { target: { value: '25' } });
      await fireEvent.input(frameRateSlider, { target: { value: '30' } });
      
      // Wait for debounce period
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should only make one API call (debounced)
      expect(setFrameRateSpy).toHaveBeenCalledTimes(1);
      expect(setFrameRateSpy).toHaveBeenCalledWith(30);
      
      setFrameRateSpy.mockRestore();
    });
  });

  describe('Accessibility Integration', () => {
    beforeEach(async () => {
      await cameraApi.connect();
    });

    afterEach(async () => {
      await cameraApi.disconnect();
    });

    it('should support keyboard navigation', async () => {
      const { component } = render(CameraControlPanel);
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      
      // Focus the slider
      frameRateSlider.focus();
      expect(document.activeElement).toBe(frameRateSlider);
      
      // Use arrow keys to change value
      await fireEvent.keyDown(frameRateSlider, { key: 'ArrowRight' });
      
      // Should update the value
      await waitFor(() => {
        expect(frameRateSlider.value).not.toBe('24');
      });
    });

    it('should announce state changes to screen readers', async () => {
      const { component } = render(CameraControlPanel);
      
      // Look for ARIA live regions
      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toBeInTheDocument();
      
      // Change a setting
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      await fireEvent.input(frameRateSlider, { target: { value: '30' } });
      
      // Wait for status update
      await waitFor(() => {
        expect(statusRegion).toHaveTextContent(/frame rate.*30/i);
      });
    });

    it('should provide proper error announcements', async () => {
      const { component } = render(CameraControlPanel);
      
      // Mock API error
      const originalSetFrameRate = cameraApi.setFrameRate;
      cameraApi.setFrameRate = vi.fn().mockResolvedValue({
        success: false,
        error: 'Invalid frame rate'
      });
      
      const frameRateSlider = screen.getByLabelText(/frame rate/i);
      await fireEvent.input(frameRateSlider, { target: { value: '150' } });
      
      // Wait for error announcement
      await waitFor(() => {
        const errorRegion = screen.getByRole('alert');
        expect(errorRegion).toHaveTextContent(/invalid frame rate/i);
      });
      
      // Restore original method
      cameraApi.setFrameRate = originalSetFrameRate;
    });
  });
});