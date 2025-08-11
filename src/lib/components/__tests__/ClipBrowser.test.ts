import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClipBrowser from '../ClipBrowser.svelte';
import { playbackStore, notificationStore } from '$lib/stores';
import { cameraApi } from '$lib/api/cameraApi';

// Mock the stores
vi.mock('$lib/stores', () => ({
	playbackStore: {
		updateClipList: vi.fn(),
		setCurrentClip: vi.fn()
	},
	notificationStore: {
		error: vi.fn(),
		warning: vi.fn(),
		success: vi.fn()
	}
}));

// Mock the camera API
vi.mock('$lib/api/cameraApi', () => ({
	cameraApi: {
		getClipList: vi.fn(),
		deleteClip: vi.fn()
	}
}));

// Mock Svelte stores
const mockPlaybackStore = {
	subscribe: vi.fn((callback) => {
		callback({
			clipList: [
				{
					id: '1',
					name: 'Clip_001.mov',
					duration: '00:01:30:00',
					durationMs: 90000,
					resolution: '4K UHD',
					codec: 'ProRes',
					sizeBytes: 1024000000,
					createdAt: '2024-01-01T10:00:00Z',
					thumbnailUrl: null
				},
				{
					id: '2',
					name: 'Clip_002.mov',
					duration: '00:02:15:00',
					durationMs: 135000,
					resolution: '4K UHD',
					codec: 'H.264',
					sizeBytes: 512000000,
					createdAt: '2024-01-01T11:00:00Z',
					thumbnailUrl: null
				}
			],
			clipListLoading: false,
			currentClip: null
		});
		return () => {};
	})
};

vi.mock('svelte/store', () => ({
	writable: vi.fn(() => mockPlaybackStore),
	derived: vi.fn(() => mockPlaybackStore),
	get: vi.fn(() => ({ 
		clipList: [], 
		clipListLoading: false, 
		currentClip: null 
	}))
}));

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
	writable: true,
	value: vi.fn(() => true)
});

