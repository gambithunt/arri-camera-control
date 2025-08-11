import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FrameLinesControl from '../FrameLinesControl.svelte';
import { cameraStore, notificationStore } from '$lib/stores';
import { cameraApi } from '$lib/api/cameraApi';

// Mock the stores
vi.mock('$lib/stores', () => ({
	cameraStore: {
		updateSettings: vi.fn(),
		setOperationLoading: vi.fn()
	},
	notificationStore: {
		error: vi.fn(),
		warning: vi.fn(),
		cameraCommandSuccess: vi.fn(),
		cameraCommandError: vi.fn()
	}
}));

// Mock the camera API
vi.mock('$lib/api/cameraApi', () => ({
	cameraApi: {
		setFrameLines: vi.fn(),
		setFrameLineType: vi.fn()
	}
}));

// Mock Svelte stores
const mockCameraStore = {
	subscribe: vi.fn((callback) => {
		callback({
			frameLinesEnabled: false,
			frameLineType: 'thirds',
			operations: { frameLines: false }
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockCameraStore),
	derived: vi.fn(() => mockCameraStore),
	get: vi.fn(() => ({ frameLinesEnabled: false, frameLineType: 'thirds', operations: { frameLines: false } }))
}));

describe('FrameLinesControl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders frame lines control with current state', () => {
		render(FrameLinesControl);
		
		expect(screen.getByText('Frame Lines')).toBeInTheDocument();
		expect(screen.getByText('OFF')).toBeInTheDocument();
	});

	it('displays frame line types', () => {
		render(FrameLinesControl);
		
		// Check for frame line type options
		expect(screen.getByText('Off')).toBeInTheDocument();
		expect(screen.getByText('Center')).toBeInTheDocument();
		expect(screen.getByText('Rule of Thirds')).toBeInTheDocument();
		expect(screen.getByText('Safe Areas')).toBeInTheDocument();
	});

	it('shows active state for current frame line type', () => {
		// Mock enabled state with thirds
		const mockEnabledStore = {
			subscribe: vi.fn((callback) => {
				callback({
					frameLinesEnabled: true,
					frameLineType: 'thirds',
					operations: { frameLines: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockEnabledStore.subscribe);

		render(FrameLinesControl);
		
		const thirdsButton = screen.getByRole('button', { name: /Rule of Thirds/ });
		expect(thirdsButton).toHaveClass('active');
	});

	it('calls setFrameLines when toggle button is clicked', async () => {
		const mockSetFrameLines = vi.mocked(cameraApi.setFrameLines);
		mockSetFrameLines.mockResolvedValue({ success: true });

		render(FrameLinesControl);
		
		const toggleButton = screen.getByRole('button', { name: /Enable Frame Lines/ });
		await fireEvent.click(toggleButton);

		expect(mockSetFrameLines).toHaveBeenCalledWith(true);
	});

	it('calls setFrameLineType when type button is clicked', async () => {
		const mockSetFrameLineType = vi.mocked(cameraApi.setFrameLineType);
		mockSetFrameLineType.mockResolvedValue({ success: true });

		render(FrameLinesControl);
		
		const centerButton = screen.getByRole('button', { name: /Center/ });
		await fireEvent.click(centerButton);

		expect(mockSetFrameLineType).toHaveBeenCalledWith('center');
	});

	it('handles API errors gracefully', async () => {
		const mockSetFrameLines = vi.mocked(cameraApi.setFrameLines);
		mockSetFrameLines.mockResolvedValue({ 
			success: false, 
			error: 'Frame lines not supported' 
		});

		render(FrameLinesControl);
		
		const toggleButton = screen.getByRole('button', { name: /Enable Frame Lines/ });
		await fireEvent.click(toggleButton);

		await waitFor(() => {
			expect(notificationStore.cameraCommandError).toHaveBeenCalledWith(
				'Frame Lines',
				'Frame lines not supported'
			);
		});
	});

	it('disables controls when disabled prop is true', () => {
		render(FrameLinesControl, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(FrameLinesControl, { compact: true });
		
		const control = screen.getByText('Frame Lines').closest('.frame-lines-control');
		expect(control).toHaveClass('compact');
	});

	it('hides label when showLabel is false', () => {
		render(FrameLinesControl, { showLabel: false });
		
		expect(screen.queryByText('Frame Lines')).not.toBeInTheDocument();
	});

	it('provides proper ARIA labels for accessibility', () => {
		render(FrameLinesControl);
		
		const centerButton = screen.getByRole('button', { 
			name: /Set frame lines to Center - Center cross marker only/i 
		});
		expect(centerButton).toBeInTheDocument();
	});

	it('shows loading state when operation is in progress', () => {
		// Mock loading state
		const mockLoadingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					frameLinesEnabled: false,
					frameLineType: 'thirds',
					operations: { frameLines: true }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(FrameLinesControl);
		
		expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
	});

	it('shows frame line preview when enabled', () => {
		// Mock enabled state
		const mockEnabledStore = {
			subscribe: vi.fn((callback) => {
				callback({
					frameLinesEnabled: true,
					frameLineType: 'thirds',
					operations: { frameLines: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockEnabledStore.subscribe);

		render(FrameLinesControl);
		
		expect(screen.getByText('Preview')).toBeInTheDocument();
	});

	it('displays correct description for frame line types', () => {
		render(FrameLinesControl);
		
		// Check that descriptions are shown
		expect(screen.getByText('No frame lines displayed')).toBeInTheDocument();
		expect(screen.getByText('Center cross marker only')).toBeInTheDocument();
		expect(screen.getByText('3x3 grid overlay')).toBeInTheDocument();
	});

	it('enables frame lines when selecting a type while disabled', async () => {
		const mockSetFrameLines = vi.mocked(cameraApi.setFrameLines);
		const mockSetFrameLineType = vi.mocked(cameraApi.setFrameLineType);
		
		mockSetFrameLines.mockResolvedValue({ success: true });
		mockSetFrameLineType.mockResolvedValue({ success: true });

		render(FrameLinesControl);
		
		// Click on a frame line type when frame lines are disabled
		const safeButton = screen.getByRole('button', { name: /Safe Areas/ });
		await fireEvent.click(safeButton);

		// Should first enable frame lines, then set the type
		expect(mockSetFrameLines).toHaveBeenCalledWith(true);
		expect(mockSetFrameLineType).toHaveBeenCalledWith('safe');
	});

	it('turns off frame lines when selecting off type', async () => {
		// Mock enabled state first
		const mockEnabledStore = {
			subscribe: vi.fn((callback) => {
				callback({
					frameLinesEnabled: true,
					frameLineType: 'thirds',
					operations: { frameLines: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockEnabledStore.subscribe);

		const mockSetFrameLines = vi.mocked(cameraApi.setFrameLines);
		mockSetFrameLines.mockResolvedValue({ success: true });

		render(FrameLinesControl);
		
		const offButton = screen.getByRole('button', { name: /Off/ });
		await fireEvent.click(offButton);

		expect(mockSetFrameLines).toHaveBeenCalledWith(false);
	});

	it('shows different icons for different frame line types', () => {
		render(FrameLinesControl);
		
		// Icons should be present (we can't easily test the exact emoji, but we can test structure)
		const typeButtons = screen.getAllByRole('button').filter(btn => 
			btn.textContent?.includes('Off') || 
			btn.textContent?.includes('Center') || 
			btn.textContent?.includes('Rule of Thirds')
		);
		
		expect(typeButtons.length).toBeGreaterThan(0);
	});
});"