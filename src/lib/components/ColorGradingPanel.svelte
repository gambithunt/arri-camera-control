<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import ColorWheel from './ColorWheel.svelte';
	import { cameraStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Props
	export let disabled = false;
	export let compact = false;
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		cdlChange: { cdlValues: CDLValues };
		reset: { wheelType: string };
	}>();
	
	// CDL Values interface
	interface CDLValues {
		shadows: {
			lift: { r: number; g: number; b: number };
			gamma: { r: number; g: number; b: number };
			gain: { r: number; g: number; b: number };
		};
		midtones: {
			lift: { r: number; g: number; b: number };
			gamma: { r: number; g: number; b: number };
			gain: { r: number; g: number; b: number };
		};
		highlights: {
			lift: { r: number; g: number; b: number };
			gamma: { r: number; g: number; b: number };
			gain: { r: number; g: number; b: number };
		};
	}
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: isLoading = cameraState.operations?.grading || false;
	
	// Component state
	let currentCDL: CDLValues = {
		shadows: {
			lift: { r: 0, g: 0, b: 0 },
			gamma: { r: 1, g: 1, b: 1 },
			gain: { r: 1, g: 1, b: 1 }
		},
		midtones: {
			lift: { r: 0, g: 0, b: 0 },
			gamma: { r: 1, g: 1, b: 1 },
			gain: { r: 1, g: 1, b: 1 }
		},
		highlights: {
			lift: { r: 0, g: 0, b: 0 },
			gamma: { r: 1, g: 1, b: 1 },
			gain: { r: 1, g: 1, b: 1 }
		}
	};
	
	let selectedWheel: 'shadows' | 'midtones' | 'highlights' = 'midtones';
	let selectedControl: 'lift' | 'gamma' | 'gain' = 'lift';
	let fullscreenWheel: { wheelType: string; controlType: string } | null = null;
	let updateTimeout: NodeJS.Timeout;
	let lastUpdateTime = 0;
	
	// Wheel configurations
	const wheelTypes = [
		{ 
			id: 'shadows' as const, 
			label: 'Shadows', 
			icon: '🌑',
			description: 'Adjust shadow/black levels',
			color: 'from-gray-900 to-gray-700'
		},
		{ 
			id: 'midtones' as const, 
			label: 'Midtones', 
			icon: '🌗',
			description: 'Adjust midtone levels',
			color: 'from-gray-600 to-gray-400'
		},
		{ 
			id: 'highlights' as const, 
			label: 'Highlights', 
			icon: '🌕',
			description: 'Adjust highlight/white levels',
			color: 'from-gray-300 to-white'
		}
	];
	
	const controlTypes = [
		{ 
			id: 'lift' as const, 
			label: 'Lift', 
			icon: '↑',
			description: 'Raises or lowers the black point',
			shortcut: 'L'
		},
		{ 
			id: 'gamma' as const, 
			label: 'Gamma', 
			icon: '~',
			description: 'Adjusts the midpoint curve',
			shortcut: 'G'
		},
		{ 
			id: 'gain' as const, 
			label: 'Gain', 
			icon: '↗',
			description: 'Multiplies the signal strength',
			shortcut: 'N'
		}
	];
	
	onMount(() => {
		// Load current CDL values from camera state if available
		if (cameraState.cdlValues) {
			currentCDL = { ...cameraState.cdlValues };
		}
		
		// Set up keyboard shortcuts
		if (browser) {
			document.addEventListener('keydown', handleGlobalKeydown);
			return () => {
				document.removeEventListener('keydown', handleGlobalKeydown);
			};
		}
	});
	
	function handleColorWheelChange(event: CustomEvent) {
		const { wheelType, controlType, values } = event.detail;
		
		// Update local CDL values
		currentCDL = {
			...currentCDL,
			[wheelType]: {
				...currentCDL[wheelType as keyof CDLValues],
				[controlType]: values
			}
		};
		
		// Debounce updates to camera
		debouncedCameraUpdate();
		
		// Dispatch change event
		dispatch('cdlChange', { cdlValues: currentCDL });
	}
	
	function debouncedCameraUpdate() {
		const now = Date.now();
		lastUpdateTime = now;
		
		if (updateTimeout) {
			clearTimeout(updateTimeout);
		}
		
		updateTimeout = setTimeout(async () => {
			// Only update if this is the most recent change
			if (now === lastUpdateTime) {
				await updateCameraCDL();
			}
		}, 100); // 100ms debounce
	}
	
	async function updateCameraCDL() {
		if (disabled || isLoading) return;
		
		cameraStore.setOperationLoading('grading', true);
		
		try {
			const result = await cameraApi.setCDL(currentCDL);
			if (result.success) {
				// Update camera store with new CDL values
				cameraStore.updateSettings({ cdlValues: currentCDL });
			} else {
				notificationStore.error('CDL Update Failed', result.error || 'Failed to update camera CDL');
				// Revert local changes on failure
				if (cameraState.cdlValues) {
					currentCDL = { ...cameraState.cdlValues };
				}
			}
		} catch (error) {
			notificationStore.error('CDL Update Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('grading', false);
		}
	}
	
	function handleFullscreenToggle(event: CustomEvent) {
		const { wheelType, controlType } = event.detail;
		
		if (fullscreenWheel && 
			fullscreenWheel.wheelType === wheelType && 
			fullscreenWheel.controlType === controlType) {
			// Close fullscreen
			fullscreenWheel = null;
		} else {
			// Open fullscreen
			fullscreenWheel = { wheelType, controlType };
			selectedWheel = wheelType;
			selectedControl = controlType;
		}
		
		// Provide haptic feedback
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate(20);
		}
	}
	
	function handleWheelReset(event: CustomEvent) {
		const { wheelType, controlType } = event.detail;
		
		// Reset specific control to default
		const defaultValue = controlType === 'lift' ? 0 : 1;
		const resetValues = { r: defaultValue, g: defaultValue, b: defaultValue };
		
		currentCDL = {
			...currentCDL,
			[wheelType]: {
				...currentCDL[wheelType as keyof CDLValues],
				[controlType]: resetValues
			}
		};
		
		debouncedCameraUpdate();
		dispatch('cdlChange', { cdlValues: currentCDL });
		
		notificationStore.success('Reset', `${wheelType} ${controlType} reset to default`);
	}
	
	function resetAllWheels() {
		if (disabled || isLoading) return;
		
		currentCDL = {
			shadows: {
				lift: { r: 0, g: 0, b: 0 },
				gamma: { r: 1, g: 1, b: 1 },
				gain: { r: 1, g: 1, b: 1 }
			},
			midtones: {
				lift: { r: 0, g: 0, b: 0 },
				gamma: { r: 1, g: 1, b: 1 },
				gain: { r: 1, g: 1, b: 1 }
			},
			highlights: {
				lift: { r: 0, g: 0, b: 0 },
				gamma: { r: 1, g: 1, b: 1 },
				gain: { r: 1, g: 1, b: 1 }
			}
		};
		
		debouncedCameraUpdate();
		dispatch('cdlChange', { cdlValues: currentCDL });
		
		notificationStore.success('Reset', 'All color wheels reset to default');
		
		// Provide haptic feedback
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate([20, 100, 20]);
		}
	}
	
	function selectWheel(wheelType: 'shadows' | 'midtones' | 'highlights') {
		selectedWheel = wheelType;
		
		// Provide haptic feedback
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate(10);
		}
	}
	
	function selectControl(controlType: 'lift' | 'gamma' | 'gain') {
		selectedControl = controlType;
		
		// Provide haptic feedback
		if (browser && 'vibrate' in navigator) {
			navigator.vibrate(10);
		}
	}
	
	function handleGlobalKeydown(event: KeyboardEvent) {
		// Only handle shortcuts when not in an input field
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}
		
		// Handle wheel selection shortcuts (1, 2, 3)
		if (event.key >= '1' && event.key <= '3') {
			const wheelIndex = parseInt(event.key) - 1;
			if (wheelIndex < wheelTypes.length) {
				selectWheel(wheelTypes[wheelIndex].id);
				event.preventDefault();
			}
		}
		
		// Handle control selection shortcuts (L, G, N)
		switch (event.key.toLowerCase()) {
			case 'l':
				selectControl('lift');
				event.preventDefault();
				break;
			case 'g':
				selectControl('gamma');
				event.preventDefault();
				break;
			case 'n':
				selectControl('gain');
				event.preventDefault();
				break;
			case 'r':
				if (event.ctrlKey || event.metaKey) {
					resetAllWheels();
					event.preventDefault();
				}
				break;
			case 'f':
				if (event.ctrlKey || event.metaKey) {
					handleFullscreenToggle({ 
						detail: { wheelType: selectedWheel, controlType: selectedControl } 
					} as CustomEvent);
					event.preventDefault();
				}
				break;
			case 'escape':
				if (fullscreenWheel) {
					fullscreenWheel = null;
					event.preventDefault();
				}
				break;
		}
	}
	
	// Get current values for selected wheel and control
	$: currentValues = currentCDL[selectedWheel][selectedControl];
