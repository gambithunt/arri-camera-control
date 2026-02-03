<script lang="ts">
	import { safeStoreAccess } from '$lib/dev/mockStores';
	
	// Props
	export let disabled = false;
	export let showLabel = true;
	export let compact = false;
	
	// Safe store access with fallbacks
	const { cameraStore, notificationStore, cameraApi, isUsingMocks } = safeStoreAccess();
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: currentLUT = cameraState.currentLUT;
	$: isLoading = cameraState.operations?.lut || false;
	$: availableLUTs = cameraState.availableLUTs || [];
	
	// Standard ARRI LUTs
	const standardLUTs = [
		{ 
			name: 'Rec709', 
			description: 'Standard broadcast/web delivery',
			category: 'Standard',
			preview: 'linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1)'
		},
		{ 
			name: 'LogC', 
			description: 'ARRI LogC color space',
			category: 'Log',
			preview: 'linear-gradient(45deg, #8b7355, #a0956b, #b5a881)'
		},
		{ 
			name: 'LogC_to_Rec709', 
			description: 'LogC to Rec709 conversion',
			category: 'Conversion',
			preview: 'linear-gradient(45deg, #ff8a80, #80cbc4, #81c784)'
		},
		{ 
			name: 'Alexa_Classic', 
			description: 'Classic ALEXA look',
			category: 'Creative',
			preview: 'linear-gradient(45deg, #d32f2f, #388e3c, #1976d2)'
		},
		{ 
			name: 'K1S1', 
			description: 'ARRI K1S1 film emulation',
			category: 'Film',
			preview: 'linear-gradient(45deg, #8d6e63, #689f38, #303f9f)'
		},
		{ 
			name: 'None', 
			description: 'No LUT applied',
			category: 'Standard',
			preview: 'linear-gradient(45deg, #666, #888, #aaa)'
		}
	];
	
	// LUT categories for organization
	const lutCategories = ['All', 'Standard', 'Log', 'Conversion', 'Creative', 'Film', 'Custom'];
	let selectedCategory = 'All';
	
	// Custom LUT upload
	let showUploadDialog = false;
	let uploadingLUT = false;
	
	// Filtered LUTs based on category
	$: filteredLUTs = selectedCategory === 'All' 
		? [...standardLUTs, ...availableLUTs.filter(lut => !standardLUTs.some(std => std.name === lut.name))]
		: [...standardLUTs, ...availableLUTs].filter(lut => lut.category === selectedCategory);
	
	async function setLUT(lutName: string) {
		if (disabled) return;
		
		cameraStore.setOperationLoading('lut', true);
		
		try {
			const result = await cameraApi.setLUT(lutName);
			if (result.success) {
				cameraStore.updateSettings({ currentLUT: lutName });
				notificationStore.cameraCommandSuccess('LUT');
			} else {
				notificationStore.cameraCommandError('LUT', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('LUT', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('lut', false);
		}
	}
	
	async function loadLUTList() {
		try {
			const result = await cameraApi.getLUTList();
			if (result.success && result.data?.luts) {
				cameraStore.updateSettings({ availableLUTs: result.data.luts });
			} else {
				notificationStore.warning('LUT List', 'Could not load available LUTs');
			}
		} catch (error) {
			notificationStore.error('LUT List Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function uploadLUT(file: File) {
		if (!file) return;
		
		uploadingLUT = true;
		
		try {
			const result = await cameraApi.uploadLUT(file);
			if (result.success) {
				notificationStore.success('LUT Uploaded', `${file.name} uploaded successfully`);
				await loadLUTList(); // Refresh the list
				showUploadDialog = false;
			} else {
				notificationStore.error('Upload Failed', result.error || 'Failed to upload LUT');
			}
		} catch (error) {
			notificationStore.error('Upload Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			uploadingLUT = false;
		}
	}
	
	async function deleteLUT(lutName: string) {
		if (!confirm(`Are you sure you want to delete the LUT "${lutName}"?`)) {
			return;
		}
		
		try {
			const result = await cameraApi.deleteLUT(lutName);
			if (result.success) {
				notificationStore.success('LUT Deleted', `${lutName} deleted successfully`);
				await loadLUTList(); // Refresh the list
			} else {
				notificationStore.error('Delete Failed', result.error || 'Failed to delete LUT');
			}
		} catch (error) {
			notificationStore.error('Delete Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	function getLUTDescription(lutName: string): string {
		const lut = [...standardLUTs, ...availableLUTs].find(l => l.name === lutName);
		return lut?.description || 'Custom LUT';
	}
	
	function getLUTPreview(lutName: string): string {
		const lut = [...standardLUTs, ...availableLUTs].find(l => l.name === lutName);
		return lut?.preview || 'linear-gradient(45deg, #666, #888, #aaa)';
	}
	
	function isCustomLUT(lutName: string): boolean {
		return !standardLUTs.some(lut => lut.name === lutName);
	}
	
	// Touch interaction helpers
	let touchStartTime = 0;
	let touchStartTarget: HTMLElement | null = null;
	
	function handleTouchStart(event: TouchEvent, lutName: string) {
		touchStartTime = Date.now();
		touchStartTarget = event.currentTarget as HTMLElement;
		touchStartTarget.classList.add('touch-active');
	}
	
	function handleTouchEnd(event: TouchEvent, lutName: string) {
		const touchDuration = Date.now() - touchStartTime;
		
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		
		// Only trigger if it was a quick tap
		if (touchDuration < 500 && touchStartTarget === event.currentTarget) {
			setLUT(lutName);
		}
		
		touchStartTarget = null;
	}
	
	function handleTouchCancel() {
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		touchStartTarget = null;
	}
	
	// File upload handler
	function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			uploadLUT(file);
		}
	}
	
	// Load LUT list on component mount
	import { onMount } from 'svelte';
	onMount(() => {
		loadLUTList();
	});
</script>

<div class="lut-control {compact ? 'compact' : ''}">
	{#if showLabel}
		<div class="control-header">
			<h3 class="control-title">LUT (Look-Up Table)</h3>
			<div class="current-value">
				{currentLUT || 'None'}
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
			<div class="current-description">
				{getLUTDescription(currentLUT || 'None')}
			</div>
		</div>
	{/if}
	
	<!-- Current LUT Preview -->
	{#if currentLUT && currentLUT !== 'None'}
		<div class="current-lut-preview">
			<div class="preview-container">
				<div 
					class="lut-preview-large"
					style="background: {getLUTPreview(currentLUT)}"
				></div>
				<div class="preview-info">
					<div class="preview-name">{currentLUT}</div>
					<div class="preview-description">{getLUTDescription(currentLUT)}</div>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Category Filter -->
	<div class="category-filter">
		<div class="category-buttons">
			{#each lutCategories as category}
				<button
					class="category-button {selectedCategory === category ? 'active' : ''}"
					on:click={() => selectedCategory = category}
					disabled={disabled}
				>
					{category}
				</button>
			{/each}
		</div>
	</div>
	
	<!-- LUT Grid -->
	<div class="lut-grid {compact ? 'compact-grid' : ''}">
		{#each filteredLUTs as lut}
			<div class="lut-item">
				<button
					class="lut-button {currentLUT === lut.name ? 'active' : ''}"
					on:click={() => setLUT(lut.name)}
					on:touchstart={(e) => handleTouchStart(e, lut.name)}
					on:touchend={(e) => handleTouchEnd(e, lut.name)}
					on:touchcancel={handleTouchCancel}
					disabled={disabled || isLoading}
					aria-label="Apply LUT {lut.name} - {lut.description}"
				>
					<div 
						class="lut-preview"
						style="background: {lut.preview}"
					></div>
					<div class="lut-info">
						<div class="lut-name">{lut.name}</div>
						{#if !compact}
							<div class="lut-description">{lut.description}</div>
						{/if}
					</div>
				</button>
				
				{#if isCustomLUT(lut.name)}
					<button
						class="delete-button"
						on:click={() => deleteLUT(lut.name)}
						disabled={disabled || isLoading}
						aria-label="Delete LUT {lut.name}"
					>
						🗑️
					</button>
				{/if}
			</div>
		{/each}
	</div>
	
	<!-- LUT Management -->
	<div class="lut-management">
		<div class="management-buttons">
			<button 
				class="btn-management"
				on:click={loadLUTList}
				disabled={disabled || isLoading}
			>
				<span class="management-icon">🔄</span>
				Refresh
			</button>
			
			<button 
				class="btn-management"
				on:click={() => showUploadDialog = true}
				disabled={disabled || isLoading}
			>
				<span class="management-icon">📁</span>
				Upload LUT
			</button>
		</div>
	</div>
	
	<!-- Upload Dialog -->
	{#if showUploadDialog}
		<div class="upload-dialog">
			<div class="dialog-content">
				<h4 class="dialog-title">Upload Custom LUT</h4>
				<div class="upload-area">
					<input
						type="file"
						accept=".cube,.3dl,.lut"
						on:change={handleFileUpload}
						disabled={uploadingLUT}
						class="file-input"
						id="lut-upload"
					/>
					<label for="lut-upload" class="file-label">
						{#if uploadingLUT}
							<div class="loading-spinner"></div>
							Uploading...
						{:else}
							<span class="upload-icon">📤</span>
							Choose LUT File
						{/if}
					</label>
					<div class="upload-help">
						Supported formats: .cube, .3dl, .lut
					</div>
				</div>
				<div class="dialog-actions">
					<button 
						class="btn-dialog cancel"
						on:click={() => showUploadDialog = false}
						disabled={uploadingLUT}
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.lut-control {
		@apply space-y-4;
	}
	
	.lut-control.compact {
		@apply space-y-2;
	}
	
	.control-header {
		@apply text-center space-y-1;
	}
	
	.control-title {
		@apply text-sm font-medium text-gray-300;
	}
	
	.current-value {
		@apply text-xl font-bold flex items-center justify-center gap-2;
	}
	
	.current-description {
		@apply text-xs text-gray-400;
	}
	
	.loading-spinner {
		@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.current-lut-preview {
		@apply bg-arri-gray rounded-lg p-4;
	}
	
	.preview-container {
		@apply flex items-center gap-4;
	}
	
	.lut-preview-large {
		@apply w-16 h-10 rounded border border-gray-600 flex-shrink-0;
	}
	
	.preview-info {
		@apply flex-1;
	}
	
	.preview-name {
		@apply font-medium text-white;
	}
	
	.preview-description {
		@apply text-sm text-gray-400;
	}
	
	.category-filter {
		@apply border-b border-gray-600 pb-3;
	}
	
	.category-buttons {
		@apply flex flex-wrap gap-2 justify-center;
	}
	
	.category-button {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1 px-3 rounded;
		@apply transition-colors disabled:opacity-50;
	}
	
	.category-button.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.lut-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.lut-grid.compact-grid {
		@apply grid-cols-3 gap-2;
	}
	
	.lut-item {
		@apply relative;
	}
	
	.lut-button {
		@apply w-full bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-3 transition-all duration-200;
		@apply min-h-touch flex flex-col items-center space-y-2;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.lut-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.lut-button.touch-active {
		@apply scale-95 bg-gray-500;
	}
	
	.lut-button.active.touch-active {
		@apply bg-red-700;
	}
	
	.compact .lut-button {
		@apply p-2;
	}
	
	.lut-preview {
		@apply w-full h-8 rounded border border-gray-600;
	}
	
	.compact .lut-preview {
		@apply h-6;
	}
	
	.lut-info {
		@apply text-center space-y-1;
	}
	
	.lut-name {
		@apply text-sm font-medium;
	}
	
	.compact .lut-name {
		@apply text-xs;
	}
	
	.lut-description {
		@apply text-xs text-gray-300 leading-tight;
	}
	
	.delete-button {
		@apply absolute -top-1 -right-1 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full;
		@apply flex items-center justify-center text-xs transition-colors;
	}
	
	.lut-management {
		@apply border-t border-gray-600 pt-4;
	}
	
	.management-buttons {
		@apply flex gap-3 justify-center;
	}
	
	.btn-management {
		@apply bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2;
		@apply min-h-touch flex items-center gap-2 transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.management-icon {
		@apply text-lg;
	}
	
	.upload-dialog {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
	}
	
	.dialog-content {
		@apply bg-arri-gray rounded-lg p-6 w-full max-w-sm space-y-4;
	}
	
	.dialog-title {
		@apply text-lg font-medium text-center;
	}
	
	.upload-area {
		@apply space-y-3;
	}
	
	.file-input {
		@apply hidden;
	}
	
	.file-label {
		@apply w-full bg-gray-700 hover:bg-gray-600 text-white rounded-lg p-4;
		@apply min-h-touch flex items-center justify-center gap-2 cursor-pointer;
		@apply border-2 border-dashed border-gray-500 hover:border-gray-400 transition-colors;
	}
	
	.upload-icon {
		@apply text-xl;
	}
	
	.upload-help {
		@apply text-xs text-gray-400 text-center;
	}
	
	.dialog-actions {
		@apply flex justify-center;
	}
	
	.btn-dialog {
		@apply py-2 px-4 rounded-lg font-medium transition-colors min-h-touch;
	}
	
	.btn-dialog.cancel {
		@apply bg-gray-600 hover:bg-gray-500 text-white;
	}
	
	/* Touch feedback animations */
	@keyframes touch-feedback {
		0% { transform: scale(1); }
		50% { transform: scale(0.95); }
		100% { transform: scale(1); }
	}
	
	.lut-button:active {
		animation: touch-feedback 0.1s ease-in-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.lut-grid {
			@apply grid-cols-2 gap-2;
		}
		
		.lut-button {
			@apply p-2;
		}
		
		.lut-name {
			@apply text-xs;
		}
		
		.category-buttons {
			@apply gap-1;
		}
		
		.category-button {
			@apply text-xs px-2;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.lut-button {
			@apply border-white;
		}
		
		.lut-button.active {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.lut-button {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
		
		.lut-button:active {
			animation: none;
		}
	}
</style>"