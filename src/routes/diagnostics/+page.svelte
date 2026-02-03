<!--
  Diagnostics Page
  Comprehensive connection diagnostics and troubleshooting
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import ConnectionStatusDisplay from '$lib/components/ConnectionStatusDisplay.svelte';
	import ConnectionSettings from '$lib/components/ConnectionSettings.svelte';
	import ResponsiveContainer from '$lib/components/ResponsiveContainer.svelte';

	// Component state
	let showProtocolMessages = true;
	let showDiagnostics = true;
	let autoRefresh = false;
	let refreshInterval: NodeJS.Timeout | null = null;
	
	// Handle connection settings changes
	function handleSettingsChange(settings: any) {
		console.log('Connection settings updated:', settings);
		// Here you would update the WebSocket client configuration
		// and reconnect with the new settings
	}

	onMount(() => {
		// Check for auto-refresh parameter
		const urlParams = new URLSearchParams($page.url.search);
		if (urlParams.get('autoRefresh') === 'true') {
			autoRefresh = true;
			startAutoRefresh();
		}
		
		return () => {
			if (refreshInterval) {
				clearInterval(refreshInterval);
			}
		};
	});
	
	function startAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
		}
		
		refreshInterval = setInterval(() => {
			// Refresh connection status
			console.log('Auto refreshing diagnostics...');
		}, 5000); // Refresh every 5 seconds
	}
	
	function stopAutoRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}
	
	function handleToggleAutoRefresh() {
		autoRefresh = !autoRefresh;
		
		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
	}
	
	function handleToggleProtocolMessages() {
		showProtocolMessages = !showProtocolMessages;
	}
	
	function handleToggleDiagnostics() {
		showDiagnostics = !showDiagnostics;
	}
	
	function handleRefresh() {
		console.log('Refreshing diagnostics...');
	}
</script>

<svelte:head>
	<title>Connection Diagnostics - ARRI Camera Control</title>
	<meta name="description" content="Connection diagnostics and troubleshooting tools" />
</svelte:head>

<ResponsiveContainer size="full" padding="md" className="diagnostics-page">
	<!-- Page Header -->
	<div class="page-header mb-6">
		<div class="flex items-center justify-between mb-4">
			<h1 class="text-2xl font-bold text-white">
				🔍 Connection Diagnostics
			</h1>
			
			<div class="header-actions flex gap-2">
				<button
					class="btn-secondary text-sm px-3 py-2 rounded transition-colors"
					on:click={handleRefresh}
				>
					🔄 Refresh
				</button>
				
				<button
					class="btn-secondary text-sm px-3 py-2 rounded transition-colors"
					class:active={autoRefresh}
					on:click={handleToggleAutoRefresh}
				>
					⏱️ Auto {autoRefresh ? 'On' : 'Off'}
				</button>
			</div>
		</div>
		
		<p class="text-base text-gray-300 leading-relaxed">
			Comprehensive connection monitoring and diagnostic tools for troubleshooting 
			camera connectivity issues.
		</p>
	</div>
	
	<!-- Display Options -->
	<div class="display-options bg-gray-800 rounded-lg p-4 mb-6">
		<h3 class="text-lg font-semibold text-white mb-3">
			Display Options
		</h3>
		
		<div class="options-grid grid grid-cols-2 gap-3">
			<label class="option-item flex items-center gap-3 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={showProtocolMessages}
					on:change={handleToggleProtocolMessages}
					class="checkbox"
				/>
				<span class="text-sm text-white">
					Show Protocol Messages
				</span>
			</label>
			
			<label class="option-item flex items-center gap-3 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={showDiagnostics}
					on:change={handleToggleDiagnostics}
					class="checkbox"
				/>
				<span class="text-sm text-white">
					Show Diagnostic Tests
				</span>
			</label>
		</div>
	</div>
	
	<!-- Connection Settings -->
	<div class="connection-settings-section mb-6">
		<ConnectionSettings onSettingsChange={handleSettingsChange} />
	</div>
	
	<!-- Connection Status Display -->
	<ConnectionStatusDisplay
		compact={false}
		{showProtocolMessages}
		{showDiagnostics}
		className="diagnostics-display"
	/>
	
	<!-- Help Section -->
	<div class="help-section bg-gray-800 rounded-lg p-4 mt-6">
		<h3 class="text-lg font-semibold text-white mb-3">
			💡 Troubleshooting Tips
		</h3>
		
		<div class="tips-grid grid grid-cols-2 gap-4">
			<div class="tip-item">
				<h4 class="text-base font-medium text-red-500 mb-2">
					Connection Issues
				</h4>
				<ul class="text-sm text-gray-300 space-y-1">
					<li>• Check camera IP address and network settings</li>
					<li>• Ensure camera is powered on and accessible</li>
					<li>• Verify network connectivity between devices</li>
					<li>• Check firewall and port settings</li>
				</ul>
			</div>
			
			<div class="tip-item">
				<h4 class="text-base font-medium text-red-500 mb-2">
					Performance Issues
				</h4>
				<ul class="text-sm text-gray-300 space-y-1">
					<li>• Monitor connection latency and quality</li>
					<li>• Check network bandwidth and stability</li>
					<li>• Reduce protocol message frequency if needed</li>
					<li>• Consider wired connection for better stability</li>
				</ul>
			</div>
		</div>
	</div>
</ResponsiveContainer>

<style>
	.diagnostics-page {
		min-height: 100vh;
		padding-bottom: 2rem;
	}
	
	.header-actions button.active {
		background-color: #E31E24;
		color: white;
	}
	
	.checkbox {
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 0.25rem;
		border: 2px solid #4B5563;
		background-color: transparent;
		cursor: pointer;
		transition: all 0.2s ease;
	}
	
	.checkbox:checked {
		background-color: #E31E24;
		border-color: #E31E24;
	}
	
	.option-item {
		min-height: 44px;
		touch-action: manipulation;
	}
</style>