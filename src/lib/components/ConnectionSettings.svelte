<!--
  Connection Settings Component
  Allows users to configure camera IP address and CAP protocol settings
-->

<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { triggerHaptic } from '$lib/utils/touchInteractions';
	import { showSuccess, showError } from '$lib/utils/errorManager';

	// Props
	export let onSettingsChange: (settings: ConnectionSettings) => void = () => {};
	export let className = '';

	// Connection settings interface
	export interface ConnectionSettings {
		cameraIp: string;
		capPassword: string;
		serverPort: number;
		autoConnect: boolean;
		connectionTimeout: number;
	}

	// Component state
	let settings: ConnectionSettings = {
		cameraIp: '192.168.1.100',
		capPassword: '',
		serverPort: 3001,
		autoConnect: true,
		connectionTimeout: 5000
	};

	let showAdvanced = false;
	let isConnecting = false;
	let connectionStatus = 'disconnected'; // 'disconnected', 'connecting', 'connected', 'error'
	let lastError = '';

	// Load settings from localStorage on mount
	onMount(() => {
		loadSettings();
	});

	function loadSettings() {
		try {
			const savedSettings = localStorage.getItem('arri-camera-connection-settings');
			if (savedSettings) {
				const parsed = JSON.parse(savedSettings);
				settings = { ...settings, ...parsed };
			}
		} catch (error) {
			console.warn('Failed to load connection settings:', error);
		}
	}

	function saveSettings() {
		try {
			localStorage.setItem('arri-camera-connection-settings', JSON.stringify(settings));
			showSuccess('Settings Saved', 'Connection settings have been saved and will be applied on next connection');
			onSettingsChange(settings);
			
			// Also save to a global settings object that other parts of the app can access
			if (typeof window !== 'undefined') {
				(window as any).arriCameraSettings = settings;
			}
		} catch (error) {
			showError('Save Failed', 'Failed to save connection settings');
			console.error('Failed to save settings:', error);
		}
	}

	async function testConnection() {
		triggerHaptic({ type: 'medium' });
		isConnecting = true;
		connectionStatus = 'connecting';
		lastError = '';

		try {
			// Validate settings
			if (!settings.cameraIp.trim()) {
				throw new Error('Camera IP address is required');
			}

			if (!isValidIpAddress(settings.cameraIp)) {
				throw new Error('Invalid IP address format');
			}

			// Test basic network connectivity first
			console.log(`Testing connection to ${settings.cameraIp}...`);
			
			// Try to test network connectivity using fetch with a timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), settings.connectionTimeout);
			
			try {
				// Try to connect to a basic HTTP endpoint on the camera
				// Most ARRI cameras have a web interface on port 80
				const response = await fetch(`http://${settings.cameraIp}`, {
					method: 'HEAD',
					mode: 'no-cors', // Allow cross-origin requests
					signal: controller.signal
				});
				
				clearTimeout(timeoutId);
				
				// If we get here without an error, the camera is reachable
				connectionStatus = 'connected';
				showSuccess('Connection Test', `Camera at ${settings.cameraIp} is reachable`);
				
			} catch (fetchError) {
				clearTimeout(timeoutId);
				
				// Try a different approach - test if the IP responds to ping-like behavior
				// by attempting a WebSocket connection to the CAP port (usually 7878)
				try {
					await testCAPConnection(settings.cameraIp, settings.capPassword);
					connectionStatus = 'connected';
					showSuccess('Connection Test', `CAP connection to ${settings.cameraIp} successful`);
				} catch (capError) {
					throw new Error(`Cannot reach camera at ${settings.cameraIp}. Please check the IP address and network connection.`);
				}
			}
			
		} catch (error) {
			connectionStatus = 'error';
			lastError = error instanceof Error ? error.message : 'Connection failed';
			showError('Connection Failed', lastError);
		} finally {
			isConnecting = false;
		}
	}

	async function testCAPConnection(ip: string, password: string): Promise<void> {
		return new Promise((resolve, reject) => {
			// Try to establish a WebSocket connection to test CAP protocol
			// This is a basic connectivity test, not a full CAP handshake
			const wsUrl = `ws://${ip}:7878`; // Standard CAP port
			const ws = new WebSocket(wsUrl);
			
			const timeout = setTimeout(() => {
				ws.close();
				reject(new Error('Connection timeout'));
			}, settings.connectionTimeout);
			
			ws.onopen = () => {
				clearTimeout(timeout);
				ws.close();
				resolve();
			};
			
			ws.onerror = () => {
				clearTimeout(timeout);
				reject(new Error('WebSocket connection failed'));
			};
			
			ws.onclose = (event) => {
				clearTimeout(timeout);
				if (event.wasClean) {
					resolve();
				} else {
					reject(new Error('Connection closed unexpectedly'));
				}
			};
		});
	}

	function isValidIpAddress(ip: string): boolean {
		const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
		return ipRegex.test(ip);
	}

	function resetToDefaults() {
		triggerHaptic({ type: 'light' });
		settings = {
			cameraIp: '192.168.1.100',
			capPassword: '',
			serverPort: 3001,
			autoConnect: true,
			connectionTimeout: 5000
		};
		showSuccess('Settings Reset', 'Connection settings reset to defaults');
	}

	function getStatusIcon(status: string): string {
		switch (status) {
			case 'connected':
				return '🟢';
			case 'connecting':
				return '🟡';
			case 'error':
				return '🔴';
			default:
				return '⚪';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'connected':
				return 'Connected';
			case 'connecting':
				return 'Connecting...';
			case 'error':
				return 'Connection Failed';
			default:
				return 'Not Connected';
		}
	}

	function getStatusColor(status: string): string {
		switch (status) {
			case 'connected':
				return 'text-green-400';
			case 'connecting':
				return 'text-yellow-400';
			case 'error':
				return 'text-red-400';
			default:
				return 'text-gray-400';
		}
	}
