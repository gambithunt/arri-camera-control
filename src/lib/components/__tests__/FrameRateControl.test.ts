import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import FrameRateControl from '../FrameRateControl.svelte';
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
		setFrameRate: vi.fn()
	}
}));

// Mock Svelte stores
const mockCameraStore = {
	subscribe: vi.fn((callback) => {
		callback({
			frameRate: 24,
			operations: { frameRate: false }
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockCameraStore),
	derived: vi.fn(() => mockCameraStore),
	get: vi.fn(() => ({ frameRate: 24, operations: { frameRate: false } }))
}));

describe('FrameRateControl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders frame rate control with current value', () => {
		render(FrameRateControl);
		
		expect(screen.getByText('Frame Rate')).toBeInTheDocument();
		expect(screen.getByText('24 fps')).toBeInTheDocument();
	});

	it('displays supported frame rates', () => {
		render(FrameRateControl);
		
		// Check for some standard frame rates
		expect(screen.getByText('23.98')).toBeInTheDocument();
		expect(screen.getByText('24')).toBeInTheDocument();
		expect(screen.getByText('25')).toBeInTheDocument();
		expect(screen.getByText('30')).toBeInTheDocument();
	});

	it('shows active state for current frame rate', () => {
		render(FrameRateControl);
		
		const button24 = screen.getByRole('button', { name: /24/ });
		expect(button24).toHaveClass('active');
	});

	it('calls setFrameRate when button is clicked', async () => {
		const mockSetFrameRate = vi.mocked(cameraApi.setFrameRate);
		mockSetFrameRate.mockResolvedValue({ success: true });

		render(FrameRateControl);
		
		const button25 = screen.getByRole('button', { name: /25/ });
		await fireEvent.click(button25);

		expect(mockSetFrameRate).toHaveBeenCalledWith(25);
	});

	it('shows custom frame rate input when custom button is clicked', async () => {
		render(FrameRateControl);
		
		const customButton = screen.getByText('Custom Frame Rate');
		await fireEvent.click(customButton);

		expect(screen.getByPlaceholderText('Enter fps')).toBeInTheDocument();
		expect(screen.getByText('Set')).toBeInTheDocument();
		expect(screen.getByText('Cancel')).toBeInTheDocument();
	});

	it('validates custom frame rate input', async () => {
		render(FrameRateControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom Frame Rate');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter fps');
		const setButton = screen.getByText('Set');

		// Test invalid input
		await fireEvent.input(input, { target: { value: 'invalid' } });
		await fireEvent.click(setButton);

		expect(notificationStore.warning).toHaveBeenCalledWith(
			'Invalid Input',
			'Please enter a valid number'
		);
	});

	it('validates frame rate bounds', async () => {
		render(FrameRateControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom Frame Rate');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter fps');
		const setButton = screen.getByText('Set');

		// Test out of bounds input
		await fireEvent.input(input, { target: { value: '500' } });
		await fireEvent.click(setButton);

		expect(notificationStore.error).toHaveBeenCalledWith(
			'Invalid Frame Rate',
			'Frame rate must be between 1 and 300 fps'
		);
	});

	it('handles API errors gracefully', async () => {
		const mockSetFrameRate = vi.mocked(cameraApi.setFrameRate);
		mockSetFrameRate.mockResolvedValue({ 
			success: false, 
			error: 'Camera not responding' 
		});

		render(FrameRateControl);
		
		const button30 = screen.getByRole('button', { name: /30/ });
		await fireEvent.click(button30);

		await waitFor(() => {
			expect(notificationStore.cameraCommandError).toHaveBeenCalledWith(
				'Frame Rate',
				'Camera not responding'
			);
		});
	});

	it('disables controls when disabled prop is true', () => {
		render(FrameRateControl, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(FrameRateControl, { compact: true });
		
		const control = screen.getByRole('group', { name: /frame rate/i }) || 
						screen.getByText('Frame Rate').closest('.frame-rate-control');
		expect(control).toHaveClass('compact');
	});

	it('hides label when showLabel is false', () => {
		render(FrameRateControl, { showLabel: false });
		
		expect(screen.queryByText('Frame Rate')).not.toBeInTheDocument();
	});

	it('supports keyboard navigation for custom input', async () => {
		render(FrameRateControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom Frame Rate');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter fps');
		
		// Test Enter key
		await fireEvent.input(input, { target: { value: '48' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(cameraApi.setFrameRate).toHaveBeenCalledWith(48);

		// Test Escape key
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.queryByPlaceholderText('Enter fps')).not.toBeInTheDocument();
	});

	it('provides proper ARIA labels for accessibility', () => {
		render(FrameRateControl);
		
		const button24 = screen.getByRole('button', { 
			name: /Set frame rate to 24 fps - Film standard/i 
		});
		expect(button24).toBeInTheDocument();
	});

	it('shows loading state when operation is in progress', () => {
		// Mock loading state
		const mockLoadingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					frameRate: 24,
					operations: { frameRate: true }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(FrameRateControl);
		
		expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
	});
});