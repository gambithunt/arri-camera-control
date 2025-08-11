<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import TimecodeDisplay from '$lib/components/TimecodeDisplay.svelte';
	import { cameraStore, connectionStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: connectionStatus = $connectionStore.overallStatus;
	$: isConnected = $connectionStatus.fullyConnected;
	$: isLoading = $cameraStore.operations.loading;
	
	// Local state
	let manualTimecode = '';
	let showManualEntry = false;
	let timecodeInterval: number | null = null;
	
	// Derived values from camera state
	$: currentTimecode = cameraState.currentTimecode || '00:00:00:00';
	$: timecodeMode = cameraState.timecodeMode || 'free_run';
	$: syncStatus = cameraState.timecodeSync || 'synced';
	$: frameRate = cameraState.frameRate || 24;
	
	onMount(() => {
		console.log('Timecode page initialized');
		
		// Start timecode updates when connected
		if (isConnected) {
			startTimecodeUpdates();
		}
	});
	
	onDestroy(() => {
		if (timecodeInterval) {
			clearInterval(timecodeInterval);
		}
	});
	
	function startTimecodeUpdates() {
		if (timecodeInterval) {
			clearInterval(timecodeInterval);
		}
		
		// Request timecode updates from camera
		timecodeInterval = setInterval(async () => {
			if (isConnected) {
				try {
					const result = await cameraApi.getTimecode();
					if (result.success && result.data) {
						cameraStore.updateSettings({
							currentTimecode: result.data.timecode,
							timecodeSync: result.data.syncStatus
						});
					}
				} catch (error) {
					// Silently handle timecode update errors to avoid spam
					console.warn('Timecode update failed:', error);
				}
			}
		}, 1000 / frameRate);
	}
	
	async function setTimecodeMode(mode: 'free_run' | 'record_run' | 'external') {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}
		
		try {
			const result = await cameraApi.setTimecodeMode(mode);
			if (result.success) {
				cameraStore.updateSettings({ timecodeMode: mode });
				notificationStore.success('Timecode Mode', `Switched to ${mode.replace('_', ' ')}`);
			} else {
				notificationStore.error('Mode Change Failed', result.error || 'Failed to change timecode mode');
			}
		} catch (error) {
			notificationStore.error('Mode Change Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function syncToTimeOfDay() {
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}
		
		try {
			const result = await cameraApi.syncTimecodeToTimeOfDay();
			if (result.success) {
				// Update will come through the timecode polling
				notificationStore.success('Timecode Synced', 'Synchronized to current time of day');
			} else {
				notificationStore.error('Sync Failed', result.error || 'Failed to sync timecode');
			}
		} catch (error) {
			notificationStore.error('Sync Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function setManualTimecode() {
		if (!manualTimecode.match(/^\d{2}:\d{2}:\d{2}:\d{2}$/)) {
			notificationStore.warning('Invalid Format', 'Please use HH:MM:SS:FF format');
			return;
		}
		
		if (!isConnected) {
			notificationStore.error('Not Connected', 'Please connect to camera first');
			return;
		}
		
		try {
			const result = await cameraApi.setTimecode(manualTimecode);
			if (result.success) {
				cameraStore.updateSettings({ currentTimecode: manualTimecode });
				showManualEntry = false;
				manualTimecode = '';
				notificationStore.success('Timecode Set', `Set to ${manualTimecode}`);
			} else {
				notificationStore.error('Set Failed', result.error || 'Failed to set timecode');
			}
		} catch (error) {
			notificationStore.error('Set Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	function getSyncStatusColor() {
		switch (syncStatus) {
			case 'synced': return 'text-green-400';
			case 'drifting': return 'text-yellow-400';
			case 'lost': return 'text-red-400';
			default: return 'text-gray-400';
		}
	}
	
	function getSyncStatusText() {
		switch (syncStatus) {
			case 'synced': return 'Synchronized';
			case 'drifting': return 'Drift Detected';
			case 'lost': return 'Sync Lost';
			default: return 'Unknown';
		}
	}
	
	// Watch for connection changes to start/stop timecode updates
	$: if (isConnected) {
		startTimecodeUpdates();
	} else if (timecodeInterval) {
		clearInterval(timecodeInterval);
		timecodeInterval = null;
	}
</script>

<div class="page-container">
	<ConnectionStatus />
	
	{#if isConnected}
		<div class="timecode-container">
			<!-- Current Timecode Display -->
			<TimecodeDisplay 
				displayMode="BOTH"
				size="large"
				showSync={true}
				showFrameRate={true}
				autoUpdate={isConnected}
				theme="dark"
			/>
			
			<!-- Timecode Mode Selection -->
			<div class="mode-section">
				<h3 class="section-title">Timecode Mode</h3>
				<div class="mode-buttons">
					<button 
						class="btn-mode {timecodeMode === 'free_run' ? 'active' : ''}"
						on:click={() => setTimecodeMode('free_run')}
						disabled={$isLoading}
					>
						Free Run
					</button>
					<button 
						class="btn-mode {timecodeMode === 'record_run' ? 'active' : ''}"
						on:click={() => setTimecodeMode('record_run')}
						disabled={$isLoading}
					>
						Record Run
					</button>
					<button 
						class="btn-mode {timecodeMode === 'external' ? 'active' : ''}"
						on:click={() => setTimecodeMode('external')}
						disabled={$isLoading}
					>
						External
					</button>
				</div>
				<div class="mode-description">
					{#if timecodeMode === 'free_run'}
						<p class="text-xs text-gray-400">
							Timecode runs continuously regardless of recording status
						</p>
					{:else if timecodeMode === 'record_run'}
						<p class="text-xs text-gray-400">
							Timecode only advances during recording
						</p>
					{:else if timecodeMode === 'external'}
						<p class="text-xs text-gray-400">
							Timecode synchronized to external source
						</p>
					{/if}
				</div>
			</div>
			
			<!-- Quick Actions -->
			<div class="actions-section">
				<h3 class="section-title">Quick Actions</h3>
				<div class="action-buttons">
					<button 
						class="btn-action" 
						on:click={syncToTimeOfDay}
						disabled={$isLoading}
					>
						<div class="action-icon">🕐</div>
						<div class="action-text">
							<div class="font-medium">Sync to Time of Day</div>
							<div class="text-xs text-gray-400">Set to current time</div>
						</div>
					</button>
					
					<button 
						class="btn-action" 
						on:click={() => showManualEntry = true}
						disabled={$isLoading}
					>
						<div class="action-icon">✏️</div>
						<div class="action-text">
							<div class="font-medium">Manual Entry</div>
							<div class="text-xs text-gray-400">Set custom timecode</div>
						</div>
					</button>
				</div>
			</div>
			
			<!-- Manual Timecode Entry Modal -->
			{#if showManualEntry}
				<div class="modal-overlay" on:click={() => showManualEntry = false}>
					<div class="modal-content" on:click|stopPropagation>
						<h3 class="modal-title">Set Manual Timecode</h3>
						<div class="manual-entry">
							<input 
								type="text" 
								class="timecode-input"
								placeholder="HH:MM:SS:FF"
								bind:value={manualTimecode}
								maxlength="11"
							/>
							<div class="text-xs text-gray-400 mt-2">
								Format: Hours:Minutes:Seconds:Frames
							</div>
						</div>
						<div class="modal-actions">
							<button 
								class="btn-secondary" 
								on:click={() => showManualEntry = false}
							>
								Cancel
							</button>
							<button 
								class="btn-primary" 
								on:click={setManualTimecode}
								disabled={!manualTimecode.match(/^\d{2}:\d{2}:\d{2}:\d{2}$/)}
							>
								Set Timecode
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="empty-state">
			<div class="text-center text-gray-400">
				<div class="text-4xl mb-4">🕐</div>
				<h3 class="text-lg font-medium mb-2">Camera Not Connected</h3>
				<p class="text-sm">Connect to an ARRI camera to manage timecode</p>
			</div>
		</div>
	{/if}
</div>

<style>
	.page-container {
		@apply p-4 max-w-md mx-auto;
	}
	
	.timecode-container {
		@apply space-y-6;
	}
	
	.timecode-display {
		@apply bg-arri-gray rounded-lg p-6 text-center;
	}
	
	.timecode-value {
		@apply text-3xl font-mono font-bold mb-2;
		letter-spacing: 0.1em;
	}
	
	.timecode-info {
		@apply flex justify-between items-center text-sm;
	}
	
	.sync-status {
		@apply font-medium;
	}
	
	.frame-rate {
		@apply text-gray-400;
	}
	
	.mode-section, .actions-section {
		@apply bg-arri-gray rounded-lg p-4;
	}
	
	.section-title {
		@apply text-sm font-medium text-gray-300 mb-3;
	}
	
	.mode-buttons {
		@apply flex gap-2 mb-2;
	}
	
	.btn-mode {
		@apply flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-3 rounded;
		@apply min-h-touch transition-colors;
	}
	
	.btn-mode.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.mode-description {
		@apply mt-2;
	}
	
	.action-buttons {
		@apply space-y-3;
	}
	
	.btn-action {
		@apply w-full flex items-center gap-3 p-3 bg-gray-700 hover:bg-gray-600 rounded-lg;
		@apply min-h-touch transition-colors text-left;
	}
	
	.action-icon {
		@apply text-xl flex-shrink-0;
	}
	
	.action-text {
		@apply flex-1;
	}
	
	.modal-overlay {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
	}
	
	.modal-content {
		@apply bg-arri-gray rounded-lg p-6 w-full max-w-sm;
	}
	
	.modal-title {
		@apply text-lg font-medium mb-4;
	}
	
	.manual-entry {
		@apply mb-6;
	}
	
	.timecode-input {
		@apply w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-center;
		@apply font-mono text-lg focus:outline-none focus:border-arri-red;
	}
	
	.modal-actions {
		@apply flex gap-3;
	}
	
	.empty-state {
		@apply flex items-center justify-center min-h-96;
	}
</style>