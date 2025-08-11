<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import ResponsiveContainer from '$lib/components/ResponsiveContainer.svelte';
	import { offlineStatus, getCachedUserSettings, getCachedCameraState } from '$lib/utils/offlineManager';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	
	// Component state
	let cachedSettings: any = null;
	let cachedCameraState: any = null;
	let retryAttempts = 0;
	let maxRetryAttempts = 3;
	
	// Reactive subscriptions
	$: currentStatus = $offlineStatus;
	$: currentScreenInfo = $screenInfo;
	$: isCompact = currentScreenInfo.deviceType === 'phone';
	
	onMount(async () => {
		// Load cached data
		try {
			cachedSettings = await getCachedUserSettings();
			cachedCameraState = await getCachedCameraState();
		} catch (error) {
			console.error('Failed to load cached data:', error);
		}
		
		// Auto-redirect if online
		if (browser && navigator.onLine) {
			goto('/');
		}
		
		// Listen for online events
		const handleOnline = () => {
			console.log('Back online, redirecting...');
			goto('/');
		};
		
		window.addEventListener('online', handleOnline);
		
		return () => {
			window.removeEventListener('online', handleOnline);
		};
	});
	
	function handleRetry() {
		retryAttempts++;
		
		if (navigator.onLine) {
			goto('/');
		} else {
			// Show feedback that we're still offline
			setTimeout(() => {
				if (retryAttempts < maxRetryAttempts) {
					// Reset retry count after a delay
					setTimeout(() => {
						retryAttempts = 0;
					}, 5000);
				}
			}, 1000);
		}
	}
	
	function navigateToSection(path: string) {
		// Even offline, we can navigate to cached pages
		goto(path);
	}
	
	function formatCacheAge(timestamp: number): string {
		if (!timestamp) return 'Unknown';
		
		const now = Date.now();
		const diff = now - timestamp;
		
		if (diff < 60000) return 'Just cached';
		if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)} hours ago`;
		return `${Math.floor(diff / 86400000)} days ago`;
	}
</script>

<svelte:head>
	<title>ARRI Camera Control - Offline</title>
	<meta name="description" content="ARRI Camera Control app is currently offline but still functional" />
</svelte:head>

<ResponsiveContainer size="lg" padding="lg">
	<div class="offline-page min-h-screen-safe flex flex-col">
		<!-- Header -->
		<header class="text-center spacing-responsive-lg">
			<div class="offline-icon text-6xl mb-4 animate-pulse">📡</div>
			<h1 class="text-responsive-2xl font-bold text-arri-red mb-2">
				You're Offline
			</h1>
			<p class="text-responsive-base text-gray-300 max-w-md mx-auto">
				No internet connection detected, but the app is still functional with cached data.
			</p>
		</header>
		
		<!-- Status Card -->
		<div class="status-card bg-arri-gray rounded-lg spacing-responsive-md mb-6">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-responsive-lg font-semibold">Connection Status</h2>
				<div class="status-indicator bg-red-600 text-white px-3 py-1 rounded-full text-responsive-xs">
					Offline
				</div>
			</div>
			
			<div class="grid grid-cols-1 tablet:grid-cols-2 gap-4 text-responsive-sm">
				<div class="stat-item">
					<span class="label text-gray-400">App Cache:</span>
					<span class="value text-green-400">
						{currentStatus.isAppCached ? 'Available' : 'Loading...'}
					</span>
				</div>
				
				<div class="stat-item">
					<span class="label text-gray-400">Pending Operations:</span>
					<span class="value text-yellow-400">
						{currentStatus.pendingOperations}
					</span>
				</div>
				
				<div class="stat-item">
					<span class="label text-gray-400">Last Sync:</span>
					<span class="value">
						{currentStatus.lastSync ? formatCacheAge(currentStatus.lastSync) : 'Never'}
					</span>
				</div>
				
				<div class="stat-item">
					<span class="label text-gray-400">Cache Size:</span>
					<span class="value">
						{(currentStatus.cacheSize / 1024).toFixed(1)} KB
					</span>
				</div>
			</div>
		</div>
		
		<!-- Available Features -->
		<div class="features-section mb-6">
			<h2 class="text-responsive-lg font-semibold mb-4">Available Offline</h2>
			
			<div class="features-grid grid grid-cols-1 tablet:grid-cols-2 gap-4">
				<button
					class="feature-card bg-arri-gray rounded-lg spacing-responsive-md text-left hover:bg-gray-600 transition-colors touch-manipulation"
					on:click={() => navigateToSection('/camera')}
					disabled={!currentStatus.isAppCached}
				>
					<div class="flex items-center gap-3 mb-2">
						<span class="feature-icon text-2xl">📹</span>
						<h3 class="text-responsive-base font-medium">Camera Settings</h3>
					</div>
					<p class="text-responsive-xs text-gray-400">
						View cached camera configuration and queue setting changes
					</p>
					{#if cachedCameraState}
						<div class="cached-info mt-2 text-xs text-green-400">
							✓ Cached data available
						</div>
					{/if}
				</button>
				
				<button
					class="feature-card bg-arri-gray rounded-lg spacing-responsive-md text-left hover:bg-gray-600 transition-colors touch-manipulation"
					on:click={() => navigateToSection('/grading')}
					disabled={!currentStatus.isAppCached}
				>
					<div class="flex items-center gap-3 mb-2">
						<span class="feature-icon text-2xl">🎨</span>
						<h3 class="text-responsive-base font-medium">Color Grading</h3>
					</div>
					<p class="text-responsive-xs text-gray-400">
						Access saved LUTs and create new color grades
					</p>
					<div class="cached-info mt-2 text-xs text-green-400">
						✓ LUT library available
					</div>
				</button>
				
				<button
					class="feature-card bg-arri-gray rounded-lg spacing-responsive-md text-left hover:bg-gray-600 transition-colors touch-manipulation"
					on:click={() => navigateToSection('/playback')}
					disabled={!currentStatus.isAppCached}
				>
					<div class="flex items-center gap-3 mb-2">
						<span class="feature-icon text-2xl">▶️</span>
						<h3 class="text-responsive-base font-medium">Playback</h3>
					</div>
					<p class="text-responsive-xs text-gray-400">
						Review cached clip information and metadata
					</p>
					<div class="cached-info mt-2 text-xs text-yellow-400">
						⚠ Limited functionality offline
					</div>
				</button>
				
				<button
					class="feature-card bg-arri-gray rounded-lg spacing-responsive-md text-left hover:bg-gray-600 transition-colors touch-manipulation"
					on:click={() => navigateToSection('/timecode')}
					disabled={!currentStatus.isAppCached}
				>
					<div class="flex items-center gap-3 mb-2">
						<span class="feature-icon text-2xl">🕐</span>
						<h3 class="text-responsive-base font-medium">Timecode</h3>
					</div>
					<p class="text-responsive-xs text-gray-400">
						View timecode settings and configuration
					</p>
					{#if cachedSettings?.timecode}
						<div class="cached-info mt-2 text-xs text-green-400">
							✓ Settings cached
						</div>
					{/if}
				</button>
			</div>
		</div>
		
		<!-- Retry Section -->
		<div class="retry-section text-center">
			<button
				class="retry-button bg-arri-red hover:bg-red-600 text-white font-medium py-3 px-6 rounded-lg transition-colors touch-manipulation min-h-touch"
				on:click={handleRetry}
				disabled={retryAttempts >= maxRetryAttempts}
			>
				{#if retryAttempts >= maxRetryAttempts}
					Still Offline
				{:else if retryAttempts > 0}
					Try Again ({maxRetryAttempts - retryAttempts} left)
				{:else}
					Check Connection
				{/if}
			</button>
			
			{#if retryAttempts > 0}
				<p class="text-responsive-xs text-gray-400 mt-2">
					{#if retryAttempts >= maxRetryAttempts}
						The app will automatically reconnect when internet is available
					{:else}
						Still no connection detected
					{/if}
				</p>
			{/if}
		</div>
		
		<!-- Tips Section -->
		<div class="tips-section mt-8 bg-arri-dark rounded-lg spacing-responsive-md">
			<h3 class="text-responsive-base font-medium mb-3 text-arri-red">Offline Tips</h3>
			<ul class="space-y-2 text-responsive-xs text-gray-300">
				<li class="flex items-start gap-2">
					<span class="text-green-400 mt-1">•</span>
					<span>All changes are automatically queued and will sync when connection is restored</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-green-400 mt-1">•</span>
					<span>Cached data is updated every time you use the app online</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-green-400 mt-1">•</span>
					<span>The app works best when installed as a PWA on your device</span>
				</li>
				<li class="flex items-start gap-2">
					<span class="text-green-400 mt-1">•</span>
					<span>Camera control requires a direct network connection to the camera</span>
				</li>
			</ul>
		</div>
	</div>
</ResponsiveContainer>

<style>
	.offline-page {
		/* Ensure proper spacing */
		padding-top: max(1rem, env(safe-area-inset-top));
		padding-bottom: max(1rem, env(safe-area-inset-bottom));
	}
	
	.stat-item {
		@apply flex justify-between items-center;
	}
	
	.feature-card {
		/* Ensure proper touch targets */
		min-height: 80px;
		
		/* Optimize for touch */
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	
	.feature-card:disabled {
		@apply opacity-50 cursor-not-allowed;
	}
	
	.feature-card:disabled:hover {
		@apply bg-arri-gray;
	}
	
	.retry-button:disabled {
		@apply opacity-75 cursor-not-allowed;
	}
	
	.retry-button:disabled:hover {
		@apply bg-arri-red;
	}
	
	/* Animation for offline icon */
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) {
		.features-grid {
			@apply grid-cols-1;
		}
		
		.feature-card {
			min-height: 70px;
		}
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.feature-card,
		.status-card,
		.tips-section {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.offline-icon {
			animation: none;
		}
		
		.feature-card,
		.retry-button {
			transition: none;
		}
	}
</style>