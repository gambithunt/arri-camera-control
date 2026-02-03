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
	$: currentISO = cameraState.iso;
	$: isLoading = cameraState.operations?.iso || false;
	
	// ARRI camera ISO/EI values (typical ranges for ALEXA series)
	const standardISOValues = [
		{ value: 160, label: '160', description: 'Base ISO (lowest noise)' },
		{ value: 200, label: '200', description: 'Low light optimized' },
		{ value: 320, label: '320', description: 'Standard low' },
		{ value: 400, label: '400', description: 'Standard' },
		{ value: 500, label: '500', description: 'Balanced' },
		{ value: 640, label: '640', description: 'Standard high' },
		{ value: 800, label: '800', description: 'High sensitivity' },
		{ value: 1000, label: '1000', description: 'Very high' },
		{ value: 1280, label: '1280', description: 'Maximum standard' },
		{ value: 1600, label: '1600', description: 'High noise' },
		{ value: 2000, label: '2000', description: 'Very high noise' },
		{ value: 3200, label: '3200', description: 'Maximum (high noise)' }
	];
	
	// Custom ISO input
	let showCustomInput = false;
	let customISO = '';
	
	async function setISO(iso: number) {
		if (disabled) return;
		
		// Validate ISO value
		if (!isValidISO(iso)) {
			notificationStore.error('Invalid ISO', `ISO ${iso} is not supported by this camera`);
			return;
		}
		
		cameraStore.setOperationLoading('iso', true);
		
		try {
			const result = await cameraApi.setISO(iso);
			if (result.success) {
				cameraStore.updateSettings({ iso });
				notificationStore.cameraCommandSuccess('ISO');
			} else {
				notificationStore.cameraCommandError('ISO', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('ISO', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('iso', false);
		}
	}
	
	function isValidISO(iso: number): boolean {
		// Check if ISO is in standard list
		if (standardISOValues.some(value => value.value === iso)) {
			return true;
		}
		
		// Allow custom ISO values within ARRI camera bounds
		return iso >= 160 && iso <= 3200 && Number.isInteger(iso);
	}
	
	async function setCustomISO() {
		const iso = parseInt(customISO);
		
		if (isNaN(iso)) {
			notificationStore.warning('Invalid Input', 'Please enter a valid number');
			return;
		}
		
		if (!isValidISO(iso)) {
			notificationStore.error('Invalid ISO', 'ISO must be between 160 and 3200');
			return;
		}
		
		await setISO(iso);
		showCustomInput = false;
		customISO = '';
	}
	
	function getISODescription(iso: number): string {
		const isoValue = standardISOValues.find(v => v.value === iso);
		return isoValue?.description || 'Custom ISO value';
	}
	
	function getExposureImpact(iso: number): string {
		if (iso <= 200) return 'Cleanest image, lowest noise';
		if (iso <= 400) return 'Good balance of sensitivity and noise';
		if (iso <= 800) return 'Higher sensitivity, moderate noise';
		if (iso <= 1600) return 'High sensitivity, noticeable noise';
		return 'Maximum sensitivity, high noise';
	}
	
	// Touch interaction helpers
	let touchStartTime = 0;
	let touchStartTarget: HTMLElement | null = null;
	
	function handleTouchStart(event: TouchEvent, iso: number) {
		touchStartTime = Date.now();
		touchStartTarget = event.currentTarget as HTMLElement;
		touchStartTarget.classList.add('touch-active');
	}
	
	function handleTouchEnd(event: TouchEvent, iso: number) {
		const touchDuration = Date.now() - touchStartTime;
		
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		
		// Only trigger if it was a quick tap
		if (touchDuration < 500 && touchStartTarget === event.currentTarget) {
			setISO(iso);
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

<div class="iso-control {compact ? 'compact' : ''}">
	{#if showLabel}
		<div class="control-header">
			<h3 class="control-title">ISO/EI</h3>
			<div class="current-value">
				ISO {currentISO}
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
			<div class="current-description">
				{getISODescription(currentISO)}
			</div>
			<div class="exposure-impact">
				{getExposureImpact(currentISO)}
			</div>
		</div>
	{/if}
	
	<!-- Standard ISO Values Grid -->
	<div class="iso-grid {compact ? 'compact-grid' : ''}">
		{#each standardISOValues as isoValue}
			<button
				class="iso-button {currentISO === isoValue.value ? 'active' : ''}"
				on:click={() => setISO(isoValue.value)}
				on:touchstart={(e) => handleTouchStart(e, isoValue.value)}
				on:touchend={(e) => handleTouchEnd(e, isoValue.value)}
				on:touchcancel={handleTouchCancel}
				disabled={disabled || isLoading}
				aria-label="Set ISO to {isoValue.value} - {isoValue.description}"
			>
				<div class="iso-value">{isoValue.label}</div>
				{#if !compact}
					<div class="iso-description">{isoValue.description}</div>
				{/if}
			</button>
		{/each}
	</div>
	
	<!-- Custom ISO Input -->
	<div class="custom-iso">
		{#if !showCustomInput}
			<button 
				class="btn-custom"
				on:click={() => showCustomInput = true}
				disabled={disabled || isLoading}
			>
				<span class="custom-icon">+</span>
				Custom ISO
			</button>
		{:else}
			<div class="custom-input-container">
				<input
					type="number"
					class="custom-input"
					placeholder="Enter ISO"
					bind:value={customISO}
					min="160"
					max="3200"
					step="1"
					on:keydown={(e) => {
						if (e.key === 'Enter') {
							setCustomISO();
						} else if (e.key === 'Escape') {
							showCustomInput = false;
							customISO = '';
						}
					}}
					autofocus
				/>
				<div class="custom-actions">
					<button 
						class="btn-custom-action cancel"
						on:click={() => {
							showCustomInput = false;
							customISO = '';
						}}
					>
						Cancel
					</button>
					<button 
						class="btn-custom-action set"
						on:click={setCustomISO}
						disabled={!customISO || isNaN(parseInt(customISO))}
					>
						Set
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.iso-control {
		@apply space-y-4;
	}
	
	.iso-control.compact {
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
	
	.exposure-impact {
		@apply text-xs text-yellow-400 italic;
	}
	
	.loading-spinner {
		@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.iso-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.iso-grid.compact-grid {
		@apply grid-cols-3 gap-2;
	}
	
	.iso-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4 transition-all duration-200;
		@apply min-h-touch flex flex-col items-center justify-center space-y-1;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.iso-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.iso-button.touch-active {
		@apply scale-95 bg-gray-500;
	}
	
	.iso-button.active.touch-active {
		@apply bg-red-700;
	}
	
	.compact .iso-button {
		@apply p-3;
	}
	
	.iso-value {
		@apply text-lg font-bold;
	}
	
	.compact .iso-value {
		@apply text-base;
	}
	
	.iso-description {
		@apply text-xs text-gray-300 text-center leading-tight;
	}
	
	.custom-iso {
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
	
	/* Touch feedback animations */
	@keyframes touch-feedback {
		0% { transform: scale(1); }
		50% { transform: scale(0.95); }
		100% { transform: scale(1); }
	}
	
	.iso-button:active {
		animation: touch-feedback 0.1s ease-in-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.iso-grid {
			@apply grid-cols-2 gap-2;
		}
		
		.iso-button {
			@apply p-3;
		}
		
		.iso-value {
			@apply text-base;
		}
		
		.iso-description {
			@apply text-xs;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.iso-button {
			@apply border-white;
		}
		
		.iso-button.active {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.iso-button {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
		
		.iso-button:active {
			animation: none;
		}
	}
</style>"