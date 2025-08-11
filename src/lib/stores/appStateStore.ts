/**
 * App State Store
 * Manages overall application state and UI state
 */

import { writable, derived } from 'svelte/store';
import { createPersistedStore } from './storeUtils';

export interface AppState {
  // Application lifecycle
  initialized: boolean;
  loading: boolean;
  error: string | null;
  
  // UI state
  currentPage: string;
  previousPage: string | null;
  navigationHistory: string[];
  
  // Modal and overlay state
  activeModal: string | null;
  modalData: any;
  showingSidebar: boolean;
  sidebarCollapsed: boolean;
  
  // Feature flags
  features: {
    advancedControls: boolean;
    colorGrading: boolean;
    playbackMode: boolean;
    timecodeSync: boolean;
    debugMode: boolean;
  };
  
  // Performance monitoring
  performance: {
    renderTime: number;
    memoryUsage: number;
    connectionLatency: number;
    lastMeasurement: Date | null;
  };
  
  // Offline state
  offline: boolean;
  syncPending: boolean;
  lastSync: Date | null;
  
  // Metadata
  version: string;
  buildTime: string;
  lastUpdate: Date | null;
}

const initialAppState: AppState = {
  initialized: false,
  loading: false,
  error: null,
  currentPage: '/',
  previousPage: null,
  navigationHistory: ['/'],
  activeModal: null,
  modalData: null,
  showingSidebar: false,
  sidebarCollapsed: false,
  features: {
    advancedControls: true,
    colorGrading: true,
    playbackMode: true,
    timecodeSync: true,
    debugMode: false
  },
  performance: {
    renderTime: 0,
    memoryUsage: 0,
    connectionLatency: 0,
    lastMeasurement: null
  },
  offline: false,
  syncPending: false,
  lastSync: null,
  version: '1.0.0',
  buildTime: new Date().toISOString(),
  lastUpdate: null
};

// Main app state store
const appState = writable<AppState>(initialAppState);

// Persisted UI preferences
const uiPreferences = createPersistedStore('ui-preferences', {
  sidebarCollapsed: initialAppState.sidebarCollapsed,
  lastPage: initialAppState.currentPage
}, {
  validator: (value: any) => {
    return typeof value === 'object' &&
           typeof value.sidebarCollapsed === 'boolean';
  }
});

// Derived stores for specific aspects
const loadingState = derived(
  appState,
  ($app) => ({
    loading: $app.loading,
    error: $app.error,
    initialized: $app.initialized
  })
);

const navigationState = derived(
  appState,
  ($app) => ({
    currentPage: $app.currentPage,
    previousPage: $app.previousPage,
    history: $app.navigationHistory,
    canGoBack: $app.navigationHistory.length > 1
  })
);

const modalState = derived(
  appState,
  ($app) => ({
    activeModal: $app.activeModal,
    modalData: $app.modalData,
    hasActiveModal: $app.activeModal !== null
  })
);

const sidebarState = derived(
  appState,
  ($app) => ({
    showing: $app.showingSidebar,
    collapsed: $app.sidebarCollapsed
  })
);

const featureFlags = derived(
  appState,
  ($app) => $app.features
);

const performanceMetrics = derived(
  appState,
  ($app) => $app.performance
);

const offlineState = derived(
  appState,
  ($app) => ({
    offline: $app.offline,
    syncPending: $app.syncPending,
    lastSync: $app.lastSync
  })
);

