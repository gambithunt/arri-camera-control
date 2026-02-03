<script lang="ts">
	import { onMount } from 'svelte';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import FrameRateControl from '$lib/components/FrameRateControl.svelte';
	import WhiteBalanceControl from '$lib/components/WhiteBalanceControl.svelte';
	import ISOControl from '$lib/components/ISOControl.svelte';
	import NDFilterControl from '$lib/components/NDFilterControl.svelte';
	import FrameLinesControl from '$lib/components/FrameLinesControl.svelte';
	import LUTControl from '$lib/components/LUTControl.svelte';
	import { safeStoreAccess } from '$lib/dev/mockStores';
	
	// Safe store access with fallbacks
	const { cameraStore, connectionStore, notificationStore, isUsingMocks } = safeStoreAccess();
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: connectionStatus = $connectionStore.overallStatus;
	$: isConnected = connectionStatus.fullyConnected;
	$: isLoading = cameraState.operations.loading;
	
	// Show dev mode indicator
	$: if (isUsingMocks) {
		console.log('Camera page: Using mock stores for UI testing');
	}
	
	onMount(() => {
		console.log('Camera settings page initialized');
	});
	

	

	

</script>

<div class="page-container">
	<ConnectionStatus />
	
	{#if isConnected}
		<div class="settings-grid">
			<!-- Frame Rate Control -->
			<div class="setting-card">
				<FrameRateControl disabled={!isConnected || isLoading} />
			</div>
			
			<!-- White Balance Control -->
			<div class="setting-card">
				<WhiteBalanceControl disabled={!isConnected || isLoading} />
			</div>
			
			<!-- ISO Control -->
			<div class="setting-card">
				<ISOControl disabled={!isConnected || isLoading} />
			</div>
			
			<!-- ND Filter Control -->
			<div class="setting-card">
				<NDFilterControl disabled={!isConnected || isLoading} />
			</div>
			
			<!-- Frame Lines Control -->
			<div class="setting-card">
				<FrameLinesControl disabled={!isConnected || isLoading} />
			</div>
			
			<!-- LUT Control -->
			<div class="setting-card">
				<LUTControl disabled={!isConnected || isLoading} />
			</div>
		</div>
	{:else}
		<div class="empty-state">
			<div class="text-center text-gray-400">
				<div class="text-4xl mb-4">📹</div>
				<h3 class="text-lg font-medium mb-2">Camera Not Connected</h3>
				<p class="text-sm">Connect to an ARRI camera to access settings</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		@apply p-4 max-w-md mx-auto;
	}
	
	.settings-grid {
		@apply space-y-4;
	}
	
	.setting-card {
		@apply bg-arri-gray rounded-lg p-4 transition-opacity;
	}
	
	.setting-card.loading {
		@apply opacity-75;
	}
	
	.setting-title {
		@apply text-sm font-medium text-gray-300 mb-1;
	}
	
	.setting-value {
		@apply text-lg font-semibold mb-3 flex items-center gap-2;
	}
	
	.loading-spinner {
		@apply w-4 h-4 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.setting-controls {
		@apply flex gap-2 flex-wrap;
	}
	
	.btn-setting {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-3 rounded;
		@apply min-h-touch transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-setting.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.btn-toggle {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-4 rounded;
		@apply min-h-touch transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-toggle.active {
		@apply bg-green-600 hover:bg-green-700;
	}
	
	.empty-state {
		@apply flex items-center justify-center min-h-96;
	}
</style>