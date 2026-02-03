/**
 * Application Configuration
 * Central configuration for development/production modes
 */

import { browser } from '$app/environment';

export interface AppConfig {
  // Development settings
  development: {
    enabled: boolean;
    useMockStores: boolean;
    useMockApi: boolean;
    showDevIndicator: boolean;
    enableDebugLogs: boolean;
  };
  
  // Production settings
  production: {
    strictMode: boolean;
    enableAnalytics: boolean;
    enableErrorReporting: boolean;
  };
  
  // Feature flags
  features: {
    offlineMode: boolean;
    mobileOptimizations: boolean;
    advancedControls: boolean;
  };
}

// Default configuration
const defaultConfig: AppConfig = {
  development: {
    enabled: false, // Always default to false, only enable via secret
    useMockStores: false,
    useMockApi: false,
    showDevIndicator: false,
    enableDebugLogs: false,
  },
  production: {
    strictMode: !import.meta.env.DEV,
    enableAnalytics: !import.meta.env.DEV,
    enableErrorReporting: !import.meta.env.DEV,
  },
  features: {
    offlineMode: true,
    mobileOptimizations: true,
    advancedControls: true,
  }
};

// Runtime configuration (can be overridden)
let runtimeConfig: AppConfig = { ...defaultConfig };

/**
 * Get current app configuration
 */
export function getAppConfig(): AppConfig {
  return runtimeConfig;
}

/**
 * Update app configuration
 */
export function updateAppConfig(updates: Partial<AppConfig>): void {
  runtimeConfig = {
    ...runtimeConfig,
    ...updates,
    development: { ...runtimeConfig.development, ...updates.development },
    production: { ...runtimeConfig.production, ...updates.production },
    features: { ...runtimeConfig.features, ...updates.features },
  };
  
  console.log('App configuration updated:', runtimeConfig);
}

/**
 * Force development mode (for testing)
 */
export function enableDevMode(): void {
  updateAppConfig({
    development: {
      enabled: true,
      useMockStores: true,
      useMockApi: true,
      showDevIndicator: true,
      enableDebugLogs: true,
    }
  });
}

/**
 * Force production mode
 */
export function enableProductionMode(): void {
  updateAppConfig({
    development: {
      enabled: false,
      useMockStores: false,
      useMockApi: false,
      showDevIndicator: false,
      enableDebugLogs: false,
    },
    production: {
      strictMode: true,
      enableAnalytics: true,
      enableErrorReporting: true,
    }
  });
}

/**
 * Check if development mode is enabled
 */
export function isDevMode(): boolean {
  return runtimeConfig.development.enabled;
}

/**
 * Check if mock stores should be used
 */
export function shouldUseMockStores(): boolean {
  return runtimeConfig.development.useMockStores;
}

/**
 * Check if mock API should be used
 */
export function shouldUseMockApi(): boolean {
  return runtimeConfig.development.useMockApi;
}

/**
 * Check if dev indicator should be shown
 */
export function shouldShowDevIndicator(): boolean {
  return runtimeConfig.development.showDevIndicator;
}

/**
 * Check if debug logs should be enabled
 */
export function shouldEnableDebugLogs(): boolean {
  return runtimeConfig.development.enableDebugLogs;
}

/**
 * Secret dev mode activation
 */
let secretSequence: string[] = [];
const SECRET_CODE = ['a', 'r', 'r', 'i', 'd', 'e', 'v'];
const SECRET_TIMEOUT = 2000; // 2 seconds to complete sequence
let secretTimer: number | null = null;

/**
 * Initialize secret dev mode listener
 */
function initializeSecretMode(): void {
  if (!browser) return;
  
  const handleKeyPress = (event: KeyboardEvent) => {
    // Only listen for letter keys, ignore modifiers
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (!/^[a-z]$/.test(event.key.toLowerCase())) return;
    
    // Add key to sequence
    secretSequence.push(event.key.toLowerCase());
    
    // Reset timer
    if (secretTimer) clearTimeout(secretTimer);
    secretTimer = window.setTimeout(() => {
      secretSequence = [];
    }, SECRET_TIMEOUT);
    
    // Keep only the last 7 keys
    if (secretSequence.length > SECRET_CODE.length) {
      secretSequence = secretSequence.slice(-SECRET_CODE.length);
    }
    
    // Check if sequence matches
    if (secretSequence.length === SECRET_CODE.length && 
        secretSequence.every((key, index) => key === SECRET_CODE[index])) {
      
      // Secret code activated!
      secretSequence = [];
      if (secretTimer) clearTimeout(secretTimer);
      
      // Toggle dev mode
      if (isDevMode()) {
        enableProductionMode();
        console.log('🤫 Secret: Development mode disabled');
        // Show subtle notification
        showSecretNotification('Dev mode disabled', false);
      } else {
        enableDevMode();
        console.log('🤫 Secret: Development mode enabled');
        // Show subtle notification
        showSecretNotification('Dev mode enabled', true);
      }
      
      saveConfig();
    }
  };
  
  window.addEventListener('keydown', handleKeyPress);
}

/**
 * Show subtle notification for secret activation
 */
function showSecretNotification(message: string, isDevMode: boolean): void {
  const notification = document.createElement('div');
  notification.textContent = `🤫 ${message}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${isDevMode ? '#E31E24' : '#28a745'};
    color: white;
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: bold;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;
  
  document.body.appendChild(notification);
  
  // Fade in
  requestAnimationFrame(() => {
    notification.style.opacity = '1';
  });
  
  // Fade out and remove
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 2000);
}

/**
 * Initialize configuration from URL parameters or localStorage
 */
export function initializeConfig(): void {
  if (!browser) return;
  
  // Initialize secret mode listener
  initializeSecretMode();
  
  // Check for localStorage overrides first
  let hasStoredConfig = false;
  try {
    const savedConfig = localStorage.getItem('arri-app-config');
    if (savedConfig) {
      const parsedConfig = JSON.parse(savedConfig);
      updateAppConfig(parsedConfig);
      hasStoredConfig = true;
      console.log('📋 Configuration loaded from localStorage');
    }
  } catch (error) {
    console.warn('Failed to load configuration from localStorage:', error);
  }
  
  // Check URL parameters for dev mode overrides
  const urlParams = new URLSearchParams(window.location.search);
  
  if (urlParams.has('dev')) {
    const devMode = urlParams.get('dev') === 'true';
    if (devMode) {
      enableDevMode();
      console.log('🎭 Development mode enabled via URL parameter');
    } else {
      enableProductionMode();
      console.log('🚀 Production mode enabled via URL parameter');
    }
  } else if (!hasStoredConfig) {
    // Only force production mode if no stored config exists
    enableProductionMode();
  }
}

/**
 * Save current configuration to localStorage
 */
export function saveConfig(): void {
  if (!browser) return;
  
  try {
    localStorage.setItem('arri-app-config', JSON.stringify(runtimeConfig));
    console.log('💾 Configuration saved to localStorage');
  } catch (error) {
    console.warn('Failed to save configuration to localStorage:', error);
  }
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  runtimeConfig = { ...defaultConfig };
  
  if (browser) {
    try {
      localStorage.removeItem('arri-app-config');
      console.log('🔄 Configuration reset to defaults');
    } catch (error) {
      console.warn('Failed to clear configuration from localStorage:', error);
    }
  }
}

/**
 * Get environment info for debugging
 */
export function getEnvironmentInfo() {
  return {
    mode: import.meta.env.MODE,
    dev: import.meta.env.DEV,
    prod: import.meta.env.PROD,
    ssr: import.meta.env.SSR,
    browser,
    config: runtimeConfig,
  };
}