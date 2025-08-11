/**
 * User Settings Store
 * Manages user preferences and application settings
 */

import { derived } from 'svelte/store';
import { createPersistedStore } from './storeUtils';

export interface UserSettings {
  // Appearance
  theme: 'dark' | 'light' | 'auto';
  colorScheme: 'arri' | 'neutral' | 'high-contrast';
  fontSize: 'small' | 'medium' | 'large';
  
  // Interface preferences
  showAdvancedControls: boolean;
  enableHapticFeedback: boolean;
  enableSoundFeedback: boolean;
  confirmDestructiveActions: boolean;
  
  // Camera control preferences
  defaultFrameRate: number;
  defaultWhiteBalance: { kelvin: number; tint: number };
  defaultISO: number;
  quickAccessControls: string[];
  
  // Playback preferences
  autoEnterPlaybackMode: boolean;
  defaultPlaybackSpeed: number;
  showTimecodeInFrames: boolean;
  enableClipThumbnails: boolean;
  
  // Timecode preferences
  timecodeFormat: 'HH:MM:SS:FF' | 'HH:MM:SS.mmm';
  timecodeDropFrame: boolean;
  
  // Color grading preferences
  colorWheelSensitivity: number;
  enableColorWheelHaptics: boolean;
  defaultCDLValues: {
    shadows: { lift: number; gamma: number; gain: number };
    midtones: { lift: number; gamma: number; gain: number };
    highlights: { lift: number; gamma: number; gain: number };
  };
  
  // Notifications
  enableNotifications: boolean;
  notificationTypes: {
    connectionStatus: boolean;
    cameraErrors: boolean;
    playbackEvents: boolean;
    recordingStatus: boolean;
  };
  
  // Performance
  enableAnimations: boolean;
  reducedMotion: boolean;
  lowPowerMode: boolean;
  
  // Debug and development
  enableDebugMode: boolean;
  showProtocolLogs: boolean;
  enablePerformanceMonitoring: boolean;
  
  // Metadata
  lastModified: Date;
  version: string;
}

const initialUserSettings: UserSettings = {
  // Appearance
  theme: 'dark',
  colorScheme: 'arri',
  fontSize: 'medium',
  
  // Interface preferences
  showAdvancedControls: false,
  enableHapticFeedback: true,
  enableSoundFeedback: false,
  confirmDestructiveActions: true,
  
  // Camera control preferences
  defaultFrameRate: 24,
  defaultWhiteBalance: { kelvin: 5600, tint: 0 },
  defaultISO: 800,
  quickAccessControls: ['frameRate', 'whiteBalance', 'iso', 'ndFilter'],
  
  // Playback preferences
  autoEnterPlaybackMode: false,
  defaultPlaybackSpeed: 1.0,
  showTimecodeInFrames: false,
  enableClipThumbnails: true,
  
  // Timecode preferences
  timecodeFormat: 'HH:MM:SS:FF',
  timecodeDropFrame: false,
  
  // Color grading preferences
  colorWheelSensitivity: 1.0,
  enableColorWheelHaptics: true,
  defaultCDLValues: {
    shadows: { lift: 0, gamma: 1, gain: 1 },
    midtones: { lift: 0, gamma: 1, gain: 1 },
    highlights: { lift: 0, gamma: 1, gain: 1 }
  },
  
  // Notifications
  enableNotifications: true,
  notificationTypes: {
    connectionStatus: true,
    cameraErrors: true,
    playbackEvents: false,
    recordingStatus: true
  },
  
  // Performance
  enableAnimations: true,
  reducedMotion: false,
  lowPowerMode: false,
  
  // Debug and development
  enableDebugMode: false,
  showProtocolLogs: false,
  enablePerformanceMonitoring: false,
  
  // Metadata
  lastModified: new Date(),
  version: '1.0.0'
};

