/**
 * Playwright Configuration
 * Configuration for end-to-end and performance tests
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:5173',
    
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Take screenshot on failure
    screenshot: 'only-on-failure',
    
    // Global timeout for each test
    actionTimeout: 30000,
    
    // Global timeout for navigation
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Enable touch events for desktop testing
        hasTouch: true,
        // Mock geolocation
        geolocation: { latitude: 37.7749, longitude: -122.4194 },
        permissions: ['geolocation']
      },
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        hasTouch: true
      },
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        hasTouch: true
      },
    },

    // Mobile devices - Primary targets for camera control app
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        // Override viewport for testing
        viewport: { width: 393, height: 851 }
      },
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        // Override viewport for testing
        viewport: { width: 390, height: 844 }
      },
    },

    // Tablet devices - Primary target (iPad Pro)
    {
      name: 'iPad Pro',
      use: {
        ...devices['iPad Pro'],
        viewport: { width: 1024, height: 1366 }
      },
    },
    
    {
      name: 'iPad Pro Landscape',
      use: {
        ...devices['iPad Pro landscape'],
        viewport: { width: 1366, height: 1024 }
      },
    },

    // Performance testing project
    {
      name: 'Performance Tests',
      testDir: './tests/performance',
      use: {
        ...devices['iPad Pro'],
        // Enable performance metrics
        trace: 'on',
        video: 'on',
        // Longer timeout for performance tests
        actionTimeout: 60000,
      },
    },

    // Integration testing project
    {
      name: 'Integration Tests',
      testDir: './tests/integration',
      use: {
        ...devices['Desktop Chrome'],
        // Disable video for faster integration tests
        video: 'off',
        screenshot: 'off',
      },
    },
  ],

  // Global setup and teardown
  globalSetup: require.resolve('./tests/global-setup.ts'),
  globalTeardown: require.resolve('./tests/global-teardown.ts'),

  // Run your local dev server before starting the tests
  webServer: [
    {
      command: 'npm run dev',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'npm run dev:backend',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    }
  ],

  // Test timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
  },

  // Output directory
  outputDir: 'test-results/',

  // Test match patterns
  testMatch: [
    '**/*.spec.ts',
    '**/*.test.ts'
  ],

  // Test ignore patterns
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**'
  ],
});