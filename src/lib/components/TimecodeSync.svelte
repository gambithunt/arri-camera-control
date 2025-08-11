<script lang="ts">
	import { cameraStore, notificationStore } from '$lib/stores';
	import { cameraApi } from '$lib/api/cameraApi';
	import { onMount, onDestroy } from 'svelte';
	
	// Props
	export let showDiagnostics = false;
	export let compact = false;
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: syncStatus = cameraState.timecode?.syncStatus || 'unknown';
	$: isLoading = cameraState.operations?.timecode || false;
	
	// Local state
	let syncStatusDetails = null;
	let diagnostics = null;
	let autoRefresh = true;
	let refreshInterval = null;
	
	// Sync status display configuration
	const syncStatusConfig = {
		synced: {
			label: 'Synced',
			color: 'text-green-400',
			bgColor: 'bg-green-900/20',
			icon: '✓',
			description: 'Timecode is synchronized'
		},
		drifting: {
			label: 'Drifting',
			color: 'text-yellow-400',
			bgColor: 'bg-yellow-900/20',
			icon: '⚠',
			description: 'Timecode sync is drifting'
		},
		lost: {
			label: 'Lost',
			color: 'text-red-400',
			bgColor: 'bg-red-900/20',
			icon: '✗',
			description: 'Timecode sync is lost'
		},
		unknown: {
			label: 'Unknown',
			color: 'text-gray-400',
			bgColor: 'bg-gray-900/20',
			icon: '?',
			description: 'Sync status unknown'
		}
	};
	
	onMount(() => {
		if (autoRefresh) {
			startAutoRefresh();
		}
		loadSyncStatus();
	});
	
	onDestroy(() => {
		stopAutoRefresh();
	});
	
	function startAutoRefresh() {
		refreshInterval = setInterval(() => {
			if (autoRefresh) {
				loadSyncStatus();
			}
		}, 5000); // Refresh every 5 seconds
	}
	
	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}
	
	async function loadSyncStatus() {
		try {
			const result = await cameraApi.getSyncStatus();
			if (result.success) {
				syncStatusDetails = result.data;
			}
		} catch (error) {
			console.error('Failed to load sync status:', error);
		}
	}
	
	async function loadDiagnostics() {
		try {
			const result = await cameraApi.getSyncDiagnostics();
			if (result.success) {
				diagnostics = result.data;
				notificationStore.success('Diagnostics', 'Sync diagnostics loaded');
			} else {
				notificationStore.error('Diagnostics Failed', result.error || 'Failed to load diagnostics');
			}
		} catch (error) {
			notificationStore.error('Diagnostics Failed', error instanceof Error ? error.message : 'Unknown error');
		}
	}
	
	async function performManualSync() {
		if (isLoading) return;
		
		cameraStore.setOperationLoading('timecode', true);
		
		try {
			const result = await cameraApi.manualSync();
			if (result.success) {
				notificationStore.success('Manual Sync', 'Timecode manually synchronized');
				await loadSyncStatus();
			} else {
				notificationStore.error('Manual Sync Failed', result.error || 'Failed to perform manual sync');
			}
		} catch (error) {
			notificationStore.error('Manual Sync Failed', error instanceof Error ? error.message : 'Unknown error');
		} finally {
			cameraStore.setOperationLoading('timecode', false);
		}
	}
	
	function toggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	}
	
	function formatDrift(drift) {
		if (typeof drift !== 'number') return 'N/A';
		const absMs = Math.abs(drift);
		if (absMs < 1) return '< 1ms';
		if (absMs < 1000) return `${Math.round(absMs)}ms`;
		return `${(absMs / 1000).toFixed(1)}s`;
	}
	
	function formatTimestamp(timestamp) {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleTimeString();
	}
	
	$: statusConfig = syncStatusConfig[syncStatus] || syncStatusConfig.unknown;
</script>

