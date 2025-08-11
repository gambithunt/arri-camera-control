<!--
  App Shell Component
  Main application wrapper with error boundary and notification system
-->

<script lang=\"ts\">
\timport { onMount } from 'svelte';
\timport { browser } from '$app/environment';
\timport { errorManager } from '$lib/utils/errorManager';
\timport ErrorBoundary from './ErrorBoundary.svelte';
\timport NotificationToast from './NotificationToast.svelte';
\timport ResponsiveLayout from './ResponsiveLayout.svelte';
\t
\t// Props
\texport let title = 'ARRI Camera Control';
\texport let showErrorBoundary = true;
\texport let showNotifications = true;
\texport let enableErrorReporting = true;
\t
\t// Component state
\tlet appInitialized = false;
\tlet initializationError: Error | null = null;
\t
\tonMount(async () => {
\t\ttry {
\t\t\t// Initialize error manager
\t\t\tif (browser) {
\t\t\t\terrorManager.initialize();
\t\t\t\tconsole.log('App shell initialized successfully');
\t\t\t}
\t\t\t
\t\t\tappInitialized = true;
\t\t} catch (error) {
\t\t\tconsole.error('Failed to initialize app shell:', error);
\t\t\tinitializationError = error instanceof Error ? error : new Error(String(error));
\t\t}
\t});
\t
\tfunction handleAppError(event: CustomEvent) {
\t\tconsole.error('App-level error:', event.detail);
\t\t
\t\t// Handle critical errors that might require app restart
\t\tif (event.detail.errorInfo?.severity === 'critical') {
\t\t\t// Could implement app restart logic here
\t\t\tconsole.warn('Critical error detected - app may need restart');
\t\t}
\t}
\t
\tfunction handleAppRecover(event: CustomEvent) {
\t\tconsole.log('App recovered from error');
\t\t
\t\t// Could implement recovery analytics here
\t\t// analytics.track('app_error_recovery');
\t}
</script>

<svelte:head>
\t<title>{title}</title>
\t<meta name=\"description\" content=\"Professional camera control interface for ARRI cameras\" />
\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\" />
\t<meta name=\"theme-color\" content=\"#1a1a1a\" />
\t
\t<!-- PWA meta tags -->
\t<link rel=\"manifest\" href=\"/manifest.json\" />
\t<link rel=\"icon\" type=\"image/png\" sizes=\"32x32\" href=\"/favicon-32x32.png\" />
\t<link rel=\"icon\" type=\"image/png\" sizes=\"16x16\" href=\"/favicon-16x16.png\" />
\t<link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"/apple-touch-icon.png\" />
\t
\t<!-- Prevent zoom on iOS -->
\t<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no\" />
</svelte:head>

