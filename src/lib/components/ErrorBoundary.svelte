<script lang="ts">
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { errorManager, createError, showError, type ErrorContext } from '$lib/utils/errorManager';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	import ResponsiveContainer from './ResponsiveContainer.svelte';
	
	// Props
	export let fallbackComponent: any = null;
	export let showDetails = false;
	export let enableReporting = true;
	export let context: Partial<ErrorContext> = {};
	
	// Event dispatcher
	const dispatch = createEventDispatcher<{
		error: { error: Error; errorInfo: any };
		recover: {};
	}>();
	
	// Component state
	let hasError = false;
	let error: Error | null = null;
	let errorInfo: any = null;
	let errorId: string | null = null;
	let retryCount = 0;
	let maxRetries = 3;
	
	// Reactive screen info
	$: currentScreenInfo = $screenInfo;
	$: isCompact = currentScreenInfo.deviceType === 'phone';
	
	onMount(() => {
		if (!browser) return;
		
		// Initialize error manager
		errorManager.initialize();
		
		// Set up error boundary
		setupErrorBoundary();
	});
	
	function setupErrorBoundary() {
		// Catch component errors
		const originalConsoleError = console.error;
		console.error = (...args) => {
			// Check if this is a Svelte component error
			const errorMessage = args[0];
			if (typeof errorMessage === 'string' && errorMessage.includes('Svelte')) {
				handleComponentError(new Error(errorMessage), { args });
			}
			
			// Call original console.error
			originalConsoleError.apply(console, args);
		};
		
		// Catch unhandled promise rejections
		window.addEventListener('unhandledrejection', handlePromiseRejection);
		
		// Catch global errors
		window.addEventListener('error', handleGlobalError);
	}
	
	function handleComponentError(err: Error, info: any = {}) {
		hasError = true;
		error = err;
		errorInfo = info;
		retryCount = 0;
		
		// Create error in error manager
		errorId = createError('unknown', err.message, {
			details: err.stack,
			context: {
				...context,
				component: 'ErrorBoundary',
				stackTrace: err.stack,
				additionalData: info
			},
			severity: 'high',
			retryable: true,
			userMessage: 'A component error occurred. The page may not work correctly.'
		}).id;
		
		// Show error notification
		if (enableReporting) {
			showError(
				'Component Error',
				'An unexpected error occurred. You can try refreshing the page or contact support if the problem persists.',
				[
					{
						id: 'retry',
						label: 'Try Again',
						type: 'retry',
						handler: handleRetry,
						primary: true
					},
					{
						id: 'reload',
						label: 'Reload Page',
						type: 'reload',
						handler: () => window.location.reload()
					},
					{
						id: 'report',
						label: 'Report Issue',
						type: 'custom',
						handler: handleReportError
					}
				]
			);
		}
		
		// Dispatch error event
		dispatch('error', { error: err, errorInfo: info });
		
		console.error('Error Boundary caught error:', err, info);
	}
	
	function handlePromiseRejection(event: PromiseRejectionEvent) {
		const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
		handleComponentError(error, { type: 'unhandledrejection', reason: event.reason });
	}
	
	function handleGlobalError(event: ErrorEvent) {
		const error = event.error || new Error(event.message);
		handleComponentError(error, { 
			type: 'globalerror',
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno
		});
	}
	
	function handleRetry() {
		if (retryCount >= maxRetries) {
			showError(
				'Retry Limit Reached',
				'Maximum retry attempts reached. Please reload the page or contact support.',
				[
					{
						id: 'reload',
						label: 'Reload Page',
						type: 'reload',
						handler: () => window.location.reload(),
						primary: true
					}
				]
			);
			return;
		}
		
		retryCount++;
		hasError = false;
		error = null;
		errorInfo = null;
		errorId = null;
		
		// Dispatch recover event
		dispatch('recover');
		
		console.log(`Error boundary retry attempt ${retryCount}/${maxRetries}`);
	}
	
	function handleReportError() {
		if (!error) return;
		
		// Create error report
		const errorReport = {
			message: error.message,
			stack: error.stack,
			userAgent: navigator.userAgent,
			url: window.location.href,
			timestamp: new Date().toISOString(),
			context: context,
			errorInfo: errorInfo
		};
		
		// In a real app, this would send to an error reporting service
		console.log('Error report:', errorReport);
		
		// Copy to clipboard for now
		if (navigator.clipboard) {
			navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2))
				.then(() => {
					showError('Error Report', 'Error details copied to clipboard. Please share with support.');
				})
				.catch(() => {
					showError('Error Report', 'Failed to copy error details. Please manually copy from console.');
				});
		}
	}
	
	function getErrorSummary(): string {
		if (!error) return 'Unknown error';
		
		// Extract meaningful error message
		let message = error.message;
		
		// Clean up common error patterns
		if (message.includes('Cannot read property')) {
			message = 'Data access error - some information may be unavailable';
		} else if (message.includes('fetch')) {
			message = 'Network request failed - check your connection';
		} else if (message.includes('undefined')) {
			message = 'Missing data error - please try refreshing';
		}
		
		return message;
	}
	
	function getErrorDetails(): string {
		if (!error || !showDetails) return '';
		
		const details = [];
		
		if (error.stack) {
			details.push(`Stack trace:\n${error.stack}`);
		}
		
		if (errorInfo) {
			details.push(`Additional info:\n${JSON.stringify(errorInfo, null, 2)}`);
		}
		
		if (context) {
			details.push(`Context:\n${JSON.stringify(context, null, 2)}`);
		}
		
		return details.join('\n\n');
	}
	
	onDestroy(() => {
		if (browser) {
			window.removeEventListener('unhandledrejection', handlePromiseRejection);
			window.removeEventListener('error', handleGlobalError);
		}
	});
