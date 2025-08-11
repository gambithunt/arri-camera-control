import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import NDFilterControl from '../NDFilterControl.svelte';
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
		setNDFilter: vi.fn()
	}
}));

// Mock Svelte stores
const mockCameraStore = {
	subscribe: vi.fn((callback) => {
		callback({
			ndFilter: 0.6,
			operations: { ndFilter: false }
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockCameraStore),
	derived: vi.fn(() => mockCameraStore),
	get: vi.fn(() => ({ ndFilter: 0.6, operations: { ndFilter: false } }))
}));

describe('NDFilterControl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders ND filter control with current value', () => {
		render(NDFilterControl);
		
		expect(screen.getByText('ND Filter')).toBeInTheDocument();
		expect(screen.getByText('0.6 ND')).toBeInTheDocument();
	});

	it('displays standard ND filter values', () => {
		render(NDFilterControl);
		
		// Check for some standard ND values
		expect(screen.getByText('0')).toBeInTheDocument();
		expect(screen.getByText('0.3')).toBeInTheDocument();
		expect(screen.getByText('0.6')).toBeInTheDocument();
		expect(screen.getByText('1.2')).toBeInTheDocument();
	});

	it('shows active state for current ND filter', () => {
		render(NDFilterControl);
		
		const button06 = screen.getByRole('button', { name: /0\.6/ });
		expect(button06).toHaveClass('active');
	});

	it('calls setNDFilter when button is clicked', async () => {
		const mockSetNDFilter = vi.mocked(cameraApi.setNDFilter);
		mockSetNDFilter.mockResolvedValue({ success: true });

		render(NDFilterControl);
		
		const button12 = screen.getByRole('button', { name: /1\.2/ });
		await fireEvent.click(button12);

		expect(mockSetNDFilter).toHaveBeenCalledWith(1.2);
	});

	it('shows custom ND input when custom button is clicked', async () => {
		render(NDFilterControl);
		
		const customButton = screen.getByText('Custom ND');
		await fireEvent.click(customButton);

		expect(screen.getByPlaceholderText('Enter ND value')).toBeInTheDocument();
		expect(screen.getByText('Set')).toBeInTheDocument();
		expect(screen.getByText('Cancel')).toBeInTheDocument();
	});

	it('validates custom ND input', async () => {
		render(NDFilterControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ND');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter ND value');
		const setButton = screen.getByText('Set');

		// Test invalid input
		await fireEvent.input(input, { target: { value: 'invalid' } });
		await fireEvent.click(setButton);

		expect(notificationStore.warning).toHaveBeenCalledWith(
			'Invalid Input',
			'Please enter a valid number'
		);
	});

	it('validates ND bounds', async () => {
		render(NDFilterControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ND');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter ND value');
		const setButton = screen.getByText('Set');

		// Test out of bounds input
		await fireEvent.input(input, { target: { value: '5.0' } });
		await fireEvent.click(setButton);

		expect(notificationStore.error).toHaveBeenCalledWith(
			'Invalid ND Filter',
			'ND filter must be between 0 and 2.4 stops'
		);
	});

	it('handles API errors gracefully', async () => {
		const mockSetNDFilter = vi.mocked(cameraApi.setNDFilter);
		mockSetNDFilter.mockResolvedValue({ 
			success: false, 
			error: 'ND filter mechanism jammed' 
		});

		render(NDFilterControl);
		
		const button18 = screen.getByRole('button', { name: /1\.8/ });
		await fireEvent.click(button18);

		await waitFor(() => {
			expect(notificationStore.cameraCommandError).toHaveBeenCalledWith(
				'ND Filter',
				'ND filter mechanism jammed'
			);
		});
	});

	it('disables controls when disabled prop is true', () => {
		render(NDFilterControl, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(NDFilterControl, { compact: true });
		
		const control = screen.getByText('ND Filter').closest('.nd-control');
		expect(control).toHaveClass('compact');
	});

	it('hides label when showLabel is false', () => {
		render(NDFilterControl, { showLabel: false });
		
		expect(screen.queryByText('ND Filter')).not.toBeInTheDocument();
	});

	it('supports keyboard navigation for custom input', async () => {
		render(NDFilterControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ND');
		await fireEvent.click(customButton);

		const input = screen.getByPlaceholderText('Enter ND value');
		
		// Test Enter key
		await fireEvent.input(input, { target: { value: '0.9' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(cameraApi.setNDFilter).toHaveBeenCalledWith(0.9);

		// Test Escape key
		await fireEvent.keyDown(input, { key: 'Escape' });
		expect(screen.queryByPlaceholderText('Enter ND value')).not.toBeInTheDocument();
	});

	it('provides proper ARIA labels for accessibility', () => {
		render(NDFilterControl);
		
		const button06 = screen.getByRole('button', { 
			name: /Set ND filter to 0\.6 - Moderate reduction \(2 stops\)/i 
		});
		expect(button06).toBeInTheDocument();
	});

	it('shows loading state when operation is in progress', () => {
		// Mock loading state
		const mockLoadingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					ndFilter: 0.6,
					operations: { ndFilter: true }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(NDFilterControl);
		
		expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
	});

	it('displays stops description for ND values', () => {
		render(NDFilterControl);
		
		// Should show stops description for current ND
		expect(screen.getByText('2 stops')).toBeInTheDocument();
	});

	it('shows exposure impact information', () => {
		render(NDFilterControl);
		
		// Should show exposure impact for current ND
		expect(screen.getByText(/Moderate exposure reduction/)).toBeInTheDocument();
	});

	it('displays ND descriptions for standard values', () => {
		render(NDFilterControl);
		
		// Check that descriptions are shown for standard values
		expect(screen.getByText('Moderate reduction')).toBeInTheDocument();
	});

	it('shows input help text for custom ND', async () => {
		render(NDFilterControl);
		
		// Open custom input
		const customButton = screen.getByText('Custom ND');
		await fireEvent.click(customButton);

		expect(screen.getByText('Range: 0.0 to 2.4 (0 to 8 stops)')).toBeInTheDocument();
	});

	it('calculates stops correctly for custom values', async () => {
		// Mock a custom ND value
		const mockCustomStore = {
			subscribe: vi.fn((callback) => {
				callback({
					ndFilter: 1.5,
					operations: { ndFilter: false }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockCustomStore.subscribe);

		render(NDFilterControl);
		
		// Should calculate and display stops for custom value
		expect(screen.getByText('5 stops')).toBeInTheDocument();
	});
});"