// Validator for user settings
const validateUserSettings = (value: any): value is UserSettings => {
  return typeof value === 'object' &&
         typeof value.theme === 'string' &&
         typeof value.colorScheme === 'string' &&
         typeof value.fontSize === 'string' &&
         typeof value.enableHapticFeedback === 'boolean' &&
         typeof value.defaultFrameRate === 'number' &&
         typeof value.version === 'string';
};

// Main user settings store with persistence
const userSettings = createPersistedStore(
  'user-settings',
  initialUserSettings,
  {
    validator: validateUserSettings,
    serialize: (value) => {
      return JSON.stringify({
        ...value,
        lastModified: value.lastModified.toISOString()
      });
    },
    deserialize: (value) => {
      const parsed = JSON.parse(value);
      return {
        ...parsed,
        lastModified: new Date(parsed.lastModified)
      };
    }
  }
);

// Derived stores for specific setting categories
const appearanceSettings = derived(
  userSettings,
  ($settings) => ({
    theme: $settings.theme,
    colorScheme: $settings.colorScheme,
    fontSize: $settings.fontSize,
    enableAnimations: $settings.enableAnimations,
    reducedMotion: $settings.reducedMotion
  })
);

const interfaceSettings = derived(
  userSettings,
  ($settings) => ({
    showAdvancedControls: $settings.showAdvancedControls,
    enableHapticFeedback: $settings.enableHapticFeedback,
    enableSoundFeedback: $settings.enableSoundFeedback,
    confirmDestructiveActions: $settings.confirmDestructiveActions,
    quickAccessControls: $settings.quickAccessControls
  })
);

const cameraDefaults = derived(
  userSettings,
  ($settings) => ({
    frameRate: $settings.defaultFrameRate,
    whiteBalance: $settings.defaultWhiteBalance,
    iso: $settings.defaultISO
  })
);

const playbackSettings = derived(
  userSettings,
  ($settings) => ({
    autoEnterPlaybackMode: $settings.autoEnterPlaybackMode,
    defaultPlaybackSpeed: $settings.defaultPlaybackSpeed,
    showTimecodeInFrames: $settings.showTimecodeInFrames,
    enableClipThumbnails: $settings.enableClipThumbnails
  })
);

const timecodeSettings = derived(
  userSettings,
  ($settings) => ({
    format: $settings.timecodeFormat,
    dropFrame: $settings.timecodeDropFrame
  })
);

const gradingSettings = derived(
  userSettings,
  ($settings) => ({
    colorWheelSensitivity: $settings.colorWheelSensitivity,
    enableColorWheelHaptics: $settings.enableColorWheelHaptics,
    defaultCDLValues: $settings.defaultCDLValues
  })
);

const notificationSettings = derived(
  userSettings,
  ($settings) => ({
    enableNotifications: $settings.enableNotifications,
    notificationTypes: $settings.notificationTypes
  })
);

const performanceSettings = derived(
  userSettings,
  ($settings) => ({
    enableAnimations: $settings.enableAnimations,
    reducedMotion: $settings.reducedMotion,
    lowPowerMode: $settings.lowPowerMode
  })
);

const debugSettings = derived(
  userSettings,
  ($settings) => ({
    enableDebugMode: $settings.enableDebugMode,
    showProtocolLogs: $settings.showProtocolLogs,
    enablePerformanceMonitoring: $settings.enablePerformanceMonitoring
  })
);

