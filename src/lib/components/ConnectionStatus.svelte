<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { cameraApi } from '$lib/api/cameraApi';
	import type { ConnectionStatus as SocketConnectionStatus } from '$lib/websocket/socketClient';
	import type { CameraState } from '$lib/api/cameraApi';
	
	export let showDetails: boolean = true;
	
	let connectionStatus: SocketConnectionStatus;
	let cameraState: CameraState;
	let connectionText: string;
	let statusColor: string;
	
	// Unsubscribe functions
	let unsubscribeConnection: () => void;
	let unsubscribeCamera: () => void;
	
	onMount(() => {
		// Subscribe to connection status
		unsubscribeConnection = cameraApi.connectionStatus.subscribe((status) => {
			connectionStatus = status;
			updateDisplay();
		});
		
		// Subscribe to camera state
		unsubscribeCamera = cameraApi.cameraState.subscribe((state) => {
			cameraState = state;
			updateDisplay();
		});
	});
	
	onDestroy(() => {
		if (unsubscribeConnection) unsubscribeConnection();
		if (unsubscribeCamera) unsubscribeCamera();
	});
	
	function updateDisplay() {
		if (!connectionStatus) return;
		
		if (connectionStatus.connected && cameraState?.connected) {
			connectionText = cameraState.model ? `Connected to ${cameraState.model}` : 'Connected';
			statusColor = 'bg-green-500';
		} else if (connectionStatus.connecting) {
			connectionText = 'Connecting...';
			statusColor = 'bg-yellow-500';
		} else if (connectionStatus.error) {
			connectionText = 'Connection Error';
			statusColor = 'bg-red-500';
		} else {
			connectionText = 'Disconnected';
			statusColor = 'bg-red-500';
		}
	}
	
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
</script>

<div class="connection-status">
	<div class="flex items-center gap-3">
		<div class="status-indicator {statusColor}">
			{#if connectionStatus?.connecting}
				<div class="spinner"></div>
			{/if}
		</div>
		<div class="flex-1">
			<div class="text-sm font-medium">
				{connectionText}
			</div>
			{#if showDetails && connectionStatus?.connected && cameraState?.connected}
				<div class="text-xs text-gray-400">
					Ready for control
				</div>
			{:else if connectionStatus?.error}
				<div class="text-xs text-red-400">
					{connectionStatus.error}
				</div>
			{/if}
		</div>
		{#if !connectionStatus?.connected || !cameraState?.connected}
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

<style>
	.connection-status {
		@apply bg-arri-gray rounded-lg p-3 mb-4;
	}
	
	.status-indicator {
		@apply w-3 h-3 rounded-full flex-shrink-0 relative;
	}
	
	.spinner {
		@apply absolute inset-0 rounded-full border-2 border-transparent border-t-white animate-spin;
	}
	
	.btn-connect {
		@apply bg-arri-red hover:bg-red-600 text-white text-xs font-medium py-1 px-3 rounded transition-colors;
	}
</style>