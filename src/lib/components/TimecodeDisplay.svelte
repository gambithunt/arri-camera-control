<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { safeStoreAccess } from '$lib/dev/mockStores';
	
	// Safe store access with fallbacks
	const { cameraStore, notificationStore, cameraApi, isUsingMocks } = safeStoreAccess();
	
	// Props
	export let displayMode: 'TC' | 'UB' | 'BOTH' = 'TC'; // Timecode, User Bits, or Both
	export let format: 'HH:MM:SS:FF' | 'HH:MM:SS.mmm' = 'HH:MM:SS:FF';
	export let size: 'small' | 'medium' | 'large' | 'xlarge' = 'medium';
	export let showSync = true;
	export let showFrameRate = true;
	export let autoUpdate = true;
	export let updateInterval = 40; // 25fps update rate
	export let showBorder = true;
	export let theme: 'dark' | 'light' | 'transparent' = 'dark';
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: currentTimecode = cameraState.currentTimecode || '00:00:00:00';
	$: timecodeMode = cameraState.timecodeMode || 'free_run';
	$: timecodeSync = cameraState.timecodeSync || 'synced';
	$: frameRate = cameraState.frameRate || 24;
	$: userBits = cameraState.userBits || '00:00:00:00';
	
	// Internal state
	let updateTimer: number | null = null;
	let lastUpdateTime = 0;
	let isUpdating = false;
	let displayTimecode = currentTimecode;
	let displayUserBits = userBits;
	let syncStatus = timecodeSync;
	let consecutiveErrors = 0;
	let maxConsecutiveErrors = 3;
	
	// Timecode validation and formatting
	function validateTimecode(tc: string): boolean {
		const tcRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]):([0-2][0-9]|3[0-1])$/;
		return tcRegex.test(tc);
	}
	
	function formatTimecode(tc: string, fmt: string): string {
		if (!validateTimecode(tc)) {
			return '00:00:00:00';
		}
		
		if (fmt === 'HH:MM:SS.mmm') {
			// Convert frames to milliseconds
			const parts = tc.split(':');
			const frames = parseInt(parts[3]);
			const milliseconds = Math.round((frames / frameRate) * 1000);
			return `${parts[0]}:${parts[1]}:${parts[2]}.${milliseconds.toString().padStart(3, '0')}`;
		}
		
		return tc; // Already in HH:MM:SS:FF format
	}
	
	function parseTimecodeToFrames(tc: string): number {
		if (!validateTimecode(tc)) return 0;
		
		const parts = tc.split(':').map(p => parseInt(p));
		const [hours, minutes, seconds, frames] = parts;
		
		return (hours * 3600 + minutes * 60 + seconds) * frameRate + frames;
	}
	
	function framesToTimecode(totalFrames: number): string {
		const frames = totalFrames % frameRate;
		const totalSeconds = Math.floor(totalFrames / frameRate);
		const seconds = totalSeconds % 60;
		const totalMinutes = Math.floor(totalSeconds / 60);
		const minutes = totalMinutes % 60;
		const hours = Math.floor(totalMinutes / 60);
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
	}
	
	async function updateTimecodeFromCamera() {
		if (!autoUpdate || isUpdating) return;
		
		isUpdating = true;
		const startTime = Date.now();
		
		try {
			const result = await cameraApi.getTimecode();
			
			if (result.success && result.data) {
				displayTimecode = result.data.timecode || currentTimecode;
				displayUserBits = result.data.userBits || userBits;
				syncStatus = result.data.syncStatus || 'synced';
				lastUpdateTime = Date.now();
				consecutiveErrors = 0;
				
				// Update store with new timecode data
				cameraStore.updateSettings({
					currentTimecode: displayTimecode,
					userBits: displayUserBits,
					timecodeSync: syncStatus
				});
				
			} else {
				handleUpdateError(result.error || 'Failed to get timecode');
			}
		} catch (error) {
			handleUpdateError(error instanceof Error ? error.message : 'Unknown error');
		} finally {
			isUpdating = false;
		}
	}
	
	function handleUpdateError(error: string) {
		consecutiveErrors++;
		
		if (consecutiveErrors >= maxConsecutiveErrors) {
			syncStatus = 'lost';
			stopAutoUpdate();
			notificationStore.warning(
				'Timecode Sync Lost',
				`Lost timecode synchronization: ${error}`
			);
		}
	}
	
	function startAutoUpdate() {
		if (updateTimer) {
			clearInterval(updateTimer);
		}
		
		updateTimer = setInterval(updateTimecodeFromCamera, updateInterval);
		consecutiveErrors = 0;
	}
	
	function stopAutoUpdate() {
		if (updateTimer) {
			clearInterval(updateTimer);
			updateTimer = null;
		}
	}
	
	// Sync status helpers
	function getSyncStatusColor(): string {
		switch (syncStatus) {
			case 'synced': return 'text-green-400';
			case 'drifting': return 'text-yellow-400';
			case 'lost': return 'text-red-400';
			case 'external': return 'text-blue-400';
			default: return 'text-gray-400';
		}
	}
	
	function getSyncStatusIcon(): string {
		switch (syncStatus) {
			case 'synced': return '🟢';
			case 'drifting': return '🟡';
			case 'lost': return '🔴';
			case 'external': return '🔵';
			default: return '⚪';
		}
	}
	
	function getSyncStatusText(): string {
		switch (syncStatus) {
			case 'synced': return 'Synchronized';
			case 'drifting': return 'Drift Detected';
			case 'lost': return 'Sync Lost';
			case 'external': return 'External Sync';
			default: return 'Unknown';
		}
	}
	
	function getTimecodeMode(): string {
		switch (timecodeMode) {
			case 'free_run': return 'Free Run';
			case 'record_run': return 'Record Run';
			case 'external': return 'External';
			default: return 'Unknown';
		}
	}
	
	function getSizeClass(): string {
		switch (size) {
			case 'small': return 'text-lg';
			case 'medium': return 'text-2xl';
			case 'large': return 'text-4xl';
			case 'xlarge': return 'text-6xl';
			default: return 'text-2xl';
		}
	}
	
	function getThemeClass(): string {
		switch (theme) {
			case 'light': return 'bg-white text-black border-gray-300';
			case 'transparent': return 'bg-transparent text-white border-transparent';
			case 'dark': 
			default: return 'bg-black text-white border-gray-600';
		}
	}
	
	// Lifecycle management
	onMount(() => {
		if (autoUpdate) {
			startAutoUpdate();
		}
		
		// Initial update
		displayTimecode = currentTimecode;
		displayUserBits = userBits;
		syncStatus = timecodeSync;
	});
	
	onDestroy(() => {
		stopAutoUpdate();
	});
	
	// Reactive updates
	$: if (autoUpdate && !updateTimer) {
		startAutoUpdate();
	} else if (!autoUpdate && updateTimer) {
		stopAutoUpdate();
	}
	
	// Update display when store values change (for non-auto-update mode)
	$: if (!autoUpdate) {
		displayTimecode = currentTimecode;
		displayUserBits = userBits;
		syncStatus = timecodeSync;
	}
