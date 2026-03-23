/**
 * Mock Stores for UI Development
 * Provides mock implementations of all stores for UI testing without a real camera
 */

import { writable, derived, type Writable } from 'svelte/store';
import {
	shouldUseMockStores,
	shouldUseMockApi,
	shouldEnableDebugLogs
} from '$lib/config/appConfig';

// Export the development mode check function
export { isDevMode as isDevelopmentMode } from '$lib/config/appConfig';

// Mock Camera Store
function createMockCameraStore() {
	const { subscribe, set, update } = writable({
		connected: true,
		model: 'ARRI ALEXA Mini LF (Mock)',
		serialNumber: 'ALF001234',
		frameRate: 24,
		whiteBalance: {
			kelvin: 5600,
			tint: 0.0
		},
		iso: 800,
		ndFilter: 'ND 0.6',
		frameLines: 'Off',
		lut: 'Rec709',
		currentLUT: 'Rec709',
		cdlValues: {
			shadows: {
				lift: { r: 0, g: 0, b: 0 },
				gamma: { r: 1, g: 1, b: 1 },
				gain: { r: 1, g: 1, b: 1 }
			},
			midtones: {
				lift: { r: 0, g: 0, b: 0 },
				gamma: { r: 1, g: 1, b: 1 },
				gain: { r: 1, g: 1, b: 1 }
			},
			highlights: {
				lift: { r: 0, g: 0, b: 0 },
				gamma: { r: 1, g: 1, b: 1 },
				gain: { r: 1, g: 1, b: 1 }
			}
		},
		currentTimecode: '12:34:56:12',
		timecodeMode: 'free_run',
		timecodeSync: 'synced',
		operations: {
			loading: false,
			frameRate: false,
			whiteBalance: false,
			iso: false,
			ndFilter: false
		},
		lastUpdate: new Date()
	});

	return {
		subscribe,
		updateSettings: (settings: any) => {
			console.log('Mock: Updating camera settings', settings);
			update((state) => ({ ...state, ...settings, lastUpdate: new Date() }));
		},
		setOperationLoading: (operation: string, loading: boolean) => {
			console.log(`Mock: Setting ${operation} loading to ${loading}`);
			update((state) => ({
				...state,
				operations: { ...state.operations, [operation]: loading }
			}));
		},
		reset: () =>
			set({
				connected: false,
				model: '',
				serialNumber: '',
				frameRate: 24,
				whiteBalance: {
					kelvin: 5600,
					tint: 0.0
				},
				iso: 800,
				ndFilter: 'Off',
				frameLines: 'Off',
				lut: 'Rec709',
				currentLUT: 'Rec709',
				cdlValues: {
					shadows: {
						lift: { r: 0, g: 0, b: 0 },
						gamma: { r: 1, g: 1, b: 1 },
						gain: { r: 1, g: 1, b: 1 }
					},
					midtones: {
						lift: { r: 0, g: 0, b: 0 },
						gamma: { r: 1, g: 1, b: 1 },
						gain: { r: 1, g: 1, b: 1 }
					},
					highlights: {
						lift: { r: 0, g: 0, b: 0 },
						gamma: { r: 1, g: 1, b: 1 },
						gain: { r: 1, g: 1, b: 1 }
					}
				},
				currentTimecode: '00:00:00:00',
				timecodeMode: 'free_run',
				timecodeSync: 'synced',
				operations: {
					loading: false,
					frameRate: false,
					whiteBalance: false,
					iso: false,
					ndFilter: false
				},
				lastUpdate: new Date()
			}),
		setConnectionStatus: (connected: boolean, connecting: boolean) => {
			update((state) => ({ ...state, connected }));
		}
	};
}

// Mock Connection Store
function createMockConnectionStore() {
	const { subscribe, set, update } = writable({
		socketConnected: true,
		socketConnecting: false,
		socketReconnectAttempts: 0,
		cameraConnected: true,
		cameraConnecting: false,
		networkOnline: true,
		lastError: null,
		connectionHistory: [],
		overallStatus: {
			fullyConnected: true,
			connecting: false,
			error: null
		}
	});

	return {
		subscribe,
		overallStatus: derived({ subscribe }, (state) => state.overallStatus),
		updateCameraStatus: (status: any) => {
			console.log('Mock: Updating camera status', status);
			update((state) => ({ ...state, ...status }));
		},
		reset: () =>
			set({
				socketConnected: false,
				socketConnecting: false,
				socketReconnectAttempts: 0,
				cameraConnected: false,
				cameraConnecting: false,
				networkOnline: true,
				lastError: null,
				connectionHistory: [],
				overallStatus: {
					fullyConnected: false,
					connecting: false,
					error: null
				}
			}),
		loadPersistedSettings: () => {
			console.log('Mock: Loading persisted connection settings');
		}
	};
}