</script>

<div class="connection-settings {className}">
	<div class="settings-header">
		<h3 class="text-lg font-semibold text-white mb-2">Camera Connection</h3>
		<div class="connection-status flex items-center gap-2 mb-4">
			<span class="status-icon text-lg">{getStatusIcon(connectionStatus)}</span>
			<span class="status-text {getStatusColor(connectionStatus)} font-medium">
				{getStatusText(connectionStatus)}
			</span>
		</div>
	</div>

	<div class="settings-form space-y-4">
		<!-- Camera IP Address -->
		<div class="form-group">
			<label for="camera-ip" class="block text-sm font-medium text-white mb-2">
				Camera IP Address *
			</label>
			<input
				id="camera-ip"
				type="text"
				bind:value={settings.cameraIp}
				placeholder="192.168.1.100"
				class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red"
				required
			/>
			<p class="text-xs text-gray-400 mt-1">
				Enter the IP address of your ARRI camera
			</p>
		</div>

		<!-- CAP Password -->
		<div class="form-group">
			<label for="cap-password" class="block text-sm font-medium text-white mb-2">
				CAP Password
			</label>
			<input
				id="cap-password"
				type="password"
				bind:value={settings.capPassword}
				placeholder="Enter CAP password (if required)"
				class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red"
			/>
			<p class="text-xs text-gray-400 mt-1">
				Leave empty if no password is required
			</p>
		</div>

		<!-- Auto Connect -->
		<div class="form-group">
			<label class="flex items-center gap-2">
				<input
					type="checkbox"
					bind:checked={settings.autoConnect}
					class="w-4 h-4 text-arri-red bg-gray-700 border-gray-600 rounded focus:ring-arri-red focus:ring-2"
				/>
				<span class="text-sm text-white">Auto-connect on app start</span>
			</label>
		</div>

		<!-- Advanced Settings Toggle -->
		<button
			type="button"
			on:click={() => showAdvanced = !showAdvanced}
			class="text-sm text-arri-red hover:text-red-400 transition-colors"
		>
			{showAdvanced ? '▼' : '▶'} Advanced Settings
		</button>

		{#if showAdvanced}
			<div class="advanced-settings space-y-4 pl-4 border-l-2 border-gray-600">
				<!-- Server Port -->
				<div class="form-group">
					<label for="server-port" class="block text-sm font-medium text-white mb-2">
						Local Server Port
					</label>
					<input
						id="server-port"
						type="number"
						bind:value={settings.serverPort}
						min="1024"
						max="65535"
						class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red"
					/>
				</div>

				<!-- Connection Timeout -->
				<div class="form-group">
					<label for="connection-timeout" class="block text-sm font-medium text-white mb-2">
						Connection Timeout (ms)
					</label>
					<input
						id="connection-timeout"
						type="number"
						bind:value={settings.connectionTimeout}
						min="1000"
						max="30000"
						step="1000"
						class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-arri-red focus:ring-1 focus:ring-arri-red"
					/>
				</div>
			</div>
		{/if}

		<!-- Error Display -->
		{#if connectionStatus === 'error' && lastError}
			<div class="error-message bg-red-900 bg-opacity-20 border border-red-600 rounded-lg p-3">
				<div class="flex items-center gap-2">
					<span class="text-red-400">❌</span>
					<span class="text-red-400 font-medium">Connection Error</span>
				</div>
				<p class="text-red-300 text-sm mt-1">{lastError}</p>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="action-buttons flex gap-2 pt-4">
			<button
				type="button"
				on:click={testConnection}
				disabled={isConnecting}
				class="flex-1 bg-arri-red hover:bg-red-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium min-h-touch"
			>
				{#if isConnecting}
					<span class="flex items-center justify-center gap-2">
						<span class="animate-spin">⏳</span>
						Testing...
					</span>
				{:else}
					🔍 Test Connection
				{/if}
			</button>

			<button
				type="button"
				on:click={saveSettings}
				class="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium min-h-touch"
			>
				💾 Save Settings
			</button>

			<button
				type="button"
				on:click={resetToDefaults}
				class="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors min-h-touch"
			>
				🔄
			</button>
		</div>
	</div>
</div>

<style>
	.connection-settings {
		background: #2D2D2D;
		border-radius: 0.5rem;
		padding: 1.5rem;
		border: 1px solid #4B5563;
	}

	.form-group input:focus {
		box-shadow: 0 0 0 2px rgba(227, 30, 36, 0.2);
	}

	.min-h-touch {
		min-height: 44px;
	}

	@media (max-width: 767px) {
		.action-buttons {
			flex-direction: column;
		}
		
		.action-buttons button {
			width: 100%;
		}
	}
</style>