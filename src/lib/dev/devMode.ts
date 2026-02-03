/**
 * Development Mode Handler
 * Provides mock implementations when real stores/APIs aren't available
 */

import { browser } from '$app/environment';
import { mockStores, mockCameraApi, isDevelopmentMode } from './mockStores';

// Check if we should use mock data
export function shouldUseMockData(): boolean {
  if (!browser) return false;
  
  // Check for development mode
  if (isDevelopmentMode()) {
    // Check if real stores are available
    try {
      // Try to import real stores - if this fails, use mocks
      return true; // For now, always use mocks in dev mode
    } catch (error) {
      return true;
    }
  }
  
  return false;
}

// Get stores (real or mock)
export async function getStores() {
  if (shouldUseMockData()) {
    console.log('🎭 Using mock stores for UI development');
    return mockStores;
  }
  
  try {
    // Try to import real stores
    const stores = await import('$lib/stores');
    console.log('📡 Using real stores');
    return stores;
  } catch (error) {
    console.warn('⚠️ Real stores not available, falling back to mocks');
    return mockStores;
  }
}

// Get camera API (real or mock)
export async function getCameraApi() {
  if (shouldUseMockData()) {
    console.log('🎭 Using mock camera API for UI development');
    return mockCameraApi;
  }
  
  try {
    // Try to import real API
    const api = await import('$lib/api/cameraApi');
    console.log('📡 Using real camera API');
    return api.cameraApi;
  } catch (error) {
    console.warn('⚠️ Real camera API not available, falling back to mock');
    return mockCameraApi;
  }
}

// Development mode indicator
export function showDevModeIndicator() {
  if (shouldUseMockData() && browser) {
    // Add a small indicator to show we're in dev mode
    const indicator = document.createElement('div');
    indicator.innerHTML = '🎭 UI Dev Mode';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #E31E24;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      z-index: 9999;
      opacity: 0.8;
    `;
    document.body.appendChild(indicator);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 3000);
  }
}