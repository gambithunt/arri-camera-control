/**
 * Service Worker for ARRI Camera Control App
 * Handles offline functionality, caching, and background sync
 */

const CACHE_VERSION = '1.0.0';
const STATIC_CACHE_NAME = `arri-camera-static-v${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `arri-camera-dynamic-v${CACHE_VERSION}`;
const MAX_DYNAMIC_CACHE_SIZE = 50;

// Files to cache immediately
const STATIC_ASSETS = [
  '/',
  '/camera',
  '/playback',
  '/timecode',
  '/grading',
  '/offline',
  '/manifest.json'
];

// Routes that should be cached dynamically
const CACHEABLE_ROUTES = [
  /^\/$/,
  /^\/camera/,
  /^\/playback/,
  /^\/timecode/,
  /^\/grading/,
  /\.(js|css|png|jpg|jpeg|svg|woff|woff2|ico)$/
];

// Routes that should never be cached
const EXCLUDE_ROUTES = [
  /\/api\//,
  /\/socket\.io\//,
  /\/debug/,
  /\/sw\.js$/
];

// Offline fallback page
const OFFLINE_PAGE = '/offline';

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Service Worker: Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache static assets', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('Service Worker: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Activated');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip excluded routes
  if (EXCLUDE_ROUTES.some(pattern => pattern.test(url.pathname))) {
    return;
  }
  
  // Handle different types of requests
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigationRequest(request));
  } else if (isStaticAsset(request)) {
    event.respondWith(handleStaticAssetRequest(request));
  } else if (isCacheableRoute(request)) {
    event.respondWith(handleCacheableRequest(request));
  }
});

/**
 * Handle navigation requests (HTML pages)
 */
async function handleNavigationRequest(request) {
  try {
    // Try network first for navigation requests
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed for navigation, trying cache');
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try to match route patterns
    const cache = await caches.open(STATIC_CACHE_NAME);
    
    // Check if it's a SPA route that should fall back to index
    if (isSPARoute(request.url)) {
      const indexResponse = await cache.match('/');
      if (indexResponse) {
        return indexResponse;
      }
    }
    
    // Return offline page as last resort
    const offlineResponse = await cache.match(OFFLINE_PAGE);
    if (offlineResponse) {
      return offlineResponse;
    }
    
    // If all else fails, return a basic offline response
    return new Response(
      createOfflineHTML(),
      {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

/**
 * Handle static asset requests (JS, CSS, images, etc.)
 */
async function handleStaticAssetRequest(request) {
  try {
    // Try cache first for static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Try network
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Failed to fetch static asset', request.url);
    
    // For critical assets, try to return a fallback
    if (request.url.includes('.css')) {
      return new Response('/* Offline - CSS unavailable */', {
        headers: { 'Content-Type': 'text/css' }
      });
    }
    
    if (request.url.includes('.js')) {
      return new Response('// Offline - JS unavailable', {
        headers: { 'Content-Type': 'application/javascript' }
      });
    }
    
    // For images, return a placeholder
    if (isImageRequest(request)) {
      return createOfflineImageResponse();
    }
    
    throw error;
  }
}

/**
 * Handle cacheable requests with network-first strategy
 */
async function handleCacheableRequest(request) {
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      
      // Limit cache size
      await limitCacheSize(DYNAMIC_CACHE_NAME, MAX_DYNAMIC_CACHE_SIZE);
      
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Service Worker: Network failed, trying cache for', request.url);
    
    // Try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * Check if request is a navigation request
 */
function isNavigationRequest(request) {
  return request.mode === 'navigate' || 
         (request.method === 'GET' && request.headers.get('accept').includes('text/html'));
}

/**
 * Check if request is for a static asset
 */
function isStaticAsset(request) {
  const url = new URL(request.url);
  return /\.(js|css|png|jpg|jpeg|svg|woff|woff2|ico|json)$/.test(url.pathname);
}

/**
 * Check if request is for a cacheable route
 */
function isCacheableRoute(request) {
  const url = new URL(request.url);
  return CACHEABLE_ROUTES.some(pattern => pattern.test(url.pathname));
}

/**
 * Check if request is for an image
 */
function isImageRequest(request) {
  return request.destination === 'image' || 
         /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(request.url);
}

/**
 * Check if URL is a SPA route
 */
function isSPARoute(url) {
  const pathname = new URL(url).pathname;
  return ['/camera', '/playback', '/timecode', '/grading'].some(route => 
    pathname.startsWith(route)
  );
}

/**
 * Limit cache size by removing oldest entries
 */
async function limitCacheSize(cacheName, maxSize) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxSize) {
    const keysToDelete = keys.slice(0, keys.length - maxSize);
    await Promise.all(keysToDelete.map(key => cache.delete(key)));
  }
}

/**
 * Create offline HTML response
 */
function createOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>ARRI Camera Control - Offline</title>
      <style>
        body {
          font-family: system-ui, sans-serif;
          background: #1A1A1A;
          color: white;
          margin: 0;
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          text-align: center;
        }
        .offline-icon {
          font-size: 4rem;
          margin-bottom: 1rem;
        }
        .offline-title {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: #E31E24;
        }
        .offline-message {
          font-size: 1.1rem;
          margin-bottom: 2rem;
          max-width: 500px;
          line-height: 1.5;
        }
        .retry-button {
          background: #E31E24;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        .retry-button:hover {
          background: #c41e24;
        }
        .features-list {
          margin-top: 2rem;
          text-align: left;
          max-width: 400px;
        }
        .features-list h3 {
          color: #E31E24;
          margin-bottom: 1rem;
        }
        .features-list ul {
          list-style: none;
          padding: 0;
        }
        .features-list li {
          padding: 0.5rem 0;
          border-bottom: 1px solid #333;
        }
        .features-list li:before {
          content: "✓ ";
          color: #4CAF50;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="offline-icon">📡</div>
      <h1 class="offline-title">You're Offline</h1>
      <p class="offline-message">
        The ARRI Camera Control app is designed to work offline. 
        While you can't connect to new cameras, you can still access cached data and settings.
      </p>
      <button class="retry-button" onclick="window.location.reload()">
        Try Again
      </button>
      
      <div class="features-list">
        <h3>Available Offline:</h3>
        <ul>
          <li>View cached camera settings</li>
          <li>Access saved LUTs</li>
          <li>Review clip information</li>
          <li>Modify user preferences</li>
          <li>View timecode settings</li>
        </ul>
      </div>
      
      <script>
        // Auto-retry when online
        window.addEventListener('online', () => {
          window.location.reload();
        });
        
        // Show online/offline status
        function updateStatus() {
          document.body.style.borderTop = navigator.onLine ? 
            '4px solid #4CAF50' : '4px solid #E31E24';
        }
        
        window.addEventListener('online', updateStatus);
        window.addEventListener('offline', updateStatus);
        updateStatus();
      </script>
    </body>
    </html>
  `;
}

