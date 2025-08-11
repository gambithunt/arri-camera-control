/**
 * Error Manager Tests
 * Comprehensive tests for error handling, logging, and notifications
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { get } from 'svelte/store';
import { 
  errorManager, 
  createError, 
  handleCAPError, 
  handleConnectionError, 
  handleValidationError,
  showNotification,
  showSuccess,
  showInfo,
  showWarning,
  showError,
  retryError,
  resolveError,
  errors,
  notifications,
  unresolvedErrors,
  criticalErrors,
  hasErrors,
  type AppError,
  type ErrorType,
  type ErrorSeverity,
  type NotificationOptions
} from '../errorManager';

// Mock browser environment
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000/test'
  },
  writable: true
});

Object.defineProperty(navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Test Browser)',
  writable: true
});

// Mock console methods
const originalConsole = {
  error: console.error,
  warn: console.warn,
  info: console.info,
  log: console.log
};

describe('ErrorManager', () => {
  beforeEach(() => {
    // Reset error manager state
    errorManager.clearResolvedErrors();
    
    // Mock console methods
    console.error = vi.fn();
    console.warn = vi.fn();
    console.info = vi.fn();
    console.log = vi.fn();
    
    // Initialize error manager
    errorManager.initialize();
  });

  afterEach(() => {
    // Restore console methods
    Object.assign(console, originalConsole);
    
    // Clear all errors and notifications
    errorManager.clearResolvedErrors();
  });

  describe('Error Creation', () => {
    it('should create a basic error', () => {
      const error = createError('network', 'Connection failed');
      
      expect(error).toMatchObject({
        type: 'network',
        message: 'Connection failed',
        severity: 'medium',
        resolved: false,
        retryable: true,
        retryCount: 0,
        maxRetries: 3
      });
      
      expect(error.id).toBeDefined();
      expect(error.timestamp).toBeDefined();
      expect(error.context).toBeDefined();
    });

    it('should create error with custom options', () => {
      const error = createError('validation', 'Invalid input', {
        severity: 'low',
        retryable: false,
        maxRetries: 0,
        userMessage: 'Please check your input',
        code: 'VALIDATION_001'
      });
      
      expect(error).toMatchObject({
        type: 'validation',
        message: 'Invalid input',
        severity: 'low',
        retryable: false,
        maxRetries: 0,
        userMessage: 'Please check your input',
        code: 'VALIDATION_001'
      });
    });

    it('should enrich error context', () => {
      const error = createError('connection', 'Test error', {
        context: {
          component: 'TestComponent',
          operation: 'testOperation'
        }
      });
      
      expect(error.context).toMatchObject({
        component: 'TestComponent',
        operation: 'testOperation',
        url: 'http://localhost:3000/test',
        userAgent: 'Mozilla/5.0 (Test Browser)'
      });
      
      expect(error.context?.timestamp).toBeDefined();
    });

    it('should add default actions', () => {
      const error = createError('network', 'Connection failed');
      
      expect(error.actionable).toHaveLength(2);
      expect(error.actionable?.[0]).toMatchObject({
        id: 'retry',
        label: 'Retry',
        type: 'retry',
        primary: true
      });
      expect(error.actionable?.[1]).toMatchObject({
        id: 'dismiss',
        label: 'Dismiss',
        type: 'dismiss'
      });
    });
  });

  describe('CAP Protocol Errors', () => {
    it('should handle known CAP error codes', () => {
      const error = handleCAPError('CAP_001', 'Connection timeout details');
      
      expect(error).toMatchObject({
        type: 'protocol',
        code: 'CAP_001',
        severity: 'high',
        retryable: true,
        userMessage: 'Unable to connect to camera. Check network connection and camera IP address.',
        details: 'Connection timeout details'
      });
    });

    it('should handle unknown CAP error codes', () => {
      const error = handleCAPError('CAP_999', 'Unknown error details');
      
      expect(error).toMatchObject({
        type: 'protocol',
        code: 'CAP_999',
        severity: 'medium',
        userMessage: 'An unknown camera error occurred. Please try again.',
        details: 'Unknown error details'
      });
    });

    it('should handle critical CAP errors', () => {
      const error = handleCAPError('CAP_008', 'Hardware malfunction');
      
      expect(error).toMatchObject({
        type: 'protocol',
        code: 'CAP_008',
        severity: 'critical',
        retryable: false,
        userMessage: 'Camera hardware error detected. Please check camera status.'
      });
    });
  });

  describe('Connection Errors', () => {
    it('should handle connection errors with default actions', () => {
      const error = handleConnectionError('Network unreachable');
      
      expect(error).toMatchObject({
        type: 'connection',
        message: 'Network unreachable',
        severity: 'high',
        retryable: true,
        userMessage: 'Connection failed. Check your network and camera settings.'
      });
      
      expect(error.actionable).toHaveLength(3); // retry, check settings, dismiss
      expect(error.actionable?.[1]).toMatchObject({
        id: 'check-settings',
        label: 'Check Settings',
        type: 'navigate'
      });
    });
  });

  describe('Validation Errors', () => {
    it('should handle validation errors', () => {
      const error = handleValidationError('frameRate', '999', 'Frame rate must be between 1 and 120');
      
      expect(error).toMatchObject({
        type: 'validation',
        message: 'Validation failed for frameRate',
        severity: 'low',
        retryable: false,
        userMessage: 'Frame rate must be between 1 and 120'
      });
      
      expect(error.context).toMatchObject({
        field: 'frameRate',
        value: '999'
      });
    });
  });

  describe('Error Retry Logic', () => {
    it('should retry retryable errors', async () => {
      const error = createError('network', 'Request failed', { retryable: true });
      
      // Mock successful retry
      vi.spyOn(errorManager as any, 'executeRetry').mockResolvedValue(true);
      
      const success = await retryError(error.id);
      
      expect(success).toBe(true);
      expect(get(errors).find(e => e.id === error.id)?.resolved).toBe(true);
    });

    it('should not retry non-retryable errors', async () => {
      const error = createError('validation', 'Invalid input', { retryable: false });
      
      const success = await retryError(error.id);
      
      expect(success).toBe(false);
    });

    it('should not retry errors that exceeded max retries', async () => {
      const error = createError('network', 'Request failed', { 
        retryable: true, 
        maxRetries: 1 
      });
      
      // Simulate failed retries
      vi.spyOn(errorManager as any, 'executeRetry').mockResolvedValue(false);
      
      await retryError(error.id); // First retry
      const success = await retryError(error.id); // Second retry (should fail)
      
      expect(success).toBe(false);
    });
  });

  describe('Error Resolution', () => {
    it('should resolve errors', () => {
      const error = createError('network', 'Test error');
      
      resolveError(error.id);
      
      const resolvedError = get(errors).find(e => e.id === error.id);
      expect(resolvedError?.resolved).toBe(true);
    });
  });

  describe('Error Stores', () => {
    it('should update error stores when errors are created', () => {
      const initialErrors = get(errors);
      
      createError('network', 'Test error');
      
      const updatedErrors = get(errors);
      expect(updatedErrors.length).toBe(initialErrors.length + 1);
    });

    it('should filter unresolved errors', () => {
      const error1 = createError('network', 'Error 1');
      const error2 = createError('validation', 'Error 2');
      
      resolveError(error1.id);
      
      const unresolved = get(unresolvedErrors);
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].id).toBe(error2.id);
    });

    it('should filter critical errors', () => {
      createError('network', 'Normal error', { severity: 'medium' });
      createError('hardware', 'Critical error', { severity: 'critical' });
      
      const critical = get(criticalErrors);
      expect(critical).toHaveLength(1);
      expect(critical[0].severity).toBe('critical');
    });

    it('should indicate when errors exist', () => {
      expect(get(hasErrors)).toBe(false);
      
      createError('network', 'Test error');
      
      expect(get(hasErrors)).toBe(true);
    });
  });

  describe('Notifications', () => {
    it('should show success notification', () => {
      const id = showSuccess('Success', 'Operation completed');
      
      const activeNotifications = get(notifications);
      expect(activeNotifications).toHaveLength(1);
      expect(activeNotifications[0]).toMatchObject({
        type: 'success',
        title: 'Success',
        message: 'Operation completed',
        duration: 3000
      });
    });

    it('should show info notification', () => {
      const id = showInfo('Info', 'Information message');
      
      const activeNotifications = get(notifications);
      expect(activeNotifications).toHaveLength(1);
      expect(activeNotifications[0]).toMatchObject({
        type: 'info',
        title: 'Info',
        message: 'Information message',
        duration: 5000
      });
    });

    it('should show warning notification', () => {
      const id = showWarning('Warning', 'Warning message');
      
      const activeNotifications = get(notifications);
      expect(activeNotifications).toHaveLength(1);
      expect(activeNotifications[0]).toMatchObject({
        type: 'warning',
        title: 'Warning',
        message: 'Warning message',
        duration: 7000
      });
    });

    it('should show error notification', () => {
      const actions = [
        {
          id: 'retry',
          label: 'Retry',
          type: 'retry' as const,
          handler: vi.fn()
        }
      ];
      
      const id = showError('Error', 'Error message', actions);
      
      const activeNotifications = get(notifications);
      expect(activeNotifications).toHaveLength(1);
      expect(activeNotifications[0]).toMatchObject({
        type: 'error',
        title: 'Error',
        message: 'Error message',
        duration: 0, // Persistent
        actions
      });
    });

    it('should show custom notification', () => {
      const options: NotificationOptions = {
        type: 'info',
        title: 'Custom',
        message: 'Custom message',
        duration: 10000,
        dismissible: false,
        showProgress: true,
        position: 'bottom-right'
      };
      
      const id = showNotification(options);
      
      const activeNotifications = get(notifications);
      expect(activeNotifications).toHaveLength(1);
      expect(activeNotifications[0]).toMatchObject(options);
    });

    it('should limit number of notifications', () => {
      // Create more notifications than the limit
      for (let i = 0; i < 15; i++) {
        showInfo(`Info ${i}`, `Message ${i}`);
      }
      
      const activeNotifications = get(notifications);
      expect(activeNotifications.length).toBeLessThanOrEqual(10); // maxNotifications
    });
  });

  describe('Error Logging', () => {
    it('should log errors with appropriate levels', () => {
      createError('network', 'Critical error', { severity: 'critical' });
      createError('validation', 'High error', { severity: 'high' });
      createError('timeout', 'Medium error', { severity: 'medium' });
      createError('storage', 'Low error', { severity: 'low' });
      
      expect(console.error).toHaveBeenCalledTimes(2); // critical and high
      expect(console.warn).toHaveBeenCalledTimes(1); // medium
      expect(console.info).toHaveBeenCalledTimes(1); // low
    });

    it('should include error details in logs', () => {
      const error = createError('network', 'Test error', {
        code: 'NET_001',
        details: 'Connection timeout',
        context: { component: 'TestComponent' }
      });
      
      expect(console.warn).toHaveBeenCalledWith(
        '[NETWORK] Test error',
        expect.objectContaining({
          id: error.id,
          code: 'NET_001',
          details: 'Connection timeout',
          context: expect.objectContaining({
            component: 'TestComponent'
          })
        })
      );
    });
  });

  describe('Global Error Handling', () => {
    it('should handle global JavaScript errors', () => {
      const errorEvent = new ErrorEvent('error', {
        message: 'Global error',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
        error: new Error('Global error')
      });
      
      window.dispatchEvent(errorEvent);
      
      const errors = get(errorManager.getErrors());
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: 'unknown',
        message: 'Global error',
        severity: 'medium'
      });
    });

    it('should handle unhandled promise rejections', () => {
      const rejectionEvent = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(new Error('Promise rejection')),
        reason: new Error('Promise rejection')
      });
      
      window.dispatchEvent(rejectionEvent);
      
      const errors = get(errorManager.getErrors());
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        type: 'unknown',
        message: 'Unhandled promise rejection',
        severity: 'medium'
      });
    });
  });

  describe('Error Statistics', () => {
    it('should provide error statistics', () => {
      createError('network', 'Network error 1', { severity: 'high' });
      createError('network', 'Network error 2', { severity: 'medium' });
      createError('validation', 'Validation error', { severity: 'low' });
      
      const stats = errorManager.getErrorStats();
      
      expect(stats).toMatchObject({
        total: 3,
        byType: {
          network: 2,
          validation: 1
        },
        bySeverity: {
          high: 1,
          medium: 1,
          low: 1
        },
        resolved: 0,
        unresolved: 3
      });
    });
  });

  describe('Error History Management', () => {
    it('should limit stored errors', () => {
      // Create more errors than the limit
      for (let i = 0; i < 150; i++) {
        createError('network', `Error ${i}`);
      }
      
      const allErrors = errorManager.getErrors();
      expect(allErrors.length).toBeLessThanOrEqual(100); // maxErrors
    });

    it('should clear resolved errors', () => {
      const error1 = createError('network', 'Error 1');
      const error2 = createError('validation', 'Error 2');
      
      resolveError(error1.id);
      
      errorManager.clearResolvedErrors();
      
      const remainingErrors = errorManager.getErrors();
      expect(remainingErrors).toHaveLength(1);
      expect(remainingErrors[0].id).toBe(error2.id);
    });
  });
});