</script>

<div class="color-grading-panel" class:compact class:disabled>
	<!-- Panel Header -->
	<div class="panel-header">
		<div class="header-info">
			<h2 class="panel-title">Color Grading</h2>
			<p class="panel-description">Professional CDL color correction</p>
		</div>
		
		<div class="header-actions">
			<button 
				class="btn-reset-all"
				on:click={resetAllWheels}
				disabled={disabled || isLoading}
				title="Reset all wheels (Ctrl+R)"
			>
				{#if isLoading}
					<div class="loading-spinner"></div>
				{:else}
					↺
				{/if}
				Reset All
			</button>
		</div>
	</div>
	
	<!-- Wheel Type Selector -->
	<div class="wheel-selector">
		<h3 class="selector-title">Color Range</h3>
		<div class="wheel-tabs">
			{#each wheelTypes as wheel, index}
				<button 
					class="wheel-tab {selectedWheel === wheel.id ? 'active' : ''}"
					on:click={() => selectWheel(wheel.id)}
					disabled={disabled}
					title="{wheel.description} (Key: {index + 1})"
				>
					<span class="tab-icon">{wheel.icon}</span>
					<span class="tab-label">{wheel.label}</span>
					{#if !compact}
						<div class="tab-gradient bg-gradient-to-r {wheel.color}"></div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
	
	<!-- Control Type Selector -->
	<div class="control-selector">
		<h3 class="selector-title">Control Type</h3>
		<div class="control-tabs">
			{#each controlTypes as control}
				<button 
					class="control-tab {selectedControl === control.id ? 'active' : ''}"
					on:click={() => selectControl(control.id)}
					disabled={disabled}
					title="{control.description} (Key: {control.shortcut})"
				>
					<span class="tab-icon">{control.icon}</span>
					<span class="tab-label">{control.label}</span>
				</button>
			{/each}
		</div>
	</div>
	
	<!-- Main Color Wheel -->
	<div class="main-wheel-container">
		<ColorWheel
			wheelType={selectedWheel}
			controlType={selectedControl}
			values={currentValues}
			{disabled}
			size={compact ? 180 : 240}
			fullscreen={false}
			showValues={!compact}
			sensitivity={1.0}
			on:change={handleColorWheelChange}
			on:fullscreenToggle={handleFullscreenToggle}
			on:reset={handleWheelReset}
		/>
	</div>
	
	<!-- Quick Access Wheels (when not in compact mode) -->
	{#if !compact}
		<div class="quick-wheels">
			<h3 class="selector-title">Quick Access</h3>
			<div class="quick-wheels-grid">
				{#each wheelTypes as wheel}
					{#each controlTypes as control}
						<div class="quick-wheel-item">
							<div class="quick-wheel-header">
								<span class="quick-wheel-title">{wheel.label} {control.label}</span>
							</div>
							<ColorWheel
								wheelType={wheel.id}
								controlType={control.id}
								values={currentCDL[wheel.id][control.id]}
								{disabled}
								size={120}
								fullscreen={false}
								showValues={false}
								sensitivity={0.8}
								on:change={handleColorWheelChange}
								on:fullscreenToggle={handleFullscreenToggle}
								on:reset={handleWheelReset}
							/>
						</div>
					{/each}
				{/each}
			</div>
		</div>
	{/if}
	
	<!-- Keyboard Shortcuts Help -->
	{#if !compact}
		<div class="shortcuts-help">
			<details>
				<summary>Keyboard Shortcuts</summary>
				<div class="shortcuts-grid">
					<div class="shortcut-item">
						<kbd>1-3</kbd>
						<span>Select wheel (Shadows, Midtones, Highlights)</span>
					</div>
					<div class="shortcut-item">
						<kbd>L</kbd>
						<span>Select Lift control</span>
					</div>
					<div class="shortcut-item">
						<kbd>G</kbd>
						<span>Select Gamma control</span>
					</div>
					<div class="shortcut-item">
						<kbd>N</kbd>
						<span>Select Gain control</span>
					</div>
					<div class="shortcut-item">
						<kbd>Ctrl+F</kbd>
						<span>Toggle fullscreen</span>
					</div>
					<div class="shortcut-item">
						<kbd>Ctrl+R</kbd>
						<span>Reset all wheels</span>
					</div>
				</div>
			</details>
		</div>
	{/if}
</div>

<!-- Fullscreen Overlay -->
{#if fullscreenWheel}
	<div class="fullscreen-overlay">
		<ColorWheel
			wheelType={fullscreenWheel.wheelType}
			controlType={fullscreenWheel.controlType}
			values={currentCDL[fullscreenWheel.wheelType as keyof CDLValues][fullscreenWheel.controlType as keyof CDLValues['shadows']]}
			{disabled}
			size={400}
			fullscreen={true}
			showValues={true}
			sensitivity={1.2}
			on:change={handleColorWheelChange}
			on:fullscreenToggle={handleFullscreenToggle}
			on:reset={handleWheelReset}
		/>
	</div>
{/if}

<style>
	.color-grading-panel {
		@apply space-y-6 p-4;
		@apply bg-gray-900 rounded-lg;
		@apply border border-gray-700;
	}
	
	.color-grading-panel.compact {
		@apply space-y-4 p-3;
	}
	
	.color-grading-panel.disabled {
		@apply opacity-50 pointer-events-none;
	}
	
	.panel-header {
		@apply flex items-center justify-between;
	}
	
	.header-info {
		@apply flex-1;
	}
	
	.panel-title {
		@apply text-xl font-bold text-white;
	}
	
	.panel-description {
		@apply text-sm text-gray-400 mt-1;
	}
	
	.header-actions {
		@apply flex gap-2;
	}
	
	.btn-reset-all {
		@apply flex items-center gap-2 px-4 py-2;
		@apply bg-red-600 hover:bg-red-700 text-white;
		@apply rounded-lg font-medium transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
		@apply min-h-touch;
	}
	
	.loading-spinner {
		@apply w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin;
	}
	
	.wheel-selector, .control-selector {
		@apply space-y-3;
	}
	
	.selector-title {
		@apply text-sm font-medium text-gray-300 uppercase tracking-wide;
	}
	
	.wheel-tabs, .control-tabs {
		@apply flex gap-2;
	}
	
	.wheel-tab, .control-tab {
		@apply flex-1 relative overflow-hidden;
		@apply bg-gray-800 hover:bg-gray-700 text-white;
		@apply rounded-lg p-3 transition-all duration-200;
		@apply min-h-touch;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.wheel-tab.active, .control-tab.active {
		@apply bg-arri-red hover:bg-red-600;
		@apply ring-2 ring-red-400 ring-opacity-50;
	}
	
	.tab-icon {
		@apply text-lg block mb-1;
	}
	
	.tab-label {
		@apply text-sm font-medium;
	}
	
	.tab-gradient {
		@apply absolute bottom-0 left-0 right-0 h-1;
	}
	
	.main-wheel-container {
		@apply flex justify-center;
	}
	
	.quick-wheels {
		@apply space-y-4;
	}
	
	.quick-wheels-grid {
		@apply grid grid-cols-3 gap-4;
	}
	
	.quick-wheel-item {
		@apply space-y-2;
	}
	
	.quick-wheel-header {
		@apply text-center;
	}
	
	.quick-wheel-title {
		@apply text-xs font-medium text-gray-400;
	}
	
	.shortcuts-help {
		@apply bg-gray-800 rounded-lg p-4;
	}
	
	.shortcuts-help summary {
		@apply text-sm font-medium text-gray-300 cursor-pointer;
		@apply hover:text-white transition-colors;
	}
	
	.shortcuts-grid {
		@apply grid grid-cols-1 md:grid-cols-2 gap-2 mt-3;
	}
	
	.shortcut-item {
		@apply flex items-center gap-3 text-sm;
	}
	
	.shortcut-item kbd {
		@apply bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs font-mono;
		@apply min-w-[2rem] text-center;
	}
	
	.fullscreen-overlay {
		@apply fixed inset-0 z-50 bg-black bg-opacity-95;
		@apply flex items-center justify-center p-4;
	}
	
	/* Responsive adjustments */
	@media (max-width: 768px) {
		.wheel-tabs, .control-tabs {
			@apply flex-col;
		}
		
		.quick-wheels-grid {
			@apply grid-cols-2;
		}
		
		.shortcuts-grid {
			@apply grid-cols-1;
		}
		
		.panel-header {
			@apply flex-col items-start gap-3;
		}
		
		.header-actions {
			@apply self-end;
		}
	}
	
	@media (max-width: 480px) {
		.quick-wheels-grid {
			@apply grid-cols-1;
		}
		
		.color-grading-panel {
			@apply p-2;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.wheel-tab, .control-tab {
			@apply border border-white;
		}
		
		.wheel-tab.active, .control-tab.active {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.wheel-tab, .control-tab, .btn-reset-all {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
	}
</style>