import { render, screen, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import PlaybackStateManager from '../PlaybackStateManager.svelte';
import { playbackStore, notificationStore } from '$lib/stores';
import { cameraApi } from '$lib/api/cameraApi';

// Mock the stores
vi.mock('$lib/stores', () => ({
	playbackStore: {
		updateTransport: vi.fn(),
		updatePlaybackStats: vi.fn()
	},
	notificationStore: {
		error: vi.fn(),
		success: vi.fn(),
		warning: vi.fn()
	}
}));

// Mock the camera API
vi.mock('$lib/api/cameraApi', () => ({
	cameraApi: {
		getPlaybackStatus: vi.fn()
	}
}));

// Mock Svelte stores
const mockPlaybackStore = {
	subscribe: vi.fn((callback) => {
		callback({
			currentClip: {
				id: '1',
				name: 'Test_Clip.mov',
				totalFrames: 2880,
				frameRate: 24
			},
			playbackStatus: 'playing',
			isInPlaybackMode: true,
			currentPosition: 100,
			playbackSpeed: 1,
			bufferHealth: 85
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockPlaybackStore),
	derived: vi.fn(() => mockPlaybackStore),
	get: vi.fn(() => ({ 
		currentClip: null, 
		playbackStatus: 'stopped',
		isInPlaybackMode: false
	}))
}));

// Mock timers
vi.useFakeTimers();

describe('PlaybackStateManager', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.clearAllTimers();
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
	});

	it('renders status indicator when enabled', () => {
		render(PlaybackStateManager, { showStatusIndicator: true });
		
		expect(screen.getByText('Playback Status')).toBeInTheDocument();
		expect(screen.getByText('Connected')).toBeInTheDocument();
	});

	it('starts updates when playback is active', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'playing',
				position: 150,
				speed: 1,
				timecode: '00:00:06:06',
				bufferHealth: 90,
				droppedFrames: 0
			}
		});

		render(PlaybackStateManager, { updateInterval: 100 });

		// Fast-forward time to trigger updates
		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(mockGetPlaybackStatus).toHaveBeenCalled();
		});
	});

	it('updates playback state from API response', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'playing',
				position: 200,
				speed: 2,
				timecode: '00:00:08:08',
				bufferHealth: 75,
				droppedFrames: 2
			}
		});

		render(PlaybackStateManager);

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(playbackStore.updateTransport).toHaveBeenCalledWith({
				playbackStatus: 'playing',
				currentPosition: 200,
				playbackSpeed: 2,
				currentTimecode: '00:00:08:08',
				bufferHealth: 75,
				droppedFrames: 2
			});
		});
	});

	it('handles API errors gracefully', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: false,
			error: 'Connection lost'
		});

		render(PlaybackStateManager);

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(screen.getByText('Error')).toBeInTheDocument();
		});
	});

	it('stops updates after consecutive errors', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: false,
			error: 'Connection lost'
		});

		render(PlaybackStateManager);

		// Trigger multiple failed updates
		for (let i = 0; i < 6; i++) {
			vi.advanceTimersByTime(100);
			await waitFor(() => {}, { timeout: 50 });
		}

		await waitFor(() => {
			expect(notificationStore.error).toHaveBeenCalledWith(
				'Playback State Error',
				expect.stringContaining('Lost connection to playback system')
			);
		});
	});

	it('handles playback completion', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'completed',
				position: 2880,
				speed: 1,
				timecode: '00:02:00:00',
				bufferHealth: 100,
				droppedFrames: 0
			}
		});

		render(PlaybackStateManager);

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(notificationStore.success).toHaveBeenCalledWith(
				'Playback Complete',
				'Finished playing Test_Clip.mov'
			);
		});
	});

	it('shows buffer warnings when buffer is low', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'playing',
				position: 100,
				speed: 1,
				timecode: '00:00:04:04',
				bufferHealth: 15,
				droppedFrames: 0
			}
		});

		render(PlaybackStateManager);

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(notificationStore.warning).toHaveBeenCalledWith(
				'Buffer Critical',
				'Playback buffer critically low (15%)'
			);
		});
	});

	it('displays latency information', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'playing',
				position: 100,
				speed: 1,
				timecode: '00:00:04:04',
				bufferHealth: 90,
				droppedFrames: 0
			}
		});

		render(PlaybackStateManager, { showStatusIndicator: true });

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(screen.getByText('Latency:')).toBeInTheDocument();
		});
	});

	it('shows dropped frames warning when present', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'playing',
				position: 100,
				speed: 1,
				timecode: '00:00:04:04',
				bufferHealth: 90,
				droppedFrames: 5
			}
		});

		render(PlaybackStateManager, { showStatusIndicator: true });

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(screen.getByText('Dropped Frames:')).toBeInTheDocument();
			expect(screen.getByText('5')).toBeInTheDocument();
		});
	});

	it('stops updates when disabled', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: true,
			data: {
				status: 'playing',
				position: 100,
				speed: 1,
				timecode: '00:00:04:04',
				bufferHealth: 90,
				droppedFrames: 0
			}
		});

		const { rerender } = render(PlaybackStateManager, { enabled: true });

		vi.advanceTimersByTime(200);
		expect(mockGetPlaybackStatus).toHaveBeenCalled();

		vi.clearAllMocks();

		// Disable the component
		rerender({ enabled: false });

		vi.advanceTimersByTime(200);
		expect(mockGetPlaybackStatus).not.toHaveBeenCalled();
	});

	it('hides status indicator when showStatusIndicator is false', () => {
		render(PlaybackStateManager, { showStatusIndicator: false });
		
		expect(screen.queryByText('Playback Status')).not.toBeInTheDocument();
	});

	it('updates statistics correctly', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		
		// First call
		mockGetPlaybackStatus.mockResolvedValueOnce({
			success: true,
			data: {
				status: 'playing',
				position: 100,
				speed: 1,
				timecode: '00:00:04:04',
				bufferHealth: 90,
				droppedFrames: 0
			}
		});

		render(PlaybackStateManager);

		vi.advanceTimersByTime(100);

		// Second call with advanced position
		mockGetPlaybackStatus.mockResolvedValueOnce({
			success: true,
			data: {
				status: 'playing',
				position: 124, // 24 frames advanced (1 second at 24fps)
				speed: 1,
				timecode: '00:00:05:04',
				bufferHealth: 90,
				droppedFrames: 0
			}
		});

		vi.advanceTimersByTime(100);

		await waitFor(() => {
			expect(playbackStore.updatePlaybackStats).toHaveBeenCalled();
		});
	});

	it('resets statistics when clip changes', () => {
		// Mock clip change
		const mockClipChangeStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: {
						id: '2',
						name: 'New_Clip.mov',
						totalFrames: 1440,
						frameRate: 24
					},
					playbackStatus: 'playing',
					isInPlaybackMode: true,
					currentPosition: 0,
					playbackSpeed: 1,
					bufferHealth: 100
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockClipChangeStore.subscribe);

		render(PlaybackStateManager);

		expect(playbackStore.updatePlaybackStats).toHaveBeenCalledWith({
			totalPlayTime: 0,
			framesPlayed: 0,
			averageFrameRate: 0,
			droppedFrames: 0,
			lastFrameTime: 0
		});
	});

	it('shows connection error details', async () => {
		const mockGetPlaybackStatus = vi.mocked(cameraApi.getPlaybackStatus);
		mockGetPlaybackStatus.mockResolvedValue({
			success: false,
			error: 'Network timeout'
		});

		render(PlaybackStateManager, { showStatusIndicator: true });

		vi.advanceTimersByTime(200);

		await waitFor(() => {
			expect(screen.getByText('Connection lost. Attempting to reconnect...')).toBeInTheDocument();
		});
	});
});"