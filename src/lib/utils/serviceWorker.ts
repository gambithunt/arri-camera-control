/**
 * Service Worker Registration and Management
 */

export interface ServiceWorkerStatus {
  supported: boolean;
  registered: boolean;
  installing: boolean;
  waiting: boolean;
  active: boolean;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private statusCallbacks: ((status: ServiceWorkerStatus) => void)[] = [];

  /**
   * Register the service worker
   */
  async register(): Promise<boolean> {
    if (!this.isSupported()) {
      console.log('Service workers not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service worker registered:', this.registration);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        this.handleUpdateFound();
      });

      // Check for existing service worker
      if (this.registration.active) {
        this.notifyStatusChange();
      }

      return true;
    } catch (error) {
      console.error('Service worker registration failed:', error);
      return false;
    }
  }

  /**
   * Check if service workers are supported
   */
  isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Get current service worker status
   */
  getStatus(): ServiceWorkerStatus {
    if (!this.isSupported()) {
      return {
        supported: false,
        registered: false,
        installing: false,
        waiting: false,
        active: false
      };
    }

    return {
      supported: true,
      registered: !!this.registration,
      installing: !!this.registration?.installing,
      waiting: !!this.registration?.waiting,
      active: !!this.registration?.active
    };
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(callback: (status: ServiceWorkerStatus) => void): () => void {
    this.statusCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.statusCallbacks.indexOf(callback);
      if (index > -1) {
        this.statusCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Update the service worker
   */
  async update(): Promise<void> {
    if (this.registration) {
      await this.registration.update();
    }
  }

  /**
   * Skip waiting and activate new service worker
   */
  skipWaiting(): void {
    if (this.registration?.waiting) {
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Handle service worker update found
   */
  private handleUpdateFound(): void {
    if (!this.registration) return;

    const newWorker = this.registration.installing;
    if (!newWorker) return;

    newWorker.addEventListener('statechange', () => {
      if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
        // New service worker is available
        this.notifyStatusChange();
      }
    });

    this.notifyStatusChange();
  }

  /**
   * Notify status change to subscribers
   */
  private notifyStatusChange(): void {
    const status = this.getStatus();
    this.statusCallbacks.forEach(callback => callback(status));
  }

  /**
   * Add command to offline queue
   */
  async queueOfflineCommand(command: any): Promise<void> {
    if (!this.registration) return;

    // Store command in IndexedDB for offline sync
    // TODO: Implement IndexedDB storage
    console.log('Queuing offline command:', command);

    // Request background sync
    if ('sync' in window.ServiceWorkerRegistration.prototype) {
      try {
        await this.registration.sync.register('camera-commands');
      } catch (error) {
        console.error('Background sync registration failed:', error);
      }
    }
  }
}

// Export singleton instance
export const serviceWorkerManager = new ServiceWorkerManager();

/**
 * Initialize service worker on app startup
 */
export async function initializeServiceWorker(): Promise<void> {
  if (typeof window === 'undefined') return; // Skip on server

  try {
    // Initialize offline manager first
    const { offlineManager } = await import('./offlineManager');
    await offlineManager.initialize();
    
    await serviceWorkerManager.register();
    console.log('Service worker initialized');
  } catch (error) {
    console.error('Service worker initialization failed:', error);
  }
}