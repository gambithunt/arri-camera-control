<script lang="ts">
	import '../app.css';
	import Header from '$lib/components/Header.svelte';
	import Navigation from '$lib/components/Navigation.svelte';
	import NotificationToast from '$lib/components/NotificationToast.svelte';
	import DevModePanel from '$lib/components/DevModePanel.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	// Simplified imports for UI testing
	// import { initializeServiceWorker } from '$lib/utils/serviceWorker';
	// import { initializeConnectionManager } from '$lib/services/connectionManager';
	// import { initializeStores } from '$lib/stores/storeManager';
	import { screenInfo, type ScreenInfo } from '$lib/utils/responsiveLayout';
	
	$: isHomePage = $page.url.pathname === '/';
	
	// Reactive screen info for layout adjustments
	let currentScreenInfo: ScreenInfo;
	$: currentScreenInfo = $screenInfo;
	
	// Compute layout classes based on screen info
	$: layoutClasses = computeLayoutClasses(currentScreenInfo, isHomePage);
	
	function computeLayoutClasses(screenInfo: ScreenInfo, isHome: boolean): string {
		const classes = ['app-container'];
		
		// Add device-specific classes
		classes.push(`device-${screenInfo.deviceType}`);
		classes.push(`orientation-${screenInfo.orientation}`);
		
		if (screenInfo.isTouch) {
			classes.push('touch-device');
		}
		
		// Compact mode for phone portrait
		if (screenInfo.deviceType === 'phone' && screenInfo.orientation === 'portrait') {
			classes.push('compact-mode');
		}
		
		return classes.join(' ');
	}
	
	onMount(async () => {
		// Simple initialization for UI testing
		try {
			console.log('Initializing app for UI testing...');
			
			// Initialize basic stores (simplified for UI testing)
			try {
				console.log('Initializing stores...');
				// Skip complex store initialization for now
			} catch (error) {
				console.warn('Store initialization failed, continuing...', error);
			}
			
			// Skip service worker and connection manager for UI testing
			console.log('Skipping service worker and connection manager for UI testing');
			
			console.log('App initialization complete');
		
		// Initialize app configuration
		const { initializeConfig } = await import('$lib/config/appConfig');
		initializeConfig();
		} catch (error) {
			console.error('App initialization error:', error);
			// Continue anyway to show UI
		}
	});
</script>

<div class={layoutClasses}>
	{#if !isHomePage}
		<Header />
	{/if}
	
	<main class="main-content" class:has-header={!isHomePage} class:has-navigation={!isHomePage}>
		<slot {currentScreenInfo} />
	</main>
	
	{#if !isHomePage}
		<Navigation />
	{/if}
</div>

<!-- Global notification system -->
<NotificationToast />

<!-- Development mode panel -->
<DevModePanel />

<style>
	.app-container {
		@apply min-h-screen bg-arri-dark text-white flex flex-col;
		/* Handle safe areas */
		padding-left: max(0px, env(safe-area-inset-left));
		padding-right: max(0px, env(safe-area-inset-right));
		padding-top: max(0px, env(safe-area-inset-top));
	}
	
	.main-content {
		@apply flex-1 overflow-y-auto;
		/* Smooth scrolling */
		scroll-behavior: smooth;
		-webkit-overflow-scrolling: touch;
	}
	
	/* Adjust main content height based on header/navigation presence */
	.main-content.has-header.has-navigation {
		min-height: calc(100vh - 120px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
	}
	
	.main-content.has-header:not(.has-navigation) {
		min-height: calc(100vh - 60px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
	}
	
	.main-content.has-navigation:not(.has-header) {
		min-height: calc(100vh - 60px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
	}
	
	.main-content:not(.has-header):not(.has-navigation) {
		min-height: calc(100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
	}
	
	/* Device-specific adjustments */
	.device-phone {
		/* Phone-specific styles */
	}
	
	.device-tablet {
		/* Tablet-specific styles */
	}
	
	.device-desktop {
		/* Desktop-specific styles */
	}
	
	/* Orientation-specific adjustments */
	.orientation-landscape .main-content {
		/* Landscape-specific adjustments */
		padding-bottom: max(1rem, env(safe-area-inset-bottom));
	}
	
	.orientation-portrait .main-content {
		/* Portrait-specific adjustments */
		padding-bottom: max(1rem, env(safe-area-inset-bottom));
	}
	
	/* Touch device optimizations */
	.touch-device {
		/* Optimize for touch interactions */
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}
	
	/* Compact mode for small screens */
	.compact-mode {
		/* Tighter spacing and smaller elements */
		--spacing-scale: 0.875;
		--font-scale: 0.9;
	}
	
	.compact-mode .main-content {
		padding: 0.5rem;
	}
	
	/* Smooth transitions for layout changes */
	@media (prefers-reduced-motion: no-preference) {
		.app-container,
		.main-content {
			transition: all 0.2s ease-in-out;
		}
	}
	
	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.app-container {
			border: 1px solid currentColor;
		}
	}
</style>