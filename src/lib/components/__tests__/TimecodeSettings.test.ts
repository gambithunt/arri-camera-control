/**
 * TimecodeSettings Component Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import TimecodeSettings from '../TimecodeSettings.svelte';
import { cameraStore, notificationStore } from '../../stores';
import { cameraApi } from '../../api/cameraApi';

// Mock the API
vi.mock('../../api/cameraApi', () => ({
  cameraApi: {
    setTimecodeMode: vi.fn(),
    syncTimecodeToTimeOfDay: vi.fn(),
    setTimecode: vi.fn(),
    setUserBits: vi.fn(),
    setFrameRate: vi.fn()
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
    error: vi.fn(),
    warning: vi.fn()
  }
}));

describe('TimecodeSettings', () => {
  const mockCameraState = {
    currentTimecode: '01:23:45:12',
    timecodeMode: 'free_run',
    frameRate: 24,
    userBits: '00:00:00:00',
    operations: { timecode: false }
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

  it('renders timecode settings interface', () => {
    render(TimecodeSettings);
    
    expect(screen.getByText('Timecode Mode')).toBeInTheDocument();
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Timecode Presets')).toBeInTheDocument();
  });

  it('displays current timecode mode as active', () => {
    render(TimecodeSettings);
    
    const freeRunButton = screen.getByLabelText('Set timecode mode to Free Run');
    expect(freeRunButton).toHaveClass('active');
  });

  it('handles timecode mode change', async () => {
    (cameraApi.setTimecodeMode as any).mockResolvedValue({ success: true });
    
    render(TimecodeSettings);
    
    const recordRunButton = screen.getByLabelText('Set timecode mode to Record Run');
    await fireEvent.click(recordRunButton);
    
    expect(cameraApi.setTimecodeMode).toHaveBeenCalledWith('record_run');
    expect(cameraStore.setOperationLoading).toHaveBeenCalledWith('timecode', true);
  });

  it('handles sync to time of day', async () => {
    (cameraApi.syncTimecodeToTimeOfDay as any).mockResolvedValue({ success: true });
    
    render(TimecodeSettings);
    
    const syncButton = screen.getByText('Sync to Time of Day');
    await fireEvent.click(syncButton);
    
    expect(cameraApi.syncTimecodeToTimeOfDay).toHaveBeenCalled();
    expect(cameraStore.setOperationLoading).toHaveBeenCalledWith('timecode', true);
  });

  it('opens manual timecode entry modal', async () => {
    render(TimecodeSettings);
    
    const manualEntryButton = screen.getByText('Manual Entry');
    await fireEvent.click(manualEntryButton);
    
    expect(screen.getByText('Set Manual Timecode')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('HH:MM:SS:FF')).toBeInTheDocument();
  });

  it('validates timecode format in manual entry', async () => {
    render(TimecodeSettings);
    
    // Open manual entry modal
    const manualEntryButton = screen.getByText('Manual Entry');
    await fireEvent.click(manualEntryButton);
    
    const input = screen.getByPlaceholderText('HH:MM:SS:FF');
    const setButton = screen.getByText('Set Timecode');
    
    // Test invalid format
    await fireEvent.input(input, { target: { value: 'invalid' } });
    expect(setButton).toBeDisabled();
    
    // Test valid format
    await fireEvent.input(input, { target: { value: '01:23:45:12' } });
    expect(setButton).not.toBeDisabled();
  });

  it('handles manual timecode setting', async () => {
    (cameraApi.setTimecode as any).mockResolvedValue({ success: true });
    
    render(TimecodeSettings);
    
    // Open manual entry modal
    const manualEntryButton = screen.getByText('Manual Entry');
    await fireEvent.click(manualEntryButton);
    
    const input = screen.getByPlaceholderText('HH:MM:SS:FF');
    const setButton = screen.getByText('Set Timecode');
    
    await fireEvent.input(input, { target: { value: '01:23:45:12' } });
    await fireEvent.click(setButton);
    
    expect(cameraApi.setTimecode).toHaveBeenCalledWith('01:23:45:12');
    expect(cameraStore.updateSettings).toHaveBeenCalledWith({ currentTimecode: '01:23:45:12' });
  });

  it('opens user bits entry modal', async () => {
    render(TimecodeSettings, { props: { showAdvanced: true } });
    
    const userBitsButton = screen.getByText('User Bits');
    await fireEvent.click(userBitsButton);
    
    expect(screen.getByText('Set User Bits')).toBeInTheDocument();
  });

  it('handles user bits setting', async () => {
    (cameraApi.setUserBits as any).mockResolvedValue({ success: true });
    
    render(TimecodeSettings, { props: { showAdvanced: true } });
    
    // Open user bits modal
    const userBitsButton = screen.getByText('User Bits');
    await fireEvent.click(userBitsButton);
    
    const input = screen.getByPlaceholderText('HH:MM:SS:FF');
    const setButton = screen.getByText('Set User Bits');
    
    await fireEvent.input(input, { target: { value: '12:34:56:78' } });
    await fireEvent.click(setButton);
    
    expect(cameraApi.setUserBits).toHaveBeenCalledWith('12:34:56:78');
    expect(cameraStore.updateSettings).toHaveBeenCalledWith({ userBits: '12:34:56:78' });
  });

  it('handles frame rate changes when advanced mode is enabled', async () => {
    (cameraApi.setFrameRate as any).mockResolvedValue({ success: true });
    
    render(TimecodeSettings, { props: { showAdvanced: true } });
    
    const fps25Button = screen.getByText('25 fps');
    await fireEvent.click(fps25Button);
    
    expect(cameraApi.setFrameRate).toHaveBeenCalledWith(25);
    expect(cameraStore.updateSettings).toHaveBeenCalledWith({ frameRate: 25 });
  });

  it('disables controls when disabled prop is true', () => {
    render(TimecodeSettings, { props: { disabled: true } });
    
    const freeRunButton = screen.getByLabelText('Set timecode mode to Free Run');
    const syncButton = screen.getByText('Sync to Time of Day');
    
    expect(freeRunButton).toBeDisabled();
    expect(syncButton).toBeDisabled();
  });

  it('shows loading state during operations', () => {
    const loadingState = { ...mockCameraState, operations: { timecode: true } };
    (cameraStore.subscribe as any).mockImplementation((callback: any) => {
      callback(loadingState);
      return () => {};
    });
    
    render(TimecodeSettings);
    
    const freeRunButton = screen.getByLabelText('Set timecode mode to Free Run');
    expect(freeRunButton).toBeDisabled();
  });

  it('formats timecode input as user types', async () => {
    render(TimecodeSettings);
    
    // Open manual entry modal
    const manualEntryButton = screen.getByText('Manual Entry');
    await fireEvent.click(manualEntryButton);
    
    const input = screen.getByPlaceholderText('HH:MM:SS:FF') as HTMLInputElement;
    
    // Simulate typing numbers
    await fireEvent.input(input, { target: { value: '12345678' } });
    
    // Should be formatted as HH:MM:SS:FF
    expect(input.value).toBe('12:34:56:78');
  });

  it('handles API errors gracefully', async () => {
    (cameraApi.setTimecodeMode as any).mockResolvedValue({ 
      success: false, 
      error: 'Camera not connected' 
    });
    
    render(TimecodeSettings);
    
    const recordRunButton = screen.getByLabelText('Set timecode mode to Record Run');
    await fireEvent.click(recordRunButton);
    
    await waitFor(() => {
      expect(notificationStore.error).toHaveBeenCalledWith(
        'Mode Change Failed', 
        'Camera not connected'
      );
    });
  });

  it('applies timecode presets correctly', async () => {
    (cameraApi.setTimecode as any).mockResolvedValue({ success: true });
    
    render(TimecodeSettings);
    
    const presetSelect = screen.getByDisplayValue('No Preset');
    await fireEvent.change(presetSelect, { target: { value: 'production_start' } });
    
    // Should trigger setTimecode with preset value
    await waitFor(() => {
      expect(cameraApi.setTimecode).toHaveBeenCalledWith('01:00:00:00');
    });
  });
});