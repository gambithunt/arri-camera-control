<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import ConnectionStatus from '$lib/components/ConnectionStatus.svelte';
	import ResponsiveContainer from '$lib/components/ResponsiveContainer.svelte';
	import ResponsiveGrid from '$lib/components/ResponsiveGrid.svelte';
	import { screenInfo, type ScreenInfo } from '$lib/utils/responsiveLayout';
	import { initializeConfig, isDevMode, shouldUseMockStores } from '$lib/config/appConfig';

	// Props from layout
	export let currentScreenInfo: ScreenInfo;

	// State variables
	let cameraState: { connected: boolean; model?: string; serialNumber?: string } = {
		connected: false,
		model: '',
		serialNumber: ''
	};
	let connectionStatus: { connected: boolean; connecting: boolean; error?: string } = {
		connected: false,
		connecting: false
	};

	// Store references
	let cameraStore: any = null;
	let connectionStore: any = null;

	// Unsubscribe functions
	let unsubscribeCamera: (() => void) | null = null;
	let unsubscribeConnection: (() => void) | null = null;

	interface QuickAction {
		id: string;
		label: string;
		description: string;
		path: string;
		icon: string;
		color: string;
	}

	const quickActions: QuickAction[] = [
		{
			id: 'camera',
			label: 'Camera Settings',
			description: 'Frame rate, white balance, ISO, ND filters',
			path: '/camera',
			icon: '📹',
			color: 'from-blue-600 to-blue-800'
		},
		{
			id: 'playback',
			label: 'Playback Control',
			description: 'Review clips and transport controls',
			path: '/playback',
			icon: '▶️',
			color: 'from-green-600 to-green-800'
		},
		{
			id: 'timecode',
			label: 'Timecode Management',
			description: 'Sync and configure timecode settings',
			path: '/timecode',
			icon: '🕐',
			color: 'from-purple-600 to-purple-800'
		},
		{
			id: 'grading',
			label: 'Color Grading',
			description: 'CDL controls and LUT management',
			path: '/grading',
			icon: '🎨',
			color: 'from-orange-600 to-orange-800'
		}
	];

	// Get screen info if not provided by layout
	$: if (!currentScreenInfo) {
		currentScreenInfo = $screenInfo;
	}

	// Compute responsive classes
	$: isCompact =
		currentScreenInfo?.deviceType === 'phone' && currentScreenInfo?.orientation === 'portrait';
	$: gridMinWidth = isCompact ? '280px' : '300px';

	onMount(async () => {
		console.log('ARRI Camera Control App initialized');

		// Initialize configuration (checks URL params and localStorage)
		initializeConfig();

		const useMocks = shouldUseMockStores();
		const isDev = isDevMode();

		console.log(`App mode: ${isDev ? 'Development' : 'Production'}, Using mocks: ${useMocks}`);

		try {
			if (useMocks) {
				// Development mode - use mock stores
				const { mockStores } = await import('$lib/dev/mockStores');
				cameraStore = mockStores.cameraStore;
				connectionStore = mockStores.connectionStore;

				console.log('🎭 Using mock stores for development');
			} else {
				// Production mode - use real stores
				const stores = await import('$lib/stores');
				cameraStore = stores.cameraStore;
				connectionStore = stores.connectionStore;

				console.log('🚀 Using real stores for production');
			}

			// Subscribe to stores
			if (cameraStore) {
				unsubscribeCamera = cameraStore.subscribe((state: any) => {
					cameraState = {
						connected: state?.connected ?? false,
						model: state?.model ?? '',
						serialNumber: state?.serialNumber ?? ''
					};
				});
			}

			if (connectionStore) {
				unsubscribeConnection = connectionStore.subscribe((state: any) => {
					connectionStatus = {
						connected: state?.cameraConnected ?? state?.connected ?? false,
						connecting: state?.cameraConnecting ?? state?.connecting ?? false,
						error: state?.lastError ?? undefined
					};
				});
			}
		} catch (error) {
			console.error('Failed to initialize stores:', error);
			// Fallback to disconnected state
			cameraState = { connected: false, model: '', serialNumber: '' };
			connectionStatus = { connected: false, connecting: false };
		}
	});

	onDestroy(() => {
		if (unsubscribeCamera) {
			unsubscribeCamera();
			unsubscribeCamera = null;
		}
		if (unsubscribeConnection) {
			unsubscribeConnection();
			unsubscribeConnection = null;
		}
	});

	function navigateTo(path: string) {
		goto(path);
	}

	$: isConnected = connectionStatus?.connected && cameraState?.connected;
</script>

