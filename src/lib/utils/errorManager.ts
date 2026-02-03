/**
 * Error Manager
 * Centralized error handling, logging, and user notification system
 */

import { browser } from '$app/environment';
import { writable, derived } from 'svelte/store';

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  code?: string;
  message: string;
  details?: string;
  context?: ErrorContext;
  timestamp: number;
  resolved: boolean;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
  userMessage?: string;
  actionable?: ErrorAction[];
}

export type ErrorType = 
  | 'connection'
  | 'protocol'
  | 'hardware'
  | 'validation'
  | 'network'
  | 'storage'
  | 'permission'
  | 'timeout'
  | 'unknown';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  component?: string;
  operation?: string;
  cameraId?: string;
  userId?: string;
  sessionId?: string;
  url?: string;
  userAgent?: string;
  timestamp?: number;
  stackTrace?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorAction {
  id: string;
  label: string;
  type: 'retry' | 'navigate' | 'reload' | 'dismiss' | 'contact' | 'custom';
  handler?: () => void | Promise<void>;
  primary?: boolean;
}

export interface NotificationOptions {
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  duration?: number; // milliseconds, 0 for persistent
  actions?: ErrorAction[];
  dismissible?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center';
  showIcon?: boolean;
  showProgress?: boolean;
}

export interface Notification extends NotificationOptions {
  id: string;
  timestamp: number;
  dismissed: boolean;
  progress?: number;
}

// CAP Protocol Error Codes
const CAP_ERROR_CODES: Record<string, { message: string; userMessage: string; severity: ErrorSeverity; retryable: boolean }> = {
  'CAP_001': {
    message: 'Camera connection timeout',
    userMessage: 'Unable to connect to camera. Check network connection and camera IP address.',
    severity: 'high',
    retryable: true
  },
  'CAP_002': {
    message: 'Invalid CAP command',
    userMessage: 'Camera command failed. The camera may not support this operation.',
    severity: 'medium',
    retryable: false
  },
  'CAP_003': {
    message: 'Camera authentication failed',
    userMessage: 'Camera authentication failed. Check camera credentials.',
    severity: 'high',
    retryable: true
  },
  'CAP_004': {
    message: 'Camera busy',
    userMessage: 'Camera is busy. Please wait and try again.',
    severity: 'medium',
    retryable: true
  },
  'CAP_005': {
    message: 'Unsupported camera firmware',
    userMessage: 'Camera firmware version is not supported. Please update camera firmware.',
    severity: 'high',
    retryable: false
  },
  'CAP_006': {
    message: 'Network connection lost',
    userMessage: 'Connection to camera lost. Attempting to reconnect...',
    severity: 'high',
    retryable: true
  },
  'CAP_007': {
    message: 'Invalid parameter value',
    userMessage: 'Invalid setting value. Please check the input and try again.',
    severity: 'medium',
    retryable: false
  },
  'CAP_008': {
    message: 'Camera hardware error',
    userMessage: 'Camera hardware error detected. Please check camera status.',
    severity: 'critical',
    retryable: false
  },
  'CAP_009': {
    message: 'Operation timeout',
    userMessage: 'Operation timed out. Camera may be unresponsive.',
    severity: 'medium',
    retryable: true
  },
  'CAP_010': {
    message: 'Insufficient permissions',
    userMessage: 'Insufficient permissions to perform this operation.',
    severity: 'medium',
    retryable: false
  }
};

class ErrorManager {
  private errors: Map<string, AppError> = new Map();
  private notifications: Map<string, Notification> = new Map();
  private errorListeners: ((error: AppError) => void)[] = [];
  private notificationListeners: ((notification: Notification) => void)[] = [];
  private maxErrors = 100;
  private maxNotifications = 10;

  /**
   * Initialize error manager
   */
  initialize(): void {
    if (!browser) return;

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
    
    // Set up unhandled promise rejection handler
    this.setupPromiseRejectionHandler();
    
    // Set up console error interception
    this.setupConsoleErrorInterception();
    
    console.log('Error manager initialized');
  }

