import { render, screen } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlaybackProgressDisplay from '../PlaybackProgressDisplay.svelte';
import { playbackStore } from '$lib/stores';

// Mock the stores
vi.mock('$lib/stores', () => ({
	playbackStore: {
		subscribe: vi.fn()
	}
}));

// Mock Svelte stores
const mockPlaybackStore = {
	subscribe: vi.fn((callback) => {
		callback({
			currentClip: {
				id: '1',
				name: 'Test_Clip.mov',
				resolution: '4K UHD',
				codec: 'ProRes',
				durationMs: 120000,
				totalFrames: 2880,
				frameRate: 24
			},
			playbackStatus: 'playing',
			currentPosition: 720, // 25% through
			playbackSpeed: 1,
			bufferHealth: 85,
			playbackStats: {
				totalPlayTime: 30000,
				framesPlayed: 720,
				averageFrameRate: 24.0,
				droppedFrames: 2,
				lastFrameTime: Date.now()
			}
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
		currentPosition: 0
	}))
}));

describe('PlaybackProgressDisplay', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders progress display with current clip', () => {
		render(PlaybackProgressDisplay);
		
		expect(screen.getByText('Playing')).toBeInTheDocument();
		expect(screen.getByText('25.0%')).toBeInTheDocument();
	});

	it('shows correct playback status icon and text', () => {
		render(PlaybackProgressDisplay);
		
		expect(screen.getByText('▶️')).toBeInTheDocument();
		expect(screen.getByText('Playing')).toBeInTheDocument();
	});

	it('displays progress bar with correct width', () => {
		render(PlaybackProgressDisplay);
		
		const progressFill = document.querySelector('.progress-fill');
		expect(progressFill).toHaveStyle('width: 25%');
	});

	it('shows detailed information when showDetailed is true', () => {
		render(PlaybackProgressDisplay, { showDetailed: true });
		
		expect(screen.getByText('Position')).toBeInTheDocument();
		expect(screen.getByText('Frame 720')).toBeInTheDocument();
		expect(screen.getByText('Remaining')).toBeInTheDocument();
		expect(screen.getByText('Total Frames')).toBeInTheDocument();
		expect(screen.getByText('2,880')).toBeInTheDocument();
	});

	it('hides detailed information when showDetailed is false', () => {
		render(PlaybackProgressDisplay, { showDetailed: false });
		
		expect(screen.queryByText('Position')).not.toBeInTheDocument();
		expect(screen.queryByText('Total Frames')).not.toBeInTheDocument();
	});

	it('shows buffer health when showBuffer is true', () => {
		render(PlaybackProgressDisplay, { showBuffer: true });
		
		expect(screen.getByText('Buffer')).toBeInTheDocument();
		expect(screen.getByText('85%')).toBeInTheDocument();
	});

	it('hides buffer health when showBuffer is false', () => {
		render(PlaybackProgressDisplay, { showBuffer: false });
		
		expect(screen.queryByText('Buffer')).not.toBeInTheDocument();
	});

	it('shows statistics when showStats is true', () => {
		render(PlaybackProgressDisplay, { showStats: true });
		
		expect(screen.getByText('Playback Statistics')).toBeInTheDocument();
		expect(screen.getByText('Avg Frame Rate')).toBeInTheDocument();
		expect(screen.getByText('24.0 fps')).toBeInTheDocument();
		expect(screen.getByText('Frames Played')).toBeInTheDocument();
		expect(screen.getByText('720')).toBeInTheDocument();
	});

	it('shows dropped frames warning when present', () => {
		render(PlaybackProgressDisplay, { showStats: true });
		
		expect(screen.getByText('Dropped Frames')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
		
		const droppedFramesStat = screen.getByText('Dropped Frames').closest('.stat-item');
		expect(droppedFramesStat).toHaveClass('warning');
	});

	it('hides statistics when showStats is false', () => {
		render(PlaybackProgressDisplay, { showStats: false });
		
		expect(screen.queryByText('Playback Statistics')).not.toBeInTheDocument();
	});

	it('shows no clip state when no clip is selected', () => {
		// Mock no clip state
		const mockNoClipStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: null,
					playbackStatus: 'stopped',
					currentPosition: 0,
					playbackSpeed: 1,
					bufferHealth: undefined,
					playbackStats: null
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockNoClipStore.subscribe);

		render(PlaybackProgressDisplay);
		
		expect(screen.getByText('No Playback Active')).toBeInTheDocument();
		expect(screen.getByText('Select and play a clip to see progress information')).toBeInTheDocument();
	});

	it('calculates remaining time correctly', () => {
		render(PlaybackProgressDisplay, { showDetailed: true });
		
		// 2880 - 720 = 2160 frames remaining
		// 2160 / 24 fps = 90 seconds = 01:30:00
		expect(screen.getByText('01:30:00')).toBeInTheDocument();
	});

	it('formats duration correctly', () => {
		render(PlaybackProgressDisplay, { showDetailed: true });
		
		// 120000ms = 2 minutes = 00:02:00
		expect(screen.getByText('00:02:00')).toBeInTheDocument();
	});

	it('shows different progress bar colors for different states', () => {
		// Test playing state (red)
		render(PlaybackProgressDisplay);
		let progressFill = document.querySelector('.progress-fill');
		expect(progressFill).toHaveClass('bg-arri-red');

		// Test completed state (green)
		const mockCompletedStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: {
						id: '1',
						name: 'Test_Clip.mov',
						totalFrames: 2880,
						frameRate: 24
					},
					playbackStatus: 'completed',
					currentPosition: 2880,
					playbackSpeed: 1,
					bufferHealth: 100
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockCompletedStore.subscribe);

		const { rerender } = render(PlaybackProgressDisplay);
		rerender({});

		progressFill = document.querySelector('.progress-fill');
		expect(progressFill).toHaveClass('bg-green-500');
	});

	it('shows different buffer health colors', () => {
		// Test low buffer (red)
		const mockLowBufferStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: {
						id: '1',
						name: 'Test_Clip.mov',
						totalFrames: 2880,
						frameRate: 24
					},
					playbackStatus: 'playing',
					currentPosition: 720,
					playbackSpeed: 1,
					bufferHealth: 5
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockLowBufferStore.subscribe);

		render(PlaybackProgressDisplay, { showBuffer: true });

		const bufferFill = document.querySelector('.buffer-fill');
		expect(bufferFill).toHaveClass('bg-red-500');
	});

	it('shows compact layout when compact prop is true', () => {
		render(PlaybackProgressDisplay, { compact: true });
		
		const display = screen.getByText('Playing').closest('.playback-progress-display');
		expect(display).toHaveClass('compact');
	});

	it('displays frame rate information', () => {
		render(PlaybackProgressDisplay, { showDetailed: true });
		
		expect(screen.getByText('Frame Rate')).toBeInTheDocument();
		expect(screen.getByText('24 fps')).toBeInTheDocument();
		expect(screen.getByText('Speed')).toBeInTheDocument();
		expect(screen.getByText('1x')).toBeInTheDocument();
	});

	it('handles paused state correctly', () => {
		// Mock paused state
		const mockPausedStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: {
						id: '1',
						name: 'Test_Clip.mov',
						totalFrames: 2880,
						frameRate: 24
					},
					playbackStatus: 'paused',
					currentPosition: 720,
					playbackSpeed: 1,
					bufferHealth: 85
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockPausedStore.subscribe);

		render(PlaybackProgressDisplay);
		
		expect(screen.getByText('⏸️')).toBeInTheDocument();
		expect(screen.getByText('Paused')).toBeInTheDocument();
	});

	it('handles error state correctly', () => {
		// Mock error state
		const mockErrorStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: {
						id: '1',
						name: 'Test_Clip.mov',
						totalFrames: 2880,
						frameRate: 24
					},
					playbackStatus: 'error',
					currentPosition: 720,
					playbackSpeed: 1,
					bufferHealth: 0
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockErrorStore.subscribe);

		render(PlaybackProgressDisplay);
		
		expect(screen.getByText('❌')).toBeInTheDocument();
		expect(screen.getByText('Error')).toBeInTheDocument();
		
		const progressFill = document.querySelector('.progress-fill');
		expect(progressFill).toHaveClass('bg-red-500');
	});

	it('handles zero remaining time correctly', () => {
		// Mock completed state
		const mockCompletedStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentClip: {
						id: '1',
						name: 'Test_Clip.mov',
						totalFrames: 2880,
						frameRate: 24,
						durationMs: 120000
					},
					playbackStatus: 'completed',
					currentPosition: 2880, // At the end
					playbackSpeed: 1,
					bufferHealth: 100
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockCompletedStore.subscribe);

		render(PlaybackProgressDisplay, { showDetailed: true });
		
		expect(screen.getByText('00:00:00')).toBeInTheDocument(); // Remaining time
		expect(screen.getByText('100.0%')).toBeInTheDocument(); // Progress
	});
});"