// Store actions
const appStateActions = {
  /**
   * Initialize the application
   */
  initialize() {
    appState.update(state => ({
      ...state,
      initialized: true,
      loading: false,
      lastUpdate: new Date()
    }));
  },

  /**
   * Set loading state
   */
  setLoading(loading: boolean, error: string | null = null) {
    appState.update(state => ({
      ...state,
      loading,
      error,
      lastUpdate: new Date()
    }));
  },

  /**
   * Set error state
   */
  setError(error: string | null) {
    appState.update(state => ({
      ...state,
      error,
      loading: false,
      lastUpdate: new Date()
    }));
  },

  /**
   * Navigate to page
   */
  navigateTo(page: string) {
    appState.update(state => {
      const history = [...state.navigationHistory];
      
      // Don't add duplicate consecutive entries
      if (history[history.length - 1] !== page) {
        history.push(page);
        
        // Keep history reasonable size
        if (history.length > 50) {
          history.splice(0, 10);
        }
      }

      return {
        ...state,
        previousPage: state.currentPage,
        currentPage: page,
        navigationHistory: history,
        lastUpdate: new Date()
      };
    });

    // Persist current page
    uiPreferences.update(prefs => ({
      ...prefs,
      lastPage: page
    }));
  },

  /**
   * Go back in navigation
   */
  goBack() {
    appState.update(state => {
      const history = [...state.navigationHistory];
      if (history.length > 1) {
        history.pop(); // Remove current page
        const previousPage = history[history.length - 1];
        
        return {
          ...state,
          previousPage: state.currentPage,
          currentPage: previousPage,
          navigationHistory: history,
          lastUpdate: new Date()
        };
      }
      return state;
    });
  },

  /**
   * Show modal
   */
  showModal(modalId: string, data: any = null) {
    appState.update(state => ({
      ...state,
      activeModal: modalId,
      modalData: data,
      lastUpdate: new Date()
    }));
  },

  /**
   * Hide modal
   */
  hideModal() {
    appState.update(state => ({
      ...state,
      activeModal: null,
      modalData: null,
      lastUpdate: new Date()
    }));
  },

  /**
   * Toggle sidebar
   */
  toggleSidebar() {
    appState.update(state => ({
      ...state,
      showingSidebar: !state.showingSidebar,
      lastUpdate: new Date()
    }));
  },

  /**
   * Set sidebar collapsed state
   */
  setSidebarCollapsed(collapsed: boolean) {
    appState.update(state => ({
      ...state,
      sidebarCollapsed: collapsed,
      lastUpdate: new Date()
    }));

    // Persist preference
    uiPreferences.update(prefs => ({
      ...prefs,
      sidebarCollapsed: collapsed
    }));
  },

  /**
   * Update feature flags
   */
  updateFeatures(features: Partial<AppState['features']>) {
    appState.update(state => ({
      ...state,
      features: {
        ...state.features,
        ...features
      },
      lastUpdate: new Date()
    }));
  },

  /**
   * Update performance metrics
   */
  updatePerformance(metrics: Partial<AppState['performance']>) {
    appState.update(state => ({
      ...state,
      performance: {
        ...state.performance,
        ...metrics,
        lastMeasurement: new Date()
      },
      lastUpdate: new Date()
    }));
  },

  /**
   * Set offline state
   */
  setOffline(offline: boolean) {
    appState.update(state => ({
      ...state,
      offline,
      lastUpdate: new Date()
    }));
  },

  /**
   * Set sync state
   */
  setSyncState(syncPending: boolean, lastSync: Date | null = null) {
    appState.update(state => ({
      ...state,
      syncPending,
      lastSync: lastSync || (syncPending ? state.lastSync : new Date()),
      lastUpdate: new Date()
    }));
  },

  /**
   * Reset app state
   */
  reset() {
    appState.update(state => ({
      ...initialAppState,
      version: state.version,
      buildTime: state.buildTime,
      initialized: state.initialized
    }));
  },

  /**
   * Load persisted UI preferences
   */
  loadPersistedPreferences() {
    uiPreferences.subscribe(prefs => {
      appState.update(state => ({
        ...state,
        sidebarCollapsed: prefs.sidebarCollapsed,
        currentPage: prefs.lastPage || state.currentPage
      }));
    });
  },

  /**
   * Get app info
   */
  getAppInfo() {
    return derived(appState, ($app) => ({
      version: $app.version,
      buildTime: $app.buildTime,
      initialized: $app.initialized,
      lastUpdate: $app.lastUpdate
    }));
  }
};

// Performance monitoring
if (typeof window !== 'undefined') {
  // Monitor memory usage if available
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (performance as any).memory;
      appStateActions.updatePerformance({
        memoryUsage: memory.usedJSHeapSize / memory.jsHeapSizeLimit
      });
    }, 30000); // Every 30 seconds
  }

  // Monitor render performance
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const renderTime = entries.reduce((sum, entry) => sum + entry.duration, 0) / entries.length;
        appStateActions.updatePerformance({ renderTime });
      });
      observer.observe({ entryTypes: ['measure'] });
    } catch (error) {
      console.warn('Performance monitoring not available:', error);
    }
  }
}

// Export the store and related utilities
export const appStateStore = {
  // Main store
  subscribe: appState.subscribe,
  
  // Derived stores
  loadingState,
  navigationState,
  modalState,
  sidebarState,
  featureFlags,
  performanceMetrics,
  offlineState,
  
  // Actions
  ...appStateActions
};

export type { AppState };