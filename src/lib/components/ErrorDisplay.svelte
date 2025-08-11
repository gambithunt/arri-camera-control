<script lang="ts">
	import { onMount } from 'svelte';
	import { errors, unresolvedErrors, criticalErrors, retryError, resolveError, type AppError } from '$lib/utils/errorManager';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	import { triggerHaptic } from '$lib/utils/touchInteractions';
	
	// Props
	export let showResolved = false;
	export let maxErrors = 10;
	export let compact = false;
	export let filterSeverity: string[] = [];
	export let filterType: string[] = [];
	export let className = '';
	
	// Component state
	let displayErrors: AppError[] = [];
	let expandedErrors: Set<string> = new Set();
	
	// Reactive subscriptions
	$: allErrors = $errors;
	$: unresolved = $unresolvedErrors;
	$: critical = $criticalErrors;
	$: currentScreenInfo = $screenInfo;
	$: isCompact = compact || currentScreenInfo.deviceType === 'phone';
	
	// Filter and sort errors
	$: {
		let filtered = showResolved ? allErrors : unresolved;
		
		// Apply severity filter
		if (filterSeverity.length > 0) {
			filtered = filtered.filter(error => filterSeverity.includes(error.severity));
		}
		
		// Apply type filter
		if (filterType.length > 0) {
			filtered = filtered.filter(error => filterType.includes(error.type));
		}
		
		// Sort by severity and timestamp
		filtered.sort((a, b) => {
			const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
			const aSeverity = severityOrder[a.severity] || 0;
			const bSeverity = severityOrder[b.severity] || 0;
			
			if (aSeverity !== bSeverity) {
				return bSeverity - aSeverity; // Higher severity first
			}
			
			return b.timestamp - a.timestamp; // Newer first
		});
		
		// Limit number of errors
		displayErrors = filtered.slice(0, maxErrors);
	}
	
	function getSeverityIcon(severity: string): string {
		switch (severity) {
			case 'critical': return '🚨';
			case 'high': return '❌';
			case 'medium': return '⚠️';
			case 'low': return 'ℹ️';
			default: return '❓';
		}
	}
	
	function getSeverityColor(severity: string): string {
		switch (severity) {
			case 'critical': return 'text-red-500 bg-red-900 border-red-500';
			case 'high': return 'text-red-400 bg-red-900 border-red-400';
			case 'medium': return 'text-yellow-400 bg-yellow-900 border-yellow-400';
			case 'low': return 'text-blue-400 bg-blue-900 border-blue-400';
			default: return 'text-gray-400 bg-gray-900 border-gray-400';
		}
	}
	
	function getTypeIcon(type: string): string {
		switch (type) {
			case 'connection': return '🔌';
			case 'protocol': return '📡';
			case 'hardware': return '⚙️';
			case 'validation': return '✏️';
			case 'network': return '🌐';
			case 'storage': return '💾';
			case 'permission': return '🔒';
			case 'timeout': return '⏱️';
			default: return '❓';
		}
	}
	
	function formatTimestamp(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		
		if (diff < 60000) return 'Just now';
		if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
		if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
		return `${Math.floor(diff / 86400000)}d ago`;
	}
	
	function toggleExpanded(errorId: string) {
		if (expandedErrors.has(errorId)) {
			expandedErrors.delete(errorId);
		} else {
			expandedErrors.add(errorId);
		}
		expandedErrors = new Set(expandedErrors);
	}
	
	async function handleRetry(error: AppError) {
		if (!error.retryable || error.retryCount >= error.maxRetries) return;
		
		// Trigger haptic feedback
		triggerHaptic({ type: 'medium' });
		
		try {
			const success = await retryError(error.id);
			if (success) {
				triggerHaptic({ type: 'light' });
			}
		} catch (err) {
			console.error('Retry failed:', err);
		}
	}
	
	function handleResolve(error: AppError) {
		// Trigger haptic feedback
		triggerHaptic({ type: 'light' });
		
		resolveError(error.id);
	}
	
	function handleAction(action: any, error: AppError) {
		// Trigger haptic feedback
		triggerHaptic({ type: 'selection' });
		
		if (action.handler) {
			try {
				const result = action.handler();
				if (result instanceof Promise) {
					result.catch(err => console.error('Action handler failed:', err));
				}
			} catch (err) {
				console.error('Action handler failed:', err);
			}
		}
	}
	
	function getErrorClasses(error: AppError): string {
		const classes = [
			'error-item',
			'bg-arri-gray',
			'rounded-lg',
			'border-l-4',
			'transition-all',
			'duration-200'
		];
		
		// Add severity color
		classes.push(getSeverityColor(error.severity));
		
		// Add compact classes
		if (isCompact) {
			classes.push('p-3', 'mb-2');
		} else {
			classes.push('p-4', 'mb-3');
		}
		
		// Add resolved state
		if (error.resolved) {
			classes.push('opacity-60');
		}
		
		return classes.join(' ');
	}
