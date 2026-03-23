/**
 * Development Mode Handler
 * Provides mock implementations when real stores/APIs aren't available
 */

import { browser } from '$app/environment';
import { getStores, getCameraApi, isDevelopmentMode } from './mockStores';

export { isDevelopmentMode };

// Check if we should use mock data
export function shouldUseMockData(): boolean {
	if (!browser) return false;

	// Check for development mode
	if (isDevelopmentMode()) {
		return true;
	}

	return false;
}

// Re-export the store access functions
export { getStores, getCameraApi };

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
