/**
 * ColorGradingPanel Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ColorGradingPanel from '../ColorGradingPanel.svelte';
import { cameraStore, notificationStore } from '../../stores';
import { cameraApi } from '../../api/cameraApi';

// Mock the API
vi.mock('../../api/cameraApi', () => ({
  cameraApi: {
    setCDL: vi.fn(),
    resetCDL: vi.fn(),
    getCDL: vi.fn()
  }
}));

// Mock the stores
vi.mock('../../stores', () => ({
  cameraStore: {
    subscribe: vi.fn(),
    updateSettings: vi.fn(),
    setOperationLoading: vi.fn()
  },
  notificationStore: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

// Mock ColorWheel component
vi.mock('../ColorWheel.svelte', () => ({
  default: vi.fn(() => ({
    $$: { on_mount: [], on_destroy: [], before_update: [], after_update: [] }
  }))
}));

describe('ColorGradingPanel', () => {
  const mockCameraState = {
    operations: { grading: false },
    cdlValues: {
      shadows: {
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 1, g: 1, b: 1 },
        gain: { r: 1, g: 1, b: 1 }
      },
      midtones: {
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 1, g: 1, b: 1 },
        gain: { r: 1, g: 1, b: 1 }
      },
      highlights: {
        lift: { r: 0, g: 0, b: 0 },
        gamma: { r: 1, g: 1, b: 1 },
        gain: { r: 1, g: 1, b: 1 }
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup store subscription mock
    (cameraStore.subscribe as any).mockImplementation((callback: any) => {
      callback(mockCameraState);
      return () => {}; // unsubscribe function
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders color grading panel with header', () => {
    render(ColorGradingPanel);
    
    expect(screen.getByText('Color Grading')).toBeInTheDocument();
    expect(screen.getByText('Professional CDL color correction')).toBeInTheDocument();
    expect(screen.getByText('Reset All')).toBeInTheDocument();
  });

  it('renders wheel type selector tabs', () => {
    render(ColorGradingPanel);
    
    expect(screen.getByText('Color Range')).toBeInTheDocument();
    expect(screen.getByText('Shadows')).toBeInTheDocument();
    expect(screen.getByText('Midtones')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
  });

  it('renders control type selector tabs', () => {
    render(ColorGradingPanel);
    
    expect(screen.getByText('Control Type')).toBeInTheDocument();
    expect(screen.getByText('Lift')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('Gain')).toBeInTheDocument();
  });

  it('handles wheel type selection', async () => {
    render(ColorGradingPanel);
    
    const highlightsTab = screen.getByText('Highlights');
    await fireEvent.click(highlightsTab);
    
    expect(highlightsTab.closest('button')).toHaveClass('active');
  });

  it('handles control type selection', async () => {
    render(ColorGradingPanel);
    
    const gammaTab = screen.getByText('Gamma');
    await fireEvent.click(gammaTab);
    
    expect(gammaTab.closest('button')).toHaveClass('active');
  });

  it('handles reset all button click', async () => {
    (cameraApi.setCDL as any).mockResolvedValue({ success: true });
    
    render(ColorGradingPanel);
    
    const resetAllButton = screen.getByText('Reset All');
    await fireEvent.click(resetAllButton);
    
    expect(cameraStore.setOperationLoading).toHaveBeenCalledWith('grading', true);
    
    await waitFor(() => {
      expect(cameraApi.setCDL).toHaveBeenCalledWith(
        expect.objectContaining({
          shadows: expect.objectContaining({
            lift: { r: 0, g: 0, b: 0 },
            gamma: { r: 1, g: 1, b: 1 },
            gain: { r: 1, g: 1, b: 1 }
          })
        })
      );
    });
    
    expect(notificationStore.success).toHaveBeenCalledWith(
      'Reset',
      'All color wheels reset to default'
    );
  });

  it('handles CDL update API errors', async () => {
    (cameraApi.setCDL as any).mockResolvedValue({
      success: false,
      error: 'Camera not connected'
    });
    
    render(ColorGradingPanel);
    
    const resetAllButton = screen.getByText('Reset All');
    await fireEvent.click(resetAllButton);
    
    await waitFor(() => {
      expect(notificationStore.error).toHaveBeenCalledWith(
        'CDL Update Failed',
        'Camera not connected'
      );
    });
  });

  it('shows loading state during operations', () => {
    const loadingState = { ...mockCameraState, operations: { grading: true } };
    (cameraStore.subscribe as any).mockImplementation((callback: any) => {
      callback(loadingState);
      return () => {};
    });
    
    render(ColorGradingPanel);
    
    const resetAllButton = screen.getByText('Reset All');
    expect(resetAllButton).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('renders in compact mode', () => {
    render(ColorGradingPanel, { props: { compact: true } });
    
    // Should not show quick access wheels in compact mode
    expect(screen.queryByText('Quick Access')).not.toBeInTheDocument();
    
    // Should not show keyboard shortcuts in compact mode
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('renders quick access wheels in full mode', () => {
    render(ColorGradingPanel, { props: { compact: false } });
    
    expect(screen.getByText('Quick Access')).toBeInTheDocument();
  });

  it('renders keyboard shortcuts help in full mode', () => {
    render(ColorGradingPanel, { props: { compact: false } });
    
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('disables all interactions when disabled prop is true', () => {
    render(ColorGradingPanel, { props: { disabled: true } });
    
    const resetAllButton = screen.getByText('Reset All');
    const shadowsTab = screen.getByText('Shadows');
    const liftTab = screen.getByText('Lift');
    
    expect(resetAllButton).toBeDisabled();
    expect(shadowsTab.closest('button')).toBeDisabled();
    expect(liftTab.closest('button')).toBeDisabled();
  });

  it('handles color wheel change events', async () => {
    (cameraApi.setCDL as any).mockResolvedValue({ success: true });
    
    const { component } = render(ColorGradingPanel);
    
    // Simulate color wheel change event
    const changeEvent = new CustomEvent('change', {
      detail: {
        wheelType: 'shadows',
        controlType: 'lift',
        values: { r: 0.1, g: -0.2, b: 0.3 }
      }
    });
    
    component.$set({});
    await fireEvent(component, changeEvent);
    
    // Should debounce and then call API
    await waitFor(() => {
      expect(cameraApi.setCDL).toHaveBeenCalled();
    }, { timeout: 200 });
  });

  it('handles fullscreen toggle events', async () => {
    const { component } = render(ColorGradingPanel);
    
    // Simulate fullscreen toggle event
    const fullscreenEvent = new CustomEvent('fullscreenToggle', {
      detail: {
        wheelType: 'midtones',
        controlType: 'gamma'
      }
    });
    
    await fireEvent(component, fullscreenEvent);
    
    // Should show fullscreen overlay
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('handles wheel reset events', async () => {
    (cameraApi.setCDL as any).mockResolvedValue({ success: true });
    
    const { component } = render(ColorGradingPanel);
    
    // Simulate wheel reset event
    const resetEvent = new CustomEvent('reset', {
      detail: {
        wheelType: 'highlights',
        controlType: 'gain'
      }
    });
    
    await fireEvent(component, resetEvent);
    
    await waitFor(() => {
      expect(notificationStore.success).toHaveBeenCalledWith(
        'Reset',
        'highlights gain reset to default'
      );
    });
  });

  it('debounces CDL updates to prevent overwhelming camera', async () => {
    (cameraApi.setCDL as any).mockResolvedValue({ success: true });
    
    const { component } = render(ColorGradingPanel);
    
    // Simulate rapid changes
    for (let i = 0; i < 5; i++) {
      const changeEvent = new CustomEvent('change', {
        detail: {
          wheelType: 'shadows',
          controlType: 'lift',
          values: { r: i * 0.1, g: 0, b: 0 }
        }
      });
      
      await fireEvent(component, changeEvent);
    }
    
    // Should only call API once after debounce period
    await waitFor(() => {
      expect(cameraApi.setCDL).toHaveBeenCalledTimes(1);
    }, { timeout: 200 });
  });

  it('handles keyboard shortcuts for wheel selection', async () => {
    render(ColorGradingPanel);
    
    // Simulate keyboard shortcut for selecting midtones (key '2')
    await fireEvent.keyDown(document, { key: '2' });
    
    const midtonesTab = screen.getByText('Midtones');
    expect(midtonesTab.closest('button')).toHaveClass('active');
  });

  it('handles keyboard shortcuts for control selection', async () => {
    render(ColorGradingPanel);
    
    // Simulate keyboard shortcut for selecting gamma (key 'g')
    await fireEvent.keyDown(document, { key: 'g' });
    
    const gammaTab = screen.getByText('Gamma');
    expect(gammaTab.closest('button')).toHaveClass('active');
  });

  it('handles keyboard shortcut for reset all', async () => {
    (cameraApi.setCDL as any).mockResolvedValue({ success: true });
    
    render(ColorGradingPanel);
    
    // Simulate Ctrl+R for reset all
    await fireEvent.keyDown(document, { key: 'r', ctrlKey: true });
    
    await waitFor(() => {
      expect(cameraApi.setCDL).toHaveBeenCalled();
    });
  });

  it('handles keyboard shortcut for fullscreen toggle', async () => {
    render(ColorGradingPanel);
    
    // Simulate Ctrl+F for fullscreen
    await fireEvent.keyDown(document, { key: 'f', ctrlKey: true });
    
    // Should show fullscreen overlay
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('handles escape key to close fullscreen', async () => {
    const { component } = render(ColorGradingPanel);
    
    // First open fullscreen
    const fullscreenEvent = new CustomEvent('fullscreenToggle', {
      detail: {
        wheelType: 'shadows',
        controlType: 'lift'
      }
    });
    
    await fireEvent(component, fullscreenEvent);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // Then close with escape
    await fireEvent.keyDown(document, { key: 'Escape' });
    
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores keyboard shortcuts when focused on input elements', async () => {
    render(ColorGradingPanel);
    
    // Create a mock input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    
    // Simulate keyboard shortcut
    await fireEvent.keyDown(input, { key: '2' });
    
    // Should not change wheel selection
    const shadowsTab = screen.getByText('Shadows');
    expect(shadowsTab.closest('button')).toHaveClass('active');
    
    document.body.removeChild(input);
  });

  it('dispatches cdlChange events', async () => {
    const handleCdlChange = vi.fn();
    
    const { component } = render(ColorGradingPanel);
    component.$on('cdlChange', handleCdlChange);
    
    // Simulate color wheel change
    const changeEvent = new CustomEvent('change', {
      detail: {
        wheelType: 'shadows',
        controlType: 'lift',
        values: { r: 0.1, g: 0.2, b: 0.3 }
      }
    });
    
    await fireEvent(component, changeEvent);
    
    expect(handleCdlChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: {
          cdlValues: expect.objectContaining({
            shadows: expect.objectContaining({
              lift: { r: 0.1, g: 0.2, b: 0.3 }
            })
          })
        }
      })
    );
  });
});