<div class="timecode-sync {compact ? 'compact' : ''}">
	<!-- Sync Status Display -->
	<div class="sync-status-card {statusConfig.bgColor}">
		<div class="status-header">
			<div class="status-indicator">
				<span class="status-icon {statusConfig.color}">{statusConfig.icon}</span>
				<div class="status-info">
					<div class="status-label {statusConfig.color}">{statusConfig.label}</div>
					{#if !compact}
						<div class="status-description">{statusConfig.description}</div>
					{/if}
				</div>
			</div>
			
			<div class="status-actions">
				<button 
					class="btn-icon"
					on:click={loadSyncStatus}
					disabled={isLoading}
					title="Refresh sync status"
				>
					🔄
				</button>
				
				<button 
					class="btn-icon {autoRefresh ? 'active' : ''}"
					on:click={toggleAutoRefresh}
					title="Toggle auto-refresh"
				>
					⏱️
				</button>
			</div>
		</div>
		
		{#if syncStatusDetails && !compact}
			<div class="status-details">
				<div class="detail-row">
					<span class="detail-label">Sync Offset:</span>
					<span class="detail-value">{formatDrift(syncStatusDetails.syncOffset)}</span>
				</div>
				
				<div class="detail-row">
					<span class="detail-label">Last Sync:</span>
					<span class="detail-value">{formatTimestamp(syncStatusDetails.lastSyncTime)}</span>
				</div>
				
				{#if syncStatusDetails.consecutiveErrors > 0}
					<div class="detail-row">
						<span class="detail-label">Errors:</span>
						<span class="detail-value text-red-400">{syncStatusDetails.consecutiveErrors}</span>
					</div>
				{/if}
			</div>
		{/if}
	</div>
	
	<!-- Action Buttons -->
	<div class="sync-actions">
		<button 
			class="btn-action"
			on:click={performManualSync}
			disabled={isLoading}
		>
			<span class="action-icon">🔄</span>
			<div class="action-text">
				<div class="action-label">Manual Sync</div>
				<div class="action-description">Force synchronization</div>
			</div>
		</button>
		
		{#if showDiagnostics}
			<button 
				class="btn-action"
				on:click={loadDiagnostics}
				disabled={isLoading}
			>
				<span class="action-icon">🔍</span>
				<div class="action-text">
					<div class="action-label">Diagnostics</div>
					<div class="action-description">View detailed sync info</div>
				</div>
			</button>
		{/if}
	</div>
	
	<!-- Drift Analysis -->
	{#if syncStatusDetails?.driftAnalysis && !compact}
		<div class="drift-analysis">
			<h4 class="analysis-title">Drift Analysis</h4>
			<div class="analysis-grid">
				<div class="analysis-item">
					<span class="analysis-label">Trend:</span>
					<span class="analysis-value">{syncStatusDetails.driftAnalysis.trend.replace('_', ' ')}</span>
				</div>
				
				<div class="analysis-item">
					<span class="analysis-label">Avg Drift:</span>
					<span class="analysis-value">{formatDrift(syncStatusDetails.driftAnalysis.avgDrift)}</span>
				</div>
				
				<div class="analysis-item">
					<span class="analysis-label">Max Drift:</span>
					<span class="analysis-value">{formatDrift(syncStatusDetails.driftAnalysis.maxDrift)}</span>
				</div>
				
				<div class="analysis-item">
					<span class="analysis-label">Samples:</span>
					<span class="analysis-value">{syncStatusDetails.driftAnalysis.sampleCount}</span>
				</div>
			</div>
		</div>
	{/if}
	
	<!-- Diagnostics Modal -->
	{#if diagnostics}
		<div class="modal-overlay" on:click={() => diagnostics = null} role="dialog" aria-label="Sync Diagnostics">
			<div class="modal-content" on:click|stopPropagation>
				<div class="modal-header">
					<h3 class="modal-title">Timecode Sync Diagnostics</h3>
					<button class="btn-close" on:click={() => diagnostics = null}>✕</button>
				</div>
				
				<div class="modal-body">
					<!-- System Info -->
					<div class="diagnostic-section">
						<h4 class="section-title">System Status</h4>
						<div class="diagnostic-grid">
							<div class="diagnostic-item">
								<span class="diagnostic-label">Update Interval:</span>
								<span class="diagnostic-value">{diagnostics.systemInfo.updateInterval || 'N/A'}ms</span>
							</div>
							<div class="diagnostic-item">
								<span class="diagnostic-label">Monitor Interval:</span>
								<span class="diagnostic-value">{diagnostics.systemInfo.monitorInterval || 'N/A'}ms</span>
							</div>
							<div class="diagnostic-item">
								<span class="diagnostic-label">Running:</span>
								<span class="diagnostic-value {diagnostics.systemInfo.isRunning ? 'text-green-400' : 'text-red-400'}">
									{diagnostics.systemInfo.isRunning ? 'Yes' : 'No'}
								</span>
							</div>
						</div>
					</div>
					
					<!-- Timecode State -->
					<div class="diagnostic-section">
						<h4 class="section-title">Timecode State</h4>
						<div class="diagnostic-grid">
							<div class="diagnostic-item">
								<span class="diagnostic-label">Current:</span>
								<span class="diagnostic-value font-mono">{diagnostics.timecodeState.current}</span>
							</div>
							<div class="diagnostic-item">
								<span class="diagnostic-label">Mode:</span>
								<span class="diagnostic-value">{diagnostics.timecodeState.mode}</span>
							</div>
							<div class="diagnostic-item">
								<span class="diagnostic-label">Frame Rate:</span>
								<span class="diagnostic-value">{diagnostics.timecodeState.frameRate} fps</span>
							</div>
							<div class="diagnostic-item">
								<span class="diagnostic-label">Sync Offset:</span>
								<span class="diagnostic-value">{formatDrift(diagnostics.timecodeState.syncOffset)}</span>
							</div>
						</div>
					</div>
					
					<!-- Drift History -->
					{#if diagnostics.driftHistory && diagnostics.driftHistory.length > 0}
						<div class="diagnostic-section">
							<h4 class="section-title">Recent Drift History</h4>
							<div class="drift-history">
								{#each diagnostics.driftHistory.slice(-5) as entry}
									<div class="drift-entry">
										<span class="drift-time">{formatTimestamp(entry.timestamp)}</span>
										<span class="drift-value">{formatDrift(entry.drift)}</span>
										<span class="drift-latency">{entry.networkLatency}ms</span>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				</div>
				
				<div class="modal-actions">
					<button class="btn-secondary" on:click={() => diagnostics = null}>
						Close
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.timecode-sync {
		@apply space-y-4;
	}
	
	.timecode-sync.compact {
		@apply space-y-2;
	}
	
	.sync-status-card {
		@apply rounded-lg p-4 border border-gray-600;
	}
	
	.status-header {
		@apply flex items-center justify-between;
	}
	
	.status-indicator {
		@apply flex items-center gap-3;
	}
	
	.status-icon {
		@apply text-xl font-bold;
	}
	
	.status-info {
		@apply flex-1;
	}
	
	.status-label {
		@apply font-medium;
	}
	
	.status-description {
		@apply text-sm text-gray-400 mt-1;
	}
	
	.status-actions {
		@apply flex gap-2;
	}
	
	.btn-icon {
		@apply w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center;
		@apply text-sm transition-colors;
	}
	
	.btn-icon.active {
		@apply bg-arri-red hover:bg-red-600;
	}
	
	.status-details {
		@apply mt-3 pt-3 border-t border-gray-600 space-y-2;
	}
	
	.detail-row {
		@apply flex justify-between items-center text-sm;
	}
	
	.detail-label {
		@apply text-gray-400;
	}
	
	.detail-value {
		@apply font-mono;
	}
	
	.sync-actions {
		@apply space-y-3;
	}
	
	.btn-action {
		@apply w-full flex items-center gap-3 p-3 bg-arri-gray hover:bg-gray-600 rounded-lg;
		@apply min-h-touch transition-colors text-left;
		@apply disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.action-icon {
		@apply text-xl flex-shrink-0;
	}
	
	.action-text {
		@apply flex-1;
	}
	
	.action-label {
		@apply font-medium;
	}
	
	.action-description {
		@apply text-sm text-gray-300 mt-1;
	}
	
	.drift-analysis {
		@apply bg-arri-gray rounded-lg p-4;
	}
	
	.analysis-title {
		@apply text-sm font-medium text-gray-300 mb-3;
	}
	
	.analysis-grid {
		@apply grid grid-cols-2 gap-3;
	}
	
	.analysis-item {
		@apply flex justify-between items-center text-sm;
	}
	
	.analysis-label {
		@apply text-gray-400;
	}
	
	.analysis-value {
		@apply font-mono capitalize;
	}
	
	.modal-overlay {
		@apply fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4;
	}
	
	.modal-content {
		@apply bg-arri-gray rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden;
	}
	
	.modal-header {
		@apply flex items-center justify-between p-6 border-b border-gray-600;
	}
	
	.modal-title {
		@apply text-lg font-medium;
	}
	
	.btn-close {
		@apply w-8 h-8 rounded bg-gray-700 hover:bg-gray-600 flex items-center justify-center;
		@apply text-lg transition-colors;
	}
	
	.modal-body {
		@apply p-6 overflow-y-auto max-h-[60vh] space-y-6;
	}
	
	.diagnostic-section {
		@apply space-y-3;
	}
	
	.section-title {
		@apply text-sm font-medium text-gray-300 uppercase tracking-wide;
	}
	
	.diagnostic-grid {
		@apply grid grid-cols-1 md:grid-cols-2 gap-3;
	}
	
	.diagnostic-item {
		@apply flex justify-between items-center text-sm bg-gray-800 rounded p-2;
	}
	
	.diagnostic-label {
		@apply text-gray-400;
	}
	
	.diagnostic-value {
		@apply font-mono;
	}
	
	.drift-history {
		@apply space-y-2;
	}
	
	.drift-entry {
		@apply flex justify-between items-center text-sm bg-gray-800 rounded p-2;
	}
	
	.drift-time {
		@apply text-gray-400 flex-1;
	}
	
	.drift-value {
		@apply font-mono flex-1 text-center;
	}
	
	.drift-latency {
		@apply text-gray-400 flex-1 text-right;
	}
	
	.modal-actions {
		@apply p-6 border-t border-gray-600 flex justify-end;
	}
	
	.btn-secondary {
		@apply py-2 px-4 rounded-lg font-medium transition-colors min-h-touch;
		@apply bg-gray-600 hover:bg-gray-500 text-white;
	}
	
	/* Responsive adjustments */
	@media (max-width: 480px) {
		.analysis-grid {
			@apply grid-cols-1;
		}
		
		.diagnostic-grid {
			@apply grid-cols-1;
		}
		
		.drift-entry {
			@apply flex-col items-start gap-1;
		}
		
		.drift-time, .drift-value, .drift-latency {
			@apply flex-none text-left;
		}
	}
</style>