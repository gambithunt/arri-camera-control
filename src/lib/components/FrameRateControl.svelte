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
	$: currentFrameRate = cameraState.frameRate;
	$: isLoading = cameraState.operations?.frameRate || false;
	
	// Show dev mode indicator
	$: if (isUsingMocks) {
		console.log('FrameRateControl: Using mock stores for UI testing');
	}
	
	// Supported frame rates for ARRI cameras
	const supportedFrameRates = [
		{ value: 23.98, label: '23.98', description: 'Cinema standard' },
		{ value: 24, label: '24', description: 'Film standard' },
		{ value: 25, label: '25', description: 'PAL standard' },
		{ value: 29.97, label: '29.97', description: 'NTSC standard' },
		{ value: 30, label: '30', description: 'Progressive' },
		{ value: 50, label: '50', description: 'PAL high frame rate' },
		{ value: 59.94, label: '59.94', description: 'NTSC high frame rate' },
		{ value: 60, label: '60', description: 'High frame rate' },
		{ value: 120, label: '120', description: 'Slow motion' },
		{ value: 240, label: '240', description: 'Ultra slow motion' }
	];
	
	// Custom frame rate input
	let showCustomInput = false;
	let customFrameRate = '';
	
	async function setFrameRate(fps: number) {
		if (disabled) return;
		
		// Validate frame rate
		if (!isValidFrameRate(fps)) {
			notificationStore.error('Invalid Frame Rate', `${fps} fps is not supported by this camera`);
			return;
		}
		
		cameraStore.update(state => ({
			...state,
			operations: { ...state.operations, frameRate: true }
		}));
		
		try {
			const result = await cameraApi.setFrameRate(fps);
			if (result.success) {
				cameraStore.update(state => ({ ...state, frameRate: fps }));
				notificationStore.cameraCommandSuccess('Frame Rate');
			} else {
				notificationStore.cameraCommandError('Frame Rate', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('Frame Rate', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.update(state => ({
				...state,
				operations: { ...state.operations, frameRate: false }
			}));
		}
	}
	
	function isValidFrameRate(fps: number): boolean {
		// Check if frame rate is in supported list
		if (supportedFrameRates.some(rate => rate.value === fps)) {
			return true;
		}
		
		// Allow custom frame rates within reasonable bounds
		return fps >= 1 && fps <= 300 && fps % 0.01 === 0;
	}
	
	async function setCustomFrameRate() {
		const fps = parseFloat(customFrameRate);
		
		if (isNaN(fps)) {
			notificationStore.warning('Invalid Input', 'Please enter a valid number');
			return;
		}
		
		if (!isValidFrameRate(fps)) {
			notificationStore.error('Invalid Frame Rate', 'Frame rate must be between 1 and 300 fps');
			return;
		}
		
		await setFrameRate(fps);
		showCustomInput = false;
		customFrameRate = '';
	}
	
	function getFrameRateDescription(fps: number): string {
		const rate = supportedFrameRates.find(r => r.value === fps);
		return rate?.description || 'Custom frame rate';
	}
	
	// Touch interaction helpers
	let touchStartTime = 0;
	let touchStartTarget: HTMLElement | null = null;
	
	function handleTouchStart(event: TouchEvent, fps: number) {
		touchStartTime = Date.now();
		touchStartTarget = event.currentTarget as HTMLElement;
		touchStartTarget.classList.add('touch-active');
	}
	
	function handleTouchEnd(event: TouchEvent, fps: number) {
		const touchDuration = Date.now() - touchStartTime;
		
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		
		// Only trigger if it was a quick tap (not a long press or drag)
		if (touchDuration < 500 && touchStartTarget === event.currentTarget) {
			setFrameRate(fps);
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

<div class="frame-rate-control {compact ? 'compact' : ''}">
	{#if showLabel}
		<div class="control-header">
			<h3 class="control-title">Frame Rate</h3>
			<div class="current-value">
				{currentFrameRate} fps
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
			<div class="current-description">
				{getFrameRateDescription(currentFrameRate)}
			</div>
		</div>
	{/if}
	
	<!-- Standard Frame Rates Grid -->
	<div class="frame-rate-grid {compact ? 'compact-grid' : ''}">
		{#each supportedFrameRates as rate}
			<button
				class="frame-rate-button {currentFrameRate === rate.value ? 'active' : ''}"
				on:click={() => setFrameRate(rate.value)}
				on:touchstart={(e) => handleTouchStart(e, rate.value)}
				on:touchend={(e) => handleTouchEnd(e, rate.value)}
				on:touchcancel={handleTouchCancel}
				disabled={disabled || isLoading}
				aria-label="Set frame rate to {rate.value} fps - {rate.description}"
			>
				<div class="rate-value">{rate.label}</div>
				{#if !compact}
					<div class="rate-description">{rate.description}</div>
				{/if}
			</button>
		{/each}
	</div>
	
	<!-- Custom Frame Rate Input -->
	<div class="custom-frame-rate">
		{#if !showCustomInput}
			<button 
				class="btn-custom"
				on:click={() => showCustomInput = true}
				disabled={disabled || isLoading}
			>
				<span class="custom-icon">+</span>
				Custom Frame Rate
			</button>
		{:else}
			<div class="custom-input-container">
				<input
					type="number"
					class="custom-input"
					placeholder="Enter fps"
					bind:value={customFrameRate}
					min="1"
					max="300"
					step="0.01"
					on:keydown={(e) => {
						if (e.key === 'Enter') {
							setCustomFrameRate();
						} else if (e.key === 'Escape') {
							showCustomInput = false;
							customFrameRate = '';
						}
					}}
					autofocus
				/>
				<div class="custom-actions">
					<button 
						class="btn-custom-action cancel"
						on:click={() => {
							showCustomInput = false;
							customFrameRate = '';
						}}
					>
						Cancel
					</button>
					<button 
						class="btn-custom-action set"
						on:click={setCustomFrameRate}
						disabled={!customFrameRate || isNaN(parseFloat(customFrameRate))}
					>
						Set
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.frame-rate-control {
		@apply space-y-4;
	}
	
	.frame-rate-control.compact {
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
	
	.loading-spinner {
		@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.frame-rate-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.frame-rate-grid.compact-grid {
		@apply grid-cols-3 gap-2;
	}
	
	.frame-rate-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4 transition-all duration-200;
		@apply min-h-touch flex flex-col items-center justify-center space-y-1;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.frame-rate-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.frame-rate-button.touch-active {
		@apply scale-95 bg-gray-500;
	}
	
	.frame-rate-button.active.touch-active {
		@apply bg-red-700;
	}
	
	.compact .frame-rate-button {
		@apply p-3;
	}
	
	.rate-value {
		@apply text-lg font-bold;
	}
	
	.compact .rate-value {
		@apply text-base;
	}
	
	.rate-description {
		@apply text-xs text-gray-300 text-center leading-tight;
	}
	
	.custom-frame-rate {
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
</style>