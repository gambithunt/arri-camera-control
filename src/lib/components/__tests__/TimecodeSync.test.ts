/**
 * TimecodeSync Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import TimecodeSync from '../TimecodeSync.svelte';
import { cameraStore, notificationStore } from '../../stores';
import { cameraApi } from '../../api/cameraApi';

// Mock the API
vi.mock('../../api/cameraApi', () => ({
  cameraApi: {
    getSyncStatus: vi.fn(),
    getSyncDiagnostics: vi.fn(),
    manualSync: vi.fn()
  }
}));

// Mock the stores
vi.mock('../../stores', () => ({
  cameraStore: {
    subscribe: vi.fn(),
    setOperationLoading: vi.fn()
  },
  notificationStore: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

describe('TimecodeSync', () => {
  const mockCameraState = {
    timecode: {
      syncStatus: 'synced'
    },
    operations: { timecode: false }
  };

  const mockSyncStatus = {
    syncStatus: 'synced',
    syncOffset: 5.2,
    lastSyncTime: Date.now() - 30000,
    consecutiveErrors: 0,
    driftAnalysis: {
      trend: 'stable',
      avgDrift: 2.1,
      maxDrift: 8.5,
      sampleCount: 10
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup store subscription mock
    (cameraStore.subscribe as any).mockImplementation((callback: any) => {
      callback(mockCameraState);
      return () => {}; // unsubscribe function
    });

    // Setup API mocks
    (cameraApi.getSyncStatus as any).mockResolvedValue({
      success: true,
      data: mockSyncStatus
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders sync status display', () => {
    render(TimecodeSync);
    
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(screen.getByText('Timecode is synchronized')).toBeInTheDocument();
  });

  it('displays correct status for different sync states', () => {
    const driftingState = {
      ...mockCameraState,
      timecode: { syncStatus: 'drifting' }
    };
    
    (cameraStore.subscribe as any).mockImplementation((callback: any) => {
      callback(driftingState);
      return () => {};
    });
    
    render(TimecodeSync);
    
    expect(screen.getByText('Drifting')).toBeInTheDocument();
    expect(screen.getByText('Timecode sync is drifting')).toBeInTheDocument();
  });

  it('loads sync status on mount', async () => {
    render(TimecodeSync);
    
    await waitFor(() => {
      expect(cameraApi.getSyncStatus).toHaveBeenCalled();
    });
  });

  it('displays sync status details when available', async () => {
    render(TimecodeSync);
    
    await waitFor(() => {
      expect(screen.getByText('Sync Offset:')).toBeInTheDocument();
      expect(screen.getByText('5ms')).toBeInTheDocument();
      expect(screen.getByText('Last Sync:')).toBeInTheDocument();
    });
  });

  it('handles manual sync action', async () => {
    (cameraApi.manualSync as any).mockResolvedValue({ success: true });
    
    render(TimecodeSync);
    
    const manualSyncButton = screen.getByText('Manual Sync');
    await fireEvent.click(manualSyncButton);
    
    expect(cameraApi.manualSync).toHaveBeenCalled();
    expect(cameraStore.setOperationLoading).toHaveBeenCalledWith('timecode', true);
  });

  it('toggles auto-refresh functionality', async () => {
    render(TimecodeSync);
    
    const autoRefreshButton = screen.getByTitle('Toggle auto-refresh');
    await fireEvent.click(autoRefreshButton);
    
    // Should toggle the active state
    expect(autoRefreshButton).not.toHaveClass('active');
  });

  it('refreshes sync status when refresh button is clicked', async () => {
    render(TimecodeSync);
    
    // Clear the initial call
    vi.clearAllMocks();
    
    const refreshButton = screen.getByTitle('Refresh sync status');
    await fireEvent.click(refreshButton);
    
    expect(cameraApi.getSyncStatus).toHaveBeenCalled();
  });

  it('displays drift analysis when available', async () => {
    render(TimecodeSync);
    
    await waitFor(() => {
      expect(screen.getByText('Drift Analysis')).toBeInTheDocument();
      expect(screen.getByText('Trend:')).toBeInTheDocument();
      expect(screen.getByText('stable')).toBeInTheDocument();
      expect(screen.getByText('Avg Drift:')).toBeInTheDocument();
      expect(screen.getByText('2ms')).toBeInTheDocument();
    });
  });

  it('loads and displays diagnostics when requested', async () => {
    const mockDiagnostics = {
      timecodeState: {
        current: '01:23:45:12',
        mode: 'free_run',
        syncStatus: 'synced',
        frameRate: 24
      },
      systemInfo: {
        updateInterval: 250,
        monitorInterval: 5000,
        isRunning: true
      },
      driftHistory: [
        {
          timestamp: Date.now(),
          drift: 2.5,
          networkLatency: 15
        }
      ]
    };

    (cameraApi.getSyncDiagnostics as any).mockResolvedValue({
      success: true,
      data: mockDiagnostics
    });
    
    render(TimecodeSync, { props: { showDiagnostics: true } });
    
    const diagnosticsButton = screen.getByText('Diagnostics');
    await fireEvent.click(diagnosticsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Timecode Sync Diagnostics')).toBeInTheDocument();
      expect(screen.getByText('System Status')).toBeInTheDocument();
      expect(screen.getByText('250ms')).toBeInTheDocument();
      expect(screen.getByText('5000ms')).toBeInTheDocument();
    });
  });

  it('handles API errors gracefully', async () => {
    (cameraApi.manualSync as any).mockResolvedValue({
      success: false,
      error: 'Camera not connected'
    });
    
    render(TimecodeSync);
    
    const manualSyncButton = screen.getByText('Manual Sync');
    await fireEvent.click(manualSyncButton);
    
    await waitFor(() => {
      expect(notificationStore.error).toHaveBeenCalledWith(
        'Manual Sync Failed',
        'Camera not connected'
      );
    });
  });

  it('displays error count when consecutive errors exist', async () => {
    const errorState = {
      ...mockSyncStatus,
      consecutiveErrors: 2
    };

    (cameraApi.getSyncStatus as any).mockResolvedValue({
      success: true,
      data: errorState
    });
    
    render(TimecodeSync);
    
    await waitFor(() => {
      expect(screen.getByText('Errors:')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('renders in compact mode', () => {
    render(TimecodeSync, { props: { compact: true } });
    
    expect(screen.getByText('Synced')).toBeInTheDocument();
    // Description should not be visible in compact mode
    expect(screen.queryByText('Timecode is synchronized')).not.toBeInTheDocument();
  });

  it('formats drift values correctly', async () => {
    const highDriftStatus = {
      ...mockSyncStatus,
      syncOffset: 1500.5, // 1.5 seconds
      driftAnalysis: {
        ...mockSyncStatus.driftAnalysis,
        avgDrift: 0.8, // Less than 1ms
        maxDrift: 2500 // 2.5 seconds
      }
    };

    (cameraApi.getSyncStatus as any).mockResolvedValue({
      success: true,
      data: highDriftStatus
    });
    
    render(TimecodeSync);
    
    await waitFor(() => {
      expect(screen.getByText('1.5s')).toBeInTheDocument(); // Sync offset
      expect(screen.getByText('< 1ms')).toBeInTheDocument(); // Avg drift
      expect(screen.getByText('2.5s')).toBeInTheDocument(); // Max drift
    });
  });

  it('closes diagnostics modal when close button is clicked', async () => {
    const mockDiagnostics = {
      timecodeState: { current: '01:23:45:12' },
      systemInfo: { isRunning: true }
    };

    (cameraApi.getSyncDiagnostics as any).mockResolvedValue({
      success: true,
      data: mockDiagnostics
    });
    
    render(TimecodeSync, { props: { showDiagnostics: true } });
    
    // Open diagnostics
    const diagnosticsButton = screen.getByText('Diagnostics');
    await fireEvent.click(diagnosticsButton);
    
    await waitFor(() => {
      expect(screen.getByText('Timecode Sync Diagnostics')).toBeInTheDocument();
    });
    
    // Close diagnostics
    const closeButton = screen.getByText('✕');
    await fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Timecode Sync Diagnostics')).not.toBeInTheDocument();
    });
  });
});