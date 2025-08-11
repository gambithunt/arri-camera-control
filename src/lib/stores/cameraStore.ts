/**
 * Camera State Store
 * Manages camera settings and status
 */

import { writable, derived } from 'svelte/store';
import { createPersistedStore, createAsyncStore } from './storeUtils';

export interface CDLValues {
  shadows: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
  midtones: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
  highlights: {
    lift: { r: number; g: number; b: number };
    gamma: { r: number; g: number; b: number };
    gain: { r: number; g: number; b: number };
  };
}

export interface CameraState {
  // Connection status
  connected: boolean;
  connecting: boolean;
  lastConnected: Date | null;
  
  // Camera information
  model: string;
  serialNumber: string;
  firmwareVersion: string;
  
  // Camera settings
  frameRate: number;
  whiteBalance: {
    kelvin: number;
    tint: number;
  };
  iso: number;
  ndFilter: number;
  frameLinesEnabled: boolean;
  currentLUT: string;
  
  // Camera status
  recording: boolean;
  batteryLevel: number;
  storageRemaining: number;
  temperature: number;
  
  // Timecode
  currentTimecode: string;
  timecodeMode: 'free_run' | 'record_run' | 'external' | 'time_of_day';
  userBits: string;
  timecode: {
    current: string;
    mode: 'free_run' | 'record_run' | 'external' | 'time_of_day';
    syncStatus: 'synced' | 'drifting' | 'lost';
  };
  
  // Color grading
  cdlValues?: CDLValues;
  
  // Operations tracking
  operations?: {
    loading?: boolean;
    timecode?: boolean;
    grading?: boolean;
    [key: string]: boolean | undefined;
  };
  
  // Metadata
  lastUpdate: Date | null;
}

const initialCameraState: CameraState = {
  connected: false,
  connecting: false,
  lastConnected: null,
  model: '',
  serialNumber: '',
  firmwareVersion: '',
  frameRate: 24,
  whiteBalance: {
    kelvin: 5600,
    tint: 0
  },
  iso: 800,
  ndFilter: 0,
  frameLinesEnabled: false,
  currentLUT: 'Rec709',
  recording: false,
  batteryLevel: 100,
  storageRemaining: 100,
  temperature: 25,
  currentTimecode: '00:00:00:00',
  timecodeMode: 'free_run',
  userBits: '00:00:00:00',
  timecode: {
    current: '00:00:00:00',
    mode: 'free_run',
    syncStatus: 'synced'
  },
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
  operations: {
    loading: false,
    timecode: false,
    grading: false
  },
  lastUpdate: null
};

// Main camera state store
const cameraState = writable<CameraState>(initialCameraState);

// Camera settings that should be persisted
const cameraSettings = createPersistedStore('camera-settings', {
  frameRate: initialCameraState.frameRate,
  whiteBalance: initialCameraState.whiteBalance,
  iso: initialCameraState.iso,
  ndFilter: initialCameraState.ndFilter,
  frameLinesEnabled: initialCameraState.frameLinesEnabled,
  currentLUT: initialCameraState.currentLUT,
  timecodeMode: initialCameraState.timecodeMode,
  userBits: initialCameraState.userBits
}, {
  validator: (value: any) => {
    return typeof value === 'object' &&
           typeof value.frameRate === 'number' &&
           typeof value.whiteBalance === 'object' &&
           typeof value.iso === 'number';
  }
});

// Async operations store
const cameraOperations = createAsyncStore({
  lastCommand: null as string | null,
  pendingCommands: [] as string[]
});

// Derived stores for specific aspects
const connectionStatus = derived(
  cameraState,
  ($camera) => ({
    connected: $camera.connected,
    connecting: $camera.connecting,
    lastConnected: $camera.lastConnected,
    model: $camera.model
  })
);

const cameraInfo = derived(
  cameraState,
  ($camera) => ({
    model: $camera.model,
    serialNumber: $camera.serialNumber,
    firmwareVersion: $camera.firmwareVersion,
    batteryLevel: $camera.batteryLevel,
    storageRemaining: $camera.storageRemaining,
    temperature: $camera.temperature
  })
);

