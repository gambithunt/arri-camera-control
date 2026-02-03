<!--
  Connection Status Display Component
  Shows detailed connection status and diagnostics
-->

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { 
		connectionStatusStore, 
		protocolMessagesStore,
		isWebSocketConnected,
		isCameraConnected,
		isFullyConnected,
		connectionQuality,
		hasConnectionErrors,
		runDiagnostics,
		exportDiagnosticData,
		clearMessageHistory,
		setDebugMode,
		type ConnectionStatus,
		type ProtocolMessage,
		type DiagnosticTest
	} from '$lib/utils/connectionDiagnostics';
	import { screenInfo } from '$lib/utils/responsiveLayout';
	import { triggerHaptic } from '$lib/utils/touchInteractions';
	import { showSuccess, showError } from '$lib/utils/errorManager';
	
	// Props
	export let compact = false;
	export let showProtocolMessages = false;
	export let showDiagnostics = false;
	export let className = '';
	
	// Component state
	let status: ConnectionStatus;
	let protocolMessages: ProtocolMessage[] = [];
	let diagnosticTests: DiagnosticTest[] = [];
	let isRunningDiagnostics = false;
	let debugMode = false;
	let expandedSections: Set<string> = new Set();
	
	// Reactive subscriptions
	$: currentScreenInfo = $screenInfo;
	$: isCompact = compact || currentScreenInfo.deviceType === 'phone';
	$: wsConnected = $isWebSocketConnected;
	$: cameraConnected = $isCameraConnected;
	$: fullyConnected = $isFullyConnected;
	$: quality = $connectionQuality;
	$: hasErrors = $hasConnectionErrors;
	
	// Subscribe to stores
	const unsubscribeStatus = connectionStatusStore.subscribe(s => status = s);
	const unsubscribeMessages = protocolMessagesStore.subscribe(m => protocolMessages = m);
	
	onMount(() => {
		// Refresh data
		connectionStatusStore.refresh();
		protocolMessagesStore.refresh(50);
	});
	
	onDestroy(() => {
		unsubscribeStatus();
		unsubscribeMessages();
	});
	
	function getStatusIcon(connectionStatus: string): string {
		switch (connectionStatus) {
			case 'connected':
				return '🟢';
			case 'connecting':
			case 'reconnecting':
				return '🟡';
			case 'disconnected':
				return '🔴';
			case 'error':
				return '❌';
			default:
				return '⚪';
		}
	}
	
	function getQualityIcon(quality: string): string {
		switch (quality) {
			case 'excellent':
				return '📶';
			case 'good':
				return '📶';
			case 'fair':
				return '📶';
			case 'poor':
				return '📶';
			default:
				return '❓';
		}
	}
	
	function getQualityColor(quality: string): string {
		switch (quality) {
			case 'excellent':
				return 'text-green-400';
			case 'good':
				return 'text-green-300';
			case 'fair':
				return 'text-yellow-400';
			case 'poor':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}
	
	function formatLatency(latency?: number): string {
		if (latency === undefined) return 'N/A';
		return `${Math.round(latency)}ms`;
	}
	
	function formatUptime(seconds: number): string {
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
		return `${Math.round(seconds / 3600)}h`;
	}
	
	function formatTimestamp(timestamp: number): string {
		return new Date(timestamp).toLocaleTimeString();
	}
	
	function formatDataSize(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	}
	
	function toggleSection(sectionId: string) {
		if (expandedSections.has(sectionId)) {
			expandedSections.delete(sectionId);
		} else {
			expandedSections.add(sectionId);
		}
		expandedSections = new Set(expandedSections);
	}
	
	async function handleRunDiagnostics() {
		triggerHaptic({ type: 'medium' });
		isRunningDiagnostics = true;
		
		try {
			diagnosticTests = await runDiagnostics();
			showSuccess('Diagnostics Complete', 'Connection diagnostics completed successfully');
		} catch (error) {
			showError('Diagnostics Failed', 'Failed to run connection diagnostics');
			console.error('Diagnostics failed:', error);
		} finally {
			isRunningDiagnostics = false;
		}
	}
	
	function handleExportDiagnostics() {
		triggerHaptic({ type: 'light' });
		
		try {
			const diagnosticData = exportDiagnosticData();
			
			// Create and download file
			const blob = new Blob([diagnosticData], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `camera-diagnostics-${new Date().toISOString().slice(0, 19)}.json`;
			a.click();
			URL.revokeObjectURL(url);
			
			showSuccess('Export Complete', 'Diagnostic data exported successfully');
		} catch (error) {
			showError('Export Failed', 'Failed to export diagnostic data');
			console.error('Export failed:', error);
		}
	}
	
	function handleClearMessages() {
		triggerHaptic({ type: 'light' });
		clearMessageHistory();
		protocolMessagesStore.refresh();
		showSuccess('Messages Cleared', 'Protocol message history cleared');
	}
	
	function handleToggleDebug() {
		debugMode = !debugMode;
		setDebugMode(debugMode);
		triggerHaptic({ type: 'selection' });
		showSuccess(
			'Debug Mode',
			`Debug mode ${debugMode ? 'enabled' : 'disabled'}`
		);
	}
	
	function getMessageTypeColor(type: string): string {
		switch (type) {
			case 'websocket':
				return 'text-blue-400';
			case 'cap':
				return 'text-purple-400';
			default:
				return 'text-gray-400';
		}
	}
	
	function getDirectionIcon(direction: string): string {
		return direction === 'sent' ? '↗️' : '↙️';
	}
	
	function getTestStatusIcon(status: string): string {
		switch (status) {
			case 'passed':
				return '✅';
			case 'failed':
				return '❌';
			case 'running':
				return '⏳';
			case 'skipped':
				return '⏭️';
			default:
				return '⏸️';
		}
	}
</script>

<div class="connection-status-display {className}" class:compact={isCompact}>
	<!-- Main Status Overview -->
	<div class="status-overview bg-arri-gray rounded-lg p-4 mb-4">
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-responsive-lg font-semibold text-white">
				Connection Status
			</h3>
			<div class="status-indicators flex gap-2">
				<span class="quality-indicator {getQualityColor(quality)}" title="Connection Quality: {quality}">
					{getQualityIcon(quality)}
				</span>
				{#if hasErrors}
					<span class="error-indicator text-red-400" title="Connection Errors">
						⚠️
					</span>
				{/if}
			</div>
		</div>
		
		<div class="connection-grid grid {isCompact ? 'grid-cols-1' : 'grid-cols-2'} gap-4">
			<!-- WebSocket Status -->
			<div class="connection-item">
				<div class="flex items-center gap-2 mb-2">
					<span class="status-icon text-lg">
						{getStatusIcon(status?.websocket?.status || 'disconnected')}
					</span>
					<span class="connection-label text-responsive-sm font-medium text-white">
						WebSocket
					</span>
				</div>
				<div class="connection-details text-xs text-gray-400">
					<div>Status: {status?.websocket?.status || 'unknown'}</div>
					<div>Latency: {formatLatency(status?.websocket?.latency)}</div>
					{#if status?.websocket?.reconnectAttempts > 0}
						<div class="text-yellow-400">
							Retries: {status.websocket.reconnectAttempts}/{status.websocket.maxReconnectAttempts}
						</div>
					{/if}
				</div>
			</div>
			
			<!-- Camera Status -->
			<div class="connection-item">
				<div class="flex items-center gap-2 mb-2">
					<span class="status-icon text-lg">
						{getStatusIcon(status?.camera?.status || 'disconnected')}
					</span>
					<span class="connection-label text-responsive-sm font-medium text-white">
						Camera
					</span>
				</div>
				<div class="connection-details text-xs text-gray-400">
					<div>Status: {status?.camera?.status || 'unknown'}</div>
					<div>Latency: {formatLatency(status?.camera?.latency)}</div>
					{#if status?.camera?.reconnectAttempts > 0}
						<div class="text-yellow-400">
							Retries: {status.camera.reconnectAttempts}/{status.camera.maxReconnectAttempts}
						</div>
					{/if}
				</div>
			</div>
		</div>
		
		<!-- Network Info -->
		{#if status?.network && !isCompact}
			<div class="network-info mt-4 pt-3 border-t border-gray-600">
				<div class="flex items-center gap-2 mb-2">
					<span class="text-sm font-medium text-white">Network</span>
					<span class="{status.network.online ? 'text-green-400' : 'text-red-400'}">
						{status.network.online ? '🌐' : '📵'}
					</span>
				</div>
				<div class="network-details text-xs text-gray-400 grid grid-cols-2 gap-2">
					{#if status.network.effectiveType}
						<div>Type: {status.network.effectiveType}</div>
					{/if}
					{#if status.network.downlink}
						<div>Speed: {status.network.downlink}Mbps</div>
					{/if}
					{#if status.network.rtt}
						<div>RTT: {status.network.rtt}ms</div>
					{/if}
					{#if status.network.saveData}
						<div class="text-yellow-400">Data Saver: On</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
	
	<!-- Action Buttons -->
	<div class="action-buttons flex flex-wrap gap-2 mb-4">
		<button
			class="btn-secondary text-xs px-3 py-2 rounded transition-colors min-h-touch"
			on:click={handleRunDiagnostics}
			disabled={isRunningDiagnostics}
		>
			{#if isRunningDiagnostics}
				⏳ Running...
			{:else}
				🔍 Run Diagnostics
			{/if}
		</button>
		
		<button
			class="btn-secondary text-xs px-3 py-2 rounded transition-colors min-h-touch"
			on:click={handleExportDiagnostics}
		>
			📄 Export Data
		</button>
		
		<button
			class="btn-secondary text-xs px-3 py-2 rounded transition-colors min-h-touch"
			on:click={handleToggleDebug}
			class:active={debugMode}
		>
			🐛 Debug {debugMode ? 'On' : 'Off'}
		</button>
	</div>
</div>

<style>
	.connection-status-display {
		/* Ensure proper spacing */
		width: 100%;
	}
	
	.connection-item {
		/* Ensure proper layout */
		min-height: 60px;
	}
	
	.section-header {
		/* Ensure proper touch targets */
		min-height: 32px;
		touch-action: manipulation;
	}
	
	.action-buttons button {
		/* Ensure proper touch targets */
		min-height: 32px;
		touch-action: manipulation;
	}
	
	.action-buttons button.active {
		background-color: #E31E24;
		color: white;
	}
	
	/* Responsive adjustments */
	@media (max-width: 767px) {
		.connection-status-display.compact {
			padding: 0.5rem;
		}
		
		.action-buttons {
			flex-direction: column;
		}
		
		.action-buttons button {
			width: 100%;
			justify-content: center;
		}
	}
	
	/* Focus management */
	.section-header:focus-visible,
	.action-buttons button:focus-visible {
		outline: 2px solid #E31E24;
		outline-offset: 2px;
	}
</style>