</script>

{#if hasError}
	<!-- Error fallback UI -->
	{#if fallbackComponent}
		<svelte:component this={fallbackComponent} {error} {errorInfo} {handleRetry} />
	{:else}
		<ResponsiveContainer size="md" padding="lg" className="error-boundary-container">
			<div class="error-boundary min-h-screen-safe flex flex-col items-center justify-center text-center">
				<!-- Error icon -->
				<div class="error-icon text-6xl mb-6 animate-pulse">
					💥
				</div>
				
				<!-- Error title -->
				<h1 class="error-title text-responsive-2xl font-bold text-red-500 mb-4">
					Something went wrong
				</h1>
				
				<!-- Error message -->
				<div class="error-message text-responsive-base text-gray-300 mb-6 max-w-md">
					<p class="mb-2">
						{getErrorSummary()}
					</p>
					<p class="text-responsive-sm text-gray-400">
						Don't worry, this happens sometimes. You can try again or reload the page.
					</p>
				</div>
				
				<!-- Error actions -->
				<div class="error-actions flex flex-col tablet:flex-row gap-3 mb-6">
					<button
						class="btn-primary px-6 py-3 rounded-lg font-medium transition-colors min-h-touch"
						on:click={handleRetry}
						disabled={retryCount >= maxRetries}
					>
						{#if retryCount >= maxRetries}
							Max Retries Reached
						{:else}
							Try Again ({maxRetries - retryCount} left)
						{/if}
					</button>
					
					<button
						class="btn-secondary px-6 py-3 rounded-lg font-medium transition-colors min-h-touch"
						on:click={() => window.location.reload()}
					>
						Reload Page
					</button>
				</div>
				
				<!-- Error details toggle -->
				{#if error}
					<div class="error-details-section w-full max-w-2xl">
						<button
							class="details-toggle text-responsive-sm text-gray-400 hover:text-gray-300 transition-colors mb-4"
							on:click={() => showDetails = !showDetails}
						>
							{showDetails ? '▼' : '▶'} {showDetails ? 'Hide' : 'Show'} Technical Details
						</button>
						
						{#if showDetails}
							<div class="error-details bg-arri-gray rounded-lg p-4 text-left animate-slide-down">
								<div class="details-header flex justify-between items-center mb-3">
									<h3 class="text-responsive-base font-medium">Error Details</h3>
									<button
										class="copy-btn text-xs bg-arri-red px-3 py-1 rounded hover:bg-red-600 transition-colors"
										on:click={handleReportError}
									>
										Copy Report
									</button>
								</div>
								
								<pre class="error-stack text-xs text-gray-300 overflow-auto max-h-64 whitespace-pre-wrap">
{getErrorDetails()}
								</pre>
							</div>
						{/if}
					</div>
				{/if}
				
				<!-- Help text -->
				<div class="help-text text-responsive-xs text-gray-500 mt-6 max-w-lg">
					<p>
						If this problem persists, please copy the technical details above and contact support.
						Your work is automatically saved and will be restored when the issue is resolved.
					</p>
				</div>
			</div>
		</ResponsiveContainer>
	{/if}
{:else}
	<!-- Normal content -->
	<slot />
{/if}

<style>
	.error-boundary-container {
		/* Ensure error boundary takes full space */
		min-height: 100vh;
	}
	
	.error-boundary {
		/* Center content */
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		
		/* Handle safe areas */
		padding-top: max(2rem, env(safe-area-inset-top));
		padding-bottom: max(2rem, env(safe-area-inset-bottom));
	}
	
	.error-icon {
		/* Pulse animation for attention */
		animation: pulse 2s infinite;
	}
	
	.error-actions {
		/* Ensure proper touch targets */
		gap: 0.75rem;
	}
	
	.error-actions button {
		/* Ensure minimum touch target size */
		min-width: 120px;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}
	
	.error-actions button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	
	.details-toggle {
		/* Ensure proper touch target */
		min-height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
	}
	
	.error-details {
		/* Ensure proper scrolling */
		max-height: 400px;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}
	
	.error-stack {
		/* Ensure text is readable */
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		line-height: 1.4;
		word-break: break-word;
	}
	
	.copy-btn {
		/* Ensure proper touch target */
		min-height: 28px;
		touch-action: manipulation;
	}
	
	/* Animation keyframes */
	@keyframes pulse {
		0%, 100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}
	
	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.animate-slide-down {
		animation: slideDown 0.3s ease-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) {
		.error-actions {
			flex-direction: column;
			width: 100%;
		}
		
		.error-actions button {
			width: 100%;
		}
		
		.error-details {
			max-height: 300px;
		}
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.error-boundary {
			border: 2px solid currentColor;
		}
		
		.error-details {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.error-icon {
			animation: none;
		}
		
		.animate-slide-down {
			animation: none;
		}
		
		.error-actions button,
		.details-toggle,
		.copy-btn {
			transition: none;
		}
	}
	
	/* Focus visible for keyboard navigation */
	.error-actions button:focus-visible,
	.details-toggle:focus-visible,
	.copy-btn:focus-visible {
		outline: 2px solid #E31E24;
		outline-offset: 2px;
	}
</style>