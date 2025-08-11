<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { offlineStatus, isOnline, isOffline, hasPendingOperations, isAppReady, updateToNewVersion } from '$lib/utils/offlineManager';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	
	// Props
	export let showDetails = false;
	export let compact = false;
	export let className = '';
	
	// Component state
	let showUpdatePrompt = false;
	let syncInProgress = false;
	
	// Reactive subscriptions
	$: currentStatus = $offlineStatus;
	$: online = $isOnline;
	$: offline = $isOffline;
	$: pendingOps = $hasPendingOperations;
	$: appReady = $isAppReady;
	$: currentScreenInfo = $screenInfo;
	
	// Compute status classes
	$: statusClasses = computeStatusClasses(online, pendingOps, appReady, compact, className);
	$: statusText = getStatusText(online, pendingOps, currentStatus.pendingOperations);
	$: statusIcon = getStatusIcon(online, pendingOps, appReady);
	
	function computeStatusClasses(
		online: boolean,
		hasPending: boolean,
		appReady: boolean,
		compact: boolean,
		customClass: string
	): string {
		const classes = ['offline-status'];
		
		// Base classes
		classes.push('flex', 'items-center', 'gap-2', 'transition-all', 'duration-200');
		
		// Size classes
		if (compact) {
			classes.push('px-2', 'py-1', 'text-xs');
		} else {
			classes.push('px-3', 'py-2', 'text-sm');
		}
		
		// Status classes
		if (online) {
			if (hasPending) {
				classes.push('bg-yellow-600', 'text-white');
			} else {
				classes.push('bg-green-600', 'text-white');
			}
		} else {
			classes.push('bg-red-600', 'text-white');
		}
		
		// Shape classes
		classes.push('rounded-full');
		
		// Custom classes
		if (customClass) {
			classes.push(customClass);
		}
		
		return classes.join(' ');
	}
	
	function getStatusText(online: boolean, hasPending: boolean, pendingCount: number): string {
		if (!online) {
			return 'Offline';
		}
		
		if (hasPending) {
			return `Syncing (${pendingCount})`;
		}
		
		return 'Online';
	}
	
	function getStatusIcon(online: boolean, hasPending: boolean, appReady: boolean): string {
		if (!online) {
			return '📡';
		}
		
		if (hasPending) {
			return '🔄';
		}
		
		return '✅';
	}
	
	function formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}
	
	function formatLastSync(timestamp: number | null): string {
		if (!timestamp) return 'Never';
		
		const now = Date.now();
		const diff = now - timestamp;
		
		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	}
	
	async function handleUpdateApp() {
		try {
			await updateToNewVersion();
		} catch (error) {
			console.error('Failed to update app:', error);
		}
	}
	
	function handleRetrySync() {
		if (syncInProgress) return;
		
		syncInProgress = true;
		// Trigger a manual sync by going offline and online
		window.dispatchEvent(new Event('offline'));
		setTimeout(() => {
			window.dispatchEvent(new Event('online'));
			syncInProgress = false;
		}, 100);
	}
	
	onMount(() => {
		// Listen for app update events
		const handleAppUpdate = () => {
			showUpdatePrompt = true;
		};
		
		window.addEventListener('app-update-available', handleAppUpdate);
		
		// Refresh offline status
		offlineStatus.refresh();
		
		return () => {
			window.removeEventListener('app-update-available', handleAppUpdate);
		};
	});
</script>