<ResponsiveContainer size="lg" padding="lg" className="home-container">
	<header class="app-header">
		<div class="header-content">
			<div class="logo-section">
				<h1 class="app-title text-responsive-2xl">ARRI Camera Control</h1>
				<p class="app-subtitle text-responsive-sm">Professional camera control via CAP protocol</p>
			</div>
			<button
				class="settings-button"
				on:click={() => navigateTo('/settings')}
				aria-label="Settings"
			>
				⚙️
			</button>
		</div>
	</header>

	<div class="content-section">
		<div class="connection-section">
			<ConnectionStatus />
		</div>

		<div class="quick-actions">
			<h2 class="section-title text-responsive-lg">Quick Actions</h2>

			<ResponsiveGrid
				minItemWidth={gridMinWidth}
				gap={isCompact ? 'sm' : 'md'}
				equalHeight={true}
				className="actions-grid"
			>
				{#each quickActions as action}
					<button
						class="action-card"
						class:compact={isCompact}
						on:click={() => navigateTo(action.path)}
						disabled={!isConnected}
					>
						<div class="action-gradient bg-gradient-to-br {action.color}"></div>
						<div class="action-content">
							<div class="action-icon" class:compact={isCompact}>{action.icon}</div>
							<div class="action-text">
								<div class="action-label text-responsive-base">{action.label}</div>
								<div class="action-description text-responsive-xs">{action.description}</div>
							</div>
						</div>
					</button>
				{/each}
			</ResponsiveGrid>
		</div>

		{#if !isConnected}
			<div class="connection-prompt">
				<div class="text-center text-gray-400">
					<div class="text-responsive-2xl mb-2">📡</div>
					<p class="text-responsive-sm mb-4">Connect to an ARRI camera to access all features</p>
					<button
						class="connect-button bg-arri-red hover:bg-red-600 text-white px-6 py-3 rounded-lg transition-colors font-medium"
						on:click={() => navigateTo('/settings')}
					>
						⚙️ Camera Settings
					</button>
				</div>
			</div>
		{/if}
	</div>
</ResponsiveContainer>

<style>
	.home-container {
		@apply min-h-screen-safe flex flex-col;
	}

	.app-header {
		@apply p-4 tablet:p-6;
	}

	.header-content {
		@apply flex items-center justify-between max-w-4xl mx-auto;
	}

	.logo-section {
		@apply text-center flex-1;
	}

	.settings-button {
		@apply text-2xl p-2 rounded-lg transition-colors min-h-touch min-w-touch;
		@apply text-gray-400 hover:text-white hover:bg-gray-700;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red focus:ring-opacity-50;
	}

	.app-title {
		@apply font-bold text-arri-red mb-2;
	}

	.app-subtitle {
		@apply text-gray-300;
	}

	.content-section {
		@apply flex-1 w-full;
	}

	.connection-section {
		@apply mb-6;
	}

	.quick-actions {
		@apply mb-8;
	}

	.section-title {
		@apply font-semibold mb-4;
	}

	.action-card {
		@apply relative bg-arri-gray rounded-lg overflow-hidden transition-all duration-200;
		@apply hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed;
		@apply disabled:hover:scale-100 disabled:hover:shadow-none;
		@apply min-h-touch touch-manipulation;
		@apply focus:outline-none focus:ring-2 focus:ring-arri-red focus:ring-opacity-50;
		@apply active:scale-95;
	}

	.action-card.compact {
		@apply min-h-[80px];
	}

	.action-gradient {
		@apply absolute inset-0 opacity-10;
	}

	.action-content {
		@apply relative flex items-center gap-4 p-3 tablet:p-4;
		@apply h-full;
	}

	.action-icon {
		@apply text-2xl flex-shrink-0;
		@apply tablet:text-3xl;
	}

	.action-icon.compact {
		@apply text-xl;
	}

	.action-text {
		@apply flex-1 text-left min-w-0;
	}

	.action-label {
		@apply font-medium mb-1 truncate;
	}

	.action-description {
		@apply text-gray-400 line-clamp-2;
	}

	.connection-prompt {
		@apply bg-arri-gray rounded-lg p-4 tablet:p-6;
		@apply animate-fade-in;
	}

	.connect-button {
		@apply min-h-touch touch-manipulation;
		@apply focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-50;
		@apply active:scale-95 transition-transform;
	}

	/* Responsive adjustments */
	@media (max-width: 767px) and (orientation: landscape) {
		.app-header {
			@apply py-4;
		}

		.action-card {
			@apply min-h-[70px];
		}

		.action-content {
			@apply gap-3 p-3;
		}
	}

	/* Touch device optimizations */
	@media (hover: none) and (pointer: coarse) {
		.action-card:hover {
			transform: none;
		}

		.action-card:active {
			transform: scale(0.98);
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.action-card {
			@apply border border-gray-500;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.action-card {
			transition: none;
		}

		.connection-prompt {
			animation: none;
		}
	}
</style>
