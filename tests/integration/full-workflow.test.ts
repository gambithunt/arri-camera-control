/**
 * Full Workflow Integration Tests
 * End-to-end tests for complete camera control workflows
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, Page } from 'playwright';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket } from 'ws';

// Test configuration
const TEST_CONFIG = {
  frontendUrl: 'http://localhost:5173',
  backendUrl: 'http://localhost:3001',
  wsUrl: 'ws://localhost:3001',
  mockCameraPort: 7755
};

// Mock camera server for testing
class MockCameraServer {
  private server: any;
  private clients: Set<any> = new Set();
  private port: number;

  constructor(port: number = TEST_CONFIG.mockCameraPort) {
    this.port = port;
  }

  async start() {
    const net = await import('net');
    
    return new Promise<void>((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.clients.add(socket);
        
        socket.on('data', (data) => {
          this.handleCAPCommand(socket, data.toString());
        });
        
        socket.on('close', () => {
          this.clients.delete(socket);
        });
        
        socket.on('error', (error) => {
          console.error('Mock camera socket error:', error);
        });
      });
      
      this.server.listen(this.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log(`Mock camera server listening on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  async stop() {
    return new Promise<void>((resolve) => {
      if (this.server) {
        this.clients.forEach(client => client.destroy());
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  private handleCAPCommand(socket: any, command: string) {
    const trimmedCommand = command.trim();
    let response = '';
    
    if (trimmedCommand.startsWith('GET /camera/status')) {
      response = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "model": "ARRI ALEXA Mini LF",
  "serialNumber": "ALF001234",
  "firmwareVersion": "7.2.1",
  "recording": false,
  "batteryLevel": 85,
  "temperature": 42
}`;
    } else if (trimmedCommand.includes('frameRate')) {
      const match = trimmedCommand.match(/"frameRate":\s*(\d+(?:\.\d+)?)/);
      if (match) {
        const frameRate = parseFloat(match[1]);
        response = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "frameRate": ${frameRate}
}`;
      }
    } else if (trimmedCommand.includes('whiteBalance')) {
      const match = trimmedCommand.match(/"kelvin":\s*(\d+)/);
      if (match) {
        const kelvin = parseInt(match[1]);
        response = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "kelvin": ${kelvin}
}`;
      }
    } else if (trimmedCommand.includes('iso')) {
      const match = trimmedCommand.match(/"iso":\s*(\d+)/);
      if (match) {
        const iso = parseInt(match[1]);
        response = `HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{
  "iso": ${iso}
}`;
      }
    }
    
    if (response) {
      setTimeout(() => {
        socket.write(response);
      }, 10);
    }
  }
}

describe('Full Workflow Integration Tests', () => {
  let browser: Browser;
  let page: Page;
  let mockCamera: MockCameraServer;
  let backendProcess: ChildProcess;
  let frontendProcess: ChildProcess;

  beforeAll(async () => {
    // Start mock camera server
    mockCamera = new MockCameraServer();
    await mockCamera.start();

    // Start backend server
    backendProcess = spawn('npm', ['run', 'dev'], {
      cwd: './backend',
      stdio: 'pipe'
    });

    // Wait for backend to start
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Start frontend server
    frontendProcess = spawn('npm', ['run', 'dev'], {
      stdio: 'pipe'
    });

    // Wait for frontend to start
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Launch browser
    browser = await chromium.launch({
      headless: process.env.CI === 'true'
    });
  });

  afterAll(async () => {
    // Clean up
    if (browser) {
      await browser.close();
    }
    
    if (mockCamera) {
      await mockCamera.stop();
    }
    
    if (backendProcess) {
      backendProcess.kill();
    }
    
    if (frontendProcess) {
      frontendProcess.kill();
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    await page.goto(TEST_CONFIG.frontendUrl);
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Camera Connection Workflow', () => {
    it('should complete full camera connection workflow', async () => {
      // Step 1: Navigate to camera control page
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      
      // Step 2: Enter camera IP address
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      
      // Step 3: Click connect button
      await page.click('[data-testid="connect-button"]');
      
      // Step 4: Wait for connection to establish
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]', {
        timeout: 10000
      });
      
      // Step 5: Verify camera information is displayed
      await expect(page.locator('[data-testid="camera-model"]')).toContainText('ARRI ALEXA Mini LF');
      await expect(page.locator('[data-testid="camera-serial"]')).toContainText('ALF001234');
      await expect(page.locator('[data-testid="firmware-version"]')).toContainText('7.2.1');
      
      // Step 6: Verify control panels are enabled
      await expect(page.locator('[data-testid="frame-rate-control"]')).toBeEnabled();
      await expect(page.locator('[data-testid="white-balance-control"]')).toBeEnabled();
      await expect(page.locator('[data-testid="iso-control"]')).toBeEnabled();
    });

    it('should handle connection failure gracefully', async () => {
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      
      // Try to connect to non-existent camera
      await page.fill('[data-testid="camera-ip-input"]', '192.168.1.999');
      await page.click('[data-testid="connect-button"]');
      
      // Wait for error message
      await page.waitForSelector('[data-testid="error-message"]', {
        timeout: 10000
      });
      
      // Verify error is displayed
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Connection failed');
      
      // Verify controls remain disabled
      await expect(page.locator('[data-testid="frame-rate-control"]')).toBeDisabled();
    });
  });

  describe('Camera Control Workflow', () => {
    beforeEach(async () => {
      // Establish camera connection before each test
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
    });

    it('should complete frame rate adjustment workflow', async () => {
      // Step 1: Locate frame rate control
      const frameRateSlider = page.locator('[data-testid="frame-rate-slider"]');
      
      // Step 2: Change frame rate to 30fps
      await frameRateSlider.fill('30');
      
      // Step 3: Wait for API call to complete
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="frame-rate-status"]');
        return status && status.textContent?.includes('30');
      });
      
      // Step 4: Verify UI reflects the change
      await expect(page.locator('[data-testid="frame-rate-display"]')).toContainText('30 fps');
      
      // Step 5: Verify success notification
      await expect(page.locator('[data-testid="success-notification"]')).toContainText('Frame rate updated');
    });

    it('should complete white balance adjustment workflow', async () => {
      const whiteBalanceSlider = page.locator('[data-testid="white-balance-slider"]');
      
      // Change white balance to 5600K
      await whiteBalanceSlider.fill('5600');
      
      // Wait for update
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="white-balance-status"]');
        return status && status.textContent?.includes('5600');
      });
      
      // Verify display
      await expect(page.locator('[data-testid="white-balance-display"]')).toContainText('5600K');
    });

    it('should complete ISO adjustment workflow', async () => {
      const isoSelect = page.locator('[data-testid="iso-select"]');
      
      // Change ISO to 800
      await isoSelect.selectOption('800');
      
      // Wait for update
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="iso-status"]');
        return status && status.textContent?.includes('800');
      });
      
      // Verify display
      await expect(page.locator('[data-testid="iso-display"]')).toContainText('ISO 800');
    });

    it('should handle multiple simultaneous control changes', async () => {
      // Change multiple settings at once
      await Promise.all([
        page.locator('[data-testid="frame-rate-slider"]').fill('25'),
        page.locator('[data-testid="white-balance-slider"]').fill('3200'),
        page.locator('[data-testid="iso-select"]').selectOption('1600')
      ]);
      
      // Wait for all updates to complete
      await page.waitForFunction(() => {
        const frameRateStatus = document.querySelector('[data-testid="frame-rate-status"]');
        const whiteBalanceStatus = document.querySelector('[data-testid="white-balance-status"]');
        const isoStatus = document.querySelector('[data-testid="iso-status"]');
        
        return frameRateStatus?.textContent?.includes('25') &&
               whiteBalanceStatus?.textContent?.includes('3200') &&
               isoStatus?.textContent?.includes('1600');
      });
      
      // Verify all displays are updated
      await expect(page.locator('[data-testid="frame-rate-display"]')).toContainText('25 fps');
      await expect(page.locator('[data-testid="white-balance-display"]')).toContainText('3200K');
      await expect(page.locator('[data-testid="iso-display"]')).toContainText('ISO 1600');
    });
  });

  describe('Playback Control Workflow', () => {
    beforeEach(async () => {
      // Establish camera connection and enter playback mode
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
      
      // Switch to playback mode
      await page.click('[data-testid="playback-mode-button"]');
      await page.waitForSelector('[data-testid="playback-controls"]');
    });

    it('should complete playback control workflow', async () => {
      // Step 1: Start playback
      await page.click('[data-testid="play-button"]');
      
      // Step 2: Verify playback status
      await page.waitForSelector('[data-testid="playback-status"][data-playing="true"]');
      await expect(page.locator('[data-testid="playback-indicator"]')).toContainText('Playing');
      
      // Step 3: Pause playback
      await page.click('[data-testid="pause-button"]');
      await page.waitForSelector('[data-testid="playback-status"][data-playing="false"]');
      await expect(page.locator('[data-testid="playback-indicator"]')).toContainText('Paused');
      
      // Step 4: Stop playback
      await page.click('[data-testid="stop-button"]');
      await expect(page.locator('[data-testid="playback-indicator"]')).toContainText('Stopped');
    });

    it('should handle clip navigation workflow', async () => {
      // Navigate to clip browser
      await page.click('[data-testid="clip-browser-tab"]');
      
      // Select a clip
      await page.click('[data-testid="clip-item"]:first-child');
      
      // Verify clip is loaded
      await expect(page.locator('[data-testid="current-clip-name"]')).not.toBeEmpty();
      
      // Play the selected clip
      await page.click('[data-testid="play-button"]');
      await page.waitForSelector('[data-testid="playback-status"][data-playing="true"]');
    });
  });

  describe('Timecode Synchronization Workflow', () => {
    beforeEach(async () => {
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
    });

    it('should complete timecode sync workflow', async () => {
      // Navigate to timecode settings
      await page.click('[data-testid="timecode-tab"]');
      
      // Sync timecode
      await page.click('[data-testid="sync-timecode-button"]');
      
      // Wait for sync to complete
      await page.waitForSelector('[data-testid="timecode-status"][data-synced="true"]');
      
      // Verify timecode display
      await expect(page.locator('[data-testid="timecode-display"]')).toMatch(/\d{2}:\d{2}:\d{2}:\d{2}/);
      
      // Verify sync indicator
      await expect(page.locator('[data-testid="sync-indicator"]')).toContainText('Synced');
    });

    it('should handle manual timecode setting', async () => {
      await page.click('[data-testid="timecode-tab"]');
      
      // Set custom timecode
      await page.fill('[data-testid="timecode-input"]', '01:30:45:12');
      await page.click('[data-testid="set-timecode-button"]');
      
      // Verify timecode is set
      await expect(page.locator('[data-testid="timecode-display"]')).toContainText('01:30:45:12');
    });
  });

  describe('Color Grading Workflow', () => {
    beforeEach(async () => {
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
    });

    it('should complete LUT loading workflow', async () => {
      // Navigate to color grading panel
      await page.click('[data-testid="color-grading-tab"]');
      
      // Open LUT manager
      await page.click('[data-testid="lut-manager-button"]');
      
      // Select a LUT
      await page.click('[data-testid="lut-item"]:first-child');
      
      // Load the LUT
      await page.click('[data-testid="load-lut-button"]');
      
      // Wait for LUT to load
      await page.waitForSelector('[data-testid="lut-status"][data-loaded="true"]');
      
      // Verify LUT is applied
      await expect(page.locator('[data-testid="current-lut-name"]')).not.toBeEmpty();
    });

    it('should complete color adjustment workflow', async () => {
      await page.click('[data-testid="color-grading-tab"]');
      
      // Adjust lift
      await page.locator('[data-testid="lift-red-slider"]').fill('0.1');
      await page.locator('[data-testid="lift-green-slider"]').fill('0.0');
      await page.locator('[data-testid="lift-blue-slider"]').fill('-0.1');
      
      // Adjust gamma
      await page.locator('[data-testid="gamma-red-slider"]').fill('1.1');
      
      // Adjust gain
      await page.locator('[data-testid="gain-blue-slider"]').fill('0.9');
      
      // Apply changes
      await page.click('[data-testid="apply-grading-button"]');
      
      // Verify changes are applied
      await page.waitForSelector('[data-testid="grading-status"][data-applied="true"]');
    });
  });

  describe('Error Recovery Workflow', () => {
    it('should recover from connection loss', async () => {
      // Establish connection
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
      
      // Simulate connection loss by stopping mock camera
      await mockCamera.stop();
      
      // Wait for disconnection detection
      await page.waitForSelector('[data-testid="connection-status"][data-connected="false"]');
      await expect(page.locator('[data-testid="connection-error"]')).toContainText('Connection lost');
      
      // Restart mock camera
      await mockCamera.start();
      
      // Attempt reconnection
      await page.click('[data-testid="reconnect-button"]');
      
      // Wait for reconnection
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
      
      // Verify controls are re-enabled
      await expect(page.locator('[data-testid="frame-rate-control"]')).toBeEnabled();
    });

    it('should handle command failures gracefully', async () => {
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
      
      // Try to set invalid frame rate
      await page.locator('[data-testid="frame-rate-slider"]').fill('150');
      
      // Wait for error notification
      await page.waitForSelector('[data-testid="error-notification"]');
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid frame rate');
      
      // Dismiss error
      await page.click('[data-testid="dismiss-error-button"]');
      
      // Verify error is dismissed
      await expect(page.locator('[data-testid="error-notification"]')).not.toBeVisible();
      
      // Verify control is still functional with valid value
      await page.locator('[data-testid="frame-rate-slider"]').fill('24');
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="frame-rate-status"]');
        return status && status.textContent?.includes('24');
      });
    });
  });

  describe('Performance Workflow', () => {
    beforeEach(async () => {
      await page.goto(`${TEST_CONFIG.frontendUrl}/camera`);
      await page.fill('[data-testid="camera-ip-input"]', '127.0.0.1');
      await page.click('[data-testid="connect-button"]');
      await page.waitForSelector('[data-testid="connection-status"][data-connected="true"]');
    });

    it('should handle rapid control changes efficiently', async () => {
      const startTime = Date.now();
      
      // Perform rapid control changes
      for (let i = 0; i < 10; i++) {
        await page.locator('[data-testid="frame-rate-slider"]').fill((24 + i).toString());
        await page.waitForTimeout(50); // Small delay between changes
      }
      
      // Wait for final update
      await page.waitForFunction(() => {
        const status = document.querySelector('[data-testid="frame-rate-status"]');
        return status && status.textContent?.includes('33');
      });
      
      const endTime = Date.now();
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
      
      // Verify final state
      await expect(page.locator('[data-testid="frame-rate-display"]')).toContainText('33 fps');
    });

    it('should maintain responsiveness during heavy operations', async () => {
      // Start a heavy operation (color grading adjustments)
      await page.click('[data-testid="color-grading-tab"]');
      
      // Make multiple simultaneous adjustments
      await Promise.all([
        page.locator('[data-testid="lift-red-slider"]').fill('0.2'),
        page.locator('[data-testid="gamma-green-slider"]').fill('1.2'),
        page.locator('[data-testid="gain-blue-slider"]').fill('0.8')
      ]);
      
      // UI should remain responsive - test by switching tabs
      await page.click('[data-testid="camera-control-tab"]');
      await expect(page.locator('[data-testid="frame-rate-control"]')).toBeVisible();
      
      // Switch back to color grading
      await page.click('[data-testid="color-grading-tab"]');
      await expect(page.locator('[data-testid="color-wheel"]')).toBeVisible();
    });
  });
});