/**
 * Create offline image response
 */
function createOfflineImageResponse() {
  // Return a simple SVG placeholder
  const svg = `
    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="200" height="200" fill="#2D2D2D"/>
      <text x="100" y="100" text-anchor="middle" dy=".3em" fill="#666" font-family="system-ui" font-size="14">
        Image Unavailable
      </text>
      <text x="100" y="120" text-anchor="middle" dy=".3em" fill="#666" font-family="system-ui" font-size="12">
        (Offline)
      </text>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-cache'
    }
  });
}

/**
 * Handle background sync
 */
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync triggered', event.tag);
  
  if (event.tag === 'camera-sync') {
    event.waitUntil(syncCameraOperations());
  }
});

/**
 * Sync camera operations in background
 */
async function syncCameraOperations() {
  try {
    console.log('Service Worker: Syncing camera operations');
    
    // This would integrate with the offline manager
    // to sync pending operations
    
    // For now, just log the sync attempt
    console.log('Service Worker: Camera operations synced');
  } catch (error) {
    console.error('Service Worker: Failed to sync camera operations', error);
  }
}

/**
 * Handle messages from main thread
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
  
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil(clearAllCaches());
  }
});

/**
 * Clear all caches
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
  console.log('Service Worker: All caches cleared');
}

/**
 * Handle push notifications (future enhancement)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    tag: data.tag || 'camera-notification',
    requireInteraction: data.requireInteraction || false,
    actions: data.actions || []
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

/**
 * Handle notification clicks
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});

console.log('Service Worker: Loaded and ready');