import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { 
  createPersistedStore, 
  createDerivedStore, 
  createResettableStore,
  createValidatedStore,
  createDebouncedStore,
  createAsyncStore,
  storage
} from '../storeUtils';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('Store Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createPersistedStore', () => {
    it('should create a store with initial value', () => {
      const store = createPersistedStore('test-key', 'initial');
      expect(get(store)).toBe('initial');
    });

    it('should load value from localStorage if available', () => {
      mockLocalStorage.getItem.mockReturnValue('"stored-value"');
      
      const store = createPersistedStore('test-key', 'initial');
      expect(get(store)).toBe('stored-value');
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('test-key');
    });

    it('should persist changes to localStorage', () => {
      const store = createPersistedStore('test-key', 'initial');
      
      store.set('new-value');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('test-key', '"new-value"');
    });

    it('should validate loaded values', () => {
      mockLocalStorage.getItem.mockReturnValue('"invalid"');
      
      const validator = vi.fn().mockReturnValue(false);
      const store = createPersistedStore('test-key', 'initial', { validator });
      
      expect(get(store)).toBe('initial'); // Should use initial value
      expect(validator).toHaveBeenCalledWith('invalid');
    });
  });

  describe('createDerivedStore', () => {
    it('should create derived store from single store', () => {
      const source = createPersistedStore('source', 10);
      const derived = createDerivedStore(source, (value) => value * 2);
      
      expect(get(derived)).toBe(20);
      
      source.set(15);
      expect(get(derived)).toBe(30);
    });

    it('should create derived store from multiple stores', () => {
      const store1 = createPersistedStore('store1', 10);
      const store2 = createPersistedStore('store2', 5);
      const derived = createDerivedStore([store1, store2], ([a, b]) => a + b);
      
      expect(get(derived)).toBe(15);
      
      store1.set(20);
      expect(get(derived)).toBe(25);
    });
  });

  describe('createResettableStore', () => {
    it('should create store with reset functionality', () => {
      const store = createResettableStore('initial');
      
      store.set('changed');
      expect(get(store)).toBe('changed');
      
      store.reset();
      expect(get(store)).toBe('initial');
    });
  });

  describe('createValidatedStore', () => {
    it('should accept valid values', () => {
      const validator = (value: number) => value > 0;
      const store = createValidatedStore(5, validator);
      
      store.set(10);
      expect(get(store)).toBe(10);
    });

    it('should reject invalid values', () => {
      const validator = (value: number) => value > 0;
      const onInvalid = vi.fn();
      const store = createValidatedStore(5, validator, onInvalid);
      
      store.set(-5);
      expect(get(store)).toBe(5); // Should keep original value
      expect(onInvalid).toHaveBeenCalledWith(-5);
    });
  });

  describe('createDebouncedStore', () => {
    it('should debounce updates', async () => {
      vi.useFakeTimers();
      
      const store = createDebouncedStore('initial', 100);
      
      store.set('value1');
      store.set('value2');
      store.set('value3');
      
      // Should still be initial value before debounce
      expect(get(store)).toBe('initial');
      
      // Fast forward time
      vi.advanceTimersByTime(100);
      
      // Should now have the latest value
      expect(get(store)).toBe('value3');
      
      vi.useRealTimers();
    });
  });

  describe('createAsyncStore', () => {
    it('should provide loading and error states', () => {
      const store = createAsyncStore('initial');
      
      expect(get(store)).toBe('initial');
      expect(get(store.loading)).toBe(false);
      expect(get(store.error)).toBe(null);
      
      store.setLoading(true);
      expect(get(store.loading)).toBe(true);
      
      store.setError('Test error');
      expect(get(store.error)).toBe('Test error');
    });
  });

  describe('storage utilities', () => {
    it('should get values with fallback', () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const result = storage.get('missing-key', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should get parsed values', () => {
      mockLocalStorage.getItem.mockReturnValue('{"test": "value"}');
      
      const result = storage.get('test-key', {});
      expect(result).toEqual({ test: 'value' });
    });

    it('should set values', () => {
      storage.set('test-key', { test: 'value' });
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'test-key',
        '{"test":"value"}'
      );
    });

    it('should remove values', () => {
      storage.remove('test-key');
      
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should clear all values', () => {
      storage.clear();
      
      expect(mockLocalStorage.clear).toHaveBeenCalled();
    });
  });
});