const recordingStatus = derived(
  cameraState,
  ($camera) => ({
    recording: $camera.recording,
    timecode: $camera.timecode.current,
    frameRate: $camera.frameRate
  })
);

const exposureSettings = derived(
  cameraState,
  ($camera) => ({
    iso: $camera.iso,
    ndFilter: $camera.ndFilter,
    whiteBalance: $camera.whiteBalance
  })
);

// Store actions
const cameraActions = {
  /**
   * Update camera connection status
   */
  setConnectionStatus(connected: boolean, connecting: boolean = false) {
    cameraState.update(state => ({
      ...state,
      connected,
      connecting,
      lastConnected: connected ? new Date() : state.lastConnected,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update camera information
   */
  setCameraInfo(info: Partial<Pick<CameraState, 'model' | 'serialNumber' | 'firmwareVersion'>>) {
    cameraState.update(state => ({
      ...state,
      ...info,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update camera settings
   */
  updateSettings(settings: Partial<Pick<CameraState, 'frameRate' | 'whiteBalance' | 'iso' | 'ndFilter' | 'frameLinesEnabled' | 'currentLUT' | 'currentTimecode' | 'timecodeMode' | 'userBits' | 'cdlValues'>>) {
    cameraState.update(state => ({
      ...state,
      ...settings,
      lastUpdate: new Date()
    }));

    // Persist settings
    cameraSettings.update(current => ({
      ...current,
      ...settings,
      timecodeMode: settings.timecode?.mode || current.timecodeMode
    }));
  },

  /**
   * Update camera status
   */
  updateStatus(status: Partial<Pick<CameraState, 'recording' | 'batteryLevel' | 'storageRemaining' | 'temperature'>>) {
    cameraState.update(state => ({
      ...state,
      ...status,
      lastUpdate: new Date()
    }));
  },

  /**
   * Update timecode
   */
  updateTimecode(timecode: Partial<CameraState['timecode']>) {
    cameraState.update(state => ({
      ...state,
      timecode: {
        ...state.timecode,
        ...timecode
      },
      lastUpdate: new Date()
    }));
  },

  /**
   * Reset camera state
   */
  reset() {
    cameraState.set(initialCameraState);
  },

  /**
   * Load persisted settings
   */
  loadPersistedSettings() {
    cameraSettings.subscribe(settings => {
      cameraState.update(state => ({
        ...state,
        frameRate: settings.frameRate,
        whiteBalance: settings.whiteBalance,
        iso: settings.iso,
        ndFilter: settings.ndFilter,
        frameLinesEnabled: settings.frameLinesEnabled,
        currentLUT: settings.currentLUT,
        timecode: {
          ...state.timecode,
          mode: settings.timecodeMode
        }
      }));
    });
  },

  /**
   * Set operation loading state
   */
  setOperationLoading(command: string, loading: boolean) {
    // Update the operations store
    if (loading) {
      cameraOperations.update(ops => ({
        ...ops,
        lastCommand: command,
        pendingCommands: [...ops.pendingCommands, command]
      }));
      cameraOperations.setLoading(true);
    } else {
      cameraOperations.update(ops => ({
        ...ops,
        pendingCommands: ops.pendingCommands.filter(cmd => cmd !== command)
      }));
      cameraOperations.setLoading(false);
    }

    // Also update the main camera state for component compatibility
    cameraState.update(state => ({
      ...state,
      operations: {
        ...state.operations,
        [command]: loading,
        loading: loading || Object.values(state.operations || {}).some(v => v === true)
      }
    }));
  },

  /**
   * Set operation error
   */
  setOperationError(error: string | null) {
    cameraOperations.setError(error);
  }
};

// Export the store and related utilities
export const cameraStore = {
  // Main store
  subscribe: cameraState.subscribe,
  
  // Derived stores
  connectionStatus,
  cameraInfo,
  recordingStatus,
  exposureSettings,
  
  // Operations store
  operations: cameraOperations,
  
  // Actions
  ...cameraActions
};

export type { CameraState };