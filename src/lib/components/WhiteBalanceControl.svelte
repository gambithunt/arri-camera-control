<script lang="ts">
	import { cameraStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Props
	export let disabled = false;
	export let showLabel = true;
	export let compact = false;
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: currentWhiteBalance = cameraState.whiteBalance;
	$: isLoading = cameraState.operations?.whiteBalance || false;
	
	// White balance presets for common lighting conditions
	const whiteBalancePresets = [
		{ kelvin: 2700, name: 'Tungsten', description: 'Incandescent bulbs', icon: '💡' },
		{ kelvin: 3200, name: 'Tungsten Pro', description: 'Professional tungsten', icon: '🎬' },
		{ kelvin: 4300, name: 'Fluorescent', description: 'Cool white fluorescent', icon: '💡' },
		{ kelvin: 5600, name: 'Daylight', description: 'Noon sun / HMI', icon: '☀️' },
		{ kelvin: 6500, name: 'Cloudy', description: 'Overcast daylight', icon: '☁️' },
		{ kelvin: 7500, name: 'Shade', description: 'Open shade', icon: '🌳' },
		{ kelvin: 9000, name: 'Blue Hour', description: 'Deep blue sky', icon: '🌅' }
	];
	
	// Custom white balance input
	let showCustomInput = false;
	let customKelvin = '';
	let customTint = '';
	
	// Slider interaction state
	let isDraggingKelvin = false;
	let isDraggingTint = false;
	
	async function setWhiteBalance(kelvin: number, tint?: number) {
		if (disabled) return;
		
		// Validate white balance values
		if (!isValidKelvin(kelvin)) {
			notificationStore.error('Invalid White Balance', `${kelvin}K is outside the valid range (1000K - 15000K)`);
			return;
		}
		
		if (tint !== undefined && !isValidTint(tint)) {
			notificationStore.error('Invalid Tint', 'Tint must be between -100 and +100');
			return;
		}
		
		cameraStore.setOperationLoading('whiteBalance', true);
		
		try {
			const result = await cameraApi.setWhiteBalance(kelvin, tint);
			if (result.success) {
				cameraStore.updateSettings({ 
					whiteBalance: { 
						kelvin, 
						tint: tint !== undefined ? tint : currentWhiteBalance.tint 
					} 
				});
				notificationStore.cameraCommandSuccess('White Balance');
			} else {
				notificationStore.cameraCommandError('White Balance', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('White Balance', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('whiteBalance', false);
		}
	}
	
	function isValidKelvin(kelvin: number): boolean {
		return kelvin >= 1000 && kelvin <= 15000;
	}
	
	function isValidTint(tint: number): boolean {
		return tint >= -100 && tint <= 100;
	}
	
	async function setCustomWhiteBalance() {
		const kelvin = parseInt(customKelvin);
		const tint = customTint ? parseFloat(customTint) : undefined;
		
		if (isNaN(kelvin)) {
			notificationStore.warning('Invalid Input', 'Please enter a valid Kelvin value');
			return;
		}
		
		if (customTint && isNaN(tint!)) {
			notificationStore.warning('Invalid Input', 'Please enter a valid tint value');
			return;
		}
		
		await setWhiteBalance(kelvin, tint);
		showCustomInput = false;
		customKelvin = '';
		customTint = '';
	}
	
	function getColorTemperatureColor(kelvin: number): string {
		// Approximate color temperature to RGB for visual feedback
		if (kelvin < 3000) return '#ff8c00'; // Orange
		if (kelvin < 4000) return '#ffa500'; // Light orange
		if (kelvin < 5000) return '#ffff99'; // Warm white
		if (kelvin < 6000) return '#ffffff'; // White
		if (kelvin < 7000) return '#e6f3ff'; // Cool white
		return '#cce7ff'; // Blue
	}
	
	function getTintColor(tint: number): string {
		if (tint < -20) return '#ff99ff'; // Magenta
		if (tint < 0) return '#ffccff'; // Light magenta
		if (tint > 20) return '#99ff99'; // Green
		if (tint > 0) return '#ccffcc'; // Light green
		return '#ffffff'; // Neutral
	}
	
	// Touch interaction helpers
	let touchStartTime = 0;
	let touchStartTarget: HTMLElement | null = null;
	
	function handleTouchStart(event: TouchEvent, kelvin: number) {
		touchStartTime = Date.now();
		touchStartTarget = event.currentTarget as HTMLElement;
		touchStartTarget.classList.add('touch-active');
	}
	
	function handleTouchEnd(event: TouchEvent, kelvin: number) {
		const touchDuration = Date.now() - touchStartTime;
		
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		
		// Only trigger if it was a quick tap
		if (touchDuration < 500 && touchStartTarget === event.currentTarget) {
			setWhiteBalance(kelvin);
		}
		
		touchStartTarget = null;
	}
	
	function handleTouchCancel() {
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		touchStartTarget = null;
	}
	
	// Slider change handlers with debouncing
	let kelvinTimeout: number;
	let tintTimeout: number;
	
	function handleKelvinChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const kelvin = parseInt(target.value);
		
		// Clear previous timeout
		if (kelvinTimeout) clearTimeout(kelvinTimeout);
		
		// Update local state immediately for responsive UI
		cameraStore.updateSettings({
			whiteBalance: { ...currentWhiteBalance, kelvin }
		});
		
		// Debounce API call
		kelvinTimeout = setTimeout(() => {
			if (!isDraggingKelvin) {
				setWhiteBalance(kelvin, currentWhiteBalance.tint);
			}
		}, 300);
	}
	
	function handleTintChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const tint = parseFloat(target.value);
		
		// Clear previous timeout
		if (tintTimeout) clearTimeout(tintTimeout);
		
		// Update local state immediately for responsive UI
		cameraStore.updateSettings({
			whiteBalance: { ...currentWhiteBalance, tint }
		});
		
		// Debounce API call
		tintTimeout = setTimeout(() => {
			if (!isDraggingTint) {
				setWhiteBalance(currentWhiteBalance.kelvin, tint);
			}
		}, 300);
	}
	
	function handleSliderMouseUp(type: 'kelvin' | 'tint') {
		if (type === 'kelvin') {
			isDraggingKelvin = false;
			setWhiteBalance(currentWhiteBalance.kelvin, currentWhiteBalance.tint);
		} else {
			isDraggingTint = false;
			setWhiteBalance(currentWhiteBalance.kelvin, currentWhiteBalance.tint);
		}
	}
</script>

<div class="white-balance-control {compact ? 'compact' : ''}">
	{#if showLabel}
		<div class="control-header">
			<h3 class="control-title">White Balance</h3>
			<div class="current-value">
				<div class="kelvin-display">
					{currentWhiteBalance.kelvin}K
					<div 
						class="color-indicator" 
						style="background-color: {getColorTemperatureColor(currentWhiteBalance.kelvin)}"
					></div>
				</div>
				{#if currentWhiteBalance.tint !== 0}
					<div class="tint-display">
						{currentWhiteBalance.tint > 0 ? '+' : ''}{currentWhiteBalance.tint.toFixed(1)}
						<div 
							class="tint-indicator" 
							style="background-color: {getTintColor(currentWhiteBalance.tint)}"
						></div>
					</div>
				{/if}
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
		</div>
	{/if}
	
	<!-- Fine Control Sliders -->
	<div class="slider-controls">
		<div class="slider-group">
			<label class="slider-label" for="kelvin-slider">
				<span class="label-text">Kelvin</span>
				<span class="label-value">{currentWhiteBalance.kelvin}K</span>
			</label>
			<input
				id="kelvin-slider"
				type="range"
				class="kelvin-slider"
				min="1000"
				max="15000"
				step="100"
				value={currentWhiteBalance.kelvin}
				on:input={handleKelvinChange}
				on:mousedown={() => isDraggingKelvin = true}
				on:mouseup={() => handleSliderMouseUp('kelvin')}
				on:touchstart={() => isDraggingKelvin = true}
				on:touchend={() => handleSliderMouseUp('kelvin')}
				disabled={disabled || isLoading}
				style="background: linear-gradient(to right, #ff8c00 0%, #ffff99 25%, #ffffff 50%, #e6f3ff 75%, #cce7ff 100%)"
			/>
		</div>
		
		<div class="slider-group">
			<label class="slider-label" for="tint-slider">
				<span class="label-text">Tint</span>
				<span class="label-value">{currentWhiteBalance.tint > 0 ? '+' : ''}{currentWhiteBalance.tint.toFixed(1)}</span>
			</label>
			<input
				id="tint-slider"
				type="range"
				class="tint-slider"
				min="-100"
				max="100"
				step="0.1"
				value={currentWhiteBalance.tint}
				on:input={handleTintChange}
				on:mousedown={() => isDraggingTint = true}
				on:mouseup={() => handleSliderMouseUp('tint')}
				on:touchstart={() => isDraggingTint = true}
				on:touchend={() => handleSliderMouseUp('tint')}
				disabled={disabled || isLoading}
				style="background: linear-gradient(to right, #ff99ff 0%, #ffffff 50%, #99ff99 100%)"
			/>
		</div>
	</div>
	
	<!-- Preset Buttons -->
	<div class="presets-section">
		<h4 class="presets-title">Presets</h4>
		<div class="presets-grid {compact ? 'compact-grid' : ''}">
			{#each whiteBalancePresets as preset}
				<button
					class="preset-button {currentWhiteBalance.kelvin === preset.kelvin ? 'active' : ''}"
					on:click={() => setWhiteBalance(preset.kelvin)}
					on:touchstart={(e) => handleTouchStart(e, preset.kelvin)}
					on:touchend={(e) => handleTouchEnd(e, preset.kelvin)}
					on:touchcancel={handleTouchCancel}
					disabled={disabled || isLoading}
					aria-label="Set white balance to {preset.kelvin}K - {preset.description}"
				>
					<div class="preset-icon">{preset.icon}</div>
					<div class="preset-info">
						<div class="preset-name">{preset.name}</div>
						<div class="preset-kelvin">{preset.kelvin}K</div>
						{#if !compact}
							<div class="preset-description">{preset.description}</div>
						{/if}
					</div>
					<div 
						class="preset-color" 
						style="background-color: {getColorTemperatureColor(preset.kelvin)}"
					></div>
				</button>
			{/each}
		</div>
	</div>
	
	<!-- Custom White Balance Input -->
	<div class="custom-white-balance">
		{#if !showCustomInput}
			<button 
				class="btn-custom"
				on:click={() => showCustomInput = true}
				disabled={disabled || isLoading}
			>
				<span class="custom-icon">⚙️</span>
				Custom White Balance
			</button>
		{:else}
			<div class="custom-input-container">
				<div class="custom-inputs">
					<div class="input-group">
						<label for="custom-kelvin">Kelvin</label>
						<input
							id="custom-kelvin"
							type="number"
							class="custom-input"
							placeholder="5600"
							bind:value={customKelvin}
							min="1000"
							max="15000"
							step="100"
						/>
					</div>
					<div class="input-group">
						<label for="custom-tint">Tint</label>
						<input
							id="custom-tint"
							type="number"
							class="custom-input"
							placeholder="0.0"
							bind:value={customTint}
							min="-100"
							max="100"
							step="0.1"
						/>
					</div>
				</div>
				<div class="custom-actions">
					<button 
						class="btn-custom-action cancel"
						on:click={() => {
							showCustomInput = false;
							customKelvin = '';
							customTint = '';
						}}
					>
						Cancel
					</button>
					<button 
						class="btn-custom-action set"
						on:click={setCustomWhiteBalance}
						disabled={!customKelvin || isNaN(parseInt(customKelvin))}
					>
						Set
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.white-balance-control {
		@apply space-y-4;
	}
	
	.white-balance-control.compact {
		@apply space-y-3;
	}
	
	.control-header {
		@apply text-center space-y-2;
	}
	
	.control-title {
		@apply text-sm font-medium text-gray-300;
	}
	
	.current-value {
		@apply flex items-center justify-center gap-3;
	}
	
	.kelvin-display, .tint-display {
		@apply flex items-center gap-2 text-lg font-bold;
	}
	
	.color-indicator, .tint-indicator {
		@apply w-4 h-4 rounded-full border border-gray-400;
	}
	
	.loading-spinner {
		@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.slider-controls {
		@apply space-y-4 bg-arri-gray rounded-lg p-4;
	}
	
	.slider-group {
		@apply space-y-2;
	}
	
	.slider-label {
		@apply flex justify-between items-center text-sm font-medium text-gray-300;
	}
	
	.label-text {
		@apply text-gray-300;
	}
	
	.label-value {
		@apply text-white font-mono;
	}
	
	.kelvin-slider, .tint-slider {
		@apply w-full h-3 rounded-lg appearance-none cursor-pointer;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.kelvin-slider::-webkit-slider-thumb, .tint-slider::-webkit-slider-thumb {
		@apply appearance-none w-6 h-6 rounded-full bg-white border-2 border-gray-400 cursor-pointer;
		@apply shadow-lg hover:border-arri-red transition-colors;
	}
	
	.kelvin-slider::-moz-range-thumb, .tint-slider::-moz-range-thumb {
		@apply w-6 h-6 rounded-full bg-white border-2 border-gray-400 cursor-pointer;
		@apply shadow-lg hover:border-arri-red transition-colors;
	}
	
	.presets-section {
		@apply space-y-3;
	}
	
	.presets-title {
		@apply text-sm font-medium text-gray-300;
	}
	
	.presets-grid {
		@apply grid grid-cols-1 gap-2;
	}
	
	.presets-grid.compact-grid {
		@apply grid-cols-2 gap-2;
	}
	
	.preset-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-3 transition-all duration-200;
		@apply min-h-touch flex items-center gap-3;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.preset-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.preset-button.touch-active {
		@apply scale-95 bg-gray-500;
	}
	
	.preset-button.active.touch-active {
		@apply bg-red-700;
	}
	
	.preset-icon {
		@apply text-xl flex-shrink-0;
	}
	
	.preset-info {
		@apply flex-1 text-left;
	}
	
	.preset-name {
		@apply font-medium;
	}
	
	.preset-kelvin {
		@apply text-sm text-gray-300 font-mono;
	}
	
	.preset-description {
		@apply text-xs text-gray-400 leading-tight;
	}
	
	.preset-color {
		@apply w-6 h-6 rounded-full border border-gray-400 flex-shrink-0;
	}
	
	.compact .preset-button {
		@apply p-2 flex-col text-center;
	}
	
	.compact .preset-info {
		@apply text-center;
	}
	
	.compact .preset-icon {
		@apply text-lg;
	}
	
	.custom-white-balance {
		@apply border-t border-gray-600 pt-4;
	}
	
	.btn-custom {
		@apply w-full bg-gray-700 hover:bg-gray-600 text-white rounded-lg p-3;
		@apply min-h-touch flex items-center justify-center gap-2 transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.custom-icon {
		@apply text-lg;
	}
	
	.custom-input-container {
		@apply space-y-4;
	}
	
	.custom-inputs {
		@apply grid grid-cols-2 gap-3;
	}
	
	.input-group {
		@apply space-y-1;
	}
	
	.input-group label {
		@apply block text-xs font-medium text-gray-300;
	}
	
	.custom-input {
		@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2;
		@apply text-white text-center font-mono;
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
	
	.preset-button:active {
		animation: touch-feedback 0.1s ease-in-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.presets-grid {
			@apply grid-cols-1;
		}
		
		.custom-inputs {
			@apply grid-cols-1;
		}
		
		.preset-button {
			@apply p-2;
		}
		
		.preset-icon {
			@apply text-lg;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.preset-button {
			@apply border-white;
		}
		
		.preset-button.active {
			@apply border-yellow-400;
		}
		
		.color-indicator, .tint-indicator, .preset-color {
			@apply border-2 border-white;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.preset-button {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
		
		.preset-button:active {
			animation: none;
		}
	}
</style>"