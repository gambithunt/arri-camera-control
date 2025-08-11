/**
 * Store Utilities
 * Helper functions for creating persistent and derived stores
 */

import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { browser } from '$app/environment';

/**
 * Create a persisted store that saves to localStorage
 */
export function createPersistedStore<T>(
  key: string,
  initialValue: T,
  options: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
    validator?: (value: any) => value is T;
  } = {}
): Writable<T> {
  const {
    serialize = JSON.stringify,
    deserialize = JSON.parse,
    validator = () => true
  } = options;

  // Load initial value from localStorage if available
  let storedValue = initialValue;
  if (browser) {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsed = deserialize(stored);
        if (validator(parsed)) {
          storedValue = parsed;
        }
      }
    } catch (error) {
      console.warn(`Failed to load persisted store "${key}":`, error);
    }
  }

  const store = writable<T>(storedValue);

  // Subscribe to changes and persist to localStorage
  if (browser) {
    store.subscribe((value) => {
      try {
        localStorage.setItem(key, serialize(value));
      } catch (error) {
        console.warn(`Failed to persist store "${key}":`, error);
      }
    });
  }

  return store;
}

/**
 * Create a derived store with optional transformation
 */
export function createDerivedStore<T, U>(
  stores: Readable<T> | [Readable<T>, ...Readable<any>[]],
  fn: (values: T | [T, ...any[]]) => U,
  initialValue?: U
): Readable<U> {
  return derived(stores, fn, initialValue);
}

/**
 * Create a store that resets to initial value
 */
export function createResettableStore<T>(initialValue: T): Writable<T> & { reset: () => void } {
  const store = writable<T>(initialValue);
  
  return {
    ...store,
    reset: () => store.set(initialValue)
  };
}

/**
 * Create a store with validation
 */
export function createValidatedStore<T>(
  initialValue: T,
  validator: (value: T) => boolean,
  onInvalid?: (value: T) => void
): Writable<T> {
  const store = writable<T>(initialValue);
  
  return {
    subscribe: store.subscribe,
    set: (value: T) => {
      if (validator(value)) {
        store.set(value);
      } else {
        onInvalid?.(value);
        console.warn('Invalid value rejected by store:', value);
      }
    },
    update: (updater: (value: T) => T) => {
      store.update((current) => {
        const newValue = updater(current);
        if (validator(newValue)) {
          return newValue;
        } else {
          onInvalid?.(newValue);
          console.warn('Invalid value rejected by store:', newValue);
          return current;
        }
      });
    }
  };
}

/**
 * Create a debounced store that delays updates
 */
export function createDebouncedStore<T>(
  initialValue: T,
  delay: number = 300
): Writable<T> & { immediate: Writable<T> } {
  const immediate = writable<T>(initialValue);
  const debounced = writable<T>(initialValue);
  
  let timeout: NodeJS.Timeout;
  
  immediate.subscribe((value) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      debounced.set(value);
    }, delay);
  });
  
  return {
    subscribe: debounced.subscribe,
    set: immediate.set,
    update: immediate.update,
    immediate
  };
}

/**
 * Create a store that tracks loading states
 */
export function createAsyncStore<T>(
  initialValue: T
): Writable<T> & {
  loading: Readable<boolean>;
  error: Readable<string | null>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
} {
  const store = writable<T>(initialValue);
  const loading = writable<boolean>(false);
  const error = writable<string | null>(null);
  
  return {
    subscribe: store.subscribe,
    set: store.set,
    update: store.update,
    loading: { subscribe: loading.subscribe },
    error: { subscribe: error.subscribe },
    setLoading: loading.set,
    setError: error.set
  };
}

/**
 * Storage utilities
 */
export const storage = {
  /**
   * Get item from localStorage with fallback
   */
  get<T>(key: string, fallback: T): T {
    if (!browser) return fallback;
    
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch {
      return fallback;
    }
  },

  /**
   * Set item in localStorage
   */
  set<T>(key: string, value: T): void {
    if (!browser) return;
    
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to save to localStorage:`, error);
    }
  },

  /**
   * Remove item from localStorage
   */
  remove(key: string): void {
    if (!browser) return;
    
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove from localStorage:`, error);
    }
  },

  /**
   * Clear all localStorage
   */
  clear(): void {
    if (!browser) return;
    
    try {
      localStorage.clear();
    } catch (error) {
      console.warn(`Failed to clear localStorage:`, error);
    }
  }
};