{#if !appInitialized}
\t<!-- App loading state -->
\t<div class=\"app-loading min-h-screen bg-arri-dark flex items-center justify-center\">
\t\t{#if initializationError}
\t\t\t<!-- Initialization error -->
\t\t\t<div class=\"error-container text-center p-6\">
\t\t\t\t<div class=\"error-icon text-6xl mb-4\">⚠️</div>
\t\t\t\t<h1 class=\"text-responsive-xl font-bold text-red-500 mb-2\">
\t\t\t\t\tInitialization Failed
\t\t\t\t</h1>
\t\t\t\t<p class=\"text-responsive-base text-gray-300 mb-4\">
\t\t\t\t\tThe application failed to start properly.
\t\t\t\t</p>
\t\t\t\t<button
\t\t\t\t\tclass=\"btn-primary px-6 py-3 rounded-lg font-medium transition-colors\"
\t\t\t\t\ton:click={() => window.location.reload()}
\t\t\t\t>
\t\t\t\t\tReload Application
\t\t\t\t</button>
\t\t\t\t
\t\t\t\t{#if browser && initializationError}
\t\t\t\t\t<details class=\"mt-6 text-left max-w-md\">
\t\t\t\t\t\t<summary class=\"text-sm text-gray-400 cursor-pointer hover:text-gray-300\">
\t\t\t\t\t\t\tShow Technical Details
\t\t\t\t\t\t</summary>
\t\t\t\t\t\t<pre class=\"mt-2 text-xs text-gray-500 bg-arri-gray p-3 rounded overflow-auto max-h-32\">
{initializationError.message}
{initializationError.stack}
\t\t\t\t\t\t</pre>
\t\t\t\t\t</details>
\t\t\t\t{/if}
\t\t\t</div>
\t\t{:else}
\t\t\t<!-- Loading spinner -->
\t\t\t<div class=\"loading-container text-center\">
\t\t\t\t<div class=\"loading-spinner w-12 h-12 border-4 border-arri-red border-t-transparent rounded-full animate-spin mb-4\"></div>
\t\t\t\t<h1 class=\"text-responsive-lg font-medium text-white mb-2\">
\t\t\t\t\t{title}
\t\t\t\t</h1>
\t\t\t\t<p class=\"text-responsive-sm text-gray-400\">
\t\t\t\t\tInitializing application...
\t\t\t\t</p>
\t\t\t</div>
\t\t{/if}
\t</div>
{:else}
\t<!-- Main application -->
\t{#if showErrorBoundary}
\t\t<ErrorBoundary
\t\t\tenableReporting={enableErrorReporting}
\t\t\tcontext={{ component: 'AppShell' }}
\t\t\ton:error={handleAppError}
\t\t\ton:recover={handleAppRecover}
\t\t>
\t\t\t<ResponsiveLayout>
\t\t\t\t<!-- App content -->
\t\t\t\t<main class=\"app-main min-h-screen bg-arri-dark text-white\">
\t\t\t\t\t<slot />
\t\t\t\t</main>
\t\t\t</ResponsiveLayout>
\t\t</ErrorBoundary>
\t{:else}
\t\t<ResponsiveLayout>
\t\t\t<!-- App content without error boundary -->
\t\t\t<main class=\"app-main min-h-screen bg-arri-dark text-white\">
\t\t\t\t<slot />
\t\t\t</main>
\t\t</ResponsiveLayout>
\t{/if}
\t
\t<!-- Notification system -->
\t{#if showNotifications}
\t\t<NotificationToast />
\t{/if}
{/if}

<style>
\t/* Global app styles */
\t:global(html) {
\t\t/* Prevent overscroll bounce on iOS */
\t\toverscroll-behavior: none;
\t\t
\t\t/* Optimize font rendering */
\t\t-webkit-font-smoothing: antialiased;
\t\t-moz-osx-font-smoothing: grayscale;
\t\t
\t\t/* Prevent text size adjustment on iOS */
\t\t-webkit-text-size-adjust: 100%;
\t}
\t
\t:global(body) {
\t\t/* Prevent overscroll bounce */
\t\toverscroll-behavior: none;
\t\t
\t\t/* Ensure full height */
\t\tmin-height: 100vh;
\t\tmin-height: -webkit-fill-available;
\t\t
\t\t/* Handle safe areas */
\t\tpadding-top: env(safe-area-inset-top);
\t\tpadding-bottom: env(safe-area-inset-bottom);
\t\tpadding-left: env(safe-area-inset-left);
\t\tpadding-right: env(safe-area-inset-right);
\t}
\t
\t:global(*) {
\t\t/* Improve touch handling */
\t\ttouch-action: manipulation;
\t\t
\t\t/* Remove tap highlight on mobile */
\t\t-webkit-tap-highlight-color: transparent;
\t}
\t
\t:global(button, input, select, textarea) {
\t\t/* Ensure proper touch targets */
\t\tmin-height: 44px;
\t\t
\t\t/* Improve focus visibility */
\t\tfocus-visible:outline: 2px solid #E31E24;
\t\tfocus-visible:outline-offset: 2px;
\t}
\t
\t/* App-specific styles */
\t.app-loading {
\t\t/* Ensure loading screen covers viewport */
\t\tposition: fixed;
\t\ttop: 0;
\t\tleft: 0;
\t\tright: 0;
\t\tbottom: 0;
\t\tz-index: 9999;
\t}
\t
\t.loading-spinner {
\t\t/* Smooth spinner animation */
\t\tanimation: spin 1s linear infinite;
\t}
\t
\t.app-main {
\t\t/* Ensure main content area is properly sized */
\t\tmin-height: 100vh;
\t\tmin-height: -webkit-fill-available;
\t\t
\t\t/* Handle safe areas */
\t\tpadding-top: max(1rem, env(safe-area-inset-top));
\t\tpadding-bottom: max(1rem, env(safe-area-inset-bottom));
\t\tpadding-left: max(1rem, env(safe-area-inset-left));
\t\tpadding-right: max(1rem, env(safe-area-inset-right));
\t}
\t
\t/* Animation keyframes */
\t@keyframes spin {
\t\tfrom {
\t\t\ttransform: rotate(0deg);
\t\t}
\t\tto {
\t\t\ttransform: rotate(360deg);
\t\t}
\t}
\t
\t/* Responsive adjustments */
\t@media (max-width: 767px) {
\t\t.app-main {
\t\t\tpadding: max(0.5rem, env(safe-area-inset-top)) max(0.5rem, env(safe-area-inset-right)) max(0.5rem, env(safe-area-inset-bottom)) max(0.5rem, env(safe-area-inset-left));
\t\t}
\t}
\t
\t/* High contrast mode */
\t@media (prefers-contrast: high) {
\t\t.app-main {
\t\t\tborder: 2px solid currentColor;
\t\t}
\t\t
\t\t.loading-spinner {
\t\t\tborder-width: 3px;
\t\t}
\t}
\t
\t/* Reduced motion */
\t@media (prefers-reduced-motion: reduce) {
\t\t.loading-spinner {
\t\t\tanimation: none;
\t\t\tborder-top-color: transparent;
\t\t}
\t}
\t
\t/* Dark mode (already default) */
\t@media (prefers-color-scheme: light) {
\t\t/* Keep dark theme even in light mode for professional camera interface */
\t}
\t
\t/* Print styles */
\t@media print {
\t\t.app-loading,
\t\t:global(.notification-container) {
\t\t\tdisplay: none !important;
\t\t}
\t}
</style>"