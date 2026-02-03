<script lang="ts">
	import { safeStoreAccess } from '$lib/dev/mockStores';
	
	// Props
	export let disabled = false;
	export let showLabel = true;
	export let compact = false;
	
	// Safe store access with fallbacks
	const { cameraStore, notificationStore, cameraApi, isUsingMocks } = safeStoreAccess();
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: frameLinesEnabled = cameraState.frameLinesEnabled;
	$: isLoading = cameraState.operations?.frameLines || false;
	
	// Frame line types available on ARRI cameras
	const frameLineTypes = [
		{ id: 'off', label: 'Off', description: 'No frame lines displayed' },
		{ id: 'center', label: 'Center', description: 'Center cross marker only' },
		{ id: 'thirds', label: 'Rule of Thirds', description: '3x3 grid overlay' },
		{ id: 'safe', label: 'Safe Areas', description: 'Action and title safe areas' },
		{ id: 'aspect', label: 'Aspect Ratios', description: 'Common aspect ratio guides' },
		{ id: 'custom', label: 'Custom', description: 'User-defined frame lines' }
	];
	
	// Current frame line type (derived from camera state)
	$: currentFrameLineType = frameLinesEnabled ? (cameraState.frameLineType || 'thirds') : 'off';
	
	async function toggleFrameLines() {
		if (disabled) return;
		
		const newState = !frameLinesEnabled;
		cameraStore.setOperationLoading('frameLines', true);
		
		try {
			const result = await cameraApi.setFrameLines(newState);
			if (result.success) {
				cameraStore.updateSettings({ frameLinesEnabled: newState });
				notificationStore.cameraCommandSuccess('Frame Lines');
			} else {
				notificationStore.cameraCommandError('Frame Lines', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('Frame Lines', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('frameLines', false);
		}
	}
	
	async function setFrameLineType(type: string) {
		if (disabled) return;
		
		// If turning on frame lines, enable them first
		if (!frameLinesEnabled && type !== 'off') {
			cameraStore.setOperationLoading('frameLines', true);
			
			try {
				const enableResult = await cameraApi.setFrameLines(true);
				if (!enableResult.success) {
					notificationStore.cameraCommandError('Frame Lines', enableResult.error || 'Failed to enable frame lines');
					return;
				}
			} catch (error) {
				notificationStore.cameraCommandError('Frame Lines', error instanceof Error ? error.message : 'Unknown error');
				return;
			} finally {
				cameraStore.setOperationLoading('frameLines', false);
			}
		}
		
		// If turning off, just disable frame lines
		if (type === 'off') {
			await toggleFrameLines();
			return;
		}
		
		cameraStore.setOperationLoading('frameLines', true);
		
		try {
			const result = await cameraApi.setFrameLineType(type);
			if (result.success) {
				cameraStore.updateSettings({ 
					frameLinesEnabled: true,
					frameLineType: type 
				});
				notificationStore.cameraCommandSuccess('Frame Line Type');
			} else {
				notificationStore.cameraCommandError('Frame Line Type', result.error || 'Unknown error');
			}
		} catch (error) {
			notificationStore.cameraCommandError('Frame Line Type', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('frameLines', false);
		}
	}
	
	function getFrameLineDescription(type: string): string {
		const frameLineType = frameLineTypes.find(t => t.id === type);
		return frameLineType?.description || 'Unknown frame line type';
	}
	
	function getFrameLineIcon(type: string): string {
		switch (type) {
			case 'off': return '⬜';
			case 'center': return '✚';
			case 'thirds': return '⚏';
			case 'safe': return '🔲';
			case 'aspect': return '📐';
			case 'custom': return '⚙️';
			default: return '⬜';
		}
	}
	
	// Touch interaction helpers
	let touchStartTime = 0;
	let touchStartTarget: HTMLElement | null = null;
	
	function handleTouchStart(event: TouchEvent, type: string) {
		touchStartTime = Date.now();
		touchStartTarget = event.currentTarget as HTMLElement;
		touchStartTarget.classList.add('touch-active');
	}
	
	function handleTouchEnd(event: TouchEvent, type: string) {
		const touchDuration = Date.now() - touchStartTime;
		
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		
		// Only trigger if it was a quick tap
		if (touchDuration < 500 && touchStartTarget === event.currentTarget) {
			setFrameLineType(type);
		}
		
		touchStartTarget = null;
	}
	
	function handleTouchCancel() {
		if (touchStartTarget) {
			touchStartTarget.classList.remove('touch-active');
		}
		touchStartTarget = null;
	}
</script>

<div class="frame-lines-control {compact ? 'compact' : ''}">
	{#if showLabel}
		<div class="control-header">
			<h3 class="control-title">Frame Lines</h3>
			<div class="current-value">
				<span class="status-indicator {frameLinesEnabled ? 'enabled' : 'disabled'}">
					{frameLinesEnabled ? 'ON' : 'OFF'}
				</span>
				{#if isLoading}
					<div class="loading-spinner"></div>
				{/if}
			</div>
			<div class="current-description">
				{getFrameLineDescription(currentFrameLineType)}
			</div>
		</div>
	{/if}
	
	<!-- Quick Toggle -->
	<div class="quick-toggle">
		<button
			class="toggle-button {frameLinesEnabled ? 'enabled' : 'disabled'}"
			on:click={toggleFrameLines}
			disabled={disabled || isLoading}
			aria-label="Toggle frame lines {frameLinesEnabled ? 'off' : 'on'}"
		>
			<div class="toggle-icon">
				{frameLinesEnabled ? '👁️' : '👁️‍🗨️'}
			</div>
			<div class="toggle-text">
				{frameLinesEnabled ? 'Disable' : 'Enable'} Frame Lines
			</div>
		</button>
	</div>
	
	<!-- Frame Line Types -->
	<div class="frame-line-types">
		<h4 class="types-title">Frame Line Types</h4>
		<div class="types-grid {compact ? 'compact-grid' : ''}">
			{#each frameLineTypes as frameLineType}
				<button
					class="type-button {currentFrameLineType === frameLineType.id ? 'active' : ''} {frameLineType.id === 'off' ? 'off-button' : ''}"
					on:click={() => setFrameLineType(frameLineType.id)}
					on:touchstart={(e) => handleTouchStart(e, frameLineType.id)}
					on:touchend={(e) => handleTouchEnd(e, frameLineType.id)}
					on:touchcancel={handleTouchCancel}
					disabled={disabled || isLoading}
					aria-label="Set frame lines to {frameLineType.label} - {frameLineType.description}"
				>
					<div class="type-icon">{getFrameLineIcon(frameLineType.id)}</div>
					<div class="type-label">{frameLineType.label}</div>
					{#if !compact}
						<div class="type-description">{frameLineType.description}</div>
					{/if}
				</button>
			{/each}
		</div>
	</div>
	
	<!-- Frame Line Preview -->
	{#if frameLinesEnabled && currentFrameLineType !== 'off'}
		<div class="frame-preview">
			<div class="preview-title">Preview</div>
			<div class="preview-container">
				<div class="preview-frame {currentFrameLineType}">
					{#if currentFrameLineType === 'center'}
						<div class="center-cross">
							<div class="cross-horizontal"></div>
							<div class="cross-vertical"></div>
						</div>
					{:else if currentFrameLineType === 'thirds'}
						<div class="thirds-grid">
							<div class="grid-line grid-v1"></div>
							<div class="grid-line grid-v2"></div>
							<div class="grid-line grid-h1"></div>
							<div class="grid-line grid-h2"></div>
						</div>
					{:else if currentFrameLineType === 'safe'}
						<div class="safe-areas">
							<div class="safe-area action-safe"></div>
							<div class="safe-area title-safe"></div>
						</div>
					{:else if currentFrameLineType === 'aspect'}
						<div class="aspect-guides">
							<div class="aspect-line aspect-16-9"></div>
							<div class="aspect-line aspect-21-9"></div>
						</div>
					{:else if currentFrameLineType === 'custom'}
						<div class="custom-lines">
							<div class="custom-indicator">Custom frame lines active</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.frame-lines-control {
		@apply space-y-4;
	}
	
	.frame-lines-control.compact {
		@apply space-y-2;
	}
	
	.control-header {
		@apply text-center space-y-1;
	}
	
	.control-title {
		@apply text-sm font-medium text-gray-300;
	}
	
	.current-value {
		@apply text-xl font-bold flex items-center justify-center gap-2;
	}
	
	.status-indicator {
		@apply px-3 py-1 rounded-full text-sm font-bold;
	}
	
	.status-indicator.enabled {
		@apply bg-green-600 text-white;
	}
	
	.status-indicator.disabled {
		@apply bg-gray-600 text-gray-300;
	}
	
	.current-description {
		@apply text-xs text-gray-400;
	}
	
	.loading-spinner {
		@apply w-5 h-5 border-2 border-arri-red border-t-transparent rounded-full animate-spin;
	}
	
	.quick-toggle {
		@apply flex justify-center;
	}
	
	.toggle-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-4 transition-all duration-200;
		@apply min-h-touch flex items-center gap-3;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.toggle-button.enabled {
		@apply bg-green-600 hover:bg-green-700 border-green-400;
	}
	
	.toggle-icon {
		@apply text-2xl;
	}
	
	.toggle-text {
		@apply font-medium;
	}
	
	.frame-line-types {
		@apply space-y-3;
	}
	
	.types-title {
		@apply text-sm font-medium text-gray-300 text-center;
	}
	
	.types-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.types-grid.compact-grid {
		@apply grid-cols-3 gap-2;
	}
	
	.type-button {
		@apply bg-arri-gray hover:bg-gray-600 text-white rounded-lg p-3 transition-all duration-200;
		@apply min-h-touch flex flex-col items-center justify-center space-y-1;
		@apply border-2 border-transparent focus:outline-none focus:border-arri-red;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.type-button.active {
		@apply bg-arri-red hover:bg-red-600 border-red-400;
	}
	
	.type-button.off-button.active {
		@apply bg-gray-600 hover:bg-gray-500 border-gray-400;
	}
	
	.type-button.touch-active {
		@apply scale-95 bg-gray-500;
	}
	
	.type-button.active.touch-active {
		@apply bg-red-700;
	}
	
	.compact .type-button {
		@apply p-2;
	}
	
	.type-icon {
		@apply text-xl;
	}
	
	.compact .type-icon {
		@apply text-lg;
	}
	
	.type-label {
		@apply text-sm font-medium;
	}
	
	.compact .type-label {
		@apply text-xs;
	}
	
	.type-description {
		@apply text-xs text-gray-300 text-center leading-tight;
	}
	
	.frame-preview {
		@apply border-t border-gray-600 pt-4 space-y-3;
	}
	
	.preview-title {
		@apply text-sm font-medium text-gray-300 text-center;
	}
	
	.preview-container {
		@apply flex justify-center;
	}
	
	.preview-frame {
		@apply relative w-32 h-20 bg-gray-800 border border-gray-600 rounded;
		@apply overflow-hidden;
	}
	
	/* Center cross */
	.center-cross {
		@apply absolute inset-0 flex items-center justify-center;
	}
	
	.cross-horizontal {
		@apply absolute w-full h-px bg-white opacity-70;
	}
	
	.cross-vertical {
		@apply absolute h-full w-px bg-white opacity-70;
	}
	
	/* Rule of thirds grid */
	.thirds-grid {
		@apply absolute inset-0;
	}
	
	.grid-line {
		@apply absolute bg-white opacity-50;
	}
	
	.grid-v1 {
		@apply left-1/3 top-0 w-px h-full;
	}
	
	.grid-v2 {
		@apply left-2/3 top-0 w-px h-full;
	}
	
	.grid-h1 {
		@apply top-1/3 left-0 h-px w-full;
	}
	
	.grid-h2 {
		@apply top-2/3 left-0 h-px w-full;
	}
	
	/* Safe areas */
	.safe-areas {
		@apply absolute inset-0;
	}
	
	.safe-area {
		@apply absolute border border-white opacity-60;
	}
	
	.action-safe {
		@apply inset-2;
	}
	
	.title-safe {
		@apply inset-4;
	}
	
	/* Aspect ratio guides */
	.aspect-guides {
		@apply absolute inset-0;
	}
	
	.aspect-line {
		@apply absolute border border-white opacity-50;
	}
	
	.aspect-16-9 {
		@apply inset-x-2 inset-y-1;
	}
	
	.aspect-21-9 {
		@apply inset-x-1 inset-y-3;
	}
	
	/* Custom lines */
	.custom-lines {
		@apply absolute inset-0 flex items-center justify-center;
	}
	
	.custom-indicator {
		@apply text-xs text-white opacity-70 text-center;
	}
	
	/* Touch feedback animations */
	@keyframes touch-feedback {
		0% { transform: scale(1); }
		50% { transform: scale(0.95); }
		100% { transform: scale(1); }
	}
	
	.type-button:active {
		animation: touch-feedback 0.1s ease-in-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.types-grid {
			@apply grid-cols-2 gap-2;
		}
		
		.type-button {
			@apply p-2;
		}
		
		.type-icon {
			@apply text-lg;
		}
		
		.type-label {
			@apply text-xs;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.type-button {
			@apply border-white;
		}
		
		.type-button.active {
			@apply border-yellow-400;
		}
	}
	
	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.type-button {
			@apply transition-none;
		}
		
		.loading-spinner {
			@apply animate-none;
		}
		
		.type-button:active {
			animation: none;
		}
	}
</style>"