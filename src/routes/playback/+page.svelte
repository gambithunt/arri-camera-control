<script lang="ts">
	import { onMount } from 'svelte';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import ClipBrowser from '$lib/components/ClipBrowser.svelte';
	import PlaybackControls from '$lib/components/PlaybackControls.svelte';
	import PlaybackStateManager from '$lib/components/PlaybackStateManager.svelte';
	import PlaybackProgressDisplay from '$lib/components/PlaybackProgressDisplay.svelte';
	import { playbackStore, connectionStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Reactive store subscriptions
	$: playbackState = $playbackStore;
	$: connectionStatus = $connectionStore.overallStatus;
	$: isConnected = $connectionStatus.fullyConnected;
	$: isLoading = $playbackStore.operations.loading;
	
	onMount(() => {
		console.log('Playback page initialized');
	});
	
	async function enterPlaybackMode() {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}
		
		playbackStore.setOperationLoading('enterPlayback', true);
		playbackStore.setPlaybackMode(false, true); // entering = true
		
		try {
			const result = await cameraApi.enterPlaybackMode();
			if (result.success) {
				playbackStore.setPlaybackMode(true, false);
				notificationStore.success('Playback Mode', 'Entered playback mode successfully');
			} else {
				playbackStore.setPlaybackMode(false, false);
				notificationStore.error('Playback Mode Failed', result.error || 'Failed to enter playback mode');
			}
		} catch (error) {
			playbackStore.setPlaybackMode(false, false);
			notificationStore.error('Playback Mode Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			playbackStore.setOperationLoading('enterPlayback', false);
		}
	}
	
	async function exitPlaybackMode() {
		playbackStore.setOperationLoading('exitPlayback', true);
		
		try {
			const result = await cameraApi.exitPlaybackMode();
			if (result.success) {
				playbackStore.exitPlaybackMode();
				notificationStore.success('Playback Mode', 'Exited playback mode successfully');
			} else {
				notificationStore.error('Exit Playback Failed', result.error || 'Failed to exit playback mode');
			}
		} catch (error) {
			notificationStore.error('Exit Playback Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			playbackStore.setOperationLoading('exitPlayback', false);
		}
	}
</script>

<div class="page-container">
	<ConnectionStatus />
	
	{#if isConnected}
		{#if !playbackState.isInPlaybackMode}
			<div class="mode-control">
				<button 
					class="btn-primary w-full" 
					on:click={enterPlaybackMode}
					disabled={playbackState.enteringPlaybackMode || $isLoading}
				>
					{#if playbackState.enteringPlaybackMode}
						Entering Playback Mode...
					{:else}
						Enter Playback Mode
					{/if}
				</button>
				<p class="text-xs text-gray-400 text-center mt-2">
					Switch camera to playback mode to review clips
				</p>
			</div>
		{:else}
			<div class="playback-container">
				<!-- Playback Controls Header -->
				<div class="playback-header">
					<button 
						class="btn-secondary text-sm" 
						on:click={exitPlaybackMode}
						disabled={$isLoading}
					>
						Exit Playback
					</button>
					<div class="text-sm text-gray-400">
						Playback Mode Active
					</div>
				</div>
				
				<!-- Playback State Manager (invisible, manages state updates) -->
				<PlaybackStateManager 
					enabled={isConnected && !$isLoading}
					showStatusIndicator={true}
				/>
				
				<!-- Playback Progress Display -->
				<PlaybackProgressDisplay 
					showDetailed={true}
					showBuffer={true}
					showStats={false}
				/>
				
				<!-- Playback Controls -->
				<PlaybackControls disabled={!isConnected || $isLoading} />
				
				<!-- Clip Browser -->
				<ClipBrowser disabled={!isConnected || $isLoading} />
			</div>
		{/if}
	{:else}
		<div class="empty-state">
			<div class="text-center text-gray-400">
				<div class="text-4xl mb-4">▶️</div>
				<h3 class="text-lg font-medium mb-2">Camera Not Connected</h3>
				<p class="text-sm">Connect to an ARRI camera to access playback</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		@apply p-4 max-w-md mx-auto;
	}
	
	.mode-control {
		@apply text-center py-8;
	}
	
	.playback-container {
		@apply space-y-4;
	}
	
	.playback-header {
		@apply flex justify-between items-center;
	}
	
	.current-clip {
		@apply bg-arri-gray rounded-lg p-4;
	}
	
	.progress-bar {
		@apply w-full h-2 bg-gray-700 rounded-full overflow-hidden;
	}
	
	.progress-fill {
		@apply h-full bg-arri-red transition-all duration-300;
	}
	
	.transport-controls {
		@apply flex justify-center items-center gap-4;
	}
	
	.btn-transport {
		@apply w-12 h-12 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center;
		@apply text-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-transport.primary {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.speed-control {
		@apply bg-arri-gray rounded-lg p-4;
	}
	
	.speed-buttons {
		@apply flex gap-2 flex-wrap;
	}
	
	.btn-speed {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-1 px-3 rounded;
		@apply transition-colors;
	}
	
	.btn-speed.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.clip-list {
		@apply bg-arri-gray rounded-lg p-4;
	}
	
	.clips {
		@apply space-y-2;
	}
	
	.clip-item {
		@apply w-full text-left p-3 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors;
		@apply min-h-touch;
	}
	
	.clip-item.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.clip-name {
		@apply font-medium;
	}
	
	.clip-info {
		@apply text-xs text-gray-400 mt-1;
	}
	
	.empty-state {
		@apply flex items-center justify-center min-h-96;
	}
</style>