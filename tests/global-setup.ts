/**
 * Global Test Setup
 * Sets up test environment before running tests
 */

import { chromium, type FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

async function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close(() => resolve(false));
    });
    
    server.on('error', () => resolve(true));
  });
}

async function waitForPort(port: number, timeout = 30000): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await isPortInUse(port)) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  throw new Error(`Port ${port} did not become available within ${timeout}ms`);
}

async function setupMockCameraServer(): Promise<void> {
  console.log('Setting up mock CAP server...');
  
  try {
    // Start mock CAP server for testing
    const mockServerProcess = exec('node tests/mocks/mock-cap-server.js', {
      cwd: process.cwd()
    });
    
    mockServerProcess.stdout?.on('data', (data) => {
      console.log(`Mock CAP Server: ${data}`);
    });
    
    mockServerProcess.stderr?.on('data', (data) => {
      console.error(`Mock CAP Server Error: ${data}`);
    });
    
    // Wait for mock server to start
    await waitForPort(9999, 10000);
    console.log('Mock CAP server started on port 9999');
    
    // Store process reference for cleanup
    (global as any).mockCameraServerProcess = mockServerProcess;
    
  } catch (error) {
    console.warn('Failed to start mock CAP server:', error);
    console.log('Tests will run without mock camera server');
  }
}

async function setupTestDatabase(): Promise<void> {
  console.log('Setting up test database...');
  
  try {
    // Initialize test database with sample data
    await execAsync('npm run db:test:setup');
    console.log('Test database initialized');
  } catch (error) {
    console.warn('Failed to setup test database:', error);
  }
}

async function setupTestEnvironment(): Promise<void> {
  console.log('Setting up test environment variables...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.TEST_MODE = 'true';
  process.env.MOCK_CAMERA_ENABLED = 'true';
  process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests
  
  // Disable analytics and telemetry
  process.env.DISABLE_ANALYTICS = 'true';
  process.env.DISABLE_TELEMETRY = 'true';
  
  console.log('Test environment configured');
}

async function warmupBrowser(): Promise<void> {
  console.log('Warming up browser...');
  
  try {
    // Launch browser to warm up
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to app to trigger initial load
    await page.goto('http://localhost:5173', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    
    // Wait for app to be ready
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 15000 });
    
    await browser.close();
    console.log('Browser warmup completed');
    
  } catch (error) {
    console.warn('Browser warmup failed:', error);
  }
}

async function setupPerformanceMonitoring(): Promise<void> {
  console.log('Setting up performance monitoring...');
  
  // Create performance monitoring directory
  try {
    await execAsync('mkdir -p test-results/performance');
    console.log('Performance monitoring directory created');
  } catch (error) {
    console.warn('Failed to create performance directory:', error);
  }
}

async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting global test setup...');
  
  try {
    // Setup test environment
    await setupTestEnvironment();
    
    // Setup mock services
    await setupMockCameraServer();
    
    // Setup test database
    await setupTestDatabase();
    
    // Setup performance monitoring
    await setupPerformanceMonitoring();
    
    // Wait for web servers to be ready
    console.log('Waiting for web servers to be ready...');
    await waitForPort(5173, 60000); // Frontend
    await waitForPort(3000, 30000);  // Backend
    
    // Warmup browser
    await warmupBrowser();
    
    console.log('✅ Global test setup completed successfully');
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

export default globalSetup;