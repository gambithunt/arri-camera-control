import { render, screen, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import TimecodeDisplay from '../TimecodeDisplay.svelte';
import { cameraStore, notificationStore } from '$lib/stores';
import { cameraApi } from '$lib/api/cameraApi';

// Mock the stores
vi.mock('$lib/stores', () => ({
	cameraStore: {
		updateSettings: vi.fn()
	},
	notificationStore: {
		warning: vi.fn()
	}
}));

// Mock the camera API
vi.mock('$lib/api/cameraApi', () => ({
	cameraApi: {
		getTimecode: vi.fn()
	}
}));

// Mock Svelte stores
const mockCameraStore = {
	subscribe: vi.fn((callback) => {
		callback({
			currentTimecode: '01:23:45:12',
			timecodeMode: 'free_run',
			timecodeSync: 'synced',
			frameRate: 24,
			userBits: '12:34:56:78'
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockCameraStore),
	derived: vi.fn(() => mockCameraStore),
	get: vi.fn(() => ({ 
		currentTimecode: '01:23:45:12',
		timecodeMode: 'free_run',
		timecodeSync: 'synced',
		frameRate: 24,
		userBits: '12:34:56:78'
	}))
}));

// Mock timers
vi.useFakeTimers();

describe('TimecodeDisplay', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('renders timecode display with current timecode', () => {
		render(TimecodeDisplay);
		
		expect(screen.getByText('01:23:45:12')).toBeInTheDocument();
	});

	it('shows sync status when showSync is true', () => {
		render(TimecodeDisplay, { showSync: true });
		
		expect(screen.getByText('Synchronized')).toBeInTheDocument();
		expect(screen.getByText('🟢')).toBeInTheDocument();
	});

	it('hides sync status when showSync is false', () => {
		render(TimecodeDisplay, { showSync: false });
		
		expect(screen.queryByText('Synchronized')).not.toBeInTheDocument();
	});

	it('shows frame rate when showFrameRate is true', () => {
		render(TimecodeDisplay, { showFrameRate: true });
		
		expect(screen.getByText('24 fps')).toBeInTheDocument();
		expect(screen.getByText('Free Run')).toBeInTheDocument();
	});

	it('hides frame rate when showFrameRate is false', () => {
		render(TimecodeDisplay, { showFrameRate: false });
		
		expect(screen.queryByText('24 fps')).not.toBeInTheDocument();
	});

	it('displays user bits when displayMode is UB', () => {
		render(TimecodeDisplay, { displayMode: 'UB' });
		
		expect(screen.getByText('UB: 12:34:56:78')).toBeInTheDocument();
		expect(screen.queryByText('01:23:45:12')).not.toBeInTheDocument();
	});

	it('displays both timecode and user bits when displayMode is BOTH', () => {
		render(TimecodeDisplay, { displayMode: 'BOTH' });
		
		expect(screen.getByText('01:23:45:12')).toBeInTheDocument();
		expect(screen.getByText('UB: 12:34:56:78')).toBeInTheDocument();
	});

	it('formats timecode as milliseconds when format is HH:MM:SS.mmm', () => {
		render(TimecodeDisplay, { format: 'HH:MM:SS.mmm' });
		
		// 12 frames at 24fps = 500ms
		expect(screen.getByText('01:23:45.500')).toBeInTheDocument();
	});

	it('applies correct size classes', () => {
		const { rerender } = render(TimecodeDisplay, { size: 'small' });
		let display = screen.getByText('01:23:45:12').closest('.timecode-display');
		expect(display).toHaveClass('text-lg');

		rerender({ size: 'large' });
		display = screen.getByText('01:23:45:12').closest('.timecode-display');
		expect(display).toHaveClass('text-4xl');
	});

	it('applies correct theme classes', () => {
		const { rerender } = render(TimecodeDisplay, { theme: 'light' });
		let display = screen.getByText('01:23:45:12').closest('.timecode-display');
		expect(display).toHaveClass('bg-white', 'text-black');

		rerender({ theme: 'transparent' });
		display = screen.getByText('01:23:45:12').closest('.timecode-display');
		expect(display).toHaveClass('bg-transparent');
	});

	it('shows border when showBorder is true', () => {
		render(TimecodeDisplay, { showBorder: true });
		
		const display = screen.getByText('01:23:45:12').closest('.timecode-display');
		expect(display).toHaveClass('border-2');
	});

	it('hides border when showBorder is false', () => {
		render(TimecodeDisplay, { showBorder: false });
		
		const display = screen.getByText('01:23:45:12').closest('.timecode-display');
		expect(display).not.toHaveClass('border-2');
	});

	it('starts auto-update when autoUpdate is true', async () => {
		const mockGetTimecode = vi.mocked(cameraApi.getTimecode);
		mockGetTimecode.mockResolvedValue({
			success: true,
			data: {
				timecode: '01:23:45:13',
				userBits: '12:34:56:78',
				syncStatus: 'synced'
			}
		});

		render(TimecodeDisplay, { autoUpdate: true, updateInterval: 100 });

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(mockGetTimecode).toHaveBeenCalled();
		});
	});

	it('does not auto-update when autoUpdate is false', async () => {
		const mockGetTimecode = vi.mocked(cameraApi.getTimecode);
		mockGetTimecode.mockResolvedValue({
			success: true,
			data: {
				timecode: '01:23:45:13',
				userBits: '12:34:56:78',
				syncStatus: 'synced'
			}
		});

		render(TimecodeDisplay, { autoUpdate: false });

		vi.advanceTimersByTime(200);

		expect(mockGetTimecode).not.toHaveBeenCalled();
	});

	it('updates store when receiving new timecode data', async () => {
		const mockGetTimecode = vi.mocked(cameraApi.getTimecode);
		mockGetTimecode.mockResolvedValue({
			success: true,
			data: {
				timecode: '01:23:45:15',
				userBits: '12:34:56:79',
				syncStatus: 'synced'
			}
		});

		render(TimecodeDisplay, { autoUpdate: true, updateInterval: 100 });

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(cameraStore.updateSettings).toHaveBeenCalledWith({
				currentTimecode: '01:23:45:15',
				userBits: '12:34:56:79',
				timecodeSync: 'synced'
			});
		});
	});

	it('handles API errors gracefully', async () => {
		const mockGetTimecode = vi.mocked(cameraApi.getTimecode);
		mockGetTimecode.mockResolvedValue({
			success: false,
			error: 'Timecode unavailable'
		});

		render(TimecodeDisplay, { autoUpdate: true, updateInterval: 100 });

		// Trigger multiple errors to exceed threshold
		for (let i = 0; i < 4; i++) {
			vi.advanceTimersByTime(100);
			await waitFor(() => {}, { timeout: 50 });
		}

		await waitFor(() => {
			expect(notificationStore.warning).toHaveBeenCalledWith(
				'Timecode Sync Lost',
				expect.stringContaining('Lost timecode synchronization')
			);
		});
	});

	it('shows different sync status colors and icons', () => {
		// Test synced status
		render(TimecodeDisplay, { showSync: true });
		expect(screen.getByText('🟢')).toBeInTheDocument();
		expect(screen.getByText('Synchronized')).toBeInTheDocument();

		// Test drifting status
		const mockDriftingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentTimecode: '01:23:45:12',
					timecodeMode: 'free_run',
					timecodeSync: 'drifting',
					frameRate: 24,
					userBits: '12:34:56:78'
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockDriftingStore.subscribe);

		const { rerender } = render(TimecodeDisplay, { showSync: true });
		rerender({});

		expect(screen.getByText('🟡')).toBeInTheDocument();
		expect(screen.getByText('Drift Detected')).toBeInTheDocument();
	});

	it('shows update indicator when updating', async () => {
		const mockGetTimecode = vi.mocked(cameraApi.getTimecode);
		// Make the API call hang to show loading state
		mockGetTimecode.mockImplementation(() => new Promise(() => {}));

		render(TimecodeDisplay, { autoUpdate: true, updateInterval: 100 });

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(screen.getByLabelText('Updating timecode')).toBeInTheDocument();
		});
	});

	it('validates timecode format correctly', () => {
		// Test with invalid timecode
		const mockInvalidStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentTimecode: 'invalid:timecode',
					timecodeMode: 'free_run',
					timecodeSync: 'synced',
					frameRate: 24,
					userBits: '12:34:56:78'
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockInvalidStore.subscribe);

		render(TimecodeDisplay);

		// Should fallback to 00:00:00:00 for invalid timecode
		expect(screen.getByText('00:00:00:00')).toBeInTheDocument();
	});

	it('shows proper ARIA labels for accessibility', () => {
		render(TimecodeDisplay);
		
		expect(screen.getByRole('timer')).toBeInTheDocument();
		expect(screen.getByLabelText('Current timecode')).toBeInTheDocument();
	});

	it('handles different timecode modes correctly', () => {
		// Test record run mode
		const mockRecordRunStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentTimecode: '01:23:45:12',
					timecodeMode: 'record_run',
					timecodeSync: 'synced',
					frameRate: 24,
					userBits: '12:34:56:78'
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockRecordRunStore.subscribe);

		render(TimecodeDisplay, { showFrameRate: true });

		expect(screen.getByText('Record Run')).toBeInTheDocument();
	});

	it('handles external sync status correctly', () => {
		const mockExternalStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentTimecode: '01:23:45:12',
					timecodeMode: 'external',
					timecodeSync: 'external',
					frameRate: 24,
					userBits: '12:34:56:78'
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockExternalStore.subscribe);

		render(TimecodeDisplay, { showSync: true });

		expect(screen.getByText('🔵')).toBeInTheDocument();
		expect(screen.getByText('External Sync')).toBeInTheDocument();
	});

	it('stops auto-update on component destroy', () => {
		const { unmount } = render(TimecodeDisplay, { autoUpdate: true });
		
		const mockGetTimecode = vi.mocked(cameraApi.getTimecode);
		mockGetTimecode.mockResolvedValue({ success: true, data: {} });

		// Component should be updating
		vi.advanceTimersByTime(100);
		expect(mockGetTimecode).toHaveBeenCalled();

		vi.clearAllMocks();
		unmount();

		// After unmount, should not update anymore
		vi.advanceTimersByTime(100);
		expect(mockGetTimecode).not.toHaveBeenCalled();
	});

	it('converts frames to milliseconds correctly', () => {
		render(TimecodeDisplay, { format: 'HH:MM:SS.mmm' });
		
		// At 24fps, 12 frames = 500ms, 6 frames = 250ms, etc.
		expect(screen.getByText('01:23:45.500')).toBeInTheDocument();
	});

	it('handles different frame rates correctly', () => {
		const mock30fpsStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentTimecode: '01:23:45:15', // 15 frames at 30fps
					timecodeMode: 'free_run',
					timecodeSync: 'synced',
					frameRate: 30,
					userBits: '12:34:56:78'
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mock30fpsStore.subscribe);

		render(TimecodeDisplay, { format: 'HH:MM:SS.mmm', showFrameRate: true });

		// 15 frames at 30fps = 500ms
		expect(screen.getByText('01:23:45.500')).toBeInTheDocument();
		expect(screen.getByText('30 fps')).toBeInTheDocument();
	});
});"