<div class={statusClasses}>
	<!-- Status indicator -->
	<span class="status-icon" role="img" aria-label="Connection status">
		{statusIcon}
	</span>
	
	<!-- Status text -->
	<span class="status-text">
		{statusText}
	</span>
	
	<!-- Details toggle (if not compact) -->
	{#if !compact && (showDetails || offline || pendingOps)}
		<button
			class="details-toggle text-xs opacity-75 hover:opacity-100 transition-opacity"
			on:click={() => showDetails = !showDetails}
			aria-label="Toggle status details"
		>
			{showDetails ? '▼' : '▶'}
		</button>
	{/if}
</div>

<!-- Detailed status panel -->
{#if showDetails && !compact}
	<div class="status-details bg-arri-gray rounded-lg p-4 mt-2 text-sm animate-slide-down">
		<div class="grid grid-cols-1 gap-3">
			<!-- Connection info -->
			<div class="status-item">
				<span class="label font-medium">Connection:</span>
				<span class="value {online ? 'text-green-400' : 'text-red-400'}">
					{online ? 'Online' : 'Offline'}
				</span>
			</div>
			
			<!-- App cache status -->
			<div class="status-item">
				<span class="label font-medium">App Cache:</span>
				<span class="value {appReady ? 'text-green-400' : 'text-yellow-400'}">
					{appReady ? 'Ready' : 'Loading...'}
				</span>
			</div>
			
			<!-- Pending operations -->
			{#if currentStatus.pendingOperations > 0}
				<div class="status-item">
					<span class="label font-medium">Pending Sync:</span>
					<span class="value text-yellow-400">
						{currentStatus.pendingOperations} operations
					</span>
					{#if online}
						<button
							class="retry-btn ml-2 text-xs bg-arri-red px-2 py-1 rounded hover:bg-red-600 transition-colors"
							on:click={handleRetrySync}
							disabled={syncInProgress}
						>
							{syncInProgress ? 'Syncing...' : 'Retry'}
						</button>
					{/if}
				</div>
			{/if}
			
			<!-- Cache size -->
			<div class="status-item">
				<span class="label font-medium">Cache Size:</span>
				<span class="value">
					{formatFileSize(currentStatus.cacheSize)}
				</span>
			</div>
			
			<!-- Last sync -->
			<div class="status-item">
				<span class="label font-medium">Last Sync:</span>
				<span class="value">
					{formatLastSync(currentStatus.lastSync)}
				</span>
			</div>
			
			<!-- Offline capabilities -->
			{#if offline}
				<div class="offline-features mt-2 p-3 bg-arri-dark rounded border-l-4 border-yellow-500">
					<h4 class="font-medium text-yellow-400 mb-2">Available Offline:</h4>
					<ul class="text-xs space-y-1 text-gray-300">
						<li>✓ View cached camera settings</li>
						<li>✓ Access saved LUTs</li>
						<li>✓ Review clip information</li>
						<li>✓ Modify user preferences</li>
						<li>✓ Queue operations for sync</li>
					</ul>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Update prompt -->
{#if showUpdatePrompt}
	<div class="update-prompt fixed bottom-4 right-4 bg-arri-red text-white p-4 rounded-lg shadow-lg animate-slide-up z-50">
		<div class="flex items-center gap-3">
			<span class="text-lg">🔄</span>
			<div class="flex-1">
				<div class="font-medium">App Update Available</div>
				<div class="text-sm opacity-90">Restart to get the latest features</div>
			</div>
			<div class="flex gap-2">
				<button
					class="text-xs bg-white bg-opacity-20 px-3 py-1 rounded hover:bg-opacity-30 transition-colors"
					on:click={() => showUpdatePrompt = false}
				>
					Later
				</button>
				<button
					class="text-xs bg-white text-arri-red px-3 py-1 rounded hover:bg-gray-100 transition-colors"
					on:click={handleUpdateApp}
				>
					Update
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.offline-status {
		/* Ensure proper touch targets */
		min-height: 32px;
		
		/* Optimize for animations */
		will-change: background-color, color;
	}
	
	.status-item {
		@apply flex justify-between items-center;
	}
	
	.label {
		@apply text-gray-300;
	}
	
	.value {
		@apply text-white;
	}
	
	.details-toggle {
		/* Ensure proper touch target */
		min-width: 24px;
		min-height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	
	.retry-btn {
		/* Ensure proper touch target */
		min-height: 24px;
		touch-action: manipulation;
	}
	
	.update-prompt {
		/* Ensure it's above everything */
		z-index: 9999;
		
		/* Handle safe areas */
		margin-bottom: max(1rem, env(safe-area-inset-bottom));
		margin-right: max(1rem, env(safe-area-inset-right));
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) {
		.status-details {
			@apply text-xs;
		}
		
		.update-prompt {
			@apply left-4 right-4;
			margin-left: max(1rem, env(safe-area-inset-left));
		}
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.offline-status {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.offline-status,
		.status-details,
		.update-prompt {
			transition: none;
			animation: none;
		}
	}
</style>