</script>

<div class="error-display {className}">
	{#if displayErrors.length === 0}
		<div class="no-errors text-center py-8">
			<div class="text-4xl mb-3">✅</div>
			<h3 class="text-responsive-lg font-medium text-green-400 mb-2">
				{showResolved ? 'No Errors' : 'All Clear'}
			</h3>
			<p class="text-responsive-sm text-gray-400">
				{showResolved ? 'No errors have been recorded.' : 'No active errors to display.'}
			</p>
		</div>
	{:else}
		<!-- Error summary -->
		{#if !isCompact && (unresolved.length > 0 || critical.length > 0)}
			<div class="error-summary bg-arri-dark rounded-lg p-4 mb-4 border border-gray-600">
				<div class="flex items-center justify-between">
					<div class="summary-stats flex gap-4">
						{#if critical.length > 0}
							<div class="stat-item text-red-400">
								<span class="stat-icon">🚨</span>
								<span class="stat-count font-bold">{critical.length}</span>
								<span class="stat-label text-xs">Critical</span>
							</div>
						{/if}
						
						{#if unresolved.length > 0}
							<div class="stat-item text-yellow-400">
								<span class="stat-icon">⚠️</span>
								<span class="stat-count font-bold">{unresolved.length}</span>
								<span class="stat-label text-xs">Active</span>
							</div>
						{/if}
					</div>
					
					<div class="summary-actions">
						{#if unresolved.length > 0}
							<button
								class="text-xs bg-arri-red px-3 py-1 rounded hover:bg-red-600 transition-colors"
								on:click={() => unresolved.forEach(error => handleResolve(error))}
							>
								Resolve All
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}
		
		<!-- Error list -->
		<div class="error-list">
			{#each displayErrors as error (error.id)}
				<div class={getErrorClasses(error)}>
					<!-- Error header -->
					<div class="error-header flex items-start justify-between mb-2">
						<div class="error-info flex items-start gap-3 flex-1 min-w-0">
							<!-- Severity and type icons -->
							<div class="error-icons flex gap-1 flex-shrink-0 mt-1">
								<span class="severity-icon text-lg" title="Severity: {error.severity}">
									{getSeverityIcon(error.severity)}
								</span>
								<span class="type-icon text-sm opacity-75" title="Type: {error.type}">
									{getTypeIcon(error.type)}
								</span>
							</div>
							
							<!-- Error message -->
							<div class="error-content flex-1 min-w-0">
								<h4 class="error-message font-medium text-white mb-1 leading-tight">
									{error.userMessage || error.message}
								</h4>
								
								<div class="error-meta flex items-center gap-3 text-xs text-gray-400">
									<span class="error-code">
										{error.code || error.type.toUpperCase()}
									</span>
									<span class="error-time">
										{formatTimestamp(error.timestamp)}
									</span>
									{#if error.retryCount > 0}
										<span class="retry-count text-yellow-400">
											Retry {error.retryCount}/{error.maxRetries}
										</span>
									{/if}
								</div>
							</div>
						</div>
						
						<!-- Expand toggle -->
						{#if error.details || error.context}
							<button
								class="expand-toggle text-gray-400 hover:text-white transition-colors p-1 -m-1"
								on:click={() => toggleExpanded(error.id)}
								aria-label="Toggle error details"
							>
								{expandedErrors.has(error.id) ? '▼' : '▶'}
							</button>
						{/if}
					</div>
					
					<!-- Error details (expanded) -->
					{#if expandedErrors.has(error.id)}
						<div class="error-details bg-arri-dark rounded p-3 mb-3 animate-slide-down">
							{#if error.details}
								<div class="detail-section mb-3">
									<h5 class="detail-title text-xs font-medium text-gray-300 mb-1">Details</h5>
									<p class="detail-content text-xs text-gray-400 leading-relaxed">
										{error.details}
									</p>
								</div>
							{/if}
							
							{#if error.context}
								<div class="detail-section">
									<h5 class="detail-title text-xs font-medium text-gray-300 mb-1">Context</h5>
									<pre class="detail-content text-xs text-gray-400 overflow-auto max-h-32 whitespace-pre-wrap">
{JSON.stringify(error.context, null, 2)}
									</pre>
								</div>
							{/if}
						</div>
					{/if}
					
					<!-- Error actions -->
					{#if error.actionable && error.actionable.length > 0}
						<div class="error-actions flex gap-2 flex-wrap">
							{#each error.actionable as action}
								{#if action.type === 'retry' && error.retryable && error.retryCount < error.maxRetries}
									<button
										class="action-btn btn-primary text-xs px-3 py-1 rounded transition-colors min-h-touch"
										on:click={() => handleRetry(error)}
									>
										{action.label}
									</button>
								{:else if action.type === 'dismiss'}
									<button
										class="action-btn btn-secondary text-xs px-3 py-1 rounded transition-colors min-h-touch"
										on:click={() => handleResolve(error)}
									>
										{action.label}
									</button>
								{:else if action.type !== 'retry'}
									<button
										class="action-btn btn-secondary text-xs px-3 py-1 rounded transition-colors min-h-touch"
										on:click={() => handleAction(action, error)}
									>
										{action.label}
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
		
		<!-- Show more indicator -->
		{#if allErrors.length > maxErrors}
			<div class="show-more text-center py-3">
				<p class="text-xs text-gray-400">
					Showing {displayErrors.length} of {allErrors.length} errors
				</p>
			</div>
		{/if}
	{/if}
</div>

<style>
	.error-display {
		/* Ensure proper spacing */
		width: 100%;
	}
	
	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}
	
	.error-item {
		/* Optimize for animations */
		will-change: transform, opacity;
	}
	
	.expand-toggle {
		/* Ensure proper touch target */
		min-width: 24px;
		min-height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		touch-action: manipulation;
	}
	
	.action-btn {
		/* Ensure proper touch targets */
		min-height: 28px;
		touch-action: manipulation;
		font-weight: 500;
	}
	
	.btn-primary {
		background-color: #E31E24;
		color: white;
	}
	
	.btn-primary:hover {
		background-color: #c41e24;
	}
	
	.btn-secondary {
		background-color: transparent;
		color: #9CA3AF;
		border: 1px solid #4B5563;
	}
	
	.btn-secondary:hover {
		background-color: #374151;
		color: white;
	}
	
	.detail-content {
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		line-height: 1.4;
	}
	
	/* Animation keyframes */
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
		animation: slideDown 0.2s ease-out;
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) {
		.error-summary {
			padding: 0.75rem;
		}
		
		.summary-stats {
			gap: 1rem;
		}
		
		.error-actions {
			flex-direction: column;
		}
		
		.action-btn {
			width: 100%;
			justify-content: center;
		}
	}
	
	/* High contrast mode */
	@media (prefers-contrast: high) {
		.error-item {
			border: 2px solid currentColor;
		}
	}
	
	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.error-item {
			transition: none;
		}
		
		.animate-slide-down {
			animation: none;
		}
		
		.action-btn,
		.expand-toggle {
			transition: none;
		}
	}
	
	/* Focus visible for keyboard navigation */
	.expand-toggle:focus-visible,
	.action-btn:focus-visible {
		outline: 2px solid #E31E24;
		outline-offset: 2px;
	}
</style>