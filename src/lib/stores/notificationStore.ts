/**
 * Notification Store
 * Reactive store for managing application notifications
 */

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

export interface NotificationOptions {
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number; // milliseconds, 0 for persistent
  actions?: Array<{
    label: string;
    action: () => void;
    style?: 'primary' | 'secondary';
  }>;
  dismissible?: boolean;
  showProgress?: boolean;
  icon?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
}

export interface Notification extends NotificationOptions {
  id: string;
  createdAt: number;
  dismissed: boolean;
  progress?: number;
}

function createNotificationStore() {
  const { subscribe, set, update } = writable<Notification[]>([]);

  let notificationCounter = 0;
  const maxNotifications = 5;

  function generateId(): string {
    return `notification_${Date.now()}_${++notificationCounter}`;
  }

  function show(options: NotificationOptions): string {
    const id = generateId();
    const notification: Notification = {
      id,
      createdAt: Date.now(),
      dismissed: false,
      duration: options.duration ?? (options.type === 'error' ? 0 : 5000),
      dismissible: options.dismissible ?? true,
      showProgress: options.showProgress ?? (options.duration ? options.duration > 0 : false),
      position: options.position || 'top-right',
      ...options
    };

    update(notifications => {
      const newNotifications = [notification, ...notifications];
      
      // Limit number of notifications
      if (newNotifications.length > maxNotifications) {
        return newNotifications.slice(0, maxNotifications);
      }
      
      return newNotifications;
    });

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, notification.duration);
    }

    return id;
  }

  function dismiss(id: string): void {
    update(notifications => 
      notifications.filter(notification => notification.id !== id)
    );
  }

  function dismissAll(): void {
    set([]);
  }

  function success(title: string, message: string, duration = 3000): string {
    return show({
      type: 'success',
      title,
      message,
      duration
    });
  }

  function info(title: string, message: string, duration = 5000): string {
    return show({
      type: 'info',
      title,
      message,
      duration
    });
  }

  function warning(title: string, message: string, duration = 7000): string {
    return show({
      type: 'warning',
      title,
      message,
      duration
    });
  }

  function error(title: string, message: string, actions?: NotificationOptions['actions']): string {
    return show({
      type: 'error',
      title,
      message,
      duration: 0, // Persistent
      actions
    });
  }

  return {
    subscribe,
    show,
    dismiss,
    dismissAll,
    success,
    info,
    warning,
    error
  };
}

export const notificationStore = createNotificationStore();

// Derived stores
export const activeNotifications = derived(
  notificationStore,
  $notifications => $notifications.filter(n => !n.dismissed)
);

export const hasNotifications = derived(
  activeNotifications,
  $notifications => $notifications.length > 0
);

export const errorNotifications = derived(
  activeNotifications,
  $notifications => $notifications.filter(n => n.type === 'error')
);

export const hasErrors = derived(
  errorNotifications,
  $notifications => $notifications.length > 0
);