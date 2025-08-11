/**
 * Touch Responsiveness Performance Tests
 * Tests for touch interaction performance and responsiveness
 */

import { test, expect, type Page } from '@playwright/test';

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  TOUCH_RESPONSE_TIME: 100, // milliseconds
  ANIMATION_FRAME_TIME: 16.67, // 60fps
  GESTURE_RECOGNITION_TIME: 50,
  HAPTIC_FEEDBACK_DELAY: 10,
  SCROLL_PERFORMANCE: 60, // fps
  RENDER_TIME: 33 // milliseconds for 30fps
};

// Helper functions
async function measureTouchResponse(page: Page, selector: string): Promise<number> {
  return await page.evaluate((sel) => {
    return new Promise<number>((resolve) => {
      const element = document.querySelector(sel);
      if (!element) {
        resolve(-1);
        return;
      }

      const startTime = performance.now();
      
      // Add event listener for visual feedback
      const onTransition = () => {
        const endTime = performance.now();
        element.removeEventListener('transitionstart', onTransition);
        resolve(endTime - startTime);
      };
      
      element.addEventListener('transitionstart', onTransition);
      
      // Simulate touch
      const touchEvent = new TouchEvent('touchstart', {
        touches: [new Touch({
          identifier: 0,
          target: element,
          clientX: 50,
          clientY: 50
        })]
      });
      
      element.dispatchEvent(touchEvent);
      
      // Fallback timeout
      setTimeout(() => {
        element.removeEventListener('transitionstart', onTransition);
        resolve(performance.now() - startTime);
      }, 200);
    });
  }, selector);
}

async function measureScrollPerformance(page: Page, selector: string): Promise<{ fps: number; frameDrops: number }> {
  return await page.evaluate((sel) => {
    return new Promise<{ fps: number; frameDrops: number }>((resolve) => {
      const element = document.querySelector(sel);
      if (!element) {
        resolve({ fps: 0, frameDrops: 0 });
        return;
      }

      const frameTimes: number[] = [];
      let lastFrameTime = performance.now();
      let frameDrops = 0;
      
      const measureFrame = () => {
        const currentTime = performance.now();
        const frameTime = currentTime - lastFrameTime;
        frameTimes.push(frameTime);
        
        // Count frame drops (>16.67ms for 60fps)
        if (frameTime > 16.67) {
          frameDrops++;
        }
        
        lastFrameTime = currentTime;
        
        if (frameTimes.length < 60) { // Measure for 1 second at 60fps
          requestAnimationFrame(measureFrame);
        } else {
          const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          const fps = 1000 / avgFrameTime;
          resolve({ fps, frameDrops });
        }
      };
      
      // Start scrolling
      element.scrollTop = 0;
      let scrollPosition = 0;
      const scrollInterval = setInterval(() => {
        scrollPosition += 10;
        element.scrollTop = scrollPosition;
        
        if (scrollPosition > 500) {
          clearInterval(scrollInterval);
        }
      }, 16);
      
      requestAnimationFrame(measureFrame);
    });
  }, selector);
}