  /**
   * Create and track an error
   */
  createError(
    type: ErrorType,
    message: string,
    options: Partial<Omit<AppError, 'id' | 'type' | 'message' | 'timestamp' | 'resolved' | 'retryCount'>> = {}
  ): AppError {
    const id = this.generateId();
    const error: AppError = {
      id,
      type,
      message,
      severity: options.severity || 'medium',
      code: options.code,
      details: options.details,
      context: this.enrichContext(options.context),
      timestamp: Date.now(),
      resolved: false,
      retryable: options.retryable ?? true,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      userMessage: options.userMessage,
      actionable: options.actionable || []
    };

    // Enhance error with CAP protocol information if applicable
    if (error.code && CAP_ERROR_CODES[error.code]) {
      const capError = CAP_ERROR_CODES[error.code];
      error.userMessage = error.userMessage || capError.userMessage;
      error.severity = capError.severity;
      error.retryable = capError.retryable;
    }

    // Add default actions
    error.actionable = this.addDefaultActions(error);

    this.errors.set(id, error);
    this.notifyErrorListeners(error);

    // Limit error history
    if (this.errors.size > this.maxErrors) {
      const oldestId = Array.from(this.errors.keys())[0];
      this.errors.delete(oldestId);
    }

    // Log error
    this.logError(error);

    return error;
  }

  /**
   * Handle CAP protocol errors
   */
  handleCAPError(code: string, details?: string, context?: ErrorContext): AppError {
    const capError = CAP_ERROR_CODES[code];
    if (!capError) {
      return this.createError('protocol', `Unknown CAP error: ${code}`, {
        code,
        details,
        context,
        severity: 'medium',
        userMessage: 'An unknown camera error occurred. Please try again.'
      });
    }

    return this.createError('protocol', capError.message, {
      code,
      details,
      context,
      severity: capError.severity,
      retryable: capError.retryable,
      userMessage: capError.userMessage
    });
  }

  /**
   * Handle connection errors
   */
  handleConnectionError(message: string, context?: ErrorContext): AppError {
    return this.createError('connection', message, {
      context,
      severity: 'high',
      retryable: true,
      userMessage: 'Connection failed. Check your network and camera settings.',
      actionable: [
        {
          id: 'retry-connection',
          label: 'Retry Connection',
          type: 'retry',
          primary: true
        },
        {
          id: 'check-settings',
          label: 'Check Settings',
          type: 'navigate',
          handler: () => window.location.href = '/settings'
        }
      ]
    });
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field: string, value: any, message: string): AppError {
    return this.createError('validation', `Validation failed for ${field}`, {
      details: message,
      context: { field, value },
      severity: 'low',
      retryable: false,
      userMessage: message
    });
  }

  /**
   * Retry an error
   */
  async retryError(errorId: string): Promise<boolean> {
    const error = this.errors.get(errorId);
    if (!error || !error.retryable || error.retryCount >= error.maxRetries) {
      return false;
    }

    error.retryCount++;
    this.errors.set(errorId, error);

    // Implement retry logic based on error type
    try {
      const success = await this.executeRetry(error);
      if (success) {
        this.resolveError(errorId);
      }
      return success;
    } catch (retryError) {
      console.error('Retry failed:', retryError);
      return false;
    }
  }

  /**
   * Resolve an error
   */
  resolveError(errorId: string): void {
    const error = this.errors.get(errorId);
    if (error) {
      error.resolved = true;
      this.errors.set(errorId, error);
    }
  }

