/**
 * NotificationToast Component Tests
 * Tests for the notification toast system
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import NotificationToast from '../NotificationToast.svelte';

// Mock dependencies
vi.mock('$lib/utils/errorManager', () => {
  const mockNotifications = writable([]);
  
  return {
    notifications: mockNotifications,
    dismissNotification: vi.fn()
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

describe('NotificationToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render nothing when no notifications', () => {
      render(NotificationToast);
      
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('should render notifications when present', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'success',
          title: 'Success',
          message: 'Operation completed',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByText('Success')).toBeInTheDocument();
        expect(screen.getByText('Operation completed')).toBeInTheDocument();
      });
    });

    it('should show appropriate icons for notification types', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'success-1',
          type: 'success',
          title: 'Success',
          message: 'Success message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByText('✅')).toBeInTheDocument();
      });
    });
  });

  describe('Notification Types', () => {
    it('should render success notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'success-1',
          type: 'success',
          title: 'Success',
          message: 'Success message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toHaveClass('bg-green-600');
        expect(screen.getByText('✅')).toBeInTheDocument();
      });
    });

    it('should render error notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'error-1',
          type: 'error',
          title: 'Error',
          message: 'Error message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toHaveClass('bg-red-600');
        expect(screen.getByText('❌')).toBeInTheDocument();
      });
    });

    it('should render warning notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'warning-1',
          type: 'warning',
          title: 'Warning',
          message: 'Warning message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toHaveClass('bg-yellow-600');
        expect(screen.getByText('⚠️')).toBeInTheDocument();
      });
    });

    it('should render info notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'info-1',
          type: 'info',
          title: 'Info',
          message: 'Info message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toHaveClass('bg-blue-600');
        expect(screen.getByText('ℹ️')).toBeInTheDocument();
      });
    });
  });

  describe('Dismissal', () => {
    it('should show dismiss button for dismissible notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Test',
          message: 'Test message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByLabelText('Dismiss notification')).toBeInTheDocument();
      });
    });

    it('should not show dismiss button for non-dismissible notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Test',
          message: 'Test message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: false,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.queryByLabelText('Dismiss notification')).not.toBeInTheDocument();
      });
    });

    it('should handle dismiss button clicks', async () => {
      const { notifications, dismissNotification } = await import('$lib/utils/errorManager');
      const { triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Test',
          message: 'Test message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const dismissButton = screen.getByLabelText('Dismiss notification');
        fireEvent.click(dismissButton);
        
        expect(triggerHaptic).toHaveBeenCalledWith({ type: 'light' });
        expect(dismissNotification).toHaveBeenCalledWith('test-1');
      });
    });
  });

  describe('Actions', () => {
    it('should render action buttons', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'error',
          title: 'Error',
          message: 'Error message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          actions: [
            {
              id: 'retry',
              label: 'Retry',
              type: 'retry',
              handler: vi.fn(),
              primary: true
            },
            {
              id: 'cancel',
              label: 'Cancel',
              type: 'dismiss',
              handler: vi.fn()
            }
          ]
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
      });
    });

    it('should handle action button clicks', async () => {
      const mockHandler = vi.fn();
      const { notifications } = await import('$lib/utils/errorManager');
      const { triggerHaptic } = await import('$lib/utils/touchInteractions');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'error',
          title: 'Error',
          message: 'Error message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          actions: [
            {
              id: 'retry',
              label: 'Retry',
              type: 'retry',
              handler: mockHandler,
              primary: true
            }
          ]
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
        
        expect(triggerHaptic).toHaveBeenCalledWith({ type: 'selection' });
        expect(mockHandler).toHaveBeenCalled();
      });
    });

    it('should handle action handler failures', async () => {
      const mockHandler = vi.fn().mockImplementation(() => {
        throw new Error('Action failed');
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'error',
          title: 'Error',
          message: 'Error message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          actions: [
            {
              id: 'retry',
              label: 'Retry',
              type: 'retry',
              handler: mockHandler
            }
          ]
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);
        
        expect(mockHandler).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalledWith('Action handler failed:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Progress Bar', () => {
    it('should show progress bar when showProgress is true', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Loading',
          message: 'Please wait...',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          showProgress: true,
          duration: 5000,
          progress: 50
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByText('5s')).toBeInTheDocument();
        const progressBar = document.querySelector('.progress-fill');
        expect(progressBar).toHaveStyle('width: 50%');
      });
    });

    it('should not show progress bar when showProgress is false', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Info message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          showProgress: false
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(document.querySelector('.progress-bar')).not.toBeInTheDocument();
      });
    });
  });

  describe('Pause/Resume', () => {
    it('should show pause button for timed notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Info message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          duration: 5000
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByTitle('Pause')).toBeInTheDocument();
        expect(screen.getByText('⏸️')).toBeInTheDocument();
      });
    });

    it('should toggle pause/resume state', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Info message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          duration: 5000
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const pauseButton = screen.getByTitle('Pause');
        fireEvent.click(pauseButton);
        
        // Should show resume button after pause
        expect(screen.getByTitle('Resume')).toBeInTheDocument();
        expect(screen.getByText('▶️')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Notifications', () => {
    it('should show dismiss all button with multiple notifications', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info 1',
          message: 'Message 1',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        },
        {
          id: 'test-2',
          type: 'info',
          title: 'Info 2',
          message: 'Message 2',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.getByText('Dismiss All (2)')).toBeInTheDocument();
      });
    });

    it('should not show dismiss all button with single notification', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        expect(screen.queryByText(/Dismiss All/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt to mobile layout', async () => {
      const { screenInfo } = await import('$lib/utils/responsiveLayout');
      screenInfo.set({
        deviceType: 'phone',
        screenSize: 'sm',
        orientation: 'portrait'
      });
      
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true,
          actions: [
            {
              id: 'action1',
              label: 'Action 1',
              type: 'custom',
              handler: vi.fn()
            },
            {
              id: 'action2',
              label: 'Action 2',
              type: 'custom',
              handler: vi.fn()
            }
          ]
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        // Actions should be in column layout on mobile
        const actions = document.querySelector('.notification-actions');
        expect(actions).toHaveClass('flex-col');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const notification = screen.getByRole('alert');
        expect(notification).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should be keyboard navigable', async () => {
      const { notifications } = await import('$lib/utils/errorManager');
      
      notifications.set([
        {
          id: 'test-1',
          type: 'info',
          title: 'Info',
          message: 'Message',
          timestamp: Date.now(),
          dismissed: false,
          dismissible: true,
          showIcon: true
        }
      ]);
      
      render(NotificationToast);
      
      await waitFor(() => {
        const dismissButton = screen.getByLabelText('Dismiss notification');
        expect(dismissButton).toHaveAttribute('tabindex');
      });
    });
  });
});