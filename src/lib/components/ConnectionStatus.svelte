<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	// Mock types for UI testing
	interface SocketConnectionStatus {
		connected: boolean;
		connecting: boolean;
		error?: string;
	}
	
	interface CameraState {
		connected: boolean;
		model?: string;
		serialNumber?: string;
	}
	
	export let showDetails: boolean = true;
	
	let connectionStatus: SocketConnectionStatus;
	let cameraState: CameraState;
	let connectionText: string;
	let statusColor: string;
	
	// Unsubscribe functions
	let unsubscribeConnection: () => void;
	let unsubscribeCamera: () => void;
	
	onMount(() => {
		// Mock data for UI testing - set to connected so you can test the UI
		connectionStatus = {
			connected: true,
			connecting: false,
			error: undefined
		};
		
		cameraState = {
			connected: true,
			model: 'ARRI ALEXA Mini LF (Mock)',
			serialNumber: 'ALF001234'
		};
		
		updateDisplay();
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
		console.log('Connect button clicked - UI testing mode');
		
		// Mock connection attempt
		connectionStatus = { ...connectionStatus, connecting: true };
		updateDisplay();
		
		// Simulate connection delay
		setTimeout(() => {
			connectionStatus = {
				connected: true,
				connecting: false,
				error: undefined
			};
			cameraState = { ...cameraState, connected: true };
			updateDisplay();
		}, 2000);
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