  /**
   * Get all errors
   */
  getErrors(): AppError[] {
    return Array.from(this.errors.values()).sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get unresolved errors
   */
  getUnresolvedErrors(): AppError[] {
    return this.getErrors().filter(error => !error.resolved);
  }

  /**
   * Clear resolved errors
   */
  clearResolvedErrors(): void {
    for (const [id, error] of this.errors.entries()) {
      if (error.resolved) {
        this.errors.delete(id);
      }
    }
  }

  /**
   * Show notification
   */
  showNotification(options: NotificationOptions): string {
    const id = this.generateId();
    const notification: Notification = {
      ...options,
      id,
      timestamp: Date.now(),
      dismissed: false,
      duration: options.duration ?? (options.type === 'error' ? 0 : 5000),
      dismissible: options.dismissible ?? true,
      position: options.position || 'top-right',
      showIcon: options.showIcon ?? true,
      showProgress: options.showProgress ?? (options.duration ? options.duration > 0 : false)
    };

    this.notifications.set(id, notification);
    this.notifyNotificationListeners(notification);

    // Auto-dismiss if duration is set
    if (notification.duration && notification.duration > 0) {
      setTimeout(() => {
        this.dismissNotification(id);
      }, notification.duration);
    }

    // Limit notification count
    if (this.notifications.size > this.maxNotifications) {
      const oldestId = Array.from(this.notifications.keys())[0];
      this.dismissNotification(oldestId);
    }

    return id;
  }

  /**
   * Show success notification
   */
  showSuccess(title: string, message: string, duration = 3000): string {
    return this.showNotification({
      title,
      message,
      type: 'success',
      duration
    });
  }

  /**
   * Show info notification
   */
  showInfo(title: string, message: string, duration = 5000): string {
    return this.showNotification({
      title,
      message,
      type: 'info',
      duration
    });
  }

  /**
   * Show warning notification
   */
  showWarning(title: string, message: string, duration = 7000): string {
    return this.showNotification({
      title,
      message,
      type: 'warning',
      duration
    });
  }

  /**
   * Show error notification
   */
  showError(title: string, message: string, actions?: ErrorAction[]): string {
    return this.showNotification({
      title,
      message,
      type: 'error',
      duration: 0, // Persistent
      actions
    });
  }

  /**
   * Dismiss notification
   */
  dismissNotification(notificationId: string): void {
    const notification = this.notifications.get(notificationId);
    if (notification) {
      notification.dismissed = true;
      this.notifications.delete(notificationId);
    }
  }

  /**
   * Get active notifications
   */
  getNotifications(): Notification[] {
    return Array.from(this.notifications.values())
      .filter(n => !n.dismissed)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Subscribe to error events
   */
  onError(listener: (error: AppError) => void): () => void {
    this.errorListeners.push(listener);
    return () => {
      const index = this.errorListeners.indexOf(listener);
      if (index > -1) {
        this.errorListeners.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to notification events
   */
  onNotification(listener: (notification: Notification) => void): () => void {
    this.notificationListeners.push(listener);
    return () => {
      const index = this.notificationListeners.indexOf(listener);
      if (index > -1) {
        this.notificationListeners.splice(index, 1);
      }
    };
  }

  // Private methods

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private enrichContext(context?: ErrorContext): ErrorContext {
    const enriched: ErrorContext = {
      ...context,
      timestamp: Date.now(),
      url: browser ? window.location.href : undefined,
      userAgent: browser ? navigator.userAgent : undefined
    };

    return enriched;
  }

  private addDefaultActions(error: AppError): ErrorAction[] {
    const actions = [...(error.actionable || [])];

    // Add retry action for retryable errors
    if (error.retryable && error.retryCount < error.maxRetries) {
      actions.unshift({
        id: 'retry',
        label: 'Retry',
        type: 'retry',
        handler: () => this.retryError(error.id),
        primary: true
      });
    }

    // Add dismiss action
    actions.push({
      id: 'dismiss',
      label: 'Dismiss',
      type: 'dismiss',
      handler: () => this.resolveError(error.id)
    });

    return actions;
  }

  private async executeRetry(error: AppError): Promise<boolean> {
    // Implement retry logic based on error type
    switch (error.type) {
      case 'connection':
        return this.retryConnection(error);
      case 'protocol':
        return this.retryProtocolOperation(error);
      case 'network':
        return this.retryNetworkOperation(error);
      default:
        return false;
    }
  }

  private async retryConnection(error: AppError): Promise<boolean> {
    // Implement connection retry logic
    console.log('Retrying connection...', error);
    // This would integrate with the actual connection manager
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() > 0.3), 2000);
    });
  }

  private async retryProtocolOperation(error: AppError): Promise<boolean> {
    // Implement protocol operation retry logic
    console.log('Retrying protocol operation...', error);
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() > 0.5), 1000);
    });
  }

  private async retryNetworkOperation(error: AppError): Promise<boolean> {
    // Implement network operation retry logic
    console.log('Retrying network operation...', error);
    return new Promise(resolve => {
      setTimeout(() => resolve(Math.random() > 0.4), 1500);
    });
  }

  private logError(error: AppError): void {
    const logLevel = this.getLogLevel(error.severity);
    const logMessage = `[${error.type.toUpperCase()}] ${error.message}`;
    const logData = {
      id: error.id,
      code: error.code,
      details: error.details,
      context: error.context
    };

    switch (logLevel) {
      case 'error':
        console.error(logMessage, logData);
        break;
      case 'warn':
        console.warn(logMessage, logData);
        break;
      case 'info':
        console.info(logMessage, logData);
        break;
      default:
        console.log(logMessage, logData);
    }
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'info' | 'log' {
    switch (severity) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warn';
      case 'low':
        return 'info';
      default:
        return 'log';
    }
  }

  private notifyErrorListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error listener failed:', err);
      }
    });
  }

  private notifyNotificationListeners(notification: Notification): void {
    this.notificationListeners.forEach(listener => {
      try {
        listener(notification);
      } catch (err) {
        console.error('Notification listener failed:', err);
      }
    });
  }

  private setupGlobalErrorHandlers(): void {
    window.addEventListener('error', (event) => {
      this.createError('unknown', event.message, {
        details: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
        context: {
          stackTrace: event.error?.stack
        },
        severity: 'medium'
      });
    });
  }

  private setupPromiseRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      this.createError('unknown', 'Unhandled promise rejection', {
        details: event.reason?.message || String(event.reason),
        context: {
          stackTrace: event.reason?.stack
        },
        severity: 'medium'
      });
    });
  }

  private setupConsoleErrorInterception(): void {
    const originalError = console.error;
    console.error = (...args) => {
      // Call original console.error
      originalError.apply(console, args);
      
      // Create error for tracking
      const message = args.map(arg => 
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');
      
      this.createError('unknown', 'Console error', {
        details: message,
        severity: 'low'
      });
    };
  }
}