</script>

<div class="timecode-display {getSizeClass()} {getThemeClass()} {showBorder ? 'border-2' : ''} {size}">
	<!-- Main Timecode Display -->
	<div class="timecode-main">
		{#if displayMode === 'TC' || displayMode === 'BOTH'}
			<div class="timecode-value" role="timer" aria-label="Current timecode">
				{formatTimecode(displayTimecode, format)}
			</div>
		{/if}
		
		{#if displayMode === 'UB' || displayMode === 'BOTH'}
			<div class="user-bits-value" aria-label="User bits">
				UB: {displayUserBits}
			</div>
		{/if}
	</div>
	
	<!-- Status Information -->
	{#if showSync || showFrameRate}
		<div class="timecode-status">
			{#if showSync}
				<div class="sync-status {getSyncStatusColor()}" title={getSyncStatusText()}>
					<span class="sync-icon">{getSyncStatusIcon()}</span>
					<span class="sync-text">{getSyncStatusText()}</span>
				</div>
			{/if}
			
			{#if showFrameRate}
				<div class="frame-rate-info">
					<span class="frame-rate">{frameRate} fps</span>
					<span class="timecode-mode">{getTimecodeMode()}</span>
				</div>
			{/if}
		</div>
	{/if}
	
	<!-- Update Indicator -->
	{#if autoUpdate && isUpdating}
		<div class="update-indicator" aria-label="Updating timecode">
			<div class="update-spinner"></div>
		</div>
	{/if}
</div>

<style>
	.timecode-display {
		@apply rounded-lg p-4 font-mono relative;
		@apply transition-all duration-200;
		min-width: fit-content;
	}
	
	.timecode-display.small {
		@apply p-2 text-base;
	}
	
	.timecode-display.medium {
		@apply p-3 text-xl;
	}
	
	.timecode-display.large {
		@apply p-4 text-3xl;
	}
	
	.timecode-display.xlarge {
		@apply p-6 text-5xl;
	}
	
	.timecode-main {
		@apply text-center space-y-1;
	}
	
	.timecode-value {
		@apply font-bold tracking-wider;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.1em;
	}
	
	.user-bits-value {
		@apply text-sm opacity-75 font-medium;
	}
	
	.timecode-status {
		@apply flex justify-between items-center mt-3 text-xs;
	}
	
	.sync-status {
		@apply flex items-center gap-1 font-medium;
	}
	
	.sync-icon {
		@apply text-sm;
	}
	
	.sync-text {
		@apply hidden sm:inline;
	}
	
	.frame-rate-info {
		@apply flex items-center gap-2 text-gray-400;
	}
	
	.frame-rate {
		@apply font-medium;
	}
	
	.timecode-mode {
		@apply text-xs opacity-75;
	}
	
	.update-indicator {
		@apply absolute top-2 right-2;
	}
	
	.update-spinner {
		@apply w-3 h-3 border border-current border-t-transparent rounded-full animate-spin;
		@apply opacity-50;
	}
	
	/* Size-specific adjustments */
	.timecode-display.small .timecode-status {
		@apply mt-1 text-xs;
	}
	
	.timecode-display.small .sync-text {
		@apply hidden;
	}
	
	.timecode-display.large .timecode-status {
		@apply mt-4 text-sm;
	}
	
	.timecode-display.xlarge .timecode-status {
		@apply mt-6 text-base;
	}
	
	/* Theme variations */
	.timecode-display:hover {
		@apply shadow-lg;
	}
	
	/* Accessibility improvements */
	@media (prefers-reduced-motion: reduce) {
		.timecode-display {
			@apply transition-none;
		}
		
		.update-spinner {
			@apply animate-none;
		}
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.timecode-display {
			@apply border-2 border-white;
		}
		
		.sync-status {
			@apply text-white;
		}
	}
	
	/* Focus styles for accessibility */
	.timecode-display:focus-within {
		@apply ring-2 ring-blue-500 ring-offset-2;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.timecode-display.large {
			@apply text-2xl p-3;
		}
		
		.timecode-display.xlarge {
			@apply text-3xl p-4;
		}
		
		.sync-text {
			@apply hidden;
		}
		
		.timecode-mode {
			@apply hidden;
		}
	}
	
	/* Print styles */
	@media print {
		.timecode-display {
			@apply bg-white text-black border-black;
		}
		
		.update-indicator {
			@apply hidden;
		}
	}
</style>"