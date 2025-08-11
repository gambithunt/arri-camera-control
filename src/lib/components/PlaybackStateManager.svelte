<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { playbackStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Props
	export let updateInterval = 100; // Update interval in milliseconds
	export let enabled = true;
	export let showStatusIndicator = true;
	
	// Reactive store subscriptions
	$: playbackState = $playbackStore;
	$: currentClip = playbackState.currentClip;
	$: playbackStatus = playbackState.playbackStatus;
	$: isInPlaybackMode = playbackState.isInPlaybackMode;
	
	// State management
	let updateTimer: number | null = null;
	let lastUpdateTime = 0;
	let consecutiveErrors = 0;
	let maxConsecutiveErrors = 5;
	let isUpdating = false;
	
	// Status indicators
	let connectionStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
	let lastSuccessfulUpdate = 0;
	let updateLatency = 0;
	
	// Playback statistics
	let playbackStats = {
		totalPlayTime: 0,
		framesPlayed: 0,
		averageFrameRate: 0,
		droppedFrames: 0,
		lastFrameTime: 0
	};
	
	async function updatePlaybackState() {
		if (!enabled || !isInPlaybackMode || !currentClip || isUpdating) {
			return;
		}
		
		isUpdating = true;
		const startTime = Date.now();
		
		try {
			const result = await cameraApi.getPlaybackStatus();
			
			if (result.success && result.data) {
				const updateTime = Date.now();
				updateLatency = updateTime - startTime;
				lastSuccessfulUpdate = updateTime;
				connectionStatus = 'connected';
				consecutiveErrors = 0;
				
				// Update playback state
				const newState = {
					playbackStatus: result.data.status,
					currentPosition: result.data.position,
					playbackSpeed: result.data.speed,
					currentTimecode: result.data.timecode,
					bufferHealth: result.data.bufferHealth || 100,
					droppedFrames: result.data.droppedFrames || 0
				};
				
				playbackStore.updateTransport(newState);
				
				// Update statistics
				updatePlaybackStatistics(result.data);
				
				// Handle playback completion
				if (result.data.status === 'completed') {
					handlePlaybackCompletion();
				}
				
				// Handle buffer warnings
				if (result.data.bufferHealth && result.data.bufferHealth < 20) {
					handleBufferWarning(result.data.bufferHealth);
				}
				
			} else {
				handleUpdateError(result.error || 'Failed to get playback status');
			}
		} catch (error) {
			handleUpdateError(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			isUpdating = false;
		}
	}
	
	function updatePlaybackStatistics(data: any) {
		const currentTime = Date.now();
		
		if (data.status === 'playing' && playbackStats.lastFrameTime > 0) {
			const timeDelta = currentTime - playbackStats.lastFrameTime;
			const frameDelta = data.position - playbackState.currentPosition;
			
			if (frameDelta > 0 && timeDelta > 0) {
				playbackStats.framesPlayed += frameDelta;
				playbackStats.totalPlayTime += timeDelta;
				
				// Calculate average frame rate
				const instantFrameRate = (frameDelta / timeDelta) * 1000;
				playbackStats.averageFrameRate = playbackStats.totalPlayTime > 0 
					? (playbackStats.framesPlayed / playbackStats.totalPlayTime) * 1000
					: instantFrameRate;
			}
		}
		
		playbackStats.lastFrameTime = currentTime;
		playbackStats.droppedFrames = data.droppedFrames || 0;
		
		// Update store with statistics
		playbackStore.updatePlaybackStats(playbackStats);
	}
	
	function handleUpdateError(error: string) {
		consecutiveErrors++;
		connectionStatus = 'error';
		
		console.warn(`Playback state update error (${consecutiveErrors}/${maxConsecutiveErrors}):`, error);
		
		if (consecutiveErrors >= maxConsecutiveErrors) {
			// Stop updates after too many consecutive errors
			stopUpdates();
			notificationStore.error(
				'Playback State Error', 
				`Lost connection to playback system. ${error}`
			);
			
			// Reset playback state to safe values
			playbackStore.updateTransport({
				playbackStatus: 'error',
				bufferHealth: 0
			});
		}
	}
	
	function handlePlaybackCompletion() {
		playbackStore.updateTransport({
			playbackStatus: 'completed',
			currentPosition: currentClip?.totalFrames || 0
		});
		
		notificationStore.success('Playback Complete', `Finished playing ${currentClip?.name}`);
		
		// Reset statistics for next playback
		resetPlaybackStatistics();
	}
	
	function handleBufferWarning(bufferHealth: number) {
		if (bufferHealth < 10) {
			notificationStore.warning(
				'Buffer Critical', 
				`Playback buffer critically low (${bufferHealth}%)`
			);
		} else if (bufferHealth < 20) {
			console.warn(`Playback buffer low: ${bufferHealth}%`);
		}
	}
	
	function resetPlaybackStatistics() {
		playbackStats = {
			totalPlayTime: 0,
			framesPlayed: 0,
			averageFrameRate: 0,
			droppedFrames: 0,
			lastFrameTime: 0
		};
		
		playbackStore.updatePlaybackStats(playbackStats);
	}
	
	function startUpdates() {
		if (updateTimer) {
			clearInterval(updateTimer);
		}
		
		updateTimer = setInterval(updatePlaybackState, updateInterval);
		consecutiveErrors = 0;
		connectionStatus = 'connected';
		
		// Initial update
		updatePlaybackState();
	}
	
	function stopUpdates() {
		if (updateTimer) {
			clearInterval(updateTimer);
			updateTimer = null;
		}
		
		connectionStatus = 'disconnected';
	}
	
	// Reactive updates based on playback state
	$: if (enabled && isInPlaybackMode && currentClip && playbackStatus === 'playing') {
		startUpdates();
	} else {
		stopUpdates();
	}
	
	// Handle playback mode changes
	$: if (!isInPlaybackMode) {
		stopUpdates();
		resetPlaybackStatistics();
	}
	
	// Handle clip changes
	$: if (currentClip) {
		resetPlaybackStatistics();
		if (playbackStatus === 'playing') {
			startUpdates();
		}
	}
	
	// Lifecycle management
	onMount(() => {
		console.log('PlaybackStateManager initialized');
		
		if (enabled && isInPlaybackMode && currentClip && playbackStatus === 'playing') {
			startUpdates();
		}
	});
	
	onDestroy(() => {
		stopUpdates();
		console.log('PlaybackStateManager destroyed');
	});
	
	// Utility functions for display
	function getConnectionStatusColor(): string {
		switch (connectionStatus) {
			case 'connected': return 'text-green-400';
			case 'error': return 'text-red-400';
			case 'disconnected': return 'text-gray-400';
			default: return 'text-gray-400';
		}
	}
	
	function getConnectionStatusText(): string {
		switch (connectionStatus) {
			case 'connected': return 'Connected';
			case 'error': return 'Error';
			case 'disconnected': return 'Disconnected';
			default: return 'Unknown';
		}
	}
	
	function formatLatency(ms: number): string {
		return `${ms}ms`;
	}
	
	function formatFrameRate(fps: number): string {
		return `${fps.toFixed(1)} fps`;
	}
	
	function getTimeSinceLastUpdate(): number {
		return lastSuccessfulUpdate > 0 ? Date.now() - lastSuccessfulUpdate : 0;
	}
</script>

<!-- Status Indicator (optional) -->
{#if showStatusIndicator && (isInPlaybackMode || connectionStatus === 'error')}
	<div class="playback-status-indicator">
		<div class="status-header">
			<div class="status-title">Playback Status</div>
			<div class="connection-status {getConnectionStatusColor()}">
				● {getConnectionStatusText()}
			</div>
		</div>
		
		{#if connectionStatus === 'connected'}
			<div class="status-details">
				<div class="status-item">
					<span class="status-label">Latency:</span>
					<span class="status-value">{formatLatency(updateLatency)}</span>
				</div>
				
				{#if playbackStats.averageFrameRate > 0}
					<div class="status-item">
						<span class="status-label">Frame Rate:</span>
						<span class="status-value">{formatFrameRate(playbackStats.averageFrameRate)}</span>
					</div>
				{/if}
				
				{#if playbackStats.droppedFrames > 0}
					<div class="status-item warning">
						<span class="status-label">Dropped Frames:</span>
						<span class="status-value">{playbackStats.droppedFrames}</span>
					</div>
				{/if}
				
				{#if playbackState.bufferHealth !== undefined}
					<div class="status-item {playbackState.bufferHealth < 20 ? 'warning' : ''}">
						<span class="status-label">Buffer:</span>
						<span class="status-value">{playbackState.bufferHealth}%</span>
					</div>
				{/if}
			</div>
		{:else if connectionStatus === 'error'}
			<div class="error-details">
				<div class="error-message">
					Connection lost. Attempting to reconnect...
				</div>
				<div class="error-stats">
					Errors: {consecutiveErrors}/{maxConsecutiveErrors}
				</div>
				{#if lastSuccessfulUpdate > 0}
					<div class="last-update">
						Last update: {Math.round(getTimeSinceLastUpdate() / 1000)}s ago
					</div>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.playback-status-indicator {
		@apply bg-arri-gray rounded-lg p-3 text-sm;
		@apply border-l-4 border-blue-500;
	}
	
	.status-header {
		@apply flex justify-between items-center mb-2;
	}
	
	.status-title {
		@apply font-medium text-white;
	}
	
	.connection-status {
		@apply font-medium;
	}
	
	.status-details {
		@apply space-y-1;
	}
	
	.status-item {
		@apply flex justify-between items-center;
	}
	
	.status-item.warning {
		@apply text-yellow-400;
	}
	
	.status-label {
		@apply text-gray-400;
	}
	
	.status-value {
		@apply font-mono font-medium;
	}
	
	.error-details {
		@apply space-y-2 text-red-400;
	}
	
	.error-message {
		@apply font-medium;
	}
	
	.error-stats, .last-update {
		@apply text-xs text-gray-400;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.playback-status-indicator {
			@apply text-xs p-2;
		}
		
		.status-header {
			@apply flex-col items-start gap-1;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.playback-status-indicator {
			@apply border-white;
		}
	}
</style>"