// Mock Notification Store
function createMockNotificationStore() {
	const { subscribe, set, update } = writable([]);

	return {
		subscribe,
		notificationCount: derived({ subscribe }, (notifications) => notifications.length),
		success: (title: string, message?: string) => {
			console.log(`Mock Notification - Success: ${title}`, message);
		},
		error: (title: string, message?: string) => {
			console.log(`Mock Notification - Error: ${title}`, message);
		},
		warning: (title: string, message?: string) => {
			console.log(`Mock Notification - Warning: ${title}`, message);
		},
		info: (title: string, message?: string) => {
			console.log(`Mock Notification - Info: ${title}`, message);
		},
		cameraCommandSuccess: (command: string) => {
			console.log(`Mock Notification - Camera Command Success: ${command}`);
		},
		cameraCommandError: (command: string, error: string) => {
			console.log(`Mock Notification - Camera Command Error: ${command}`, error);
		},
		connectionSuccess: () => {
			console.log('Mock Notification - Connection Success');
		},
		connectionError: (error: string) => {
			console.log('Mock Notification - Connection Error', error);
		},
		offlineMode: () => {
			console.log('Mock Notification - Offline Mode');
		},
		onlineMode: () => {
			console.log('Mock Notification - Online Mode');
		},
		playbackModeEntered: () => {
			console.log('Mock Notification - Playback Mode Entered');
		},
		playbackModeExited: () => {
			console.log('Mock Notification - Playback Mode Exited');
		},
		clear: () => {
			console.log('Mock Notification - Clear all');
			set([]);
		}
	};
}

// Mock User Settings Store
function createMockUserSettingsStore() {
	const { subscribe, set, update } = writable({
		theme: 'dark',
		language: 'en',
		performanceSettings: {
			enableAnimations: true,
			enableHaptics: true,
			enableSounds: true
		},
		debugSettings: {
			enableDebugMode: false,
			showPerformanceMetrics: false
		}
	});

	return {
		subscribe,
		performanceSettings: derived({ subscribe }, (state) => state.performanceSettings),
		debugSettings: derived({ subscribe }, (state) => state.debugSettings),
		loadPersistedSettings: () => {
			console.log('Mock: Loading persisted user settings');
		},
		importSettings: (settings: any) => {
			console.log('Mock: Importing settings', settings);
			update((state) => ({ ...state, ...settings }));
		}
	};
}

// Mock App State Store
interface AppState {
	loading: boolean;
	error: string | null;
	offline: boolean;
	features: {
		debugMode: boolean;
	};
	loadingState: {
		loading: boolean;
		error: string | null;
	};
	offlineState: {
		offline: boolean;
	};
}

function createMockAppStateStore() {
	const { subscribe, set, update } = writable<AppState>({
		loading: false,
		error: null,
		offline: false,
		features: {
			debugMode: false
		},
		loadingState: {
			loading: false,
			error: null
		},
		offlineState: {
			offline: false
		}
	});

	return {
		subscribe,
		loadingState: derived({ subscribe }, (state) => state.loadingState),
		offlineState: derived({ subscribe }, (state) => state.offlineState),
		setLoading: (loading: boolean) => {
			update((state) => ({ ...state, loading, loadingState: { ...state.loadingState, loading } }));
		},
		setError: (error: string | null) => {
			update((state) => ({
				...state,
				error,
				loadingState: { ...state.loadingState, error }
			}));
		},
		setOffline: (offline: boolean) => {
			update((state) => ({ ...state, offline, offlineState: { ...state.offlineState, offline } }));
		},
		updateFeatures: (features: any) => {
			update((state) => ({ ...state, features: { ...state.features, ...features } }));
		},
		initialize: () => {
			console.log('Mock: Initializing app state');
		},
		reset: () => {
			set({
				loading: false,
				error: null,
				offline: false,
				features: { debugMode: false },
				loadingState: { loading: false, error: null },
				offlineState: { offline: false }
			});
		},
		loadPersistedPreferences: () => {
			console.log('Mock: Loading persisted preferences');
		}
	};
}

