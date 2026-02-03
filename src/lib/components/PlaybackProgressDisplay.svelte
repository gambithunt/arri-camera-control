<script lang="ts">
	import { safeStoreAccess } from '$lib/dev/mockStores';
	
	// Safe store access with fallbacks
	const { playbackStore, isUsingMocks } = safeStoreAccess();
	
	// Props
	export let showDetailed = true;
	export let showBuffer = true;
	export let showStats = false;
	export let compact = false;
	
	// Reactive store subscriptions
	$: playbackState = $playbackStore;
	$: currentClip = playbackState.currentClip;
	$: currentPosition = playbackState.currentPosition;
	$: playbackStatus = playbackState.playbackStatus;
	$: bufferHealth = playbackState.bufferHealth;
	$: playbackStats = playbackState.playbackStats;
	
	// Progress calculations
	$: totalFrames = currentClip?.totalFrames || 0;
	$: progressPercentage = totalFrames > 0 ? (currentPosition / totalFrames) * 100 : 0;
	$: remainingFrames = totalFrames - currentPosition;
	$: remainingTime = calculateRemainingTime();
	
	function calculateRemainingTime(): string {
		if (!currentClip || !currentClip.frameRate || remainingFrames <= 0) {
			return '00:00:00';
		}
		
		const remainingSeconds = remainingFrames / currentClip.frameRate;
		const hours = Math.floor(remainingSeconds / 3600);
		const minutes = Math.floor((remainingSeconds % 3600) / 60);
		const seconds = Math.floor(remainingSeconds % 60);
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	
	function formatDuration(durationMs: number): string {
		if (!durationMs) return '00:00:00';
		
		const totalSeconds = Math.floor(durationMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	
	function getProgressBarColor(): string {
		if (playbackStatus === 'error') return 'bg-red-500';
		if (playbackStatus === 'completed') return 'bg-green-500';
		if (playbackStatus === 'playing') return 'bg-arri-red';
		return 'bg-gray-500';
	}
	
	function getBufferHealthColor(): string {
		if (!bufferHealth) return 'bg-gray-500';
		if (bufferHealth < 10) return 'bg-red-500';
		if (bufferHealth < 20) return 'bg-yellow-500';
		if (bufferHealth < 50) return 'bg-orange-500';
		return 'bg-green-500';
	}
	
	function getPlaybackStatusIcon(): string {
		switch (playbackStatus) {
			case 'playing': return '▶️';
			case 'paused': return '⏸️';
			case 'stopped': return '⏹️';
			case 'completed': return '✅';
			case 'error': return '❌';
			default: return '⏹️';
		}
	}
	
	function getPlaybackStatusText(): string {
		switch (playbackStatus) {
			case 'playing': return 'Playing';
			case 'paused': return 'Paused';
			case 'stopped': return 'Stopped';
			case 'completed': return 'Completed';
			case 'error': return 'Error';
			default: return 'Unknown';
		}
	}
</script>

<div class="playback-progress-display {compact ? 'compact' : ''}">
	{#if currentClip}
		<!-- Main Progress Bar -->
		<div class="progress-section">
			<div class="progress-header">
				<div class="status-indicator">
					<span class="status-icon">{getPlaybackStatusIcon()}</span>
					<span class="status-text">{getPlaybackStatusText()}</span>
				</div>
				<div class="progress-percentage">
					{progressPercentage.toFixed(1)}%
				</div>
			</div>
			
			<div class="progress-bar-container">
				<div class="progress-bar">
					<div 
						class="progress-fill {getProgressBarColor()}"
						style="width: {progressPercentage}%"
					></div>
				</div>
				
				{#if showBuffer && bufferHealth !== undefined}
					<div class="buffer-indicator">
						<div class="buffer-label">Buffer</div>
						<div class="buffer-bar">
							<div 
								class="buffer-fill {getBufferHealthColor()}"
								style="width: {bufferHealth}%"
							></div>
						</div>
						<div class="buffer-percentage">{bufferHealth}%</div>
					</div>
				{/if}
			</div>
		</div>
		
		{#if showDetailed}
			<!-- Detailed Information -->
			<div class="details-section">
				<div class="detail-row">
					<div class="detail-item">
						<div class="detail-label">Position</div>
						<div class="detail-value">Frame {currentPosition.toLocaleString()}</div>
					</div>
					<div class="detail-item">
						<div class="detail-label">Remaining</div>
						<div class="detail-value">{remainingTime}</div>
					</div>
				</div>
				
				<div class="detail-row">
					<div class="detail-item">
						<div class="detail-label">Total Frames</div>
						<div class="detail-value">{totalFrames.toLocaleString()}</div>
					</div>
					<div class="detail-item">
						<div class="detail-label">Duration</div>
						<div class="detail-value">{formatDuration(currentClip.durationMs)}</div>
					</div>
				</div>
				
				{#if currentClip.frameRate}
					<div class="detail-row">
						<div class="detail-item">
							<div class="detail-label">Frame Rate</div>
							<div class="detail-value">{currentClip.frameRate} fps</div>
						</div>
						<div class="detail-item">
							<div class="detail-label">Speed</div>
							<div class="detail-value">{playbackState.playbackSpeed}x</div>
						</div>
					</div>
				{/if}
			</div>
		{/if}
		
		{#if showStats && playbackStats}
			<!-- Playback Statistics -->
			<div class="stats-section">
				<div class="stats-title">Playback Statistics</div>
				<div class="stats-grid">
					{#if playbackStats.averageFrameRate > 0}
						<div class="stat-item">
							<div class="stat-label">Avg Frame Rate</div>
							<div class="stat-value">{playbackStats.averageFrameRate.toFixed(1)} fps</div>
						</div>
					{/if}
					
					{#if playbackStats.framesPlayed > 0}
						<div class="stat-item">
							<div class="stat-label">Frames Played</div>
							<div class="stat-value">{playbackStats.framesPlayed.toLocaleString()}</div>
						</div>
					{/if}
					
					{#if playbackStats.totalPlayTime > 0}
						<div class="stat-item">
							<div class="stat-label">Play Time</div>
							<div class="stat-value">{formatDuration(playbackStats.totalPlayTime)}</div>
						</div>
					{/if}
					
					{#if playbackStats.droppedFrames > 0}
						<div class="stat-item warning">
							<div class="stat-label">Dropped Frames</div>
							<div class="stat-value">{playbackStats.droppedFrames}</div>
						</div>
					{/if}
				</div>
			</div>
		{/if}
		
	{:else}
		<!-- No Clip State -->
		<div class="no-clip-state">
			<div class="no-clip-icon">📊</div>
			<div class="no-clip-title">No Playback Active</div>
			<div class="no-clip-description">Select and play a clip to see progress information</div>
		</div>
	{/if}
</div>

<style>
	.playback-progress-display {
		@apply space-y-4 bg-arri-gray rounded-lg p-4;
	}
	
	.playback-progress-display.compact {
		@apply space-y-2 p-3;
	}
	
	.progress-section {
		@apply space-y-3;
	}
	
	.progress-header {
		@apply flex justify-between items-center;
	}
	
	.status-indicator {
		@apply flex items-center gap-2;
	}
	
	.status-icon {
		@apply text-lg;
	}
	
	.status-text {
		@apply font-medium text-white;
	}
	
	.progress-percentage {
		@apply text-lg font-bold text-white;
	}
	
	.progress-bar-container {
		@apply space-y-2;
	}
	
	.progress-bar {
		@apply w-full h-3 bg-gray-700 rounded-full overflow-hidden;
	}
	
	.progress-fill {
		@apply h-full transition-all duration-300 ease-out;
	}
	
	.buffer-indicator {
		@apply flex items-center gap-3 text-sm;
	}
	
	.buffer-label {
		@apply text-gray-400 w-12;
	}
	
	.buffer-bar {
		@apply flex-1 h-2 bg-gray-700 rounded-full overflow-hidden;
	}
	
	.buffer-fill {
		@apply h-full transition-all duration-300;
	}
	
	.buffer-percentage {
		@apply text-gray-300 font-mono w-10 text-right;
	}
	
	.details-section {
		@apply space-y-2 border-t border-gray-600 pt-3;
	}
	
	.detail-row {
		@apply flex gap-4;
	}
	
	.detail-item {
		@apply flex-1 space-y-1;
	}
	
	.detail-label {
		@apply text-xs text-gray-400 uppercase tracking-wide;
	}
	
	.detail-value {
		@apply text-sm font-mono text-white;
	}
	
	.stats-section {
		@apply space-y-3 border-t border-gray-600 pt-3;
	}
	
	.stats-title {
		@apply text-sm font-medium text-gray-300;
	}
	
	.stats-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.stat-item {
		@apply space-y-1;
	}
	
	.stat-item.warning {
		@apply text-yellow-400;
	}
	
	.stat-label {
		@apply text-xs text-gray-400;
	}
	
	.stat-value {
		@apply text-sm font-mono font-medium;
	}
	
	.no-clip-state {
		@apply text-center py-8 space-y-3;
	}
	
	.no-clip-icon {
		@apply text-4xl;
	}
	
	.no-clip-title {
		@apply text-lg font-medium text-white;
	}
	
	.no-clip-description {
		@apply text-gray-400;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.detail-row {
			@apply flex-col gap-2;
		}
		
		.stats-grid {
			@apply grid-cols-1 gap-2;
		}
		
		.buffer-indicator {
			@apply flex-col gap-1;
		}
		
		.buffer-label {
			@apply w-auto;
		}
		
		.progress-header {
			@apply flex-col gap-2 items-start;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.progress-fill {
			@apply border border-white;
		}
		
		.buffer-fill {
			@apply border border-white;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.progress-fill, .buffer-fill {
			@apply transition-none;
		}
	}
</style>"