test.describe('Touch Responsiveness Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set up mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    
    // Mock touch device
    await page.addInitScript(() => {
      // Mock touch support
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 10,
        writable: false
      });
      
      // Mock haptic feedback
      Object.defineProperty(navigator, 'vibrate', {
        value: (pattern: number | number[]) => {
          window.hapticFeedbackCalls = (window.hapticFeedbackCalls || 0) + 1;
          window.lastHapticPattern = pattern;
          return true;
        },
        writable: true
      });
      
      // Performance monitoring
      window.performanceMetrics = {
        touchEvents: [],
        renderTimes: [],
        animationFrames: []
      };
      
      // Override requestAnimationFrame to measure performance
      const originalRAF = window.requestAnimationFrame;
      window.requestAnimationFrame = (callback) => {
        const startTime = performance.now();
        return originalRAF(() => {
          const endTime = performance.now();
          window.performanceMetrics.animationFrames.push(endTime - startTime);
          callback(endTime);
        });
      };
    });
    
    // Navigate to app
    await page.goto('/');
    await page.waitForSelector('[data-testid="app-loaded"]');
  });

  test.describe('Basic Touch Response Times', () => {
    test('should respond to button touches within 100ms', async ({ page }) => {
      // Test various button types
      const buttons = [
        '[data-testid="connect-camera-btn"]',
        '[data-testid="nav-settings"]',
        '[data-testid="nav-playback"]',
        '[data-testid="nav-grading"]'
      ];
      
      for (const button of buttons) {
        const responseTime = await measureTouchResponse(page, button);
        
        expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
        expect(responseTime).toBeGreaterThan(0);
      }
    });

    test('should provide immediate visual feedback on touch', async ({ page }) => {
      const startTime = await page.evaluate(() => performance.now());
      
      // Touch a button and measure visual feedback
      await page.touchscreen.tap(100, 100);
      
      // Wait for visual state change
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="connect-camera-btn"]');
        return button && button.classList.contains('active');
      }, { timeout: 100 });
      
      const endTime = await page.evaluate(() => performance.now());
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
    });

    test('should handle rapid successive touches', async ({ page }) => {
      const responseTimes: number[] = [];
      
      // Perform rapid touches
      for (let i = 0; i < 10; i++) {
        const startTime = await page.evaluate(() => performance.now());
        
        await page.touchscreen.tap(100 + i * 10, 100);
        
        // Wait for response
        await page.waitForTimeout(10);
        
        const endTime = await page.evaluate(() => performance.now());
        responseTimes.push(endTime - startTime);
      }
      
      // All responses should be fast
      responseTimes.forEach(time => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
      });
      
      // Average response time should be good
      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      expect(avgResponseTime).toBeLessThan(50);
    });
  });

  test.describe('Control-Specific Performance', () => {
    test('should handle color wheel interactions smoothly', async ({ page }) => {
      // Navigate to grading panel
      await page.click('[data-testid="nav-grading"]');
      await page.waitForSelector('[data-testid="grading-panel"]');
      
      // Expand color wheel
      await page.click('[data-testid="shadows-wheel"]');
      await page.waitForSelector('[data-testid="expanded-color-wheel"]');
      
      // Measure color wheel drag performance
      const colorWheel = page.locator('[data-testid="color-wheel-canvas"]');
      const boundingBox = await colorWheel.boundingBox();
      
      if (boundingBox) {
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        
        // Start drag
        const startTime = await page.evaluate(() => performance.now());
        
        await page.touchscreen.tap(centerX, centerY);
        
        // Perform circular drag motion
        const steps = 20;
        const radius = 50;
        
        for (let i = 0; i < steps; i++) {
          const angle = (i / steps) * 2 * Math.PI;
          const x = centerX + Math.cos(angle) * radius;
          const y = centerY + Math.sin(angle) * radius;
          
          await page.touchscreen.tap(x, y);
          await page.waitForTimeout(16); // 60fps
        }
        
        const endTime = await page.evaluate(() => performance.now());
        const totalTime = endTime - startTime;
        const avgTimePerStep = totalTime / steps;
        
        // Each step should be processed quickly
        expect(avgTimePerStep).toBeLessThan(PERFORMANCE_THRESHOLDS.ANIMATION_FRAME_TIME);
      }
    });

    test('should handle slider interactions responsively', async ({ page }) => {
      await page.click('[data-testid="nav-settings"]');
      await page.waitForSelector('[data-testid="settings-panel"]');
      
      // Test white balance slider
      await page.click('[data-testid="white-balance-control"]');
      
      const slider = page.locator('[data-testid="kelvin-slider"]');
      const boundingBox = await slider.boundingBox();
      
      if (boundingBox) {
        const responseTimes: number[] = [];
        
        // Test multiple slider positions
        for (let i = 0; i < 10; i++) {
          const x = boundingBox.x + (boundingBox.width * i / 10);
          const y = boundingBox.y + boundingBox.height / 2;
          
          const startTime = await page.evaluate(() => performance.now());
          
          await page.touchscreen.tap(x, y);
          
          // Wait for value update
          await page.waitForFunction(() => {
            const valueElement = document.querySelector('[data-testid="kelvin-value"]');
            return valueElement && valueElement.textContent !== '';
          });
          
          const endTime = await page.evaluate(() => performance.now());
          responseTimes.push(endTime - startTime);
        }
        
        // All slider interactions should be responsive
        responseTimes.forEach(time => {
          expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
        });
      }
    });

    test('should handle pinch-to-zoom gestures smoothly', async ({ page }) => {
      await page.click('[data-testid="nav-grading"]');
      await page.click('[data-testid="shadows-wheel"]');
      
      const colorWheel = page.locator('[data-testid="expanded-color-wheel"]');
      const boundingBox = await colorWheel.boundingBox();
      
      if (boundingBox) {
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        
        // Simulate pinch gesture
        const startTime = await page.evaluate(() => performance.now());
        
        // Start with two fingers close together
        await page.touchscreen.tap(centerX - 10, centerY);
        await page.touchscreen.tap(centerX + 10, centerY);
        
        // Move fingers apart (zoom in)
        for (let i = 1; i <= 10; i++) {
          await page.touchscreen.tap(centerX - 10 - i * 5, centerY);
          await page.touchscreen.tap(centerX + 10 + i * 5, centerY);
          await page.waitForTimeout(16);
        }
        
        const endTime = await page.evaluate(() => performance.now());
        const totalTime = endTime - startTime;
        
        // Gesture should be processed smoothly
        expect(totalTime).toBeLessThan(500);
        
        // Check if zoom was applied
        const transform = await colorWheel.evaluate(el => 
          window.getComputedStyle(el).transform
        );
        expect(transform).not.toBe('none');
      }
    });
  });

  test.describe('Scroll Performance', () => {
    test('should maintain 60fps during clip list scrolling', async ({ page }) => {
      // Mock large clip list
      await page.route('**/api/playback/clips', route => {
        const largeClipList = Array.from({ length: 100 }, (_, i) => ({
          id: `clip-${i}`,
          name: `Clip ${i}`,
          duration: 120,
          frameRate: 24,
          resolution: '4096x2160',
          codec: 'ARRIRAW'
        }));
        
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ clips: largeClipList })
        });
      });
      
      await page.click('[data-testid="nav-playback"]');
      await page.waitForSelector('[data-testid="clip-list"]');
      
      // Measure scroll performance
      const scrollMetrics = await measureScrollPerformance(page, '[data-testid="clip-list"]');
      
      expect(scrollMetrics.fps).toBeGreaterThan(PERFORMANCE_THRESHOLDS.SCROLL_PERFORMANCE);
      expect(scrollMetrics.frameDrops).toBeLessThan(5); // Allow some frame drops
    });

    test('should handle momentum scrolling smoothly', async ({ page }) => {
      await page.click('[data-testid="nav-playback"]');
      await page.waitForSelector('[data-testid="clip-list"]');
      
      const clipList = page.locator('[data-testid="clip-list"]');
      const boundingBox = await clipList.boundingBox();
      
      if (boundingBox) {
        // Simulate flick gesture
        const startY = boundingBox.y + 100;
        const endY = boundingBox.y + 50;
        
        await page.touchscreen.tap(boundingBox.x + 50, startY);
        
        // Quick swipe up
        const swipeSteps = 5;
        for (let i = 0; i < swipeSteps; i++) {
          const y = startY + (endY - startY) * (i / swipeSteps);
          await page.touchscreen.tap(boundingBox.x + 50, y);
          await page.waitForTimeout(5);
        }
        
        // Measure momentum scroll
        const initialScrollTop = await clipList.evaluate(el => el.scrollTop);
        
        // Wait for momentum to take effect
        await page.waitForTimeout(100);
        
        const finalScrollTop = await clipList.evaluate(el => el.scrollTop);
        
        // Should have momentum scrolled beyond the gesture
        expect(finalScrollTop).toBeGreaterThan(initialScrollTop + 50);
      }
    });
  });

  test.describe('Haptic Feedback Performance', () => {
    test('should provide haptic feedback within 10ms', async ({ page }) => {
      // Reset haptic feedback counter
      await page.evaluate(() => {
        window.hapticFeedbackCalls = 0;
      });
      
      const startTime = await page.evaluate(() => performance.now());
      
      // Trigger haptic feedback
      await page.click('[data-testid="nav-settings"]');
      
      // Wait for haptic feedback
      await page.waitForFunction(() => window.hapticFeedbackCalls > 0);
      
      const endTime = await page.evaluate(() => performance.now());
      const hapticDelay = endTime - startTime;
      
      expect(hapticDelay).toBeLessThan(PERFORMANCE_THRESHOLDS.HAPTIC_FEEDBACK_DELAY);
    });

    test('should provide appropriate haptic patterns', async ({ page }) => {
      const hapticPatterns: any[] = [];
      
      // Monitor haptic patterns
      await page.evaluate(() => {
        const originalVibrate = navigator.vibrate;
        navigator.vibrate = (pattern) => {
          window.hapticPatterns = window.hapticPatterns || [];
          window.hapticPatterns.push(pattern);
          return originalVibrate.call(navigator, pattern);
        };
      });
      
      // Test different interaction types
      await page.click('[data-testid="nav-settings"]'); // Light tap
      await page.waitForTimeout(50);
      
      await page.click('[data-testid="frame-rate-control"]'); // Medium tap
      await page.waitForTimeout(50);
      
      // Get recorded patterns
      const patterns = await page.evaluate(() => window.hapticPatterns);
      
      expect(patterns).toHaveLength(2);
      
      // Different interactions should have different patterns
      expect(patterns[0]).not.toEqual(patterns[1]);
    });
  });

  test.describe('Animation Performance', () => {
    test('should maintain smooth transitions', async ({ page }) => {
      // Test navigation transitions
      const navigationItems = [
        '[data-testid="nav-settings"]',
        '[data-testid="nav-playback"]',
        '[data-testid="nav-grading"]',
        '[data-testid="nav-timecode"]'
      ];
      
      for (const navItem of navigationItems) {
        const startTime = await page.evaluate(() => performance.now());
        
        await page.click(navItem);
        
        // Wait for transition to complete
        await page.waitForSelector('[data-testid*="panel"]', { state: 'visible' });
        
        const endTime = await page.evaluate(() => performance.now());
        const transitionTime = endTime - startTime;
        
        // Transitions should be quick and smooth
        expect(transitionTime).toBeLessThan(300);
      }
    });

    test('should handle concurrent animations efficiently', async ({ page }) => {
      await page.click('[data-testid="nav-grading"]');
      
      // Trigger multiple animations simultaneously
      const startTime = await page.evaluate(() => performance.now());
      
      // Expand multiple color wheels
      await Promise.all([
        page.click('[data-testid="shadows-wheel"]'),
        page.click('[data-testid="midtones-wheel"]'),
        page.click('[data-testid="highlights-wheel"]')
      ]);
      
      // Wait for all animations to complete
      await page.waitForSelector('[data-testid="expanded-color-wheel"]');
      
      const endTime = await page.evaluate(() => performance.now());
      const totalTime = endTime - startTime;
      
      // Multiple animations should not significantly impact performance
      expect(totalTime).toBeLessThan(500);
    });
  });

  test.describe('Memory and Resource Usage', () => {
    test('should not leak memory during interactions', async ({ page }) => {
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });
      
      // Perform many interactions
      for (let i = 0; i < 50; i++) {
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="nav-grading"]');
        await page.click('[data-testid="shadows-wheel"]');
        await page.keyboard.press('Escape'); // Close expanded wheel
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if ('gc' in window) {
          (window as any).gc();
        }
      });
      
      // Check final memory usage
      const finalMemory = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return 0;
      });
      
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100;
        
        // Memory increase should be reasonable
        expect(memoryIncreasePercent).toBeLessThan(50);
      }
    });

    test('should efficiently handle DOM updates', async ({ page }) => {
      // Monitor DOM mutation performance
      const mutationMetrics = await page.evaluate(() => {
        return new Promise<{ mutationCount: number; avgTime: number }>((resolve) => {
          const mutations: number[] = [];
          let mutationCount = 0;
          
          const observer = new MutationObserver((mutationsList) => {
            const startTime = performance.now();
            mutationCount += mutationsList.length;
            const endTime = performance.now();
            mutations.push(endTime - startTime);
          });
          
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
          });
          
          // Trigger DOM updates
          setTimeout(() => {
            observer.disconnect();
            const avgTime = mutations.reduce((a, b) => a + b, 0) / mutations.length;
            resolve({ mutationCount, avgTime });
          }, 1000);
        });
      });
      
      // Trigger DOM updates
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="nav-settings"]');
        await page.click('[data-testid="nav-grading"]');
      }
      
      const metrics = await mutationMetrics;
      
      // DOM mutations should be processed efficiently
      expect(metrics.avgTime).toBeLessThan(5);
    });
  });

  test.describe('Network Performance Impact', () => {
    test('should maintain responsiveness during network requests', async ({ page }) => {
      // Simulate slow network
      await page.route('**/api/**', route => {
        setTimeout(() => {
          route.continue();
        }, 500); // 500ms delay
      });
      
      // Test UI responsiveness during network requests
      const responseTimes: number[] = [];
      
      // Trigger network request
      page.click('[data-testid="connect-camera-btn"]');
      
      // Test UI responsiveness while request is pending
      for (let i = 0; i < 5; i++) {
        const startTime = await page.evaluate(() => performance.now());
        
        await page.click('[data-testid="nav-settings"]');
        
        const endTime = await page.evaluate(() => performance.now());
        responseTimes.push(endTime - startTime);
        
        await page.waitForTimeout(100);
      }
      
      // UI should remain responsive despite network delays
      responseTimes.forEach(time => {
        expect(time).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
      });
    });
  });
});