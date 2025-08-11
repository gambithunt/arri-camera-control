/**
 * ErrorDisplay Component Tests
 * Tests for the error display component
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import ErrorDisplay from '../ErrorDisplay.svelte';

// Mock dependencies
vi.mock('$lib/utils/errorManager', () => {
  const mockErrors = writable([]);
  const mockUnresolvedErrors = writable([]);
  const mockCriticalErrors = writable([]);
  
  return {
    errors: mockErrors,
    unresolvedErrors: mockUnresolvedErrors,
    criticalErrors: mockCriticalErrors,
    retryError: vi.fn(),
    resolveError: vi.fn()
  };
});

vi.mock('$lib/utils/responsiveLayout', () => ({
  screenInfo: writable({
    deviceType: 'desktop',
    screenSize: 'lg',
    orientation: 'landscape'
  })
}));

vi.mock('$lib/utils/touchInteractions', () => ({
  triggerHaptic: vi.fn()
}));

describe('ErrorDisplay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Empty State', () => {
    it('should show no errors message when no errors exist', () => {
      render(ErrorDisplay);
      
      expect(screen.getByText('All Clear')).toBeInTheDocument();
      expect(screen.getByText('No active errors to display.')).toBeInTheDocument();
      expect(screen.getByText('✅')).toBeInTheDocument();
    });

    it('should show different message when showResolved is true', () => {
      render(ErrorDisplay, { showResolved: true });
      
      expect(screen.getByText('No Errors')).toBeInTheDocument();
      expect(screen.getByText('No errors have been recorded.')).toBeInTheDocument();
    });
  });

  describe('Error List', () => {
    it('should display errors when present', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          type: 'network',
          severity: 'medium',
          message: 'Network request failed',
          userMessage: 'Connection failed. Please try again.',
          timestamp: Date.now(),
          resolved: false,
          retryable: true,
          retryCount: 0,
          maxRetries: 3,
          actionable: []
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Connection failed. Please try again.')).toBeInTheDocument();
        expect(screen.getByText('🌐')).toBeInTheDocument(); // Network icon
        expect(screen.getByText('⚠️')).toBeInTheDocument(); // Medium severity icon
      });
    });

    it('should show error summary for multiple errors', async () => {
      const { unresolvedErrors, criticalErrors } = await import('$lib/utils/errorManager');
      
      unresolvedErrors.set([
        { id: '1', severity: 'medium', resolved: false },
        { id: '2', severity: 'low', resolved: false }
      ]);
      
      criticalErrors.set([
        { id: '3', severity: 'critical', resolved: false }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('1')).toBeInTheDocument(); // Critical count
        expect(screen.getByText('2')).toBeInTheDocument(); // Active count
        expect(screen.getByText('Critical')).toBeInTheDocument();
        expect(screen.getByText('Active')).toBeInTheDocument();
      });
    });
  });

  describe('Error Filtering', () => {
    it('should filter by severity', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          severity: 'high',
          message: 'High severity error',
          resolved: false
        },
        {
          id: 'error-2',
          severity: 'low',
          message: 'Low severity error',
          resolved: false
        }
      ]);
      
      render(ErrorDisplay, { filterSeverity: ['high'] });
      
      await waitFor(() => {
        expect(screen.getByText('High severity error')).toBeInTheDocument();
        expect(screen.queryByText('Low severity error')).not.toBeInTheDocument();
      });
    });

    it('should filter by type', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          type: 'network',
          message: 'Network error',
          resolved: false
        },
        {
          id: 'error-2',
          type: 'validation',
          message: 'Validation error',
          resolved: false
        }
      ]);
      
      render(ErrorDisplay, { filterType: ['network'] });
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
        expect(screen.queryByText('Validation error')).not.toBeInTheDocument();
      });
    });

    it('should limit number of displayed errors', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      const manyErrors = Array.from({ length: 15 }, (_, i) => ({
        id: `error-${i}`,
        message: `Error ${i}`,
        severity: 'medium',
        resolved: false,
        timestamp: Date.now() - i * 1000
      }));
      
      errors.set(manyErrors);
      
      render(ErrorDisplay, { maxErrors: 5 });
      
      await waitFor(() => {
        expect(screen.getByText('Showing 5 of 15 errors')).toBeInTheDocument();
      });
    });
  });

  describe('Error Actions', () => {
    it('should show retry button for retryable errors', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Retryable error',
          retryable: true,
          retryCount: 0,
          maxRetries: 3,
          resolved: false,
          actionable: [
            {
              id: 'retry',
              label: 'Retry',
              type: 'retry',
              primary: true
            }
          ]
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
      });
    });

    it('should handle retry button clicks', async () => {
      const { errors, retryError } = await import('$lib/utils/errorManager');
      const { triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Retryable error',
          retryable: true,
          retryCount: 0,
          maxRetries: 3,
          resolved: false,
          actionable: [
            {
              id: 'retry',
              label: 'Retry',
              type: 'retry',
              primary: true
            }
          ]
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
        
        expect(triggerHaptic).toHaveBeenCalledWith({ type: 'medium' });
        expect(retryError).toHaveBeenCalledWith('error-1');
      });
    });

    it('should show dismiss button', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Dismissible error',
          resolved: false,
          actionable: [
            {
              id: 'dismiss',
              label: 'Dismiss',
              type: 'dismiss'
            }
          ]
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Dismiss')).toBeInTheDocument();
      });
    });

    it('should handle dismiss button clicks', async () => {
      const { errors, resolveError } = await import('$lib/utils/errorManager');
      const { triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Dismissible error',
          resolved: false,
          actionable: [
            {
              id: 'dismiss',
              label: 'Dismiss',
              type: 'dismiss'
            }
          ]
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        const dismissButton = screen.getByText('Dismiss');
        fireEvent.click(dismissButton);
        
        expect(triggerHaptic).toHaveBeenCalledWith({ type: 'light' });
        expect(resolveError).toHaveBeenCalledWith('error-1');
      });
    });
  });

  describe('Error Details', () => {
    it('should show expand toggle for errors with details', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Error with details',
          details: 'Detailed error information',
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Toggle error details')).toBeInTheDocument();
        expect(screen.getByText('▶')).toBeInTheDocument();
      });
    });

    it('should expand error details when clicked', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Error with details',
          details: 'Detailed error information',
          context: { component: 'TestComponent' },
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        const expandButton = screen.getByLabelText('Toggle error details');
        fireEvent.click(expandButton);
        
        expect(screen.getByText('▼')).toBeInTheDocument();
        expect(screen.getByText('Details')).toBeInTheDocument();
        expect(screen.getByText('Detailed error information')).toBeInTheDocument();
        expect(screen.getByText('Context')).toBeInTheDocument();
      });
    });
  });

  describe('Error Metadata', () => {
    it('should show error timestamp', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      const now = Date.now();
      
      errors.set([
        {
          id: 'error-1',
          message: 'Recent error',
          timestamp: now - 30000, // 30 seconds ago
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Just now')).toBeInTheDocument();
      });
    });

    it('should show retry count', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Retried error',
          retryCount: 2,
          maxRetries: 3,
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Retry 2/3')).toBeInTheDocument();
      });
    });

    it('should show error code', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Coded error',
          code: 'ERR_001',
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('ERR_001')).toBeInTheDocument();
      });
    });
  });

  describe('Bulk Actions', () => {
    it('should show resolve all button for multiple unresolved errors', async () => {
      const { unresolvedErrors } = await import('$lib/utils/errorManager');
      
      unresolvedErrors.set([
        { id: 'error-1', resolved: false },
        { id: 'error-2', resolved: false }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Resolve All')).toBeInTheDocument();
      });
    });

    it('should handle resolve all button clicks', async () => {
      const { unresolvedErrors, resolveError } = await import('$lib/utils/errorManager');
      
      unresolvedErrors.set([
        { id: 'error-1', resolved: false },
        { id: 'error-2', resolved: false }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        const resolveAllButton = screen.getByText('Resolve All');
        fireEvent.click(resolveAllButton);
        
        expect(resolveError).toHaveBeenCalledWith('error-1');
        expect(resolveError).toHaveBeenCalledWith('error-2');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to compact mode', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Test error',
          resolved: false,
          actionable: [
            { id: 'action1', label: 'Action 1', type: 'custom' },
            { id: 'action2', label: 'Action 2', type: 'custom' }
          ]
        }
      ]);
      
      render(ErrorDisplay, { compact: true });
      
      await waitFor(() => {
        // Actions should be in column layout in compact mode
        const actions = document.querySelector('.error-actions');
        expect(actions).toHaveClass('flex-col');
      });
    });

    it('should adapt to mobile screen size', async () => {
      const { screenInfo } = await import('$lib/utils/responsiveLayout');
      screenInfo.set({
        deviceType: 'phone',
        screenSize: 'sm',
        orientation: 'portrait'
      });
      
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Mobile error',
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        expect(screen.getByText('Mobile error')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Accessible error',
          resolved: false
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        const expandButton = screen.queryByLabelText('Toggle error details');
        if (expandButton) {
          expect(expandButton).toHaveAttribute('aria-label');
        }
      });
    });

    it('should be keyboard navigable', async () => {
      const { errors } = await import('$lib/utils/errorManager');
      
      errors.set([
        {
          id: 'error-1',
          message: 'Keyboard accessible error',
          resolved: false,
          actionable: [
            {
              id: 'dismiss',
              label: 'Dismiss',
              type: 'dismiss'
            }
          ]
        }
      ]);
      
      render(ErrorDisplay);
      
      await waitFor(() => {
        const dismissButton = screen.getByText('Dismiss');
        expect(dismissButton).toHaveAttribute('tabindex');
      });
    });
  });
});