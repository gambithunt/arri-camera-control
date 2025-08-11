import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Socket.io client for tests
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  })),
}));

// Mock SvelteKit stores
vi.mock('$app/stores', () => ({
  page: {
    subscribe: vi.fn((callback) => {
      callback({ url: { pathname: '/' } });
      return () => {};
    })
  }
}));

// Mock SvelteKit navigation
vi.mock('$app/navigation', () => ({
  goto: vi.fn(),
  invalidate: vi.fn(),
  invalidateAll: vi.fn(),
  preloadData: vi.fn(),
  preloadCode: vi.fn(),
  beforeNavigate: vi.fn(),
  afterNavigate: vi.fn()
}));

// Mock SvelteKit environment
vi.mock('$app/environment', () => ({
  browser: true,
  dev: true,
  building: false,
  version: '1.0.0'
}));

// Mock Svelte stores
vi.mock('svelte/store', () => ({
  writable: vi.fn(() => ({
    subscribe: vi.fn(),
    set: vi.fn(),
    update: vi.fn()
  })),
  readable: vi.fn(() => ({
    subscribe: vi.fn()
  })),
  derived: vi.fn(() => ({
    subscribe: vi.fn()
  }))
}));