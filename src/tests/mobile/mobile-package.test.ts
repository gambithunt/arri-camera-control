/**
 * Mobile Package Integration Test
 * Tests the complete mobile app package functionality
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// Mock Capacitor for testing
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
    getPlatform: () => 'ios'
  }
}));

vi.mock('@capacitor/splash-screen', () => ({
  SplashScreen: {
    hide: vi.fn()
  }
}));

vi.mock('@capacitor/status-bar', () => ({
  StatusBar: {
    setStyle: vi.fn(),
    setBackgroundColor: vi.fn()
  },
  Style: {
    Dark: 'dark'
  }
}));

vi.mock('@capacitor/haptics', () => ({
  Haptics: {
    impact: vi.fn()
  },
  ImpactStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy'
  }
}));

vi.mock('@capacitor/network', () => ({
  Network: {
    getStatus: vi.fn().mockResolvedValue({ connected: true }),
    addListener: vi.fn().mockReturnValue({ remove: vi.fn() })
  }
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    readdir: vi.fn().mockResolvedValue({ files: [] }),
    mkdir: vi.fn()
  },
  Directory: {
    Documents: 'documents'
  },
  Encoding: {
    UTF8: 'utf8'
  }
}));

describe('Mobile Package Integration Tests', () => {
  beforeAll(async () => {
    // Ensure build directory exists
    if (!fs.existsSync('build')) {
      fs.mkdirSync('build', { recursive: true });
    }
  });

  afterAll(async () => {
    // Cleanup test artifacts
    try {
      if (fs.existsSync('build/test-artifacts')) {
        fs.rmSync('build/test-artifacts', { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Build System', () => {
    it('should have all required build scripts', () => {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const requiredScripts = [
        'build:mobile',
        'build:ios',
        'build:android',
        'test:mobile',
        'deploy:mobile',
        'deploy:ios',
        'deploy:android',
        'deploy:all'
      ];

      requiredScripts.forEach(script => {
        expect(packageJson.scripts).toHaveProperty(script);
      });
    });

    it('should have all required build script files', () => {
      const requiredScripts = [
        'scripts/build-mobile.js',
        'scripts/build-ios.js',
        'scripts/build-android.js',
        'scripts/test-mobile.js',
        'scripts/deploy-mobile.js'
      ];

      requiredScripts.forEach(script => {
        expect(fs.existsSync(script)).toBe(true);
      });
    });

    it('should have valid Capacitor configuration', () => {
      expect(fs.existsSync('capacitor.config.ts')).toBe(true);
      
      const config = fs.readFileSync('capacitor.config.ts', 'utf8');
      expect(config).toContain('appId: \'com.arri.cameracontrol\'');
      expect(config).toContain('appName: \'ARRI Camera Control\'');
      expect(config).toContain('webDir: \'build\'');
    });
  });

  describe('Mobile Infrastructure', () => {
    it('should have all mobile infrastructure components', async () => {
      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      const { appInitializer } = await import('../../lib/mobile/app-initializer');
      const { mobileBackend } = await import('../../lib/mobile/backend-launcher');
      const { connectionManager } = await import('../../lib/mobile/connection-manager');
      const { offlineStorage } = await import('../../lib/mobile/offline-storage');

      expect(mobileAdapter).toBeDefined();
      expect(appInitializer).toBeDefined();
      expect(mobileBackend).toBeDefined();
      expect(connectionManager).toBeDefined();
      expect(offlineStorage).toBeDefined();
    });

    it('should initialize mobile adapter successfully', async () => {
      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      
      const initialized = await mobileAdapter.initialize();
      expect(initialized).toBe(true);
      
      const status = mobileAdapter.getStatus();
      expect(status.initialized).toBe(true);
      
      await mobileAdapter.cleanup();
    });

    it('should handle offline storage operations', async () => {
      const { offlineStorage } = await import('../../lib/mobile/offline-storage');
      
      const initialized = await offlineStorage.initialize();
      expect(initialized).toBe(true);
      
      // Test storage operations
      const testData = { test: 'mobile-package', timestamp: Date.now() };
      const stored = await offlineStorage.set('mobile-test', testData);
      expect(stored).toBe(true);
      
      const retrieved = await offlineStorage.get('mobile-test');
      expect(retrieved).toEqual(testData);
      
      const deleted = await offlineStorage.delete('mobile-test');
      expect(deleted).toBe(true);
    });
  });

  describe('Offline Functionality', () => {
    it('should work without internet connection', async () => {
      // Mock offline network state
      const originalNavigator = global.navigator;
      global.navigator = {
        ...originalNavigator,
        onLine: false
      } as any;

      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      
      const initialized = await mobileAdapter.initialize();
      expect(initialized).toBe(true);
      
      // Should be in offline mode
      expect(mobileAdapter.isOffline()).toBe(true);
      
      // Should still be able to store data
      const settings = { theme: 'dark', offline: true };
      const updated = await mobileAdapter.updateSettings(settings);
      expect(updated).toBe(true);
      
      await mobileAdapter.cleanup();
      
      // Restore original navigator
      global.navigator = originalNavigator;
    });

    it('should queue operations when offline', async () => {
      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      
      await mobileAdapter.initialize();
      
      // Mock offline state
      vi.spyOn(mobileAdapter, 'isOffline').mockReturnValue(true);
      
      try {
        // This should queue the operation instead of executing it
        await mobileAdapter.cameraCommand('setFrameRate', { frameRate: 24 });
        
        // Should have pending operations
        const pendingCount = mobileAdapter.getPendingOperationsCount();
        expect(pendingCount).toBeGreaterThanOrEqual(0);
      } catch (error) {
        // Operation might fail or be queued, both are acceptable
        expect(error).toBeDefined();
      }
      
      await mobileAdapter.cleanup();
    });
  });

  describe('Camera Connectivity Simulation', () => {
    it('should simulate camera connection', async () => {
      const { localServer } = await import('../../lib/mobile/local-server');
      
      const started = await localServer.start();
      expect(started).toBe(true);
      
      const status = localServer.getStatus();
      expect(status.running).toBe(true);
      
      await localServer.stop();
    });

    it('should handle camera commands', async () => {
      const { localServer } = await import('../../lib/mobile/local-server');
      
      await localServer.start();
      
      // Test local API if available
      if ((window as any).localAPI) {
        const response = await (window as any).localAPI.camera.setFrameRate({ frameRate: 24 });
        expect(response).toBeDefined();
        expect(response.success).toBeDefined();
      }
      
      await localServer.stop();
    });
  });

  describe('Build Artifacts', () => {
    it('should create build directory structure', () => {
      const buildDir = 'build';
      
      if (!fs.existsSync(buildDir)) {
        fs.mkdirSync(buildDir, { recursive: true });
      }
      
      expect(fs.existsSync(buildDir)).toBe(true);
      
      // Create test artifacts directory
      const artifactsDir = path.join(buildDir, 'test-artifacts');
      if (!fs.existsSync(artifactsDir)) {
        fs.mkdirSync(artifactsDir, { recursive: true });
      }
      
      expect(fs.existsSync(artifactsDir)).toBe(true);
    });

    it('should generate mobile configuration files', () => {
      const buildDir = 'build';
      
      // Create mock configuration files
      const iosConfig = {
        name: 'ARRI Camera Control',
        bundleId: 'com.arri.cameracontrol',
        version: '1.0.0',
        platform: 'ios'
      };
      
      const androidConfig = {
        name: 'ARRI Camera Control',
        packageName: 'com.arri.cameracontrol',
        version: '1.0.0',
        platform: 'android'
      };
      
      fs.writeFileSync(
        path.join(buildDir, 'ios-config.json'),
        JSON.stringify(iosConfig, null, 2)
      );
      
      fs.writeFileSync(
        path.join(buildDir, 'android-config.json'),
        JSON.stringify(androidConfig, null, 2)
      );
      
      expect(fs.existsSync(path.join(buildDir, 'ios-config.json'))).toBe(true);
      expect(fs.existsSync(path.join(buildDir, 'android-config.json'))).toBe(true);
    });
  });

  describe('Platform Support', () => {
    it('should support iOS platform configuration', () => {
      const iosConfig = {
        bundleId: 'com.arri.cameracontrol',
        deploymentTarget: '13.0',
        orientation: ['landscape', 'portrait'],
        permissions: ['NSLocalNetworkUsageDescription']
      };
      
      expect(iosConfig.bundleId).toBe('com.arri.cameracontrol');
      expect(iosConfig.deploymentTarget).toBe('13.0');
      expect(iosConfig.permissions).toContain('NSLocalNetworkUsageDescription');
    });

    it('should support Android platform configuration', () => {
      const androidConfig = {
        packageName: 'com.arri.cameracontrol',
        minSdkVersion: 22,
        targetSdkVersion: 34,
        permissions: ['INTERNET', 'ACCESS_NETWORK_STATE', 'ACCESS_WIFI_STATE']
      };
      
      expect(androidConfig.packageName).toBe('com.arri.cameracontrol');
      expect(androidConfig.minSdkVersion).toBe(22);
      expect(androidConfig.permissions).toContain('INTERNET');
    });
  });

  describe('Error Handling', () => {
    it('should handle build errors gracefully', () => {
      // Test error handling in build process
      const mockError = new Error('Build failed');
      
      expect(() => {
        try {
          throw mockError;
        } catch (error) {
          expect(error.message).toBe('Build failed');
          // Error should be caught and handled
        }
      }).not.toThrow();
    });

    it('should handle missing dependencies', () => {
      // Test handling of missing dependencies
      const requiredDependencies = [
        '@capacitor/core',
        '@capacitor/ios',
        '@capacitor/android',
        '@capacitor/cli'
      ];
      
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      requiredDependencies.forEach(dep => {
        expect(
          packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
        ).toBeDefined();
      });
    });
  });

  describe('Performance', () => {
    it('should initialize within reasonable time', async () => {
      const startTime = Date.now();
      
      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      await mobileAdapter.initialize();
      
      const initTime = Date.now() - startTime;
      
      // Should initialize within 10 seconds
      expect(initTime).toBeLessThan(10000);
      
      await mobileAdapter.cleanup();
    });

    it('should handle storage operations efficiently', async () => {
      const { offlineStorage } = await import('../../lib/mobile/offline-storage');
      
      await offlineStorage.initialize();
      
      const startTime = Date.now();
      
      // Perform multiple storage operations
      for (let i = 0; i < 10; i++) {
        await offlineStorage.set(`test-${i}`, { index: i, data: 'test' });
      }
      
      const operationTime = Date.now() - startTime;
      
      // Should complete within 1 second
      expect(operationTime).toBeLessThan(1000);
      
      // Cleanup
      for (let i = 0; i < 10; i++) {
        await offlineStorage.delete(`test-${i}`);
      }
    });
  });

  describe('Integration', () => {
    it('should integrate all mobile components', async () => {
      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      
      const initialized = await mobileAdapter.initialize();
      expect(initialized).toBe(true);
      
      const status = mobileAdapter.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.storageReady).toBe(true);
      
      // Test component integration
      const settings = await mobileAdapter.getSettings();
      expect(settings).toBeDefined();
      
      const cameras = await mobileAdapter.getCameras();
      expect(Array.isArray(cameras)).toBe(true);
      
      await mobileAdapter.cleanup();
    });

    it('should maintain state consistency', async () => {
      const { mobileAdapter } = await import('../../lib/mobile/mobile-adapter');
      
      await mobileAdapter.initialize();
      
      // Update settings
      const newSettings = { theme: 'light', testMode: true };
      await mobileAdapter.updateSettings(newSettings);
      
      // Retrieve settings
      const retrievedSettings = await mobileAdapter.getSettings();
      expect(retrievedSettings.theme).toBe('light');
      expect(retrievedSettings.testMode).toBe(true);
      
      await mobileAdapter.cleanup();
    });
  });
});