describe('ClipBrowser', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders clip browser with clips', () => {
		render(ClipBrowser);
		
		expect(screen.getByText('Clip Browser')).toBeInTheDocument();
		expect(screen.getByText('2 of 2 clips')).toBeInTheDocument();
		expect(screen.getByText('Clip_001.mov')).toBeInTheDocument();
		expect(screen.getByText('Clip_002.mov')).toBeInTheDocument();
	});

	it('loads clips on mount', async () => {
		const mockGetClipList = vi.mocked(cameraApi.getClipList);
		mockGetClipList.mockResolvedValue({ 
			success: true, 
			data: { clips: [] } 
		});

		render(ClipBrowser);

		await waitFor(() => {
			expect(mockGetClipList).toHaveBeenCalledWith(false);
		});
	});

	it('displays clip metadata correctly', () => {
		render(ClipBrowser);
		
		// Check for metadata display
		expect(screen.getByText('4K UHD')).toBeInTheDocument();
		expect(screen.getByText('ProRes')).toBeInTheDocument();
		expect(screen.getByText('H.264')).toBeInTheDocument();
	});

	it('handles search functionality', async () => {
		render(ClipBrowser);
		
		const searchInput = screen.getByPlaceholderText('Search clips...');
		await fireEvent.input(searchInput, { target: { value: 'Clip_001' } });

		// Should show only matching clips
		expect(screen.getByText('Clip_001.mov')).toBeInTheDocument();
		expect(screen.getByText('1 of 2 clips')).toBeInTheDocument();
	});

	it('handles format filtering', async () => {
		render(ClipBrowser);
		
		const formatSelect = screen.getByDisplayValue('All Formats');
		await fireEvent.change(formatSelect, { target: { value: 'ProRes' } });

		// Should show only ProRes clips
		expect(screen.getByText('1 of 2 clips')).toBeInTheDocument();
	});

	it('handles resolution filtering', async () => {
		render(ClipBrowser);
		
		const resolutionSelect = screen.getByDisplayValue('All Resolutions');
		await fireEvent.change(resolutionSelect, { target: { value: '4K UHD' } });

		// Should show all clips with 4K UHD resolution
		expect(screen.getByText('2 of 2 clips')).toBeInTheDocument();
	});

	it('handles sorting by name', async () => {
		render(ClipBrowser);
		
		const sortSelect = screen.getByDisplayValue('Sort by Name');
		await fireEvent.change(sortSelect, { target: { value: 'duration' } });

		// Should sort by duration
		expect(screen.getByDisplayValue('Sort by Duration')).toBeInTheDocument();
	});

	it('toggles sort order', async () => {
		render(ClipBrowser);
		
		const sortOrderButton = screen.getByLabelText('Toggle sort order');
		await fireEvent.click(sortOrderButton);

		// Should toggle from ascending to descending
		expect(sortOrderButton).toHaveTextContent('↓');
	});

	it('switches between grid and list view', async () => {
		render(ClipBrowser);
		
		const listViewButton = screen.getByLabelText('List view');
		await fireEvent.click(listViewButton);

		expect(listViewButton).toHaveClass('active');
		
		const gridViewButton = screen.getByLabelText('Grid view');
		await fireEvent.click(gridViewButton);

		expect(gridViewButton).toHaveClass('active');
	});

	it('selects a clip when clicked', async () => {
		const mockSetCurrentClip = vi.mocked(playbackStore.setCurrentClip);

		render(ClipBrowser);
		
		const clipButton = screen.getByLabelText('Select clip Clip_001.mov');
		await fireEvent.click(clipButton);

		expect(mockSetCurrentClip).toHaveBeenCalledWith(
			expect.objectContaining({ name: 'Clip_001.mov' }),
			0
		);
	});

	it('refreshes clip list when refresh button is clicked', async () => {
		const mockGetClipList = vi.mocked(cameraApi.getClipList);
		mockGetClipList.mockResolvedValue({ success: true, data: { clips: [] } });

		render(ClipBrowser);
		
		const refreshButton = screen.getByLabelText('Refresh clip list');
		await fireEvent.click(refreshButton);

		expect(mockGetClipList).toHaveBeenCalledWith(true);
	});

	it('handles clip deletion with confirmation', async () => {
		const mockDeleteClip = vi.mocked(cameraApi.deleteClip);
		mockDeleteClip.mockResolvedValue({ success: true });

		render(ClipBrowser);
		
		const deleteButton = screen.getByLabelText('Delete clip Clip_001.mov');
		await fireEvent.click(deleteButton);

		expect(window.confirm).toHaveBeenCalledWith(
			'Are you sure you want to delete "Clip_001.mov"? This action cannot be undone.'
		);
		expect(mockDeleteClip).toHaveBeenCalledWith('1');
	});

	it('shows loading state', () => {
		// Mock loading state
		const mockLoadingStore = {
			subscribe: vi.fn((callback) => {
				callback({
					clipList: [],
					clipListLoading: true,
					currentClip: null
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockLoadingStore.subscribe);

		render(ClipBrowser);
		
		expect(screen.getByText('Loading clips...')).toBeInTheDocument();
	});

	it('shows empty state when no clips', () => {
		// Mock empty state
		const mockEmptyStore = {
			subscribe: vi.fn((callback) => {
				callback({
					clipList: [],
					clipListLoading: false,
					currentClip: null
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockEmptyStore.subscribe);

		render(ClipBrowser);
		
		expect(screen.getByText('No Clips Found')).toBeInTheDocument();
		expect(screen.getByText('No clips are available for playback')).toBeInTheDocument();
	});

	it('shows no matching clips state when filtered', async () => {
		render(ClipBrowser);
		
		const searchInput = screen.getByPlaceholderText('Search clips...');
		await fireEvent.input(searchInput, { target: { value: 'nonexistent' } });

		expect(screen.getByText('No Matching Clips')).toBeInTheDocument();
		expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
	});

	it('clears search and filters', async () => {
		render(ClipBrowser);
		
		// Set some filters
		const searchInput = screen.getByPlaceholderText('Search clips...');
		await fireEvent.input(searchInput, { target: { value: 'test' } });

		const clearButton = screen.getByLabelText('Clear search');
		await fireEvent.click(clearButton);

		expect(searchInput.value).toBe('');
	});

	it('handles pagination', async () => {
		// Mock many clips to test pagination
		const manyClips = Array.from({ length: 20 }, (_, i) => ({
			id: `${i + 1}`,
			name: `Clip_${String(i + 1).padStart(3, '0')}.mov`,
			duration: '00:01:00:00',
			durationMs: 60000,
			resolution: '4K UHD',
			codec: 'ProRes',
			sizeBytes: 1000000,
			createdAt: '2024-01-01T10:00:00Z',
			thumbnailUrl: null
		}));

		const mockManyClipsStore = {
			subscribe: vi.fn((callback) => {
				callback({
					clipList: manyClips,
					clipListLoading: false,
					currentClip: null
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockManyClipsStore.subscribe);

		render(ClipBrowser);
		
		// Should show pagination
		expect(screen.getByLabelText('Next page')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument(); // Page 2 button
	});

	it('formats duration correctly', () => {
		render(ClipBrowser);
		
		// Duration should be formatted as HH:MM:SS
		expect(screen.getByText('01:30')).toBeInTheDocument(); // 90 seconds
		expect(screen.getByText('02:15')).toBeInTheDocument(); // 135 seconds
	});

	it('formats file size correctly', () => {
		render(ClipBrowser);
		
		// File sizes should be formatted with appropriate units
		expect(screen.getByText('976.6 MB')).toBeInTheDocument(); // ~1GB
		expect(screen.getByText('488.3 MB')).toBeInTheDocument(); // ~512MB
	});

	it('disables controls when disabled prop is true', () => {
		render(ClipBrowser, { disabled: true });
		
		const buttons = screen.getAllByRole('button');
		buttons.forEach(button => {
			expect(button).toBeDisabled();
		});
	});

	it('shows compact layout when compact prop is true', () => {
		render(ClipBrowser, { compact: true });
		
		const browser = screen.getByText('Clip Browser').closest('.clip-browser');
		expect(browser).toHaveClass('compact');
	});

	it('hides search when showSearch is false', () => {
		render(ClipBrowser, { showSearch: false });
		
		expect(screen.queryByPlaceholderText('Search clips...')).not.toBeInTheDocument();
	});

	it('hides filters when showFilters is false', () => {
		render(ClipBrowser, { showFilters: false });
		
		expect(screen.queryByDisplayValue('All Formats')).not.toBeInTheDocument();
	});

	it('handles API errors gracefully', async () => {
		const mockGetClipList = vi.mocked(cameraApi.getClipList);
		mockGetClipList.mockRejectedValue(new Error('Network error'));

		render(ClipBrowser);

		await waitFor(() => {
			expect(notificationStore.error).toHaveBeenCalledWith(
				'Clip List Failed',
				'Network error'
			);
		});
	});

	it('shows selected clip state', () => {
		// Mock selected clip state
		const mockSelectedStore = {
			subscribe: vi.fn((callback) => {
				callback({
					clipList: [
						{
							id: '1',
							name: 'Clip_001.mov',
							duration: '00:01:30:00',
							durationMs: 90000,
							resolution: '4K UHD',
							codec: 'ProRes',
							sizeBytes: 1024000000,
							createdAt: '2024-01-01T10:00:00Z',
							thumbnailUrl: null
						}
					],
					clipListLoading: false,
					currentClip: {
						id: '1',
						name: 'Clip_001.mov'
					}
				});
				return () => {};
			})
		};

		vi.mocked(mockPlaybackStore.subscribe).mockImplementation(mockSelectedStore.subscribe);

		render(ClipBrowser);
		
		const clipItem = screen.getByText('Clip_001.mov').closest('.clip-item');
		expect(clipItem).toHaveClass('selected');
	});
});"