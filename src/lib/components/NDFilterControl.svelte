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
	$: currentNDFilter = cameraState.ndFilter;
	$: isLoading = cameraState.operations?.ndFilter || false;
	
	// ARRI camera ND filter values (typical for built-in ND filters)
	const ndFilterValues = [
		{ value: 0, label: '0', description: 'No filtration', stops: '0 stops' },
		{ value: 0.3, label: '0.3', description: 'Light reduction', stops: '1 stop' },
		{ value: 0.6, label: '0.6', description: 'Moderate reduction', stops: '2 stops' },
		{ value: 0.9, label: '0.9', description: 'Strong reduction', stops: '3 stops' },
		{ value: 1.2, label: '1.2', description: 'Very strong reduction', stops: '4 stops' },
		{ value: 1.5, label: '1.5', description: 'Maximum reduction', stops: '5 stops' },
		{ value: 1.8, label: '1.8', description: 'Ultra strong reduction', stops: '6 stops' },
		{ value: 2.1, label: '2.1', description: 'Extreme reduction', stops: '7 stops' }
	];
	
	// Custom ND input
	let showCustomInput = false;
	let customND = '';
	
	async function setNDFilter(stops: number) {
		if (disabled) return;
		
		// Validate ND value
		if (!isValidND(stops)) {
			notificationStore.error('Invalid ND Filter', `${stops} stops is not supported by this camera`);
			return;
		}
		
		cameraStore.setOperationLoading('ndFilter', true);
		
		try {
			const result = await cameraApi.setNDFilter(stops);
			if (result.success) {
				cameraStore.updateSettings({ ndFilter: stops });
				notificationStore.cameraCommandSuccess('ND Filter');
			} else {
				notificationStore.cameraCommandError('ND Filter', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('ND Filter', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('ndFilter', false);
		}
	}
	
	function isValidND(stops: number): boolean {
		// Check if ND is in standard list
		if (ndFilterValues.some(value => value.value === stops)) {
			return true;
		}
		
		// Allow custom ND values within reasonable bounds
		return stops >= 0 && stops <= 2.4 && stops % 0.1 === 0;
	}
	
	async function setCustomND() {
		const nd = parseFloat(customND);
		
		if (isNaN(nd)) {
			notificationStore.warning('Invalid Input', 'Please enter a valid number');
			return;
		}
		
		if (!isValidND(nd)) {
			notificationStore.error('Invalid ND Filter', 'ND filter must be between 0 and 2.4 stops');
			return;
		}
		
		await setNDFilter(nd);
		showCustomInput = false;
		customND = '';
	}
	
	function getNDDescription(stops: number): string {
		const ndValue = ndFilterValues.find(v => v.value === stops);
		return ndValue?.description || 'Custom ND value';
	}
	
	function getStopsDescription(stops: number): string {
		const ndValue = ndFilterValues.find(v => v.value === stops);
		if (ndValue) return ndValue.stops;
		
		// Calculate stops for custom values
		const calculatedStops = Math.round(stops / 0.3);
		return `${calculatedStops} stop${calculatedStops !== 1 ? 's' : ''}`;
	}
	
	function getExposureImpact(stops: number): string {
		if (stops === 0) return 'No exposure change';
		if (stops <= 0.6) return 'Slight exposure reduction';
		if (stops <= 1.2) return 'Moderate exposure reduction';
		if (stops <= 1.8) return 'Strong exposure reduction';
		return 'Maximum exposure reduction';
	}
	
	// Touch interaction helpers
	let touchStartTime = 0;
	let touchStartTarget: HTMLElement | null = null;
	
	function handleTouchStart(event: TouchEvent, stops: number) {
		touchStartTime = Date.now();
		touchStartTarget = event.currentTarget as HTMLElement;
		touchStartTarget.classList.add('touch-active');
	}
	
	function handleTouchEnd(event: TouchEvent, stops: number) {
		const touchDuration = Date.now() - touchStartTime;
		
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		
		// Only trigger if it was a quick tap
		if (touchDuration < 500 && touchStartTarget === event.currentTarget) {
			setNDFilter(stops);
		}
		
		touchStartTarget = null;
	}
	
	function handleTouchCancel() {
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		touchStartTarget = null;
	}
</script>

<div class="nd-control {compact ? 'compact' : ''}">
	{#if showLabel}
		<div class="control-header">
			<h3 class="control-title">ND Filter</h3>
			<div class="current-value">
				{currentNDFilter} ND
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
			<div class="current-description">
				{getNDDescription(currentNDFilter)}
			</div>
			<div class="stops-description">
				{getStopsDescription(currentNDFilter)}
			</div>
			<div class="exposure-impact">
				{getExposureImpact(currentNDFilter)}
			</div>
		</div>
	{/if}
	
	<!-- ND Filter Values Grid -->
	<div class="nd-grid {compact ? 'compact-grid' : ''}">
		{#each ndFilterValues as ndValue}
			<button
				class="nd-button {currentNDFilter === ndValue.value ? 'active' : ''}"
				on:click={() => setNDFilter(ndValue.value)}
				on:touchstart={(e) => handleTouchStart(e, ndValue.value)}
				on:touchend={(e) => handleTouchEnd(e, ndValue.value)}
				on:touchcancel={handleTouchCancel}
				disabled={disabled || isLoading}
				aria-label="Set ND filter to {ndValue.value} - {ndValue.description} ({ndValue.stops})"
			>
				<div class="nd-value">{ndValue.label}</div>
				{#if !compact}
					<div class="nd-stops">{ndValue.stops}</div>
					<div class="nd-description">{ndValue.description}</div>
				{:else}
					<div class="nd-stops-compact">{ndValue.stops}</div>
				{/if}
			</button>
		{/each}
	</div>
	
	<!-- Custom ND Input -->
	<div class="custom-nd">
		{#if !showCustomInput}
			<button 
				class="btn-custom"
				on:click={() => showCustomInput = true}
				disabled={disabled || isLoading}
			>
				<span class="custom-icon">+</span>
				Custom ND
			</button>
		{:else}
			<div class="custom-input-container">
				<input
					type="number"
					class="custom-input"
					placeholder="Enter ND value"
					bind:value={customND}
					min="0"
					max="2.4"
					step="0.1"
					on:keydown={(e) => {
						if (e.key === 'Enter') {
							setCustomND();
						} else if (e.key === 'Escape') {
							showCustomInput = false;
							customND = '';
						}
					}}
					autofocus
				/>
				<div class="input-help">
					Range: 0.0 to 2.4 (0 to 8 stops)
				</div>
				<div class="custom-actions">
					<button 
						class="btn-custom-action cancel"
						on:click={() => {
							showCustomInput = false;
							customND = '';
						}}
					>
						Cancel
					</button>
					<button 
						class="btn-custom-action set"
						on:click={setCustomND}
						disabled={!customND || isNaN(parseFloat(customND))}
					>
						Set
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.nd-control {
		@apply space-y-4;
	}
	
	.nd-control.compact {
		@apply space-y-2;
	}
	
	.control-header {
		@apply text-center space-y-1;
	}
	
	.control-title {
		@apply text-sm font-medium text-gray-300;
	}
	
	.current-value {
		@apply text-2xl font-bold flex items-center justify-center gap-2;
	}
	
	.current-description {
		@apply text-xs text-gray-400;
	}
	
	.stops-description {
		@apply text-sm text-blue-400 font-medium;
	}
	
	.exposure-impact {
		@apply text-xs text-yellow-400 italic;
	}
	
	.loading-spinner {
		@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.nd-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.nd-grid.compact-grid {
		@apply grid-cols-4 gap-2;
	}
	
	.nd-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4 transition-all duration-200;
		@apply min-h-touch flex flex-col items-center justify-center space-y-1;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.nd-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.nd-button.touch-active {
		@apply scale-95 bg-gray-500;
	}
	
	.nd-button.active.touch-active {
		@apply bg-red-700;
	}
	
	.compact .nd-button {
		@apply p-2;
	}
	
	.nd-value {
		@apply text-lg font-bold;
	}
	
	.compact .nd-value {
		@apply text-sm;
	}
	
	.nd-stops {
		@apply text-xs text-blue-300 font-medium;
	}
	
	.nd-stops-compact {
		@apply text-xs text-blue-300 font-medium;
	}
	
	.nd-description {
		@apply text-xs text-gray-300 text-center leading-tight;
	}
	
	.custom-nd {
		@apply border-t border-gray-600 pt-4;
	}
	
	.btn-custom {
		@apply w-full bg-gray-700 hover:bg-gray-600 text-white rounded-lg p-3;
		@apply min-h-touch flex items-center justify-center gap-2 transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.custom-icon {
		@apply text-xl font-bold;
	}
	
	.custom-input-container {
		@apply space-y-3;
	}
	
	.custom-input {
		@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3;
		@apply text-white text-center text-lg font-mono;
		@apply focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red;
	}
	
	.input-help {
		@apply text-xs text-gray-400 text-center;
	}
	
	.custom-actions {
		@apply flex gap-3;
	}
	
	.btn-custom-action {
		@apply flex-1 py-2 px-4 rounded-lg font-medium transition-colors;
		@apply min-h-touch;
	}
	
	.btn-custom-action.cancel {
		@apply bg-gray-600 hover:bg-gray-500 text-white;
	}
	
	.btn-custom-action.set {
		@apply bg-arri-red hover:bg-red-600 text-white;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	/* Touch feedback animations */
	@keyframes touch-feedback {
		0% { transform: scale(1); }
		50% { transform: scale(0.95); }
		100% { transform: scale(1); }
	}
	
	.nd-button:active {
		animation: touch-feedback 0.1s ease-in-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.nd-grid {
			@apply grid-cols-2 gap-2;
		}
		
		.nd-grid.compact-grid {
			@apply grid-cols-3;
		}
		
		.nd-button {
			@apply p-3;
		}
		
		.nd-value {
			@apply text-base;
		}
		
		.nd-description {
			@apply text-xs;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.nd-button {
			@apply border-white;
		}
		
		.nd-button.active {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.nd-button {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
		
		.nd-button:active {
			animation: none;
		}
	}
</style>"