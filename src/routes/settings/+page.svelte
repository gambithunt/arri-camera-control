<!--
  Settings Page
  Camera connection and app configuration settings
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import ConnectionSettings from '$lib/components/ConnectionSettings.svelte';
	import ResponsiveContainer from '$lib/components/ResponsiveContainer.svelte';
	import { showSuccess } from '$lib/utils/errorManager';

	// Component state
	let appVersion = '1.0.0';
	let buildDate = new Date().toISOString().split('T')[0];

	// Handle connection settings changes
	function handleSettingsChange(settings: any) {
		console.log('Connection settings updated:', settings);
		showSuccess('Settings Updated', 'Connection settings have been applied');
		// Here you would update the WebSocket client configuration
		// and reconnect with the new settings
	}

	// Handle app settings
	function clearAppData() {
		if (confirm('Are you sure you want to clear all app data? This will reset all settings and cached data.')) {
			try {
				localStorage.clear();
				sessionStorage.clear();
				showSuccess('Data Cleared', 'All app data has been cleared');
				// Reload the page to reset the app state
				setTimeout(() => {
					window.location.reload();
				}, 1000);
			} catch (error) {
				console.error('Failed to clear app data:', error);
			}
		}
	}

	function exportSettings() {
		try {
			const settings = {
				connection: JSON.parse(localStorage.getItem('arri-camera-connection-settings') || '{}'),
				app: {
					version: appVersion,
					exportDate: new Date().toISOString()
				}
			};

			const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `arri-camera-settings-${new Date().toISOString().slice(0, 10)}.json`;
			a.click();
			URL.revokeObjectURL(url);

			showSuccess('Settings Exported', 'Settings have been exported successfully');
		} catch (error) {
			console.error('Failed to export settings:', error);
		}
	}

	function importSettings() {
		const input = document.createElement('input');
		input.type = 'file';
		input.accept = '.json';
		input.onchange = (event) => {
			const file = (event.target as HTMLInputElement).files?.[0];
			if (file) {
				const reader = new FileReader();
				reader.onload = (e) => {
					try {
						const settings = JSON.parse(e.target?.result as string);
						if (settings.connection) {
							localStorage.setItem('arri-camera-connection-settings', JSON.stringify(settings.connection));
						}
						showSuccess('Settings Imported', 'Settings have been imported successfully');
						setTimeout(() => {
							window.location.reload();
						}, 1000);
					} catch (error) {
						console.error('Failed to import settings:', error);
					}
				};
				reader.readAsText(file);
			}
		};
		input.click();
	}
</script>

<svelte:head>
	<title>Settings - ARRI Camera Control</title>
	<meta name="description" content="Camera connection and app configuration settings" />
</svelte:head>

