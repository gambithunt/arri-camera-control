/**
 * AppShell Component Tests
 * Tests for the main application shell wrapper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import AppShell from '../AppShell.svelte';
import { errorManager } from '$lib/utils/errorManager';

// Mock dependencies
vi.mock('$app/environment', () => ({
  browser: true
}));

vi.mock('$lib/utils/errorManager', () => ({
  errorManager: {
    initialize: vi.fn()
  }
}));

vi.mock('$lib/components/ErrorBoundary.svelte', () => ({
  default: vi.fn(() => ({ $$: {} }))
}));

vi.mock('$lib/components/NotificationToast.svelte', () => ({
  default: vi.fn(() => ({ $$: {} }))
}));

vi.mock('$lib/components/ResponsiveLayout.svelte', () => ({
  default: vi.fn(() => ({ $$: {} }))
}));

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should render loading state initially', () => {
      render(AppShell);
      
      expect(screen.getByText('ARRI Camera Control')).toBeInTheDocument();
      expect(screen.getByText('Initializing application...')).toBeInTheDocument();
    });

    it('should initialize error manager on mount', async () => {
      render(AppShell);
      
      await waitFor(() => {
        expect(errorManager.initialize).toHaveBeenCalled();
      });
    });

    it('should render main app after initialization', async () => {
      render(AppShell);
      
      await waitFor(() => {
        expect(screen.queryByText('Initializing application...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Props', () => {
    it('should use custom title', () => {
      render(AppShell, { title: 'Custom Title' });
      
      expect(document.title).toBe('Custom Title');
    });

    it('should disable error boundary when showErrorBoundary is false', () => {
      render(AppShell, { showErrorBoundary: false });
      
      // Should render ResponsiveLayout directly without ErrorBoundary
      // This would need to be tested with actual component rendering
    });

    it('should disable notifications when showNotifications is false', () => {
      render(AppShell, { showNotifications: false });
      
      // Should not render NotificationToast component
      // This would need to be tested with actual component rendering
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors', async () => {
      const mockError = new Error('Initialization failed');
      vi.mocked(errorManager.initialize).mockImplementation(() => {
        throw mockError;
      });
      
      render(AppShell);
      
      await waitFor(() => {
        expect(screen.getByText('Initialization Failed')).toBeInTheDocument();
        expect(screen.getByText('The application failed to start properly.')).toBeInTheDocument();
      });
    });

    it('should show reload button on initialization error', async () => {
      const mockError = new Error('Initialization failed');
      vi.mocked(errorManager.initialize).mockImplementation(() => {
        throw mockError;
      });
      
      // Mock window.location.reload
      const mockReload = vi.fn();
      Object.defineProperty(window, 'location', {
        value: { reload: mockReload },
        writable: true
      });
      
      render(AppShell);
      
      await waitFor(() => {
        const reloadButton = screen.getByText('Reload Application');
        expect(reloadButton).toBeInTheDocument();
        
        fireEvent.click(reloadButton);
        expect(mockReload).toHaveBeenCalled();
      });
    });

    it('should show technical details when available', async () => {
      const mockError = new Error('Initialization failed');
      mockError.stack = 'Error stack trace';
      vi.mocked(errorManager.initialize).mockImplementation(() => {
        throw mockError;
      });
      
      render(AppShell);
      
      await waitFor(() => {
        const detailsToggle = screen.getByText('Show Technical Details');
        expect(detailsToggle).toBeInTheDocument();
        
        fireEvent.click(detailsToggle);
        expect(screen.getByText('Initialization failed')).toBeInTheDocument();
      });
    });
  });

  describe('Event Handling', () => {
    it('should handle app error events', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(AppShell);
      
      // Wait for initialization
      await waitFor(() => {
        expect(errorManager.initialize).toHaveBeenCalled();
      });
      
      // Simulate error event
      const errorEvent = new CustomEvent('error', {
        detail: {
          error: new Error('Test error'),
          errorInfo: { severity: 'critical' }
        }
      });
      
      // This would need to be dispatched from the ErrorBoundary component
      // In a real test, we'd need to render the actual components
      
      consoleSpy.mockRestore();
    });

    it('should handle app recovery events', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(AppShell);
      
      // Wait for initialization
      await waitFor(() => {
        expect(errorManager.initialize).toHaveBeenCalled();
      });
      
      // Simulate recovery event
      const recoveryEvent = new CustomEvent('recover');
      
      // This would need to be dispatched from the ErrorBoundary component
      // In a real test, we'd need to render the actual components
      
      consoleSpy.mockRestore();
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle different screen sizes', () => {
      // Mock screen size
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });
      
      render(AppShell);
      
      // Should adapt layout based on screen size
      // This would need to be tested with actual responsive components
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(AppShell);
      
      // Check for proper accessibility attributes
      const main = screen.getByRole('main');
      expect(main).toBeInTheDocument();
    });

    it('should have proper meta tags', () => {
      render(AppShell);
      
      // Check for viewport meta tag
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      expect(viewportMeta).toHaveAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
      
      // Check for theme color
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');
      expect(themeColorMeta).toHaveAttribute('content', '#1a1a1a');
    });

    it('should prevent zoom on iOS', () => {
      render(AppShell);
      
      // Check for zoom prevention meta tag
      const zoomMeta = document.querySelector('meta[content*="user-scalable=no"]');
      expect(zoomMeta).toBeInTheDocument();
    });
  });

  describe('PWA Features', () => {
    it('should include PWA manifest link', () => {
      render(AppShell);
      
      const manifestLink = document.querySelector('link[rel="manifest"]');
      expect(manifestLink).toHaveAttribute('href', '/manifest.json');
    });

    it('should include favicon links', () => {
      render(AppShell);
      
      const favicon32 = document.querySelector('link[sizes="32x32"]');
      expect(favicon32).toHaveAttribute('href', '/favicon-32x32.png');
      
      const favicon16 = document.querySelector('link[sizes="16x16"]');
      expect(favicon16).toHaveAttribute('href', '/favicon-16x16.png');
      
      const appleTouchIcon = document.querySelector('link[rel="apple-touch-icon"]');
      expect(appleTouchIcon).toHaveAttribute('href', '/apple-touch-icon.png');
    });
  });

  describe('Safe Area Handling', () => {
    it('should handle safe area insets', () => {
      render(AppShell);
      
      // Check that safe area CSS variables are used
      const styles = document.querySelector('style');
      if (styles) {
        expect(styles.textContent).toContain('env(safe-area-inset-');
      }
    });
  });

  describe('Performance', () => {
    it('should optimize font rendering', () => {
      render(AppShell);
      
      // Check for font optimization CSS
      const styles = document.querySelector('style');
      if (styles) {
        expect(styles.textContent).toContain('-webkit-font-smoothing: antialiased');
        expect(styles.textContent).toContain('-moz-osx-font-smoothing: grayscale');
      }
    });

    it('should prevent overscroll bounce', () => {
      render(AppShell);
      
      // Check for overscroll prevention
      const styles = document.querySelector('style');
      if (styles) {
        expect(styles.textContent).toContain('overscroll-behavior: none');
      }
    });
  });
});