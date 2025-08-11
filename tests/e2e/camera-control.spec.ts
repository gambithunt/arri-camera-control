/**
 * End-to-End Camera Control Tests
 * Complete user workflow tests using Playwright
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:5173',
  timeout: 30000,
  mockCameraIP: '127.0.0.1',
  mockCameraPort: 9999
};

// Helper functions
async function connectToCamera(page: Page) {
  await page.goto('/');
  
  // Wait for app to load
  await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  
  // Open connection dialog
  await page.click('[data-testid="connect-camera-btn"]');
  
  // Fill in camera details
  await page.fill('[data-testid="camera-ip-input"]', TEST_CONFIG.mockCameraIP);
  await page.fill('[data-testid="camera-port-input"]', TEST_CONFIG.mockCameraPort.toString());
  
  // Connect
  await page.click('[data-testid="connect-btn"]');
  
  // Wait for connection success
  await page.waitForSelector('[data-testid="connection-status-connected"]', { timeout: 15000 });
}

async function waitForToast(page: Page, message: string) {
  await page.waitForSelector(`[data-testid="toast"]:has-text("${message}")`, { timeout: 5000 });
}

test.describe('Camera Control E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for tablet testing (iPad Pro)
    await page.setViewportSize({ width: 1024, height: 1366 });
    
    // Mock geolocation and other APIs
    await page.addInitScript(() => {
      // Mock navigator.vibrate for haptic feedback
      Object.defineProperty(navigator, 'vibrate', {
        value: () => true,
        writable: true
      });
      
      // Mock network information
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '4g',
          downlink: 10,
          rtt: 50
        },
        writable: true
      });
    });
  });

  test.describe('Application Loading and Initialization', () => {
    test('should load application successfully', async ({ page }) => {
      await page.goto('/');
      
      // Check for loading state
      await expect(page.locator('[data-testid="app-loading"]')).toBeVisible();
      
      // Wait for app to fully load
      await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
      
      // Check main navigation is present
      await expect(page.locator('[data-testid="main-navigation"]')).toBeVisible();
      
      // Check connection status indicator
      await expect(page.locator('[data-testid="connection-indicator"]')).toBeVisible();
      
      // Verify offline capability indicator
      await expect(page.locator('[data-testid="offline-ready"]')).toBeVisible();
    });

    test('should handle initialization errors gracefully', async ({ page }) => {
      // Simulate initialization error by blocking critical resources
      await page.route('**/api/health', route => route.abort());
      
      await page.goto('/');
      
      // Should show error boundary
      await expect(page.locator('[data-testid="initialization-error"]')).toBeVisible();
      
      // Should have reload button
      await expect(page.locator('[data-testid="reload-app-btn"]')).toBeVisible();
    });

    test('should work offline', async ({ page, context }) => {
      // First load the app online
      await page.goto('/');
      await page.waitForSelector('[data-testid="app-loaded"]');
      
      // Go offline
      await context.setOffline(true);
      
      // Navigate to different sections
      await page.click('[data-testid="nav-settings"]');
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      
      await page.click('[data-testid="nav-playback"]');
      await expect(page.locator('[data-testid="playback-panel"]')).toBeVisible();
      
      // Check offline indicator
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    });
  });

  test.describe('Camera Connection Workflow', () => {
    test('should connect to camera successfully', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-testid="app-loaded"]');
      
      // Initial state should show disconnected
      await expect(page.locator('[data-testid="connection-status-disconnected"]')).toBeVisible();
      
      // Connect to camera
      await connectToCamera(page);
      
      // Verify connection success
      await expect(page.locator('[data-testid="connection-status-connected"]')).toBeVisible();
      await waitForToast(page, 'Successfully connected to ALEXA 35');
      
      // Check camera info is displayed
      await expect(page.locator('[data-testid="camera-model"]')).toContainText('ALEXA 35');
      await expect(page.locator('[data-testid="camera-serial"]')).toContainText('A35-12345');
    });

    test('should handle connection failures', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-testid="app-loaded"]');
      
      // Try to connect to invalid IP
      await page.click('[data-testid="connect-camera-btn"]');
      await page.fill('[data-testid="camera-ip-input"]', '192.168.1.999');
      await page.fill('[data-testid="camera-port-input"]', '9999');
      await page.click('[data-testid="connect-btn"]');
      
      // Should show error
      await waitForToast(page, 'Connection failed');
      await expect(page.locator('[data-testid="connection-status-error"]')).toBeVisible();
    });

    test('should show connection diagnostics', async ({ page }) => {
      await page.goto('/');
      await page.waitForSelector('[data-testid="app-loaded"]');
      
      // Open diagnostics
      await page.click('[data-testid="connection-indicator"]');
      await page.click('[data-testid="view-diagnostics-btn"]');
      
      // Should navigate to diagnostics page
      await expect(page).toHaveURL('/diagnostics');
      await expect(page.locator('[data-testid="diagnostics-panel"]')).toBeVisible();
      
      // Run diagnostics
      await page.click('[data-testid="run-diagnostics-btn"]');
      
      // Wait for diagnostics to complete
      await page.waitForSelector('[data-testid="diagnostics-complete"]', { timeout: 10000 });
      
      // Check diagnostic results
      await expect(page.locator('[data-testid="network-test-result"]')).toBeVisible();
      await expect(page.locator('[data-testid="websocket-test-result"]')).toBeVisible();
    });
  });

  test.describe('Camera Settings Control', () => {
    test.beforeEach(async ({ page }) => {
      await connectToCamera(page);
    });

    test('should control frame rate settings', async ({ page }) => {
      // Navigate to settings
      await page.click('[data-testid="nav-settings"]');
      await expect(page.locator('[data-testid="settings-panel"]')).toBeVisible();
      
      // Current frame rate should be displayed
      await expect(page.locator('[data-testid="current-frame-rate"]')).toContainText('24');
      
      // Change frame rate
      await page.click('[data-testid="frame-rate-control"]');
      await page.click('[data-testid="frame-rate-25"]');
      
      // Should show success notification
      await waitForToast(page, 'Frame rate set to 25 fps');
      
      // UI should update
      await expect(page.locator('[data-testid="current-frame-rate"]')).toContainText('25');
    });

    test('should control white balance settings', async ({ page }) => {
      await page.click('[data-testid="nav-settings"]');
      
      // Open white balance control
      await page.click('[data-testid="white-balance-control"]');
      
      // Current values should be displayed
      await expect(page.locator('[data-testid="kelvin-value"]')).toContainText('5600');
      await expect(page.locator('[data-testid="tint-value"]')).toContainText('0');
      
      // Adjust kelvin
      await page.click('[data-testid="kelvin-3200-preset"]');
      
      // Should update camera and UI
      await waitForToast(page, 'White balance set to 3200K');
      await expect(page.locator('[data-testid="kelvin-value"]')).toContainText('3200');
      
      // Test manual adjustment
      const kelvinSlider = page.locator('[data-testid="kelvin-slider"]');
      await kelvinSlider.click({ position: { x: 100, y: 10 } });
      
      // Should show real-time updates
      await page.waitForTimeout(500); // Allow for debounced updates
      await expect(page.locator('[data-testid="kelvin-value"]')).not.toContainText('3200');
    });

    test('should control ISO settings', async ({ page }) => {
      await page.click('[data-testid="nav-settings"]');
      
      // Open ISO control
      await page.click('[data-testid="iso-control"]');
      
      // Current ISO should be displayed
      await expect(page.locator('[data-testid="current-iso"]')).toContainText('800');
      
      // Change ISO
      await page.click('[data-testid="iso-1600"]');
      
      // Should update
      await waitForToast(page, 'ISO set to 1600');
      await expect(page.locator('[data-testid="current-iso"]')).toContainText('1600');
    });

    test('should control ND filter settings', async ({ page }) => {
      await page.click('[data-testid="nav-settings"]');
      
      // Open ND filter control
      await page.click('[data-testid="nd-filter-control"]');
      
      // Set ND filter
      await page.click('[data-testid="nd-filter-2-stops"]');
      
      // Should update
      await waitForToast(page, 'ND filter set to 2 stops');
      await expect(page.locator('[data-testid="current-nd-filter"]')).toContainText('2.0');
    });

    test('should toggle frame lines', async ({ page }) => {
      await page.click('[data-testid="nav-settings"]');
      
      // Toggle frame lines
      const frameLineToggle = page.locator('[data-testid="frame-lines-toggle"]');
      await frameLineToggle.click();
      
      // Should show confirmation
      await waitForToast(page, 'Frame lines enabled');
      
      // Toggle should be active
      await expect(frameLineToggle).toHaveClass(/active/);
      
      // Toggle off
      await frameLineToggle.click();
      await waitForToast(page, 'Frame lines disabled');
      await expect(frameLineToggle).not.toHaveClass(/active/);
    });
  });

  test.describe('Playback Functionality', () => {
    test.beforeEach(async ({ page }) => {
      await connectToCamera(page);
    });

    test('should browse and play clips', async ({ page }) => {
      // Navigate to playback
      await page.click('[data-testid="nav-playback"]');
      await expect(page.locator('[data-testid="playback-panel"]')).toBeVisible();
      
      // Enter playback mode
      await page.click('[data-testid="enter-playback-btn"]');
      await waitForToast(page, 'Entered playback mode');
      
      // Should show clip list
      await expect(page.locator('[data-testid="clip-list"]')).toBeVisible();
      
      // Should have clips
      await expect(page.locator('[data-testid="clip-item"]')).toHaveCount(2);
      
      // Check clip information
      const firstClip = page.locator('[data-testid="clip-item"]').first();
      await expect(firstClip.locator('[data-testid="clip-name"]')).toContainText('A001_C001_0101AB');
      await expect(firstClip.locator('[data-testid="clip-duration"]')).toContainText('120.5s');
      await expect(firstClip.locator('[data-testid="clip-resolution"]')).toContainText('4096x2160');
      
      // Play first clip
      await firstClip.click();
      await page.click('[data-testid="play-btn"]');
      
      // Should start playback
      await waitForToast(page, 'Playback started');
      await expect(page.locator('[data-testid="playback-status"]')).toContainText('Playing');
      
      // Should show playback controls
      await expect(page.locator('[data-testid="pause-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="stop-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="scrub-bar"]')).toBeVisible();
    });

    test('should control playback transport', async ({ page }) => {
      await page.click('[data-testid="nav-playback"]');
      await page.click('[data-testid="enter-playback-btn"]');
      await page.waitForSelector('[data-testid="clip-list"]');
      
      // Select and play first clip
      await page.locator('[data-testid="clip-item"]').first().click();
      await page.click('[data-testid="play-btn"]');
      await page.waitForSelector('[data-testid="pause-btn"]');
      
      // Test pause
      await page.click('[data-testid="pause-btn"]');
      await expect(page.locator('[data-testid="playback-status"]')).toContainText('Paused');
      await expect(page.locator('[data-testid="play-btn"]')).toBeVisible();
      
      // Test resume
      await page.click('[data-testid="play-btn"]');
      await expect(page.locator('[data-testid="playback-status"]')).toContainText('Playing');
      
      // Test stop
      await page.click('[data-testid="stop-btn"]');
      await expect(page.locator('[data-testid="playback-status"]')).toContainText('Stopped');
      
      // Test scrubbing
      const scrubBar = page.locator('[data-testid="scrub-bar"]');
      await scrubBar.click({ position: { x: 100, y: 10 } });
      
      // Should update playback position
      await expect(page.locator('[data-testid="playback-position"]')).not.toContainText('00:00:00:00');
    });

    test('should handle empty clip list', async ({ page }) => {
      // Mock empty clip list response
      await page.route('**/api/playback/clips', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ clips: [] })
        });
      });
      
      await page.click('[data-testid="nav-playback"]');
      await page.click('[data-testid="enter-playback-btn"]');
      
      // Should show empty state
      await expect(page.locator('[data-testid="no-clips-message"]')).toBeVisible();
      await expect(page.locator('[data-testid="no-clips-message"]')).toContainText('No clips available');
    });
  });

  test.describe('Timecode Management', () => {
    test.beforeEach(async ({ page }) => {
      await connectToCamera(page);
    });

    test('should display and manage timecode', async ({ page }) => {
      // Navigate to timecode
      await page.click('[data-testid="nav-timecode"]');
      await expect(page.locator('[data-testid="timecode-panel"]')).toBeVisible();
      
      // Should show current timecode
      await expect(page.locator('[data-testid="timecode-display"]')).toBeVisible();
      await expect(page.locator('[data-testid="timecode-value"]')).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
      
      // Should show timecode mode
      await expect(page.locator('[data-testid="timecode-mode"]')).toContainText('free_run');
      
      // Test timecode sync to time of day
      await page.click('[data-testid="sync-to-time-of-day-btn"]');
      await waitForToast(page, 'Timecode synchronized');
      
      // Should update timecode display
      await page.waitForTimeout(1000);
      const timecodeValue = await page.locator('[data-testid="timecode-value"]').textContent();
      expect(timecodeValue).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
    });

    test('should set manual timecode', async ({ page }) => {
      await page.click('[data-testid="nav-timecode"]');
      
      // Open manual timecode input
      await page.click('[data-testid="manual-timecode-btn"]');
      
      // Set custom timecode
      await page.fill('[data-testid="timecode-hours"]', '02');
      await page.fill('[data-testid="timecode-minutes"]', '30');
      await page.fill('[data-testid="timecode-seconds"]', '15');
      await page.fill('[data-testid="timecode-frames"]', '10');
      
      await page.click('[data-testid="set-timecode-btn"]');
      
      // Should update
      await waitForToast(page, 'Timecode set');
      await expect(page.locator('[data-testid="timecode-value"]')).toContainText('02:30:15:10');
    });

    test('should show real-time timecode updates', async ({ page }) => {
      await page.click('[data-testid="nav-timecode"]');
      
      // Get initial timecode
      const initialTimecode = await page.locator('[data-testid="timecode-value"]').textContent();
      
      // Wait for updates (timecode should increment)
      await page.waitForTimeout(2000);
      
      const updatedTimecode = await page.locator('[data-testid="timecode-value"]').textContent();
      
      // Timecode should have changed
      expect(updatedTimecode).not.toBe(initialTimecode);
    });
  });

  test.describe('Color Grading Interface', () => {
    test.beforeEach(async ({ page }) => {
      await connectToCamera(page);
    });

    test('should display color grading controls', async ({ page }) => {
      // Navigate to grading
      await page.click('[data-testid="nav-grading"]');
      await expect(page.locator('[data-testid="grading-panel"]')).toBeVisible();
      
      // Should show three color wheels
      await expect(page.locator('[data-testid="shadows-wheel"]')).toBeVisible();
      await expect(page.locator('[data-testid="midtones-wheel"]')).toBeVisible();
      await expect(page.locator('[data-testid="highlights-wheel"]')).toBeVisible();
      
      // Should show CDL controls
      await expect(page.locator('[data-testid="cdl-controls"]')).toBeVisible();
    });

    test('should expand color wheel for precise control', async ({ page }) => {
      await page.click('[data-testid="nav-grading"]');
      
      // Touch shadows wheel to expand
      await page.click('[data-testid="shadows-wheel"]');
      
      // Should expand to full screen
      await expect(page.locator('[data-testid="expanded-color-wheel"]')).toBeVisible();
      await expect(page.locator('[data-testid="wheel-title"]')).toContainText('Shadows');
      
      // Should have precise controls
      await expect(page.locator('[data-testid="lift-controls"]')).toBeVisible();
      await expect(page.locator('[data-testid="gamma-controls"]')).toBeVisible();
      await expect(page.locator('[data-testid="gain-controls"]')).toBeVisible();
      
      // Close expanded view
      await page.click('[data-testid="close-expanded-wheel"]');
      await expect(page.locator('[data-testid="expanded-color-wheel"]')).not.toBeVisible();
    });

    test('should adjust color values and send to camera', async ({ page }) => {
      await page.click('[data-testid="nav-grading"]');
      
      // Expand shadows wheel
      await page.click('[data-testid="shadows-wheel"]');
      
      // Adjust lift values
      const liftRedSlider = page.locator('[data-testid="lift-red-slider"]');
      await liftRedSlider.click({ position: { x: 60, y: 10 } });
      
      // Should send real-time updates to camera
      await page.waitForTimeout(500); // Allow for debounced updates
      
      // Should show updated values
      const liftRedValue = await page.locator('[data-testid="lift-red-value"]').textContent();
      expect(parseFloat(liftRedValue || '0')).not.toBe(0);
    });

    test('should save and load LUTs', async ({ page }) => {
      await page.click('[data-testid="nav-grading"]');
      
      // Open LUT manager
      await page.click('[data-testid="lut-manager-btn"]');
      await expect(page.locator('[data-testid="lut-manager"]')).toBeVisible();
      
      // Save current LUT
      await page.click('[data-testid="save-lut-btn"]');
      await page.fill('[data-testid="lut-name-input"]', 'Test LUT');
      await page.fill('[data-testid="lut-description-input"]', 'Test description');
      await page.click('[data-testid="save-lut-confirm-btn"]');
      
      // Should show success
      await waitForToast(page, 'LUT saved successfully');
      
      // Should appear in LUT list
      await expect(page.locator('[data-testid="lut-item"]')).toContainText('Test LUT');
      
      // Load the LUT
      await page.click('[data-testid="lut-item"] [data-testid="load-lut-btn"]');
      await waitForToast(page, 'LUT loaded successfully');
    });
  });

  test.describe('Touch Interactions and Responsiveness', () => {
    test('should respond to touch within 100ms', async ({ page }) => {
      await connectToCamera(page);
      
      // Test touch responsiveness on various controls
      const controls = [
        '[data-testid="frame-rate-control"]',
        '[data-testid="white-balance-control"]',
        '[data-testid="iso-control"]',
        '[data-testid="nd-filter-control"]'
      ];
      
      await page.click('[data-testid="nav-settings"]');
      
      for (const control of controls) {
        const startTime = Date.now();
        
        await page.click(control);
        
        // Wait for visual feedback (control should expand or show active state)
        await page.waitForSelector(`${control}.active, ${control} [data-testid="control-expanded"]`, { timeout: 200 });
        
        const responseTime = Date.now() - startTime;
        expect(responseTime).toBeLessThan(100);
      }
    });

    test('should provide haptic feedback', async ({ page }) => {
      // Mock vibration API
      let vibrationCalls = 0;
      await page.addInitScript(() => {
        const originalVibrate = navigator.vibrate;
        navigator.vibrate = (pattern) => {
          window.vibrationCalls = (window.vibrationCalls || 0) + 1;
          return originalVibrate.call(navigator, pattern);
        };
      });
      
      await connectToCamera(page);
      await page.click('[data-testid="nav-settings"]');
      
      // Interact with controls that should provide haptic feedback
      await page.click('[data-testid="frame-rate-control"]');
      await page.click('[data-testid="frame-rate-25"]');
      
      // Check if vibration was called
      const vibrationCalls = await page.evaluate(() => window.vibrationCalls);
      expect(vibrationCalls).toBeGreaterThan(0);
    });

    test('should adapt to different screen orientations', async ({ page }) => {
      await connectToCamera(page);
      
      // Test portrait orientation (phone)
      await page.setViewportSize({ width: 375, height: 812 });
      
      // Navigation should adapt to mobile
      await expect(page.locator('[data-testid="mobile-navigation"]')).toBeVisible();
      
      // Controls should be touch-friendly
      const frameRateControl = page.locator('[data-testid="frame-rate-control"]');
      const boundingBox = await frameRateControl.boundingBox();
      expect(boundingBox?.height).toBeGreaterThanOrEqual(44); // Minimum touch target
      
      // Test landscape tablet orientation
      await page.setViewportSize({ width: 1366, height: 1024 });
      
      // Should show desktop/tablet layout
      await expect(page.locator('[data-testid="desktop-navigation"]')).toBeVisible();
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle camera disconnection gracefully', async ({ page }) => {
      await connectToCamera(page);
      
      // Simulate camera disconnection
      await page.route('**/api/camera/**', route => route.abort());
      
      // Try to change a setting
      await page.click('[data-testid="nav-settings"]');
      await page.click('[data-testid="frame-rate-control"]');
      await page.click('[data-testid="frame-rate-25"]');
      
      // Should show error notification
      await waitForToast(page, 'Connection lost');
      
      // Should show reconnection attempt
      await expect(page.locator('[data-testid="connection-status-reconnecting"]')).toBeVisible();
      
      // Should show retry options
      await expect(page.locator('[data-testid="retry-connection-btn"]')).toBeVisible();
    });

    test('should display user-friendly error messages', async ({ page }) => {
      await connectToCamera(page);
      
      // Mock error response
      await page.route('**/api/camera/frameRate', route => {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: 'Invalid frame rate value',
            code: 'CAP_007'
          })
        });
      });
      
      await page.click('[data-testid="nav-settings"]');
      await page.click('[data-testid="frame-rate-control"]');
      await page.click('[data-testid="frame-rate-25"]');
      
      // Should show user-friendly error
      await waitForToast(page, 'Invalid setting value');
      
      // Should not show technical error codes to user
      const toast = page.locator('[data-testid="toast"]');
      await expect(toast).not.toContainText('CAP_007');
    });

    test('should provide error recovery options', async ({ page }) => {
      await connectToCamera(page);
      
      // Simulate network error
      await page.route('**/api/**', route => route.abort());
      
      // Try an operation
      await page.click('[data-testid="nav-settings"]');
      await page.click('[data-testid="frame-rate-control"]');
      await page.click('[data-testid="frame-rate-25"]');
      
      // Should show error with retry option
      await expect(page.locator('[data-testid="error-notification"]')).toBeVisible();
      await expect(page.locator('[data-testid="retry-btn"]')).toBeVisible();
      
      // Test retry functionality
      await page.unroute('**/api/**'); // Remove route block
      await page.click('[data-testid="retry-btn"]');
      
      // Should retry the operation
      await waitForToast(page, 'Frame rate set to 25 fps');
    });
  });

  test.describe('Performance and Load Testing', () => {
    test('should maintain performance with rapid interactions', async ({ page }) => {
      await connectToCamera(page);
      await page.click('[data-testid="nav-grading"]');
      
      // Rapidly adjust color wheel values
      const shadowsWheel = page.locator('[data-testid="shadows-wheel"]');
      await shadowsWheel.click();
      
      const liftRedSlider = page.locator('[data-testid="lift-red-slider"]');
      
      // Perform rapid adjustments
      const startTime = Date.now();
      for (let i = 0; i < 10; i++) {
        await liftRedSlider.click({ position: { x: 20 + i * 5, y: 10 } });
        await page.waitForTimeout(50);
      }
      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
      
      // UI should remain responsive
      await expect(page.locator('[data-testid="lift-red-value"]')).toBeVisible();
    });

    test('should handle large clip lists efficiently', async ({ page }) => {
      // Mock large clip list
      const largeClipList = Array.from({ length: 100 }, (_, i) => ({
        id: `clip-${i.toString().padStart(3, '0')}`,
        name: `A001_C${i.toString().padStart(3, '0')}_0101AB`,
        duration: 120.5 + i,
        frameRate: 24.0,
        resolution: '4096x2160',
        codec: 'ARRIRAW',
        timecode: `01:${Math.floor(i / 60).toString().padStart(2, '0')}:${(i % 60).toString().padStart(2, '0')}:00`
      }));
      
      await page.route('**/api/playback/clips', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ clips: largeClipList })
        });
      });
      
      await connectToCamera(page);
      await page.click('[data-testid="nav-playback"]');
      await page.click('[data-testid="enter-playback-btn"]');
      
      // Should load efficiently
      await page.waitForSelector('[data-testid="clip-list"]', { timeout: 5000 });
      
      // Should use virtual scrolling for performance
      const visibleClips = await page.locator('[data-testid="clip-item"]').count();
      expect(visibleClips).toBeLessThan(100); // Should not render all clips at once
      
      // Scrolling should be smooth
      const clipList = page.locator('[data-testid="clip-list"]');
      await clipList.evaluate(el => el.scrollTop = 1000);
      
      // Should load more clips as needed
      await page.waitForTimeout(500);
      const newVisibleClips = await page.locator('[data-testid="clip-item"]').count();
      expect(newVisibleClips).toBeGreaterThan(0);
    });
  });
});