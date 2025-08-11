<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { playbackStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	
	// Props
	export let disabled = false;
	export let compact = false;
	export let showTimecode = true;
	export let showSpeed = true;
	
	// Reactive store subscriptions
	$: playbackState = $playbackStore;
	$: currentClip = playbackState.currentClip;
	$: playbackStatus = playbackState.playbackStatus;
	$: currentPosition = playbackState.currentPosition;
	$: playbackSpeed = playbackState.playbackSpeed;
	$: isLoading = playbackState.operations.loading;
	
	// Scrub bar state
	let scrubbing = false;
	let scrubPosition = 0;
	let scrubBarElement: HTMLElement;
	
	// Playback speeds for ARRI cameras
	const playbackSpeeds = [
		{ value: -4, label: '-4x', description: 'Fast reverse' },
		{ value: -2, label: '-2x', description: 'Reverse' },
		{ value: -1, label: '-1x', description: 'Slow reverse' },
		{ value: 0.25, label: '¼x', description: 'Very slow' },
		{ value: 0.5, label: '½x', description: 'Slow motion' },
		{ value: 1, label: '1x', description: 'Normal speed' },
		{ value: 2, label: '2x', description: 'Fast forward' },
		{ value: 4, label: '4x', description: 'Very fast' }
	];
	
	// Transport control functions
	async function play() {
		if (disabled || !currentClip) return;
		
		try {
			const result = await cameraApi.startPlayback();
			if (result.success) {
				playbackStore.updateTransport({ playbackStatus: 'playing' });
				notificationStore.success('Playback', 'Started playback');
			} else {
				notificationStore.error('Playback Failed', result.error || 'Failed to start playback');
			}
		} catch (error) {
			notificationStore.error('Playback Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function pause() {
		if (disabled) return;
		
		try {
			const result = await cameraApi.pausePlayback();
			if (result.success) {
				playbackStore.updateTransport({ playbackStatus: 'paused' });
				notificationStore.success('Playback', 'Paused playback');
			} else {
				notificationStore.error('Pause Failed', result.error || 'Failed to pause playback');
			}
		} catch (error) {
			notificationStore.error('Pause Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function stop() {
		if (disabled) return;
		
		try {
			const result = await cameraApi.stopPlayback();
			if (result.success) {
				playbackStore.updateTransport({ 
					playbackStatus: 'stopped',
					currentPosition: 0 
				});
				notificationStore.success('Playback', 'Stopped playback');
			} else {
				notificationStore.error('Stop Failed', result.error || 'Failed to stop playback');
			}
		} catch (error) {
			notificationStore.error('Stop Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function setPlaybackSpeed(speed: number) {
		if (disabled) return;
		
		try {
			const result = await cameraApi.setPlaybackSpeed(speed);
			if (result.success) {
				playbackStore.updateTransport({ playbackSpeed: speed });
				const speedInfo = playbackSpeeds.find(s => s.value === speed);
				notificationStore.success('Speed Changed', `Set to ${speedInfo?.label || speed + 'x'}`);
			} else {
				notificationStore.error('Speed Change Failed', result.error || 'Failed to change speed');
			}
		} catch (error) {
			notificationStore.error('Speed Change Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function seekToPosition(position: number) {
		if (disabled || !currentClip) return;
		
		try {
			const result = await cameraApi.seekToPosition(position);
			if (result.success) {
				playbackStore.updateTransport({ currentPosition: position });
			} else {
				notificationStore.error('Seek Failed', result.error || 'Failed to seek to position');
			}
		} catch (error) {
			notificationStore.error('Seek Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function stepFrame(direction: 'forward' | 'backward') {
		if (disabled || !currentClip) return;
		
		try {
			const result = await cameraApi.stepFrame(direction);
			if (result.success) {
				const newPosition = direction === 'forward' 
					? Math.min(currentPosition + 1, currentClip.totalFrames || 0)
					: Math.max(currentPosition - 1, 0);
				playbackStore.updateTransport({ currentPosition: newPosition });
			} else {
				notificationStore.error('Step Failed', result.error || 'Failed to step frame');
			}
		} catch (error) {
			notificationStore.error('Step Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	// Scrub bar handling
	function handleScrubStart(event: MouseEvent | TouchEvent) {
		if (disabled || !currentClip) return;
		
		scrubbing = true;
		updateScrubPosition(event);
		
		// Pause playback during scrubbing
		if (playbackStatus === 'playing') {
			pause();
		}
		
		document.addEventListener('mousemove', handleScrubMove);
		document.addEventListener('mouseup', handleScrubEnd);
		document.addEventListener('touchmove', handleScrubMove);
		document.addEventListener('touchend', handleScrubEnd);
	}
	
	function handleScrubMove(event: MouseEvent | TouchEvent) {
		if (!scrubbing) return;
		updateScrubPosition(event);
	}
	
	function handleScrubEnd() {
		if (!scrubbing) return;
		
		scrubbing = false;
		
		// Seek to the scrubbed position
		if (currentClip) {
			const totalFrames = currentClip.totalFrames || 0;
			const targetPosition = Math.round((scrubPosition / 100) * totalFrames);
			seekToPosition(targetPosition);
		}
		
		document.removeEventListener('mousemove', handleScrubMove);
		document.removeEventListener('mouseup', handleScrubEnd);
		document.removeEventListener('touchmove', handleScrubMove);
		document.removeEventListener('touchend', handleScrubEnd);
	}
	
	function updateScrubPosition(event: MouseEvent | TouchEvent) {
		if (!scrubBarElement) return;
		
		const rect = scrubBarElement.getBoundingClientRect();
		const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
		const x = clientX - rect.left;
		const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
		
		scrubPosition = percentage;
		
		// Update position display during scrubbing
		if (currentClip) {
			const totalFrames = currentClip.totalFrames || 0;
			const targetPosition = Math.round((percentage / 100) * totalFrames);
			playbackStore.updateTransport({ currentPosition: targetPosition });
		}
	}
	
	// Utility functions
	function formatTimecode(position: number, totalFrames: number, frameRate: number = 24): string {
		if (!totalFrames || !frameRate) return '00:00:00:00';
		
		const totalSeconds = position / frameRate;
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = Math.floor(totalSeconds % 60);
		const frames = position % frameRate;
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
	}
	
	function formatDuration(durationMs: number): string {
		if (!durationMs) return '00:00:00';
		
		const totalSeconds = Math.floor(durationMs / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		
		return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
	}
	
	function getPlaybackProgress(): number {
		if (!currentClip || !currentClip.totalFrames) return 0;
		return (currentPosition / currentClip.totalFrames) * 100;
	}
	
	function getSpeedDescription(speed: number): string {
		const speedInfo = playbackSpeeds.find(s => s.value === speed);
		return speedInfo?.description || 'Custom speed';
	}
	
	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		if (disabled || !currentClip) return;
		
		switch (event.code) {
			case 'Space':
				event.preventDefault();
				if (playbackStatus === 'playing') {
					pause();
				} else {
					play();
				}
				break;
			case 'ArrowLeft':
				event.preventDefault();
				stepFrame('backward');
				break;
			case 'ArrowRight':
				event.preventDefault();
				stepFrame('forward');
				break;
			case 'Home':
				event.preventDefault();
				seekToPosition(0);
				break;
			case 'End':
				event.preventDefault();
				seekToPosition(currentClip.totalFrames || 0);
				break;
		}
	}
	
	onMount(() => {
		document.addEventListener('keydown', handleKeydown);
	});
	
	onDestroy(() => {
		document.removeEventListener('keydown', handleKeydown);
		document.removeEventListener('mousemove', handleScrubMove);
		document.removeEventListener('mouseup', handleScrubEnd);
		document.removeEventListener('touchmove', handleScrubMove);
		document.removeEventListener('touchend', handleScrubEnd);
	});
</script>

<div class="playback-controls {compact ? 'compact' : ''}">
	{#if currentClip}
		<!-- Current Clip Info -->
		<div class="clip-info">
			<div class="clip-name">{currentClip.name}</div>
			<div class="clip-metadata">
				<span class="metadata-item">{currentClip.resolution || 'Unknown'}</span>
				<span class="metadata-item">{formatDuration(currentClip.durationMs)}</span>
				<span class="metadata-item">{currentClip.codec || 'Unknown'}</span>
			</div>
		</div>
		
		<!-- Scrub Bar -->
		<div class="scrub-container">
			<div 
				class="scrub-bar"
				bind:this={scrubBarElement}
				on:mousedown={handleScrubStart}
				on:touchstart={handleScrubStart}
				role="slider"
				aria-label="Playback position"
				aria-valuemin="0"
				aria-valuemax={currentClip.totalFrames || 0}
				aria-valuenow={currentPosition}
				tabindex="0"
			>
				<div class="scrub-track">
					<div 
						class="scrub-progress"
						style="width: {scrubbing ? scrubPosition : getPlaybackProgress()}%"
					></div>
					<div 
						class="scrub-handle"
						style="left: {scrubbing ? scrubPosition : getPlaybackProgress()}%"
					></div>
				</div>
			</div>
			
			{#if showTimecode}
				<div class="timecode-display">
					<div class="current-timecode">
						{formatTimecode(currentPosition, currentClip.totalFrames || 0, currentClip.frameRate || 24)}
					</div>
					<div class="total-timecode">
						{formatTimecode(currentClip.totalFrames || 0, currentClip.totalFrames || 0, currentClip.frameRate || 24)}
					</div>
				</div>
			{/if}
		</div>
		
		<!-- Transport Controls -->
		<div class="transport-controls">
			<!-- Frame Step Backward -->
			<button
				class="btn-transport step"
				on:click={() => stepFrame('backward')}
				disabled={disabled || isLoading}
				aria-label="Step backward one frame"
			>
				⏮️
			</button>
			
			<!-- Play/Pause -->
			<button
				class="btn-transport primary"
				on:click={playbackStatus === 'playing' ? pause : play}
				disabled={disabled || isLoading}
				aria-label={playbackStatus === 'playing' ? 'Pause playback' : 'Start playback'}
			>
				{#if isLoading}
					<div class="loading-spinner"></div>
				{:else if playbackStatus === 'playing'}
					⏸️
				{:else}
					▶️
				{/if}
			</button>
			
			<!-- Stop -->
			<button
				class="btn-transport"
				on:click={stop}
				disabled={disabled || isLoading || playbackStatus === 'stopped'}
				aria-label="Stop playback"
			>
				⏹️
			</button>
			
			<!-- Frame Step Forward -->
			<button
				class="btn-transport step"
				on:click={() => stepFrame('forward')}
				disabled={disabled || isLoading}
				aria-label="Step forward one frame"
			>
				⏭️
			</button>
		</div>
		
		<!-- Speed Controls -->
		{#if showSpeed}
			<div class="speed-controls">
				<div class="speed-label">Speed: {playbackSpeed}x</div>
				<div class="speed-description">{getSpeedDescription(playbackSpeed)}</div>
				<div class="speed-buttons">
					{#each playbackSpeeds as speed}
						<button
							class="btn-speed {playbackSpeed === speed.value ? 'active' : ''}"
							on:click={() => setPlaybackSpeed(speed.value)}
							disabled={disabled || isLoading}
							aria-label="Set playback speed to {speed.label}"
						>
							{speed.label}
						</button>
					{/each}
				</div>
			</div>
		{/if}
		
		<!-- Position Info -->
		<div class="position-info">
			<div class="position-text">
				Frame {currentPosition} of {currentClip.totalFrames || 0}
			</div>
			<div class="progress-percentage">
				{getPlaybackProgress().toFixed(1)}%
			</div>
		</div>
		
	{:else}
		<!-- No Clip Selected -->
		<div class="no-clip-state">
			<div class="no-clip-icon">🎬</div>
			<div class="no-clip-title">No Clip Selected</div>
			<div class="no-clip-description">Select a clip from the browser to start playback</div>
		</div>
	{/if}
</div>

<style>
	.playback-controls {
		@apply space-y-4 bg-arri-gray rounded-lg p-4;
	}
	
	.playback-controls.compact {
		@apply space-y-2 p-3;
	}
	
	.clip-info {
		@apply text-center space-y-1;
	}
	
	.clip-name {
		@apply text-lg font-medium text-white;
	}
	
	.clip-metadata {
		@apply flex justify-center gap-3 text-sm text-gray-400;
	}
	
	.metadata-item {
		@apply bg-gray-700 px-2 py-1 rounded;
	}
	
	.scrub-container {
		@apply space-y-2;
	}
	
	.scrub-bar {
		@apply relative h-12 bg-gray-700 rounded-lg cursor-pointer;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red;
	}
	
	.scrub-track {
		@apply absolute inset-2 bg-gray-600 rounded-full overflow-hidden;
	}
	
	.scrub-progress {
		@apply h-full bg-arri-red transition-all duration-100;
	}
	
	.scrub-handle {
		@apply absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2;
		@apply w-4 h-4 bg-white rounded-full border-2 border-arri-red;
		@apply shadow-lg transition-all duration-100;
	}
	
	.scrub-bar:hover .scrub-handle {
		@apply scale-125;
	}
	
	.timecode-display {
		@apply flex justify-between text-sm font-mono;
	}
	
	.current-timecode {
		@apply text-white font-bold;
	}
	
	.total-timecode {
		@apply text-gray-400;
	}
	
	.transport-controls {
		@apply flex justify-center items-center gap-4;
	}
	
	.btn-transport {
		@apply w-12 h-12 bg-gray-700 hover:bg-gray-600 text-white rounded-full;
		@apply flex items-center justify-center text-xl transition-all duration-200;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red;
	}
	
	.btn-transport.primary {
		@apply w-16 h-16 bg-arri-red hover:bg-red-600 text-2xl;
	}
	
	.btn-transport.step {
		@apply w-10 h-10 text-lg;
	}
	
	.loading-spinner {
		@apply w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin;
	}
	
	.speed-controls {
		@apply space-y-2;
	}
	
	.speed-label {
		@apply text-center text-white font-medium;
	}
	
	.speed-description {
		@apply text-center text-sm text-gray-400;
	}
	
	.speed-buttons {
		@apply flex flex-wrap justify-center gap-2;
	}
	
	.btn-speed {
		@apply bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium py-2 px-3 rounded;
		@apply min-h-touch transition-colors;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-speed.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.position-info {
		@apply flex justify-between items-center text-sm text-gray-400;
		@apply border-t border-gray-600 pt-3;
	}
	
	.position-text {
		@apply font-mono;
	}
	
	.progress-percentage {
		@apply font-bold;
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
	
	/* Touch optimizations */
	@media (hover: none) {
		.scrub-handle {
			@apply scale-125;
		}
		
		.btn-transport {
			@apply min-h-touch min-w-touch;
		}
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.transport-controls {
			@apply gap-2;
		}
		
		.btn-transport {
			@apply w-10 h-10 text-lg;
		}
		
		.btn-transport.primary {
			@apply w-14 h-14 text-xl;
		}
		
		.speed-buttons {
			@apply gap-1;
		}
		
		.btn-speed {
			@apply text-xs px-2 py-1;
		}
		
		.clip-metadata {
			@apply flex-col gap-1;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.scrub-progress {
			@apply bg-yellow-400;
		}
		
		.scrub-handle {
			@apply border-yellow-400;
		}
		
		.btn-transport.primary {
			@apply bg-yellow-600 hover:bg-yellow-700;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.scrub-progress, .scrub-handle {
			@apply transition-none;
		}
		
		.btn-transport {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
	}
	
	/* Focus styles for keyboard navigation */
	.scrub-bar:focus {
		@apply ring-2 ring-arri-red ring-offset-2 ring-offset-arri-gray;
	}
	
	.btn-transport:focus {
		@apply ring-2 ring-arri-red ring-offset-2 ring-offset-arri-gray;
	}
</style>"