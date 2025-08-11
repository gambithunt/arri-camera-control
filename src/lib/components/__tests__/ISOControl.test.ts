import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ISOControl from '../ISOControl.svelte';
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
		setISO: vi.fn()
	}
}));

// Mock Svelte stores
const mockCameraStore = {
	subscribe: vi.fn((callback) => {
		callback({
			iso: 800,
			operations: { iso: false }
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockCameraStore),
	derived: vi.fn(() => mockCameraStore),
	get: vi.fn(() => ({ iso: 800, operations: { iso: false } }))
}));

describe('ISOControl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders ISO control with current value', () => {
		render(ISOControl);
		
		expect(screen.getByText('ISO/EI')).toBeInTheDocument();
		expect(screen.getByText('ISO 800')).toBeInTheDocument();
	});

	it('displays standard ISO values', () => {
		render(ISOControl);
		
		// Check for some standard ISO values
		expect(screen.getByText('160')).toBeInTheDocument();
		expect(screen.getByText('400')).toBeInTheDocument();
		expect(screen.getByText('800')).toBeInTheDocument();
		expect(screen.getByText('1600')).toBeInTheDocument();
	});

	it('shows active state for current ISO', () => {
		render(ISOControl);
		
		const button800 = screen.getByRole('button', { name: /800/ });
		expect(button800).toHaveClass('active');
	});

	it('calls setISO when button is clicked', async () => {
		const mockSetISO = vi.mocked(cameraApi.setISO);
		mockSetISO.mockResolvedValue({ success: true });

		render(ISOControl);
		
		const button400 = screen.getByRole('button', { name: /400/ });
		await fireEvent.click(button400);

		expect(mockSetISO).toHaveBeenCalledWith(400);
	});

	it('shows custom ISO input when custom button is clicked', async () => {
		render(ISOControl);
		
		const customButton = screen.getByText('Custom ISO');
		await fireEvent.click(customButton);

		expect(screen.getByPlaceholderText('Enter ISO')).toBeInTheDocument();
		expect(screen.getByText('Set')).toBeInTheDocument();
		expect(screen.getByText('Cancel')).toBeInTheDocument();
	});

	it('validates custom ISO input', async () => {
		render(ISOControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ISO');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter ISO');
		const setButton = screen.getByText('Set');

		// Test invalid input
		await fireEvent.input(input, { target: { value: 'invalid' } });
		await fireEvent.click(setButton);

		expect(notificationStore.warning).toHaveBeenCalledWith(
			'Invalid Input',
			'Please enter a valid number'
		);
	});

	it('validates ISO bounds', async () => {
		render(ISOControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ISO');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter ISO');
		const setButton = screen.getByText('Set');

		// Test out of bounds input
		await fireEvent.input(input, { target: { value: '5000' } });
		await fireEvent.click(setButton);

		expect(notificationStore.error).toHaveBeenCalledWith(
			'Invalid ISO',
			'ISO must be between 160 and 3200'
		);
	});

	it('handles API errors gracefully', async () => {
		const mockSetISO = vi.mocked(cameraApi.setISO);
		mockSetISO.mockResolvedValue({ 
			success: false, 
			error: 'Camera not responding' 
		});

		render(ISOControl);
		
		const button1600 = screen.getByRole('button', { name: /1600/ });
		await fireEvent.click(button1600);

		await waitFor(() => {
			expect(notificationStore.cameraCommandError).toHaveBeenCalledWith(
				'ISO',
				'Camera not responding'
			);
		});
	});

	it('disables controls when disabled prop is true', () => {
		render(ISOControl, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(ISOControl, { compact: true });
		
		const control = screen.getByText('ISO/EI').closest('.iso-control');
		expect(control).toHaveClass('compact');
	});

	it('hides label when showLabel is false', () => {
		render(ISOControl, { showLabel: false });
		
		expect(screen.queryByText('ISO/EI')).not.toBeInTheDocument();
	});

	it('supports keyboard navigation for custom input', async () => {
		render(ISOControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ISO');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter ISO');
		
		// Test Enter key
		await fireEvent.input(input, { target: { value: '640' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(cameraApi.setISO).toHaveBeenCalledWith(640);

		// Test Escape key
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.queryByPlaceholderText('Enter ISO')).not.toBeInTheDocument();
	});

	it('provides proper ARIA labels for accessibility', () => {
		render(ISOControl);
		
		const button400 = screen.getByRole('button', { 
			name: /Set ISO to 400 - Standard/i 
		});
		expect(button400).toBeInTheDocument();
	});

	it('shows loading state when operation is in progress', () => {
		// Mock loading state
		const mockLoadingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					iso: 800,
					operations: { iso: true }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(ISOControl);
		
		expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
	});

	it('displays exposure impact information', () => {
		render(ISOControl);
		
		// Should show exposure impact for current ISO
		expect(screen.getByText(/Higher sensitivity, moderate noise/)).toBeInTheDocument();
	});

	it('shows ISO descriptions for standard values', () => {
		render(ISOControl);
		
		// Check that descriptions are shown for standard values
		expect(screen.getByText('High sensitivity')).toBeInTheDocument();
	});
});"