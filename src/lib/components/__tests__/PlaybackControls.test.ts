import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import PlaybackControls from '../PlaybackControls.svelte';
import { playbackStore, notificationStore } from '$lib/stores';
import { cameraApi } from '$lib/api/cameraApi';

// Mock the stores
vi.mock('$lib/stores', () => ({
	playbackStore: {
		updateTransport: vi.fn()
	},
	notificationStore: {
		error: vi.fn(),
		success: vi.fn()
	}
}));

// Mock the camera API
vi.mock('$lib/api/cameraApi', () => ({
	cameraApi: {
		startPlayback: vi.fn(),
		pausePlayback: vi.fn(),
		stopPlayback: vi.fn(),
		setPlaybackSpeed: vi.fn(),
		seekToPosition: vi.fn(),
		stepFrame: vi.fn()
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
			playbackStatus: 'stopped',
			currentPosition: 0,
			playbackSpeed: 1,
			operations: { loading: false }
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
		currentPosition: 0,
		playbackSpeed: 1,
		operations: { loading: false }
	}))
}));

describe('PlaybackControls', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders playback controls with current clip', () => {
		render(PlaybackControls);
		
		expect(screen.getByText('Test_Clip.mov')).toBeInTheDocument();
		expect(screen.getByText('4K UHD')).toBeInTheDocument();
		expect(screen.getByText('ProRes')).toBeInTheDocument();
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
					operations: { loading: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockNoClipStore.subscribe);

		render(PlaybackControls);
		
		expect(screen.getByText('No Clip Selected')).toBeInTheDocument();
		expect(screen.getByText('Select a clip from the browser to start playback')).toBeInTheDocument();
	});

	it('displays timecode correctly', () => {
		render(PlaybackControls);
		
		// Should show current timecode (00:00:00:00 at position 0)
		expect(screen.getByText('00:00:00:00')).toBeInTheDocument();
		// Should show total timecode (02:00:00:00 for 2880 frames at 24fps)
		expect(screen.getByText('00:02:00:00')).toBeInTheDocument();
	});

	it('handles play button click', async () => {
		const mockStartPlayback = vi.mocked(cameraApi.startPlayback);
		mockStartPlayback.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const playButton = screen.getByLabelText('Start playback');
		await fireEvent.click(playButton);

		expect(mockStartPlayback).toHaveBeenCalled();
		expect(playbackStore.updateTransport).toHaveBeenCalledWith({ playbackStatus: 'playing' });
	});

	it('handles pause button click when playing', async () => {
		// Mock playing state
		const mockPlayingStore = {
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
					currentPosition: 100,
					playbackSpeed: 1,
					operations: { loading: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockPlayingStore.subscribe);

		const mockPausePlayback = vi.mocked(cameraApi.pausePlayback);
		mockPausePlayback.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const pauseButton = screen.getByLabelText('Pause playback');
		await fireEvent.click(pauseButton);

		expect(mockPausePlayback).toHaveBeenCalled();
		expect(playbackStore.updateTransport).toHaveBeenCalledWith({ playbackStatus: 'paused' });
	});

	it('handles stop button click', async () => {
		const mockStopPlayback = vi.mocked(cameraApi.stopPlayback);
		mockStopPlayback.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const stopButton = screen.getByLabelText('Stop playback');
		await fireEvent.click(stopButton);

		expect(mockStopPlayback).toHaveBeenCalled();
		expect(playbackStore.updateTransport).toHaveBeenCalledWith({ 
			playbackStatus: 'stopped',
			currentPosition: 0 
		});
	});

	it('handles frame step forward', async () => {
		const mockStepFrame = vi.mocked(cameraApi.stepFrame);
		mockStepFrame.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const stepForwardButton = screen.getByLabelText('Step forward one frame');
		await fireEvent.click(stepForwardButton);

		expect(mockStepFrame).toHaveBeenCalledWith('forward');
	});

	it('handles frame step backward', async () => {
		const mockStepFrame = vi.mocked(cameraApi.stepFrame);
		mockStepFrame.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const stepBackwardButton = screen.getByLabelText('Step backward one frame');
		await fireEvent.click(stepBackwardButton);

		expect(mockStepFrame).toHaveBeenCalledWith('backward');
	});

	it('displays speed controls', () => {
		render(PlaybackControls);
		
		expect(screen.getByText('Speed: 1x')).toBeInTheDocument();
		expect(screen.getByText('Normal speed')).toBeInTheDocument();
		
		// Check for speed buttons
		expect(screen.getByText('1x')).toBeInTheDocument();
		expect(screen.getByText('2x')).toBeInTheDocument();
		expect(screen.getByText('½x')).toBeInTheDocument();
	});

	it('handles speed change', async () => {
		const mockSetPlaybackSpeed = vi.mocked(cameraApi.setPlaybackSpeed);
		mockSetPlaybackSpeed.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const speed2xButton = screen.getByLabelText('Set playback speed to 2x');
		await fireEvent.click(speed2xButton);

		expect(mockSetPlaybackSpeed).toHaveBeenCalledWith(2);
		expect(playbackStore.updateTransport).toHaveBeenCalledWith({ playbackSpeed: 2 });
	});

	it('shows active speed button', () => {
		render(PlaybackControls);
		
		const speed1xButton = screen.getByLabelText('Set playback speed to 1x');
		expect(speed1xButton).toHaveClass('active');
	});

	it('displays position information', () => {
		render(PlaybackControls);
		
		expect(screen.getByText('Frame 0 of 2880')).toBeInTheDocument();
		expect(screen.getByText('0.0%')).toBeInTheDocument();
	});

	it('handles scrub bar interaction', async () => {
		const mockSeekToPosition = vi.mocked(cameraApi.seekToPosition);
		mockSeekToPosition.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const scrubBar = screen.getByRole('slider');
		
		// Mock getBoundingClientRect
		vi.spyOn(scrubBar, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			width: 100,
			top: 0,
			right: 100,
			bottom: 20,
			height: 20,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// Simulate mouse down at 50% position
		await fireEvent.mouseDown(scrubBar, { clientX: 50 });
		await fireEvent.mouseUp(scrubBar);

		// Should seek to middle of clip (50% of 2880 frames = 1440)
		expect(mockSeekToPosition).toHaveBeenCalledWith(1440);
	});

	it('handles keyboard shortcuts', async () => {
		const mockStartPlayback = vi.mocked(cameraApi.startPlayback);
		const mockStepFrame = vi.mocked(cameraApi.stepFrame);
		const mockSeekToPosition = vi.mocked(cameraApi.seekToPosition);
		
		mockStartPlayback.mockResolvedValue({ success: true });
		mockStepFrame.mockResolvedValue({ success: true });
		mockSeekToPosition.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		// Test spacebar for play/pause
		await fireEvent.keyDown(document, { code: 'Space' });
		expect(mockStartPlayback).toHaveBeenCalled();
		
		// Test arrow keys for frame stepping
		await fireEvent.keyDown(document, { code: 'ArrowRight' });
		expect(mockStepFrame).toHaveBeenCalledWith('forward');
		
		await fireEvent.keyDown(document, { code: 'ArrowLeft' });
		expect(mockStepFrame).toHaveBeenCalledWith('backward');
		
		// Test Home key for seek to start
		await fireEvent.keyDown(document, { code: 'Home' });
		expect(mockSeekToPosition).toHaveBeenCalledWith(0);
		
		// Test End key for seek to end
		await fireEvent.keyDown(document, { code: 'End' });
		expect(mockSeekToPosition).toHaveBeenCalledWith(2880);
	});

	it('disables controls when disabled prop is true', () => {
		render(PlaybackControls, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(PlaybackControls, { compact: true });
		
		const controls = screen.getByText('Test_Clip.mov').closest('.playback-controls');
		expect(controls).toHaveClass('compact');
	});

	it('hides timecode when showTimecode is false', () => {
		render(PlaybackControls, { showTimecode: false });
		
		expect(screen.queryByText('00:00:00:00')).not.toBeInTheDocument();
	});

	it('hides speed controls when showSpeed is false', () => {
		render(PlaybackControls, { showSpeed: false });
		
		expect(screen.queryByText('Speed: 1x')).not.toBeInTheDocument();
	});

	it('shows loading state during operations', () => {
		// Mock loading state
		const mockLoadingStore = {
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
					playbackStatus: 'stopped',
					currentPosition: 0,
					playbackSpeed: 1,
					operations: { loading: true }
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(PlaybackControls);
		
		expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
	});

	it('handles API errors gracefully', async () => {
		const mockStartPlayback = vi.mocked(cameraApi.startPlayback);
		mockStartPlayback.mockResolvedValue({ 
			success: false, 
			error: 'Playback failed' 
		});

		render(PlaybackControls);
		
		const playButton = screen.getByLabelText('Start playback');
		await fireEvent.click(playButton);

		await waitFor(() => {
			expect(notificationStore.error).toHaveBeenCalledWith(
				'Playback Failed',
				'Playback failed'
			);
		});
	});

	it('formats duration correctly', () => {
		render(PlaybackControls);
		
		// 120000ms should be formatted as 00:02:00
		expect(screen.getByText('00:02:00')).toBeInTheDocument();
	});

	it('calculates progress percentage correctly', () => {
		// Mock state with current position at 25% (720 frames out of 2880)
		const mockProgressStore = {
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
					playbackStatus: 'stopped',
					currentPosition: 720,
					playbackSpeed: 1,
					operations: { loading: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockProgressStore.subscribe);

		render(PlaybackControls);
		
		expect(screen.getByText('25.0%')).toBeInTheDocument();
		expect(screen.getByText('Frame 720 of 2880')).toBeInTheDocument();
	});

	it('handles touch events on scrub bar', async () => {
		const mockSeekToPosition = vi.mocked(cameraApi.seekToPosition);
		mockSeekToPosition.mockResolvedValue({ success: true });

		render(PlaybackControls);
		
		const scrubBar = screen.getByRole('slider');
		
		// Mock getBoundingClientRect
		vi.spyOn(scrubBar, 'getBoundingClientRect').mockReturnValue({
			left: 0,
			width: 100,
			top: 0,
			right: 100,
			bottom: 20,
			height: 20,
			x: 0,
			y: 0,
			toJSON: () => {}
		});

		// Simulate touch interaction at 25% position
		await fireEvent.touchStart(scrubBar, { 
			touches: [{ clientX: 25 }] 
		});
		await fireEvent.touchEnd(scrubBar);

		// Should seek to 25% of clip (25% of 2880 frames = 720)
		expect(mockSeekToPosition).toHaveBeenCalledWith(720);
	});
});"