// Mock Playback Store
function createMockPlaybackStore() {
	const { subscribe, set, update } = writable({
		isInPlaybackMode: false,
		enteringPlaybackMode: false,
		currentClip: null,
		clips: [
			{ id: 1, name: 'A001_C001_01234', duration: '00:02:15', size: '2.1 GB', format: 'ARRIRAW' },
			{ id: 2, name: 'A001_C002_01235', duration: '00:01:45', size: '1.8 GB', format: 'ARRIRAW' },
			{ id: 3, name: 'A001_C003_01236', duration: '00:03:20', size: '3.2 GB', format: 'ARRIRAW' }
		],
		totalClips: 3,
		operations: {
			loading: false,
			enterPlayback: false,
			exitPlayback: false
		},
		playbackMode: {
			isInPlaybackMode: false,
			enteringPlaybackMode: false
		}
	});

	return {
		subscribe,
		playbackMode: derived({ subscribe }, (state) => state.playbackMode),
		setPlaybackMode: (isInPlaybackMode: boolean, enteringPlaybackMode: boolean) => {
			console.log(
				`Mock: Setting playback mode - inPlayback: ${isInPlaybackMode}, entering: ${enteringPlaybackMode}`
			);
			update((state) => ({
				...state,
				isInPlaybackMode,
				enteringPlaybackMode,
				playbackMode: { isInPlaybackMode, enteringPlaybackMode }
			}));
		},
		exitPlaybackMode: () => {
			console.log('Mock: Exiting playback mode');
			update((state) => ({
				...state,
				isInPlaybackMode: false,
				enteringPlaybackMode: false,
				playbackMode: { isInPlaybackMode: false, enteringPlaybackMode: false }
			}));
		},
		setOperationLoading: (operation: string, loading: boolean) => {
			console.log(`Mock: Setting ${operation} loading to ${loading}`);
			update((state) => ({
				...state,
				operations: { ...state.operations, [operation]: loading }
			}));
		},
		reset: () => {
			set({
				isInPlaybackMode: false,
				enteringPlaybackMode: false,
				currentClip: null,
				clips: [],
				totalClips: 0,
				operations: {
					loading: false,
					enterPlayback: false,
					exitPlayback: false
				},
				playbackMode: {
					isInPlaybackMode: false,
					enteringPlaybackMode: false
				}
			});
		}
	};
}

// Mock Camera API
export const mockCameraApi = {
	cameraState: createMockCameraStore(),
	connectionStatus: writable({
		connected: true,
		connecting: false,
		error: null
	}),
	connect: async () => {
		console.log('Mock: Connecting to camera...');
		return { success: true };
	},
	setFrameRate: async (fps: number) => {
		console.log(`Mock: Setting frame rate to ${fps} fps`);
		return { success: true, data: { frameRate: fps } };
	},
	setWhiteBalance: async (kelvin: number, tint?: number) => {
		console.log(
			`Mock: Setting white balance to ${kelvin}K${tint !== undefined ? `, tint: ${tint}` : ''}`
		);
		return { success: true, data: { whiteBalance: { kelvin, tint: tint || 0 } } };
	},
	setISO: async (iso: number) => {
		console.log(`Mock: Setting ISO to ${iso}`);
		return { success: true, data: { iso } };
	},
	enterPlaybackMode: async () => {
		console.log('Mock: Entering playback mode');
		return { success: true, data: { mode: 'playback' } };
	},
	exitPlaybackMode: async () => {
		console.log('Mock: Exiting playback mode');
		return { success: true, data: { mode: 'record' } };
	},
	setCDL: async (wheel: string, control: string, channel: string, value: number) => {
		console.log(`Mock: Setting CDL ${wheel} ${control} ${channel} to ${value}`);
		return { success: true, data: { wheel, control, channel, value } };
	},
	resetCDLWheel: async (wheel: string) => {
		console.log(`Mock: Resetting CDL wheel ${wheel}`);
		return { success: true, data: { wheel, reset: true } };
	},
	setLUT: async (lutName: string) => {
		console.log(`Mock: Setting LUT to ${lutName}`);
		return { success: true, data: { lut: lutName } };
	},
	saveLUT: async (lutName: string) => {
		console.log(`Mock: Saving LUT as ${lutName}`);
		return { success: true, data: { lut: lutName, saved: true } };
	},
	getTimecode: async () => {
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const frames = String(Math.floor(now.getMilliseconds() / 41.67)).padStart(2, '0'); // Approximate 24fps
		const timecode = `${hours}:${minutes}:${seconds}:${frames}`;
		console.log(`Mock: Getting timecode - ${timecode}`);
		return { success: true, data: { timecode, syncStatus: 'synced' } };
	},
	setTimecodeMode: async (mode: string) => {
		console.log(`Mock: Setting timecode mode to ${mode}`);
		return { success: true, data: { mode } };
	},
	syncTimecodeToTimeOfDay: async () => {
		console.log('Mock: Syncing timecode to time of day');
		const now = new Date();
		const hours = String(now.getHours()).padStart(2, '0');
		const minutes = String(now.getMinutes()).padStart(2, '0');
		const seconds = String(now.getSeconds()).padStart(2, '0');
		const timecode = `${hours}:${minutes}:${seconds}:00`;
		return { success: true, data: { timecode } };
	},
	setTimecode: async (timecode: string) => {
		console.log(`Mock: Setting timecode to ${timecode}`);
		return { success: true, data: { timecode } };
	}
};

