/**
 * Global State Management System
 * Centralized Svelte stores for application state
 */

export { cameraStore, type CameraState } from './cameraStore';
export { playbackStore, type PlaybackState } from './playbackStore';
export { connectionStore, type ConnectionState } from './connectionStore';
export { userSettingsStore, type UserSettings } from './userSettingsStore';
export { appStateStore, type AppState } from './appStateStore';
export { notificationStore, type Notification } from './notificationStore';

// Re-export store utilities
export { createPersistedStore, createDerivedStore } from './storeUtils';

// Re-export the global store manager
export { storeManager } from './storeManager';