// Create singleton instance
export const errorManager = new ErrorManager();

// Create reactive stores
function createErrorStore() {
  const { subscribe, set, update } = writable<AppError[]>([]);

  errorManager.onError(() => {
    set(errorManager.getErrors());
  });

  return {
    subscribe,
    refresh: () => set(errorManager.getErrors())
  };
}

function createNotificationStore() {
  const { subscribe, set, update } = writable<Notification[]>([]);

  errorManager.onNotification(() => {
    set(errorManager.getNotifications());
  });

  return {
    subscribe,
    refresh: () => set(errorManager.getNotifications())
  };
}

export const errors = createErrorStore();
export const notifications = createNotificationStore();

// Derived stores
export const unresolvedErrors = derived(errors, $errors => 
  $errors.filter(error => !error.resolved)
);

export const criticalErrors = derived(errors, $errors => 
  $errors.filter(error => error.severity === 'critical' && !error.resolved)
);

export const hasErrors = derived(unresolvedErrors, $errors => $errors.length > 0);
export const hasCriticalErrors = derived(criticalErrors, $errors => $errors.length > 0);

// Utility functions
export function createError(
  type: ErrorType,
  message: string,
  options?: Partial<Omit<AppError, 'id' | 'type' | 'message' | 'timestamp' | 'resolved' | 'retryCount'>>
): AppError {
  return errorManager.createError(type, message, options);
}

export function handleCAPError(code: string, details?: string, context?: ErrorContext): AppError {
  return errorManager.handleCAPError(code, details, context);
}

export function handleConnectionError(message: string, context?: ErrorContext): AppError {
  return errorManager.handleConnectionError(message, context);
}

export function handleValidationError(field: string, value: any, message: string): AppError {
  return errorManager.handleValidationError(field, value, message);
}

export function showNotification(options: NotificationOptions): string {
  return errorManager.showNotification(options);
}

export function showSuccess(title: string, message: string, duration?: number): string {
  return errorManager.showSuccess(title, message, duration);
}

export function showInfo(title: string, message: string, duration?: number): string {
  return errorManager.showInfo(title, message, duration);
}

export function showWarning(title: string, message: string, duration?: number): string {
  return errorManager.showWarning(title, message, duration);
}

export function showError(title: string, message: string, actions?: ErrorAction[]): string {
  return errorManager.showError(title, message, actions);
}

export function dismissNotification(id: string): void {
  return errorManager.dismissNotification(id);
}

export function retryError(errorId: string): Promise<boolean> {
  return errorManager.retryError(errorId);
}

export function resolveError(errorId: string): void {
  return errorManager.resolveError(errorId);
}

export function handleNetworkError(message: string, context?: ErrorContext): AppError {
  return errorManager.createError('network', message, {
    context,
    severity: 'high',
    retryable: true,
    userMessage: 'Network error occurred. Check your internet connection.',
    actionable: [
      {
        id: 'retry-network',
        label: 'Retry',
        type: 'retry',
        primary: true
      }
    ]
  });
}