<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { cameraApi } from '$lib/api/cameraApi';
	import type { ConnectionStatus } from '$lib/websocket/socketClient';
	import type { CameraState } from '$lib/api/cameraApi';
	
	let connectionStatus: ConnectionStatus;
	let cameraState: CameraState;
	let showDetails = false;
	
	// Unsubscribe functions
	let unsubscribeConnection: () => void;
	let unsubscribeCamera: () => void;
	
	onMount(() => {
		// Subscribe to connection status
		unsubscribeConnection = cameraApi.connectionStatus.subscribe((status) => {
			connectionStatus = status;
		});
		
		// Subscribe to camera state
		unsubscribeCamera = cameraApi.cameraState.subscribe((state) => {
			cameraState = state;
		});
	});
	
	onDestroy(() => {
		if (unsubscribeConnection) unsubscribeConnection();
		if (unsubscribeCamera) unsubscribeCamera();
	});
	
	async function handleConnect() {
		try {
			const result = await cameraApi.connect();
			if (!result.success) {
				console.error('Connection failed:', result.error);
			}
		} catch (error) {
			console.error('Connection error:', error);
		}
	}
	
	async function handleDisconnect() {
		try {
			await cameraApi.disconnect();
		} catch (error) {
			console.error('Disconnect error:', error);
		}
	}
	
	function getStatusColor(): string {
		if (!connectionStatus) return 'bg-gray-500';
		
		if (connectionStatus.connected && cameraState?.connected) {
			return 'bg-green-500';
		} else if (connectionStatus.connecting) {
			return 'bg-yellow-500';
		} else if (connectionStatus.error) {
			return 'bg-red-500';
		} else {
			return 'bg-gray-500';
		}
	}
	
	function getStatusText(): string {
		if (!connectionStatus) return 'Unknown';
		
		if (connectionStatus.connected && cameraState?.connected) {
			return cameraState.model ? `Connected to ${cameraState.model}` : 'Connected';
		} else if (connectionStatus.connecting) {
			return 'Connecting...';
		} else if (connectionStatus.error) {
			return 'Connection Error';
		} else {
			return 'Disconnected';
		}
	}
	
	function formatLastConnected(): string {
		if (!connectionStatus?.lastConnected) return 'Never';
		
		const now = new Date();
		const diff = now.getTime() - connectionStatus.lastConnected.getTime();
		const minutes = Math.floor(diff / 60000);
		
		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
</script>

<div class="connection-status-detailed">
	<div class="status-header" on:click={() => showDetails = !showDetails}>
		<div class="flex items-center gap-3">
			<div class="status-indicator {getStatusColor()}">
				{#if connectionStatus?.connecting}
					<div class="spinner"></div>
				{/if}
			</div>
			<div class="flex-1">
				<div class="status-text">{getStatusText()}</div>
				{#if connectionStatus?.error}
					<div class="error-text">{connectionStatus.error}</div>
				{:else if cameraState?.connected && cameraState.serialNumber}
					<div class="detail-text">S/N: {cameraState.serialNumber}</div>
				{/if}
			</div>
			<div class="expand-icon {showDetails ? 'expanded' : ''}">
				▼
			</div>
		</div>
	</div>
	
	{#if showDetails}
		<div class="status-details">
			<div class="detail-grid">
				<div class="detail-item">
					<span class="detail-label">Server</span>
					<span class="detail-value">{connectionStatus?.serverUrl || 'Unknown'}</span>
				</div>
				
				{#if connectionStatus?.lastConnected}
					<div class="detail-item">
						<span class="detail-label">Last Connected</span>
						<span class="detail-value">{formatLastConnected()}</span>
					</div>
				{/if}
				
				{#if connectionStatus?.reconnectAttempts > 0}
					<div class="detail-item">
						<span class="detail-label">Reconnect Attempts</span>
						<span class="detail-value">{connectionStatus.reconnectAttempts}</span>
					</div>
				{/if}
				
				{#if cameraState?.connected}
					<div class="detail-item">
						<span class="detail-label">Camera Model</span>
						<span class="detail-value">{cameraState.model || 'Unknown'}</span>
					</div>
					
					{#if cameraState.firmwareVersion}
						<div class="detail-item">
							<span class="detail-label">Firmware</span>
							<span class="detail-value">{cameraState.firmwareVersion}</span>
						</div>
					{/if}
				{/if}
			</div>
			
			<div class="action-buttons">
				{#if connectionStatus?.connected && cameraState?.connected}
					<button class="btn-disconnect" on:click={handleDisconnect}>
						Disconnect
					</button>
				{:else}
					<button 
						class="btn-connect" 
						on:click={handleConnect}
						disabled={connectionStatus?.connecting}
					>
						{connectionStatus?.connecting ? 'Connecting...' : 'Connect'}
					</button>
				{/if}
			</div>
		</div>
	{:else}
		<div class="quick-actions">
			{#if connectionStatus?.connected && cameraState?.connected}
				<button class="btn-disconnect-small" on:click={handleDisconnect}>
					Disconnect
				</button>
			{:else}
				<button 
					class="btn-connect-small" 
					on:click={handleConnect}
					disabled={connectionStatus?.connecting}
				>
					{connectionStatus?.connecting ? 'Connecting...' : 'Connect'}
				</button>
			{/if}
		</div>
	{/if}
</div>

<style>
	.connection-status-detailed {
		@apply bg-arri-gray rounded-lg overflow-hidden mb-4;
	}
	
	.status-header {
		@apply p-3 cursor-pointer hover:bg-gray-600 transition-colors;
	}
	
	.status-indicator {
		@apply w-3 h-3 rounded-full flex-shrink-0 relative;
	}
	
	.spinner {
		@apply absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin;
	}
	
	.status-text {
		@apply text-sm font-medium;
	}
	
	.error-text {
		@apply text-xs text-red-400 mt-1;
	}
	
	.detail-text {
		@apply text-xs text-gray-400 mt-1;
	}
	
	.expand-icon {
		@apply text-xs text-gray-400 transition-transform duration-200;
	}
	
	.expand-icon.expanded {
		@apply rotate-180;
	}
	
	.status-details {
		@apply border-t border-gray-600 p-3 bg-gray-800;
	}
	
	.detail-grid {
		@apply space-y-2 mb-3;
	}
	
	.detail-item {
		@apply flex justify-between items-center;
	}
	
	.detail-label {
		@apply text-xs text-gray-400;
	}
	
	.detail-value {
		@apply text-xs font-medium;
	}
	
	.action-buttons {
		@apply flex gap-2;
	}
	
	.quick-actions {
		@apply px-3 pb-3;
	}
	
	.btn-connect, .btn-connect-small {
		@apply bg-arri-red hover:bg-red-600 text-white font-medium py-2 px-4 rounded;
		@apply transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
	}
	
	.btn-connect-small {
		@apply text-xs py-1 px-3;
	}
	
	.btn-disconnect, .btn-disconnect-small {
		@apply bg-gray-600 hover:bg-gray-500 text-white font-medium py-2 px-4 rounded;
		@apply transition-colors;
	}
	
	.btn-disconnect-small {
		@apply text-xs py-1 px-3;
	}
</style>