<ResponsiveContainer size="full" padding="md" className="settings-page">
	<!-- Page Header -->
	<div class="page-header mb-6">
		<h1 class="text-2xl font-bold text-white mb-2">
			⚙️ Settings
		</h1>
		<p class="text-base text-gray-300 leading-relaxed">
			Configure camera connection settings and manage app preferences.
		</p>
	</div>

	<!-- Connection Settings Section -->
	<div class="settings-section mb-8">
		<h2 class="text-xl font-semibold text-white mb-4">
			📡 Camera Connection
		</h2>
		<ConnectionSettings onSettingsChange={handleSettingsChange} />
	</div>

	<!-- App Settings Section -->
	<div class="settings-section mb-8">
		<h2 class="text-xl font-semibold text-white mb-4">
			📱 App Settings
		</h2>
		
		<div class="app-settings bg-gray-800 rounded-lg p-6">
			<!-- App Information -->
			<div class="app-info mb-6">
				<h3 class="text-lg font-medium text-white mb-3">App Information</h3>
				<div class="info-grid grid grid-cols-2 gap-4 text-sm">
					<div>
						<span class="text-gray-400">Version:</span>
						<span class="text-white ml-2">{appVersion}</span>
					</div>
					<div>
						<span class="text-gray-400">Build Date:</span>
						<span class="text-white ml-2">{buildDate}</span>
					</div>
				</div>
			</div>

			<!-- Data Management -->
			<div class="data-management">
				<h3 class="text-lg font-medium text-white mb-3">Data Management</h3>
				<div class="management-actions space-y-3">
					<div class="action-row flex items-center justify-between">
						<div>
							<h4 class="text-white font-medium">Export Settings</h4>
							<p class="text-sm text-gray-400">Save your current settings to a file</p>
						</div>
						<button
							on:click={exportSettings}
							class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors min-h-touch"
						>
							📤 Export
						</button>
					</div>

					<div class="action-row flex items-center justify-between">
						<div>
							<h4 class="text-white font-medium">Import Settings</h4>
							<p class="text-sm text-gray-400">Load settings from a previously exported file</p>
						</div>
						<button
							on:click={importSettings}
							class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors min-h-touch"
						>
							📥 Import
						</button>
					</div>

					<div class="action-row flex items-center justify-between">
						<div>
							<h4 class="text-white font-medium">Clear App Data</h4>
							<p class="text-sm text-gray-400">Reset all settings and cached data</p>
						</div>
						<button
							on:click={clearAppData}
							class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors min-h-touch"
						>
							🗑️ Clear Data
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="quick-actions mb-8">
		<h2 class="text-xl font-semibold text-white mb-4">
			🚀 Quick Actions
		</h2>
		
		<div class="actions-grid grid grid-cols-2 gap-4">
			<a
				href="/diagnostics"
				class="action-card bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors text-center"
			>
				<div class="text-2xl mb-2">🔍</div>
				<h3 class="text-white font-medium mb-1">Diagnostics</h3>
				<p class="text-sm text-gray-400">Connection troubleshooting</p>
			</a>

			<a
				href="/offline"
				class="action-card bg-gray-800 hover:bg-gray-700 rounded-lg p-4 transition-colors text-center"
			>
				<div class="text-2xl mb-2">📱</div>
				<h3 class="text-white font-medium mb-1">Offline Mode</h3>
				<p class="text-sm text-gray-400">Use app without camera</p>
			</a>
		</div>
	</div>

	<!-- Help Section -->
	<div class="help-section">
		<h2 class="text-xl font-semibold text-white mb-4">
			❓ Help & Support
		</h2>
		
		<div class="help-content bg-gray-800 rounded-lg p-6">
			<div class="help-items space-y-4">
				<div class="help-item">
					<h3 class="text-white font-medium mb-2">🔗 Camera Connection</h3>
					<p class="text-sm text-gray-300">
						Enter your ARRI camera's IP address in the connection settings above. 
						The camera must be on the same network as this device. If your camera 
						requires a CAP password, enter it in the password field.
					</p>
				</div>

				<div class="help-item">
					<h3 class="text-white font-medium mb-2">📶 Network Requirements</h3>
					<p class="text-sm text-gray-300">
						For best performance, use a wired network connection or strong WiFi signal. 
						The app communicates with the camera using the CAP (Camera Access Protocol) 
						over TCP/IP.
					</p>
				</div>

				<div class="help-item">
					<h3 class="text-white font-medium mb-2">🔧 Troubleshooting</h3>
					<p class="text-sm text-gray-300">
						If you're having connection issues, visit the Diagnostics page to test 
						your connection and view detailed error information. Make sure your camera 
						is powered on and accessible on the network.
					</p>
				</div>
			</div>
		</div>
	</div>
</ResponsiveContainer>

<style>
	.settings-page {
		min-height: 100vh;
		padding-bottom: 2rem;
	}

	.action-row {
		padding: 1rem;
		border: 1px solid #4B5563;
		border-radius: 0.5rem;
	}

	.action-card {
		text-decoration: none;
		display: block;
	}

	.min-h-touch {
		min-height: 44px;
	}

	@media (max-width: 767px) {
		.info-grid {
			grid-template-columns: 1fr;
		}
		
		.actions-grid {
			grid-template-columns: 1fr;
		}
		
		.action-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}
		
		.action-row button {
			width: 100%;
		}
	}
</style>