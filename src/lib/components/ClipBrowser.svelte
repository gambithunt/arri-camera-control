<script lang="ts">
	import { onMount } from 'svelte';
	import { safeStoreAccess } from '$lib/dev/mockStores';
	
	// Safe store access with fallbacks
	const { playbackStore, notificationStore, cameraApi, isUsingMocks } = safeStoreAccess();
	
	// Props
	export let disabled = false;
	export let compact = false;
	export let showSearch = true;
	export let showFilters = true;
	
	// Reactive store subscriptions
	$: playbackState = $playbackStore;
	$: clips = playbackState.clipList;
	$: isLoading = playbackState.clipListLoading;
	$: currentClip = playbackState.currentClip;
	
	// Search and filter state
	let searchQuery = '';
	let selectedFormat = 'all';
	let selectedResolution = 'all';
	let sortBy = 'name'; // name, date, duration, size
	let sortOrder = 'asc'; // asc, desc
	let viewMode = 'grid'; // grid, list
	
	// Available filter options (derived from clips)
	$: availableFormats = [...new Set(clips.map(clip => clip.codec || 'Unknown'))];
	$: availableResolutions = [...new Set(clips.map(clip => clip.resolution || 'Unknown'))];
	
	// Filtered and sorted clips
	$: filteredClips = clips
		.filter(clip => {
			// Search filter
			if (searchQuery && !clip.name.toLowerCase().includes(searchQuery.toLowerCase())) {
				return false;
			}
			
			// Format filter
			if (selectedFormat !== 'all' && clip.codec !== selectedFormat) {
				return false;
			}
			
			// Resolution filter
			if (selectedResolution !== 'all' && clip.resolution !== selectedResolution) {
				return false;
			}
			
			return true;
		})
		.sort((a, b) => {
			let comparison = 0;
			
			switch (sortBy) {
				case 'name':
					comparison = a.name.localeCompare(b.name);
					break;
				case 'date':
					comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
					break;
				case 'duration':
					comparison = (a.durationMs || 0) - (b.durationMs || 0);
					break;
				case 'size':
					comparison = (a.sizeBytes || 0) - (b.sizeBytes || 0);
					break;
				default:
					comparison = 0;
			}
			
			return sortOrder === 'desc' ? -comparison : comparison;
		});
	
	// Pagination
	let currentPage = 1;
	const itemsPerPage = compact ? 12 : 8;
	$: totalPages = Math.ceil(filteredClips.length / itemsPerPage);
	$: paginatedClips = filteredClips.slice(
		(currentPage - 1) * itemsPerPage,
		currentPage * itemsPerPage
	);
	
	async function loadClips(refresh = false) {
		playbackStore.updateClipList([], true); // Set loading
		
		try {
			const result = await cameraApi.getClipList(refresh);
			if (result.success && result.data?.clips) {
				playbackStore.updateClipList(result.data.clips, false);
			} else {
				playbackStore.updateClipList([], false);
				if (refresh) {
					notificationStore.warning('No Clips Found', 'No clips available for playback');
				}
			}
		} catch (error) {
			playbackStore.updateClipList([], false);
			notificationStore.error('Clip List Failed', error instanceof Error ? error.message : 'Failed to load clips');
		}
	}
	
	async function selectClip(clip: any, index: number) {
		if (disabled) return;
		
		playbackStore.setCurrentClip(clip, index);
		notificationStore.success('Clip Selected', `Selected ${clip.name}`);
	}
	
	async function deleteClip(clip: any) {
		if (!confirm(`Are you sure you want to delete "${clip.name}"? This action cannot be undone.`)) {
			return;
		}
		
		try {
			const result = await cameraApi.deleteClip(clip.id);
			if (result.success) {
				notificationStore.success('Clip Deleted', `${clip.name} deleted successfully`);
				await loadClips(true); // Refresh the list
			} else {
				notificationStore.error('Delete Failed', result.error || 'Failed to delete clip');
			}
		} catch (error) {
			notificationStore.error('Delete Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	function formatDuration(durationMs: number): string {
		if (!durationMs) return '00:00:00';
		
		const totalSeconds = Math.floor(durationMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	
	function formatFileSize(sizeBytes: number): string {
		if (!sizeBytes) return 'Unknown';
		
		const units = ['B', 'KB', 'MB', 'GB', 'TB'];
		let size = sizeBytes;
		let unitIndex = 0;
		
		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}
		
		return `${size.toFixed(1)} ${units[unitIndex]}`;
	}
	
	function formatDate(dateString: string): string {
		if (!dateString) return 'Unknown';
		
		const date = new Date(dateString);
		return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}
	
	function getThumbnailUrl(clip: any): string {
		// Generate thumbnail URL or return placeholder
		return clip.thumbnailUrl || `data:image/svg+xml,${encodeURIComponent(`
			<svg width="160" height="90" xmlns="http://www.w3.org/2000/svg">
				<rect width="160" height="90" fill="#374151"/>
				<text x="80" y="45" text-anchor="middle" fill="#9CA3AF" font-family="Arial" font-size="12">
					${clip.name.substring(0, 12)}${clip.name.length > 12 ? '...' : ''}
				</text>
			</svg>
		`)}`;
	}
	
	function clearSearch() {
		searchQuery = '';
		selectedFormat = 'all';
		selectedResolution = 'all';
		currentPage = 1;
	}
	
	function changePage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}
	
	// Load clips on mount
	onMount(() => {
		loadClips();
	});
	
	// Reset page when filters change
	$: if (searchQuery || selectedFormat || selectedResolution) {
		currentPage = 1;
	}
</script>

<div class="clip-browser {compact ? 'compact' : ''}">
	<!-- Header -->
	<div class="browser-header">
		<div class="header-title">
			<h3 class="title">Clip Browser</h3>
			<div class="clip-count">
				{filteredClips.length} of {clips.length} clips
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
		</div>
		
		<div class="header-actions">
			<button 
				class="btn-refresh"
				on:click={() => loadClips(true)}
				disabled={disabled || isLoading}
				aria-label="Refresh clip list"
			>
				🔄
			</button>
			
			<button 
				class="btn-view-mode {viewMode === 'grid' ? 'active' : ''}"
				on:click={() => viewMode = 'grid'}
				disabled={disabled}
				aria-label="Grid view"
			>
				⊞
			</button>
			
			<button 
				class="btn-view-mode {viewMode === 'list' ? 'active' : ''}"
				on:click={() => viewMode = 'list'}
				disabled={disabled}
				aria-label="List view"
			>
				☰
			</button>
		</div>
	</div>
	
	<!-- Search and Filters -->
	{#if showSearch || showFilters}
		<div class="search-filters">
			{#if showSearch}
				<div class="search-container">
					<input
						type="text"
						class="search-input"
						placeholder="Search clips..."
						bind:value={searchQuery}
						disabled={disabled}
					/>
					{#if searchQuery}
						<button 
							class="btn-clear-search"
							on:click={clearSearch}
							aria-label="Clear search"
						>
							×
						</button>
					{/if}
				</div>
			{/if}
			
			{#if showFilters}
				<div class="filters-container">
					<select 
						class="filter-select"
						bind:value={selectedFormat}
						disabled={disabled}
					>
						<option value="all">All Formats</option>
						{#each availableFormats as format}
							<option value={format}>{format}</option>
						{/each}
					</select>
					
					<select 
						class="filter-select"
						bind:value={selectedResolution}
						disabled={disabled}
					>
						<option value="all">All Resolutions</option>
						{#each availableResolutions as resolution}
							<option value={resolution}>{resolution}</option>
						{/each}
					</select>
					
					<select 
						class="filter-select"
						bind:value={sortBy}
						disabled={disabled}
					>
						<option value="name">Sort by Name</option>
						<option value="date">Sort by Date</option>
						<option value="duration">Sort by Duration</option>
						<option value="size">Sort by Size</option>
					</select>
					
					<button 
						class="btn-sort-order"
						on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
						disabled={disabled}
						aria-label="Toggle sort order"
					>
						{sortOrder === 'asc' ? '↑' : '↓'}
					</button>
				</div>
			{/if}
		</div>
	{/if}
	
	<!-- Clip List -->
	<div class="clip-list">
		{#if isLoading}
			<div class="loading-state">
				<div class="loading-spinner large"></div>
				<p class="loading-text">Loading clips...</p>
			</div>
		{:else if filteredClips.length === 0}
			<div class="empty-state">
				{#if clips.length === 0}
					<div class="empty-icon">📹</div>
					<h4 class="empty-title">No Clips Found</h4>
					<p class="empty-description">No clips are available for playback</p>
					<button 
						class="btn-refresh-empty"
						on:click={() => loadClips(true)}
						disabled={disabled}
					>
						Refresh
					</button>
				{:else}
					<div class="empty-icon">🔍</div>
					<h4 class="empty-title">No Matching Clips</h4>
					<p class="empty-description">Try adjusting your search or filters</p>
					<button 
						class="btn-clear-filters"
						on:click={clearSearch}
					>
						Clear Filters
					</button>
				{/if}
			</div>
		{:else}
			<div class="clips-container {viewMode}">
				{#each paginatedClips as clip, index}
					<div class="clip-item {currentClip?.id === clip.id ? 'selected' : ''}">
						<button
							class="clip-button"
							on:click={() => selectClip(clip, (currentPage - 1) * itemsPerPage + index)}
							disabled={disabled}
							aria-label="Select clip {clip.name}"
						>
							{#if viewMode === 'grid'}
								<div class="clip-thumbnail">
									<img 
										src={getThumbnailUrl(clip)} 
										alt="Thumbnail for {clip.name}"
										class="thumbnail-image"
										loading="lazy"
									/>
									<div class="thumbnail-overlay">
										<div class="duration-badge">{formatDuration(clip.durationMs)}</div>
									</div>
								</div>
							{/if}
							
							<div class="clip-info">
								<div class="clip-name">{clip.name}</div>
								<div class="clip-metadata">
									{#if viewMode === 'list'}
										<span class="metadata-item">{formatDuration(clip.durationMs)}</span>
									{/if}
									<span class="metadata-item">{clip.resolution || 'Unknown'}</span>
									<span class="metadata-item">{clip.codec || 'Unknown'}</span>
									{#if viewMode === 'list'}
										<span class="metadata-item">{formatFileSize(clip.sizeBytes)}</span>
										<span class="metadata-item">{formatDate(clip.createdAt)}</span>
									{/if}
								</div>
							</div>
						</button>
						
						<button
							class="btn-delete-clip"
							on:click={() => deleteClip(clip)}
							disabled={disabled}
							aria-label="Delete clip {clip.name}"
						>
							🗑️
						</button>
					</div>
				{/each}
			</div>
			
			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="pagination">
					<button 
						class="btn-page"
						on:click={() => changePage(currentPage - 1)}
						disabled={currentPage === 1 || disabled}
						aria-label="Previous page"
					>
						‹
					</button>
					
					{#each Array(totalPages) as _, i}
						{@const page = i + 1}
						{#if page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1)}
							<button 
								class="btn-page {page === currentPage ? 'active' : ''}"
								on:click={() => changePage(page)}
								disabled={disabled}
							>
								{page}
							</button>
						{:else if page === currentPage - 2 || page === currentPage + 2}
							<span class="page-ellipsis">…</span>
						{/if}
					{/each}
					
					<button 
						class="btn-page"
						on:click={() => changePage(currentPage + 1)}
						disabled={currentPage === totalPages || disabled}
						aria-label="Next page"
					>
						›
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.clip-browser {
		@apply space-y-4;
	}
	
	.clip-browser.compact {
		@apply space-y-2;
	}
	
	.browser-header {
		@apply flex justify-between items-center;
	}
	
	.header-title {
		@apply flex items-center gap-3;
	}
	
	.title {
		@apply text-lg font-medium text-white;
	}
	
	.clip-count {
		@apply text-sm text-gray-400 flex items-center gap-2;
	}
	
	.loading-spinner {
		@apply w-4 h-4 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.loading-spinner.large {
		@apply w-8 h-8;
	}
	
	.header-actions {
		@apply flex gap-2;
	}
	
	.btn-refresh, .btn-view-mode {
		@apply w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg;
		@apply flex items-center justify-center transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-view-mode.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.search-filters {
		@apply space-y-3 bg-arri-gray rounded-lg p-4;
	}
	
	.search-container {
		@apply relative;
	}
	
	.search-input {
		@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 pr-10;
		@apply text-white placeholder-gray-400;
		@apply focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red;
	}
	
	.btn-clear-search {
		@apply absolute right-2 top-1/2 transform -translate-y-1/2;
		@apply w-6 h-6 flex items-center justify-center rounded-full;
		@apply hover:bg-gray-600 text-gray-400 hover:text-white;
	}
	
	.filters-container {
		@apply flex gap-2 flex-wrap;
	}
	
	.filter-select {
		@apply bg-gray-700 border border-gray-600 rounded-lg px-3 py-2;
		@apply text-white text-sm;
		@apply focus:outline-none focus:border-arri-red;
	}
	
	.btn-sort-order {
		@apply w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg;
		@apply flex items-center justify-center transition-colors;
		@apply disabled:opacity-50;
	}
	
	.clip-list {
		@apply min-h-96;
	}
	
	.loading-state {
		@apply flex flex-col items-center justify-center py-12 space-y-4;
	}
	
	.loading-text {
		@apply text-gray-400;
	}
	
	.empty-state {
		@apply flex flex-col items-center justify-center py-12 space-y-4 text-center;
	}
	
	.empty-icon {
		@apply text-4xl;
	}
	
	.empty-title {
		@apply text-lg font-medium text-white;
	}
	
	.empty-description {
		@apply text-gray-400;
	}
	
	.btn-refresh-empty, .btn-clear-filters {
		@apply bg-arri-red hover:bg-red-600 text-white px-4 py-2 rounded-lg;
		@apply transition-colors;
	}
	
	.clips-container {
		@apply space-y-2;
	}
	
	.clips-container.grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
		margin-top: 0;
		margin-bottom: 0;
	}
	
	.compact .clips-container.grid {
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}
	
	.clip-item {
		@apply relative bg-arri-gray rounded-lg overflow-hidden;
		@apply border-2 border-transparent transition-all duration-200;
	}
	
	.clip-item.selected {
		@apply border-arri-red bg-red-900 bg-opacity-20;
	}
	
	.clip-button {
		@apply w-full p-3 text-left hover:bg-gray-600 transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.clip-thumbnail {
		@apply relative mb-2 aspect-video bg-gray-800 rounded overflow-hidden;
	}
	
	.thumbnail-image {
		@apply w-full h-full object-cover;
	}
	
	.thumbnail-overlay {
		@apply absolute inset-0 bg-gradient-to-t from-black/50 to-transparent;
		@apply flex items-end justify-end p-2;
	}
	
	.duration-badge {
		@apply bg-black/70 text-white text-xs px-2 py-1 rounded;
	}
	
	.clip-info {
		@apply space-y-1;
	}
	
	.clip-name {
		@apply font-medium text-white truncate;
	}
	
	.clip-metadata {
		@apply flex flex-wrap gap-2 text-xs text-gray-400;
	}
	
	.metadata-item {
		@apply bg-gray-700 px-2 py-1 rounded;
	}
	
	.btn-delete-clip {
		@apply absolute top-2 right-2 w-8 h-8 bg-red-600 hover:bg-red-700;
		@apply rounded-full flex items-center justify-center text-white;
		@apply opacity-0 group-hover:opacity-100 transition-opacity;
	}
	
	.clip-item:hover .btn-delete-clip {
		@apply opacity-100;
	}
	
	.pagination {
		@apply flex justify-center items-center gap-2 mt-6;
	}
	
	.btn-page {
		@apply w-10 h-10 bg-gray-700 hover:bg-gray-600 text-white rounded-lg;
		@apply flex items-center justify-center transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-page.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.page-ellipsis {
		@apply text-gray-400 px-2;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.clips-container.grid {
			grid-template-columns: repeat(1, minmax(0, 1fr));
		}
		
		.filters-container {
			@apply flex-col;
		}
		
		.filter-select {
			@apply w-full;
		}
		
		.header-actions {
			@apply gap-1;
		}
		
		.btn-refresh, .btn-view-mode {
			@apply w-8 h-8 text-sm;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.clip-item {
			@apply border-white;
		}
		
		.clip-item.selected {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.clip-item {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
	}
</style>"