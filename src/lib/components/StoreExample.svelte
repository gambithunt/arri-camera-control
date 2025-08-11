<script lang="ts">
	import { onMount } from 'svelte';
	import { 
		cameraStore, 
		playbackStore, 
		connectionStore, 
		userSettingsStore,
		appStateStore,
		notificationStore 
	} from '$lib/stores';
	
	// Reactive store subscriptions
	$: cameraState = $cameraStore;
	$: connectionStatus = $connectionStore.overallStatus;
	$: userSettings = $userSettingsStore.appearanceSettings;
	$: appState = $appStateStore.loadingState;
	$: notifications = $notificationStore.activeNotifications;
	
	onMount(() => {
		// Example of using store actions
		console.log('Store example component mounted');
	});
	
	function testNotification() {
		notificationStore.success('Test Notification', 'This is a test notification from the store system');
	}
	
	function testCameraUpdate() {
		cameraStore.updateSettings({
			frameRate: 30,
			iso: 1600
		});
		notificationStore.cameraCommandSuccess('Frame Rate & ISO');
	}
	
	function testConnectionUpdate() {
		connectionStore.updateCameraStatus({
			cameraConnected: !$connectionStatus.fullyConnected,
			cameraIP: '192.168.1.100'
		});
	}
</script>

<div class="store-example">
	<h3>Store System Example</h3>
	
	<div class="store-section">
		<h4>Connection Status</h4>
		<p>Status: {$connectionStatus.status}</p>
		<p>Fully Connected: {$connectionStatus.fullyConnected}</p>
		<p>Network Online: {$connectionStatus.networkOnline}</p>
		<button on:click={testConnectionUpdate}>
			Toggle Connection
		</button>
	</div>
	
	<div class="store-section">
		<h4>Camera State</h4>
		<p>Connected: {cameraState.connected}</p>
		<p>Frame Rate: {cameraState.frameRate} fps</p>
		<p>ISO: {cameraState.iso}</p>
		<p>White Balance: {cameraState.whiteBalance.kelvin}K</p>
		<button on:click={testCameraUpdate}>
			Update Camera Settings
		</button>
	</div>
	
	<div class="store-section">
		<h4>User Settings</h4>
		<p>Theme: {$userSettings.theme}</p>
		<p>Color Scheme: {$userSettings.colorScheme}</p>
		<p>Font Size: {$userSettings.fontSize}</p>
	</div>
	
	<div class="store-section">
		<h4>App State</h4>
		<p>Initialized: {$appState.initialized}</p>
		<p>Loading: {$appState.loading}</p>
		<p>Error: {$appState.error || 'None'}</p>
	</div>
	
	<div class="store-section">
		<h4>Notifications ({$notifications.length})</h4>
		<button on:click={testNotification}>
			Test Notification
		</button>
		{#each $notifications as notification}
			<div class="notification-item {notification.type}">
				<strong>{notification.title}</strong>
				{#if notification.message}
					<p>{notification.message}</p>
				{/if}
				<button on:click={() => notificationStore.dismiss(notification.id)}>
					Dismiss
				</button>
			</div>
		{/each}
	</div>
</div>

<style>
	.store-example {
		@apply p-4 bg-arri-gray rounded-lg space-y-4;
	}
	
	.store-section {
		@apply p-3 bg-gray-700 rounded border-l-4 border-arri-red;
	}
	
	.store-section h4 {
		@apply font-semibold mb-2 text-arri-red;
	}
	
	.store-section p {
		@apply text-sm text-gray-300 mb-1;
	}
	
	.store-section button {
		@apply bg-arri-red hover:bg-red-600 text-white text-xs font-medium py-1 px-3 rounded mt-2;
		@apply transition-colors;
	}
	
	.notification-item {
		@apply p-2 rounded border-l-4 mt-2;
	}
	
	.notification-item.success {
		@apply bg-green-900 border-green-500;
	}
	
	.notification-item.error {
		@apply bg-red-900 border-red-500;
	}
	
	.notification-item.warning {
		@apply bg-yellow-900 border-yellow-500;
	}
	
	.notification-item.info {
		@apply bg-blue-900 border-blue-500;
	}
	
	.notification-item button {
		@apply bg-gray-600 hover:bg-gray-500 text-white text-xs py-1 px-2 rounded ml-2;
	}
</style>