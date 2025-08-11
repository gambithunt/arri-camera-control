<script lang="ts">
	import { onMount } from 'svelte';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import { cameraStore, connectionStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';

	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: connectionStatus = $connectionStore.overallStatus;
	$: isConnected = $connectionStatus.fullyConnected;
	$: isLoading = $cameraStore.operations.loading;

	// Color grading state
	let selectedWheel: 'shadows' | 'midtones' | 'highlights' = 'shadows';

	type CDLValues = {
		[K in 'shadows' | 'midtones' | 'highlights']: {
			lift: { r: number; g: number; b: number };
			gamma: { r: number; g: number; b: number };
			gain: { r: number; g: number; b: number };
		};
	};

	let cdlValues: CDLValues = {
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

	let savedLUTs = ['Rec709', 'LogC', 'Custom_01', 'Custom_02'];

	onMount(() => {
		console.log('Color grading page initialized');
	});

	function selectWheel(wheel: 'shadows' | 'midtones' | 'highlights') {
		selectedWheel = wheel;
	}

	async function adjustCDL(
		wheel: 'shadows' | 'midtones' | 'highlights',
		control: 'lift' | 'gamma' | 'gain',
		channel: 'r' | 'g' | 'b',
		value: number
	) {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}

		// Update local state immediately for responsive UI
		cdlValues[wheel][control][channel] = value;

		try {
			const result = await cameraApi.setCDL(wheel, control, channel, value);
			if (result.success) {
				// Update camera store with new CDL values
				cameraStore.updateSettings({
					cdlValues: { ...cdlValues }
				});
			} else {
				// Revert local change on failure
				cdlValues[wheel][control][channel] =
					cameraState.cdlValues?.[wheel]?.[control]?.[channel] ||
					(control === 'gamma' || control === 'gain' ? 1 : 0);
				notificationStore.error('CDL Adjustment Failed', result.error || 'Failed to adjust color');
			}
		} catch (error) {
			// Revert local change on error
			cdlValues[wheel][control][channel] =
				cameraState.cdlValues?.[wheel]?.[control]?.[channel] ||
				(control === 'gamma' || control === 'gain' ? 1 : 0);
			notificationStore.error(
				'CDL Adjustment Failed',
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	}

	async function resetWheel(wheel: 'shadows' | 'midtones' | 'highlights') {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}

		const resetValues = {
			lift: { r: 0, g: 0, b: 0 },
			gamma: { r: 1, g: 1, b: 1 },
			gain: { r: 1, g: 1, b: 1 }
		};

		try {
			const result = await cameraApi.resetCDLWheel(wheel);
			if (result.success) {
				cdlValues[wheel] = resetValues;
				cameraStore.updateSettings({
					cdlValues: { ...cdlValues }
				});
				notificationStore.success('Wheel Reset', `${wheel} wheel reset to default values`);
			} else {
				notificationStore.error('Reset Failed', result.error || 'Failed to reset wheel');
			}
		} catch (error) {
			notificationStore.error(
				'Reset Failed',
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	}

	async function loadLUT(lutName: string) {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}

		try {
			const result = await cameraApi.setLUT(lutName);
			if (result.success) {
				cameraStore.updateSettings({ currentLUT: lutName });
				notificationStore.success('LUT Loaded', `Switched to ${lutName}`);
			} else {
				notificationStore.error('LUT Load Failed', result.error || 'Failed to load LUT');
			}
		} catch (error) {
			notificationStore.error(
				'LUT Load Failed',
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	}

	async function saveLUT() {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}

		const lutName = `Custom_${Date.now()}`;

		try {
			const result = await cameraApi.saveLUT(lutName);
			if (result.success) {
				savedLUTs = [...savedLUTs, lutName];
				cameraStore.updateSettings({ currentLUT: lutName });
				notificationStore.success('LUT Saved', `Saved as ${lutName}`);
			} else {
				notificationStore.error('LUT Save Failed', result.error || 'Failed to save LUT');
			}
		} catch (error) {
			notificationStore.error(
				'LUT Save Failed',
				error instanceof Error ? error.message : 'Unknown error'
			);
		}
	}

	function getWheelColor(wheel: string) {
		switch (wheel) {
			case 'shadows':
				return 'from-gray-800 to-gray-600';
			case 'midtones':
				return 'from-gray-600 to-gray-400';
			case 'highlights':
				return 'from-gray-400 to-gray-200';
			default:
				return 'from-gray-600 to-gray-400';
		}
	}
</script>

<div class="page-container">
	<ConnectionStatus />

	{#if isConnected}
		<div class="grading-container">
			<!-- Color Wheel Selection -->
			<div class="wheel-selector">
				{#each ['shadows', 'midtones', 'highlights'] as wheel}
					<button
						class="wheel-tab {selectedWheel === wheel ? 'active' : ''}"
						on:click={() => selectWheel(wheel)}
					>
						<div class="wheel-preview bg-gradient-to-br {getWheelColor(wheel)}"></div>
						<span class="wheel-label">{wheel}</span>
					</button>
				{/each}
			</div>

			<!-- Color Wheel Display -->
			<div class="color-wheel-container">
				<div class="color-wheel">
					<div class="wheel-center">
						<div class="wheel-title">{selectedWheel}</div>
						<button class="reset-button" on:click={() => resetWheel(selectedWheel)}> Reset </button>
					</div>
					<!-- TODO: Implement actual color wheel interaction -->
					<div class="wheel-placeholder">
						<div class="text-center text-gray-400">
							<div class="text-2xl mb-2">🎨</div>
							<div class="text-sm">Touch to adjust color</div>
						</div>
					</div>
				</div>
			</div>

			<!-- CDL Controls -->
			<div class="cdl-controls">
				<h3 class="controls-title">CDL Parameters</h3>

				{#each ['lift', 'gamma', 'gain'] as control}
					<div class="control-group">
						<div class="control-label">{control}</div>
						<div class="control-sliders">
							{#each ['r', 'g', 'b'] as channel}
								<div class="slider-group">
									<div class="slider-label {channel}">{channel.toUpperCase()}</div>
									<input
										type="range"
										class="slider {channel}"
										min={control === 'lift' ? -1 : 0}
										max={control === 'lift' ? 1 : 2}
										step="0.01"
										value={cdlValues[selectedWheel][control][channel]}
										on:input={(e) => {
											const target = e.target as HTMLInputElement;
											adjustCDL(
												selectedWheel,
												control as 'lift' | 'gamma' | 'gain',
												channel as 'r' | 'g' | 'b',
												parseFloat(target.value)
											);
										}}
										disabled={$isLoading}
									/>
									<span class="slider-value">
										{cdlValues[selectedWheel][control][channel].toFixed(2)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<!-- LUT Management -->
			<div class="lut-section">
				<h3 class="section-title">LUT Management</h3>
				<div class="current-lut">
					<div class="lut-info">
						<div class="font-medium">Current LUT</div>
						<div class="text-sm text-gray-400">
							{cameraState.currentLUT || 'None'}
							{#if $isLoading}
								<div class="loading-spinner inline-block ml-2"></div>
							{/if}
						</div>
					</div>
					<button class="btn-save-lut" on:click={saveLUT} disabled={$isLoading}>
						Save Current
					</button>
				</div>

				<div class="lut-list">
					<div class="text-sm text-gray-300 mb-2">Available LUTs</div>
					<div class="lut-grid">
						{#each savedLUTs as lut}
							<button
								class="lut-item {cameraState.currentLUT === lut ? 'active' : ''}"
								on:click={() => loadLUT(lut)}
								disabled={$isLoading}
							>
								{lut}
							</button>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{:else}
		<div class="empty-state">
			<div class="text-center text-gray-400">
				<div class="text-4xl mb-4">🎨</div>
				<h3 class="text-lg font-medium mb-2">Camera Not Connected</h3>
				<p class="text-sm">Connect to an ARRI camera to access color grading</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		@apply p-4 max-w-md mx-auto;
	}

	.grading-container {
		@apply space-y-4;
	}

	.wheel-selector {
		@apply flex gap-2 bg-arri-gray rounded-lg p-2;
	}

	.wheel-tab {
		@apply flex-1 flex flex-col items-center gap-2 p-3 rounded-lg transition-colors;
		@apply hover:bg-gray-600;
	}

	.wheel-tab.active {
		@apply bg-arri-red;
	}

	.wheel-preview {
		@apply w-8 h-8 rounded-full;
	}

	.wheel-label {
		@apply text-xs font-medium capitalize;
	}

	.color-wheel-container {
		@apply bg-arri-gray rounded-lg p-4;
	}

	.color-wheel {
		@apply relative w-full aspect-square max-w-xs mx-auto;
	}

	.wheel-center {
		@apply absolute inset-0 flex flex-col items-center justify-center z-10;
	}

	.wheel-title {
		@apply text-lg font-medium mb-2 capitalize;
	}

	.reset-button {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium py-1 px-3 rounded;
		@apply transition-colors;
	}

	.wheel-placeholder {
		@apply w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-gray-800;
		@apply flex items-center justify-center border-4 border-gray-600;
	}

	.cdl-controls {
		@apply bg-arri-gray rounded-lg p-4;
	}

	.controls-title {
		@apply text-sm font-medium text-gray-300 mb-4;
	}

	.control-group {
		@apply mb-4 last:mb-0;
	}

	.control-label {
		@apply text-sm font-medium mb-2 capitalize;
	}

	.control-sliders {
		@apply space-y-2;
	}

	.slider-group {
		@apply flex items-center gap-3;
	}

	.slider-label {
		@apply text-xs font-medium w-4 text-center;
	}

	.slider-label.r {
		@apply text-red-400;
	}
	.slider-label.g {
		@apply text-green-400;
	}
	.slider-label.b {
		@apply text-blue-400;
	}

	.slider {
		@apply flex-1 h-2 rounded-lg appearance-none bg-gray-700 outline-none;
	}

	.slider.r::-webkit-slider-thumb {
		@apply appearance-none w-4 h-4 rounded-full bg-red-400 cursor-pointer;
	}

	.slider.g::-webkit-slider-thumb {
		@apply appearance-none w-4 h-4 rounded-full bg-green-400 cursor-pointer;
	}

	.slider.b::-webkit-slider-thumb {
		@apply appearance-none w-4 h-4 rounded-full bg-blue-400 cursor-pointer;
	}

	.slider-value {
		@apply text-xs font-mono w-12 text-right;
	}

	.lut-section {
		@apply bg-arri-gray rounded-lg p-4;
	}

	.section-title {
		@apply text-sm font-medium text-gray-300 mb-3;
	}

	.current-lut {
		@apply flex justify-between items-center mb-4 pb-3 border-b border-gray-600;
	}

	.btn-save-lut {
		@apply bg-arri-red hover:bg-red-600 text-white text-sm font-medium py-1 px-3 rounded;
		@apply transition-colors;
	}

	.lut-grid {
		@apply grid grid-cols-2 gap-2;
	}

	.lut-item {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-3 rounded;
		@apply min-h-touch transition-colors;
	}

	.lut-item.active {
		@apply bg-arri-red hover:bg-red-600;
	}

	.empty-state {
		@apply flex items-center justify-center min-h-96;
	}

	.loading-spinner {
		@apply w-4 h-4 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
</style>