// Export mock stores
export const mockStores = {
	cameraStore: createMockCameraStore(),
	connectionStore: createMockConnectionStore(),
	notificationStore: createMockNotificationStore(),
	userSettingsStore: createMockUserSettingsStore(),
	appStateStore: createMockAppStateStore(),
	playbackStore: createMockPlaybackStore()
};

// Safe store access function - returns either real or mock stores based on configuration
export function safeStoreAccess() {
	const useMockStores = shouldUseMockStores();
	const useMockApi = shouldUseMockApi();
	const enableDebugLogs = shouldEnableDebugLogs();

	if (enableDebugLogs) {
		console.log(`🔧 Store Access - Mock Stores: ${useMockStores}, Mock API: ${useMockApi}`);
	}

	if (useMockStores) {
		if (enableDebugLogs) {
			console.log('🎭 Using mock stores for development');
		}
		return {
			cameraStore: mockStores.cameraStore,
			connectionStore: mockStores.connectionStore,
			notificationStore: mockStores.notificationStore,
			userSettingsStore: mockStores.userSettingsStore,
			appStateStore: mockStores.appStateStore,
			playbackStore: mockStores.playbackStore,
			cameraApi: mockCameraApi,
			isUsingMocks: true
		};
	}

	// Production mode - use real stores
	if (enableDebugLogs) {
		console.log('🚀 Production mode - using real stores');
	}

	// Import real stores dynamically to avoid issues during SSR
	return {
		cameraStore: null, // Will be loaded dynamically
		connectionStore: null,
		notificationStore: null,
		userSettingsStore: null,
		appStateStore: null,
		playbackStore: null,
		cameraApi: null,
		isUsingMocks: false,
		useRealStores: true
	};
}

// Export a function to get stores that works in both dev and production
export async function getStores() {
	const useMockStores = shouldUseMockStores();

	if (useMockStores) {
		return {
			cameraStore: mockStores.cameraStore,
			connectionStore: mockStores.connectionStore,
			notificationStore: mockStores.notificationStore,
			userSettingsStore: mockStores.userSettingsStore,
			appStateStore: mockStores.appStateStore,
			playbackStore: mockStores.playbackStore,
			cameraApi: mockCameraApi,
			isUsingMocks: true
		};
	}

	// Production mode - dynamically import real stores
	const realStores = await import('$lib/stores');
	const { cameraApi } = await import('$lib/api/cameraApi');

	return {
		cameraStore: realStores.cameraStore,
		connectionStore: realStores.connectionStore,
		notificationStore: realStores.notificationStore,
		userSettingsStore: realStores.userSettingsStore,
		appStateStore: realStores.appStateStore,
		playbackStore: realStores.playbackStore,
		cameraApi: cameraApi,
		isUsingMocks: false
	};
}

// Export a function to get camera API
export async function getCameraApi() {
	const useMockApi = shouldUseMockApi();

	if (useMockApi) {
		return mockCameraApi;
	}

	// Production mode - use real API
	const { cameraApi } = await import('$lib/api/cameraApi');
	return cameraApi;
}
