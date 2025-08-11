<script lang="ts">
	import { cameraStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Props
	export let disabled = false;
	export let showLabel = true;
	export let compact = false;
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: currentFrameRate = cameraState.frameRate;
	$: isLoading = cameraState.operations?.frameRate || false;
	
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
		
		cameraStore.setOperationLoading('frameRate', true);
		
		try {
			const result = await cameraApi.setFrameRate(fps);
			if (result.success) {
				cameraStore.updateSettings({ frameRate: fps });
				notificationStore.cameraCommandSuccess('Frame Rate');
			} else {
				notificationStore.cameraCommandError('Frame Rate', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('Frame Rate', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('frameRate', false);
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
</script>\n\n<div class=\"frame-rate-control {compact ? 'compact' : ''}\">\n\t{#if showLabel}\n\t\t<div class=\"control-header\">\n\t\t\t<h3 class=\"control-title\">Frame Rate</h3>\n\t\t\t<div class=\"current-value\">\n\t\t\t\t{currentFrameRate} fps\n\t\t\t\t{#if isLoading}\n\t\t\t\t\t<div class=\"loading-spinner\"></div>\n\t\t\t\t{/if}\n\t\t\t</div>\n\t\t\t<div class=\"current-description\">\n\t\t\t\t{getFrameRateDescription(currentFrameRate)}\n\t\t\t</div>\n\t\t</div>\n\t{/if}\n\t\n\t<!-- Standard Frame Rates Grid -->\n\t<div class=\"frame-rate-grid {compact ? 'compact-grid' : ''}\">\n\t\t{#each supportedFrameRates as rate}\n\t\t\t<button\n\t\t\t\tclass=\"frame-rate-button {currentFrameRate === rate.value ? 'active' : ''}\"\n\t\t\t\ton:click={() => setFrameRate(rate.value)}\n\t\t\t\ton:touchstart={(e) => handleTouchStart(e, rate.value)}\n\t\t\t\ton:touchend={(e) => handleTouchEnd(e, rate.value)}\n\t\t\t\ton:touchcancel={handleTouchCancel}\n\t\t\t\tdisabled={disabled || isLoading}\n\t\t\t\taria-label=\"Set frame rate to {rate.value} fps - {rate.description}\"\n\t\t\t>\n\t\t\t\t<div class=\"rate-value\">{rate.label}</div>\n\t\t\t\t{#if !compact}\n\t\t\t\t\t<div class=\"rate-description\">{rate.description}</div>\n\t\t\t\t{/if}\n\t\t\t</button>\n\t\t{/each}\n\t</div>\n\t\n\t<!-- Custom Frame Rate Input -->\n\t<div class=\"custom-frame-rate\">\n\t\t{#if !showCustomInput}\n\t\t\t<button \n\t\t\t\tclass=\"btn-custom\"\n\t\t\t\ton:click={() => showCustomInput = true}\n\t\t\t\tdisabled={disabled || isLoading}\n\t\t\t>\n\t\t\t\t<span class=\"custom-icon\">+</span>\n\t\t\t\tCustom Frame Rate\n\t\t\t</button>\n\t\t{:else}\n\t\t\t<div class=\"custom-input-container\">\n\t\t\t\t<input\n\t\t\t\t\ttype=\"number\"\n\t\t\t\t\tclass=\"custom-input\"\n\t\t\t\t\tplaceholder=\"Enter fps\"\n\t\t\t\t\tbind:value={customFrameRate}\n\t\t\t\t\tmin=\"1\"\n\t\t\t\t\tmax=\"300\"\n\t\t\t\t\tstep=\"0.01\"\n\t\t\t\t\ton:keydown={(e) => {\n\t\t\t\t\t\tif (e.key === 'Enter') {\n\t\t\t\t\t\t\tsetCustomFrameRate();\n\t\t\t\t\t\t} else if (e.key === 'Escape') {\n\t\t\t\t\t\t\tshowCustomInput = false;\n\t\t\t\t\t\t\tcustomFrameRate = '';\n\t\t\t\t\t\t}\n\t\t\t\t\t}}\n\t\t\t\t\tautofocus\n\t\t\t\t/>\n\t\t\t\t<div class=\"custom-actions\">\n\t\t\t\t\t<button \n\t\t\t\t\t\tclass=\"btn-custom-action cancel\"\n\t\t\t\t\t\ton:click={() => {\n\t\t\t\t\t\t\tshowCustomInput = false;\n\t\t\t\t\t\t\tcustomFrameRate = '';\n\t\t\t\t\t\t}}\n\t\t\t\t\t>\n\t\t\t\t\t\tCancel\n\t\t\t\t\t</button>\n\t\t\t\t\t<button \n\t\t\t\t\t\tclass=\"btn-custom-action set\"\n\t\t\t\t\t\ton:click={setCustomFrameRate}\n\t\t\t\t\t\tdisabled={!customFrameRate || isNaN(parseFloat(customFrameRate))}\n\t\t\t\t\t>\n\t\t\t\t\t\tSet\n\t\t\t\t\t</button>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t{/if}\n\t</div>\n</div>\n\n<style>\n\t.frame-rate-control {\n\t\t@apply space-y-4;\n\t}\n\t\n\t.frame-rate-control.compact {\n\t\t@apply space-y-2;\n\t}\n\t\n\t.control-header {\n\t\t@apply text-center space-y-1;\n\t}\n\t\n\t.control-title {\n\t\t@apply text-sm font-medium text-gray-300;\n\t}\n\t\n\t.current-value {\n\t\t@apply text-2xl font-bold flex items-center justify-center gap-2;\n\t}\n\t\n\t.current-description {\n\t\t@apply text-xs text-gray-400;\n\t}\n\t\n\t.loading-spinner {\n\t\t@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;\n\t}\n\t\n\t.frame-rate-grid {\n\t\t@apply grid grid-cols-2 gap-3;\n\t}\n\t\n\t.frame-rate-grid.compact-grid {\n\t\t@apply grid-cols-3 gap-2;\n\t}\n\t\n\t.frame-rate-button {\n\t\t@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4 transition-all duration-200;\n\t\t@apply min-h-touch flex flex-col items-center justify-center space-y-1;\n\t\t@apply border-2 border-transparent focus:outline-none focus:border-arri-red;\n\t\t@apply disabled:opacity-50 disabled:cursor-not-allowed;\n\t}\n\t\n\t.frame-rate-button.active {\n\t\t@apply bg-arri-red hover:bg-red-600 border-red-400;\n\t}\n\t\n\t.frame-rate-button.touch-active {\n\t\t@apply scale-95 bg-gray-500;\n\t}\n\t\n\t.frame-rate-button.active.touch-active {\n\t\t@apply bg-red-700;\n\t}\n\t\n\t.compact .frame-rate-button {\n\t\t@apply p-3;\n\t}\n\t\n\t.rate-value {\n\t\t@apply text-lg font-bold;\n\t}\n\t\n\t.compact .rate-value {\n\t\t@apply text-base;\n\t}\n\t\n\t.rate-description {\n\t\t@apply text-xs text-gray-300 text-center leading-tight;\n\t}\n\t\n\t.custom-frame-rate {\n\t\t@apply border-t border-gray-600 pt-4;\n\t}\n\t\n\t.btn-custom {\n\t\t@apply w-full bg-gray-700 hover:bg-gray-600 text-white rounded-lg p-3;\n\t\t@apply min-h-touch flex items-center justify-center gap-2 transition-colors;\n\t\t@apply disabled:opacity-50 disabled:cursor-not-allowed;\n\t}\n\t\n\t.custom-icon {\n\t\t@apply text-xl font-bold;\n\t}\n\t\n\t.custom-input-container {\n\t\t@apply space-y-3;\n\t}\n\t\n\t.custom-input {\n\t\t@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3;\n\t\t@apply text-white text-center text-lg font-mono;\n\t\t@apply focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red;\n\t}\n\t\n\t.custom-actions {\n\t\t@apply flex gap-3;\n\t}\n\t\n\t.btn-custom-action {\n\t\t@apply flex-1 py-2 px-4 rounded-lg font-medium transition-colors;\n\t\t@apply min-h-touch;\n\t}\n\t\n\t.btn-custom-action.cancel {\n\t\t@apply bg-gray-600 hover:bg-gray-500 text-white;\n\t}\n\t\n\t.btn-custom-action.set {\n\t\t@apply bg-arri-red hover:bg-red-600 text-white;\n\t\t@apply disabled:opacity-50 disabled:cursor-not-allowed;\n\t}\n\t\n\t/* Touch feedback animations */\n\t@keyframes touch-feedback {\n\t\t0% { transform: scale(1); }\n\t\t50% { transform: scale(0.95); }\n\t\t100% { transform: scale(1); }\n\t}\n\t\n\t.frame-rate-button:active {\n\t\tanimation: touch-feedback 0.1s ease-in-out;\n\t}\n\t\n\t/* Responsive adjustments */\n\t@media (max-width: 480px) {\n\t\t.frame-rate-grid {\n\t\t\t@apply grid-cols-2 gap-2;\n\t\t}\n\t\t\n\t\t.frame-rate-button {\n\t\t\t@apply p-3;\n\t\t}\n\t\t\n\t\t.rate-value {\n\t\t\t@apply text-base;\n\t\t}\n\t\t\n\t\t.rate-description {\n\t\t\t@apply text-xs;\n\t\t}\n\t}\n\t\n\t/* High contrast mode support */\n\t@media (prefers-contrast: high) {\n\t\t.frame-rate-button {\n\t\t\t@apply border-white;\n\t\t}\n\t\t\n\t\t.frame-rate-button.active {\n\t\t\t@apply border-yellow-400;\n\t\t}\n\t}\n\t\n\t/* Reduced motion support */\n\t@media (prefers-reduced-motion: reduce) {\n\t\t.frame-rate-button {\n\t\t\t@apply transition-none;\n\t\t}\n\t\t\n\t\t.loading-spinner {\n\t\t\t@apply animate-none;\n\t\t}\n\t\t\n\t\t.frame-rate-button:active {\n\t\t\tanimation: none;\n\t\t}\n\t}\n</style>"