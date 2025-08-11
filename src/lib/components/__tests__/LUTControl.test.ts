import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import LUTControl from '../LUTControl.svelte';
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
		success: vi.fn(),
		cameraCommandSuccess: vi.fn(),
		cameraCommandError: vi.fn()
	}
}));

// Mock the camera API
vi.mock('$lib/api/cameraApi', () => ({
	cameraApi: {
		setLUT: vi.fn(),
		getLUTList: vi.fn(),
		uploadLUT: vi.fn(),
		deleteLUT: vi.fn()
	}
}));

// Mock Svelte stores
const mockCameraStore = {
	subscribe: vi.fn((callback) => {
		callback({
			currentLUT: 'Rec709',
			availableLUTs: [
				{ name: 'Custom_01', description: 'Custom LUT 1', category: 'Custom', preview: 'linear-gradient(45deg, #ff0000, #00ff00)' }
			],
			operations: { lut: false }
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockCameraStore),
	derived: vi.fn(() => mockCameraStore),
	get: vi.fn(() => ({ 
		currentLUT: 'Rec709', 
		availableLUTs: [], 
		operations: { lut: false } 
	}))
}));

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
	writable: true,
	value: vi.fn(() => true)
});

describe('LUTControl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders LUT control with current value', () => {
		render(LUTControl);
		
		expect(screen.getByText('LUT (Look-Up Table)')).toBeInTheDocument();
		expect(screen.getByText('Rec709')).toBeInTheDocument();
	});

	it('displays standard LUT options', () => {
		render(LUTControl);
		
		// Check for some standard LUTs
		expect(screen.getByText('Rec709')).toBeInTheDocument();
		expect(screen.getByText('LogC')).toBeInTheDocument();
		expect(screen.getByText('Alexa_Classic')).toBeInTheDocument();
		expect(screen.getByText('None')).toBeInTheDocument();
	});

	it('shows active state for current LUT', () => {
		render(LUTControl);
		
		const rec709Button = screen.getByRole('button', { name: /Apply LUT Rec709/ });
		expect(rec709Button).toHaveClass('active');
	});

	it('calls setLUT when LUT button is clicked', async () => {
		const mockSetLUT = vi.mocked(cameraApi.setLUT);
		mockSetLUT.mockResolvedValue({ success: true });

		render(LUTControl);
		
		const logcButton = screen.getByRole('button', { name: /Apply LUT LogC/ });
		await fireEvent.click(logcButton);

		expect(mockSetLUT).toHaveBeenCalledWith('LogC');
	});

	it('loads LUT list on mount', async () => {
		const mockGetLUTList = vi.mocked(cameraApi.getLUTList);
		mockGetLUTList.mockResolvedValue({ 
			success: true, 
			data: { 
				luts: [
					{ name: 'Custom_01', description: 'Custom LUT', category: 'Custom' }
				] 
			} 
		});

		render(LUTControl);

		await waitFor(() => {
			expect(mockGetLUTList).toHaveBeenCalled();
		});
	});

	it('handles API errors gracefully', async () => {
		const mockSetLUT = vi.mocked(cameraApi.setLUT);
		mockSetLUT.mockResolvedValue({ 
			success: false, 
			error: 'LUT not found' 
		});

		render(LUTControl);
		
		const logcButton = screen.getByRole('button', { name: /Apply LUT LogC/ });
		await fireEvent.click(logcButton);

		await waitFor(() => {
			expect(notificationStore.cameraCommandError).toHaveBeenCalledWith(
				'LUT',
				'LUT not found'
			);
		});
	});

	it('disables controls when disabled prop is true', () => {
		render(LUTControl, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(LUTControl, { compact: true });
		
		const control = screen.getByText('LUT (Look-Up Table)').closest('.lut-control');
		expect(control).toHaveClass('compact');
	});

	it('hides label when showLabel is false', () => {
		render(LUTControl, { showLabel: false });
		
		expect(screen.queryByText('LUT (Look-Up Table)')).not.toBeInTheDocument();
	});

	it('provides proper ARIA labels for accessibility', () => {
		render(LUTControl);
		
		const rec709Button = screen.getByRole('button', { 
			name: /Apply LUT Rec709 - Standard broadcast\/web delivery/i 
		});
		expect(rec709Button).toBeInTheDocument();
	});

	it('shows loading state when operation is in progress', () => {
		// Mock loading state
		const mockLoadingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					currentLUT: 'Rec709',
					availableLUTs: [],
					operations: { lut: true }
				});
				return () => {};
			})
		};

		vi.mocked(mockCameraStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(LUTControl);
		
		expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
	});

	it('displays category filter buttons', () => {
		render(LUTControl);
		
		expect(screen.getByText('All')).toBeInTheDocument();
		expect(screen.getByText('Standard')).toBeInTheDocument();
		expect(screen.getByText('Creative')).toBeInTheDocument();
		expect(screen.getByText('Custom')).toBeInTheDocument();
	});

	it('filters LUTs by category', async () => {
		render(LUTControl);
		
		// Click on Creative category
		const creativeButton = screen.getByText('Creative');
		await fireEvent.click(creativeButton);

		// Should show only creative LUTs
		expect(screen.getByText('Alexa_Classic')).toBeInTheDocument();
		// Standard LUTs should not be visible (except in All view)
	});

	it('shows upload dialog when upload button is clicked', async () => {
		render(LUTControl);
		
		const uploadButton = screen.getByText('Upload LUT');
		await fireEvent.click(uploadButton);

		expect(screen.getByText('Upload Custom LUT')).toBeInTheDocument();
		expect(screen.getByText('Choose LUT File')).toBeInTheDocument();
	});

	it('handles file upload', async () => {
		const mockUploadLUT = vi.mocked(cameraApi.uploadLUT);
		mockUploadLUT.mockResolvedValue({ success: true });

		render(LUTControl);
		
		// Open upload dialog
		const uploadButton = screen.getByText('Upload LUT');
		await fireEvent.click(uploadButton);

		// Mock file input
		const fileInput = screen.getByLabelText(/Choose LUT File/);
		const file = new File(['lut content'], 'test.cube', { type: 'application/octet-stream' });
		
		Object.defineProperty(fileInput, 'files', {
			value: [file],
			writable: false,
		});

		await fireEvent.change(fileInput);

		expect(mockUploadLUT).toHaveBeenCalledWith(file);
	});

	it('shows delete button for custom LUTs', () => {
		render(LUTControl);
		
		// Custom LUTs should have delete buttons
		const deleteButtons = screen.getAllByLabelText(/Delete LUT/);
		expect(deleteButtons.length).toBeGreaterThan(0);
	});

	it('handles LUT deletion with confirmation', async () => {
		const mockDeleteLUT = vi.mocked(cameraApi.deleteLUT);
		mockDeleteLUT.mockResolvedValue({ success: true });

		render(LUTControl);
		
		const deleteButton = screen.getByLabelText(/Delete LUT Custom_01/);
		await fireEvent.click(deleteButton);

		expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete the LUT "Custom_01"?');
		expect(mockDeleteLUT).toHaveBeenCalledWith('Custom_01');
	});

	it('shows refresh button and handles refresh', async () => {
		const mockGetLUTList = vi.mocked(cameraApi.getLUTList);
		mockGetLUTList.mockResolvedValue({ success: true, data: { luts: [] } });

		render(LUTControl);
		
		const refreshButton = screen.getByText('Refresh');
		await fireEvent.click(refreshButton);

		expect(mockGetLUTList).toHaveBeenCalled();
	});

	it('displays LUT previews', () => {
		render(LUTControl);
		
		// LUT buttons should have preview elements
		const lutButtons = screen.getAllByRole('button').filter(btn => 
			btn.getAttribute('aria-label')?.includes('Apply LUT')
		);
		
		expect(lutButtons.length).toBeGreaterThan(0);
	});

	it('shows current LUT preview when LUT is selected', () => {
		render(LUTControl);
		
		// Should show current LUT preview section
		expect(screen.getByText('Standard broadcast/web delivery')).toBeInTheDocument();
	});

	it('handles upload errors gracefully', async () => {
		const mockUploadLUT = vi.mocked(cameraApi.uploadLUT);
		mockUploadLUT.mockResolvedValue({ 
			success: false, 
			error: 'Invalid LUT format' 
		});

		render(LUTControl);
		
		// Open upload dialog
		const uploadButton = screen.getByText('Upload LUT');
		await fireEvent.click(uploadButton);

		// Mock file input
		const fileInput = screen.getByLabelText(/Choose LUT File/);
		const file = new File(['invalid content'], 'test.cube', { type: 'application/octet-stream' });
		
		Object.defineProperty(fileInput, 'files', {
			value: [file],
			writable: false,
		});

		await fireEvent.change(fileInput);

		await waitFor(() => {
			expect(notificationStore.error).toHaveBeenCalledWith(
				'Upload Failed',
				'Invalid LUT format'
			);
		});
	});

	it('cancels upload dialog', async () => {
		render(LUTControl);
		
		// Open upload dialog
		const uploadButton = screen.getByText('Upload LUT');
		await fireEvent.click(uploadButton);

		expect(screen.getByText('Upload Custom LUT')).toBeInTheDocument();

		// Cancel dialog
		const cancelButton = screen.getByText('Cancel');
		await fireEvent.click(cancelButton);

		expect(screen.queryByText('Upload Custom LUT')).not.toBeInTheDocument();
	});
});"