// Store actions
const userSettingsActions = {
  /**
   * Update appearance settings
   */
  updateAppearance(updates: Partial<Pick<UserSettings, 'theme' | 'colorScheme' | 'fontSize'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update interface preferences
   */
  updateInterface(updates: Partial<Pick<UserSettings, 'showAdvancedControls' | 'enableHapticFeedback' | 'enableSoundFeedback' | 'confirmDestructiveActions'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update camera defaults
   */
  updateCameraDefaults(updates: Partial<Pick<UserSettings, 'defaultFrameRate' | 'defaultWhiteBalance' | 'defaultISO'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update quick access controls
   */
  updateQuickAccessControls(controls: string[]) {
    userSettings.update(settings => ({
      ...settings,
      quickAccessControls: controls,
      lastModified: new Date()
    }));
  },

  /**
   * Update playback preferences
   */
  updatePlaybackSettings(updates: Partial<Pick<UserSettings, 'autoEnterPlaybackMode' | 'defaultPlaybackSpeed' | 'showTimecodeInFrames' | 'enableClipThumbnails'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update timecode preferences
   */
  updateTimecodeSettings(updates: Partial<Pick<UserSettings, 'timecodeFormat' | 'timecodeDropFrame'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update color grading preferences
   */
  updateGradingSettings(updates: Partial<Pick<UserSettings, 'colorWheelSensitivity' | 'enableColorWheelHaptics' | 'defaultCDLValues'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update notification settings
   */
  updateNotificationSettings(updates: Partial<Pick<UserSettings, 'enableNotifications' | 'notificationTypes'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update performance settings
   */
  updatePerformanceSettings(updates: Partial<Pick<UserSettings, 'enableAnimations' | 'reducedMotion' | 'lowPowerMode'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Update debug settings
   */
  updateDebugSettings(updates: Partial<Pick<UserSettings, 'enableDebugMode' | 'showProtocolLogs' | 'enablePerformanceMonitoring'>>) {
    userSettings.update(settings => ({
      ...settings,
      ...updates,
      lastModified: new Date()
    }));
  },

  /**
   * Reset to defaults
   */
  resetToDefaults() {
    userSettings.set({
      ...initialUserSettings,
      lastModified: new Date()
    });
  },

  /**
   * Reset specific category to defaults
   */
  resetCategory(category: keyof Pick<UserSettings, 'theme' | 'defaultFrameRate' | 'enableNotifications'>) {
    const defaults = {
      appearance: {
        theme: initialUserSettings.theme,
        colorScheme: initialUserSettings.colorScheme,
        fontSize: initialUserSettings.fontSize
      },
      camera: {
        defaultFrameRate: initialUserSettings.defaultFrameRate,
        defaultWhiteBalance: initialUserSettings.defaultWhiteBalance,
        defaultISO: initialUserSettings.defaultISO
      },
      notifications: {
        enableNotifications: initialUserSettings.enableNotifications,
        notificationTypes: initialUserSettings.notificationTypes
      }
    };

    // Implementation would depend on the specific category
    userSettings.update(settings => ({
      ...settings,
      lastModified: new Date()
    }));
  },

  /**
   * Export settings
   */
  exportSettings() {
    return derived(userSettings, ($settings) => ({
      ...$settings,
      exportedAt: new Date().toISOString()
    }));
  },

  /**
   * Import settings
   */
  importSettings(importedSettings: Partial<UserSettings>) {
    if (validateUserSettings(importedSettings)) {
      userSettings.set({
        ...importedSettings,
        lastModified: new Date(),
        version: initialUserSettings.version
      });
      return true;
    }
    return false;
  }
};

// Detect system preferences
if (typeof window !== 'undefined') {
  // Detect reduced motion preference
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mediaQuery.matches) {
    userSettingsActions.updatePerformanceSettings({ reducedMotion: true });
  }

  mediaQuery.addEventListener('change', (e) => {
    userSettingsActions.updatePerformanceSettings({ reducedMotion: e.matches });
  });

  // Detect color scheme preference
  const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const currentSettings = userSettings.subscribe(s => s)();
  if (currentSettings.theme === 'auto') {
    // Auto theme would be handled by the theme system
  }
}

// Export the store and related utilities
export const userSettingsStore = {
  // Main store
  subscribe: userSettings.subscribe,
  
  // Derived stores
  appearanceSettings,
  interfaceSettings,
  cameraDefaults,
  playbackSettings,
  timecodeSettings,
  gradingSettings,
  notificationSettings,
  performanceSettings,
  debugSettings,
  
  // Actions
  ...userSettingsActions
};

export type { UserSettings };