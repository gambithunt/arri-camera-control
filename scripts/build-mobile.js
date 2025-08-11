#!/usr/bin/env node

/**
 * Mobile Build Script
 * Builds and packages the ARRI Camera Control app for mobile deployment
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Building ARRI Camera Control Mobile App...\n');

async function buildMobileApp() {
  try {
    // Step 1: Clean previous builds
    console.log('📦 Cleaning previous builds...');
    if (fs.existsSync('build')) {
      fs.rmSync('build', { recursive: true, force: true });
    }
    if (fs.existsSync('dist')) {
      fs.rmSync('dist', { recursive: true, force: true });
    }

    // Step 2: Build the SvelteKit frontend
    console.log('🔨 Building SvelteKit frontend...');
    execSync('npm run build', { stdio: 'inherit' });

    // Step 3: Prepare backend for mobile packaging
    console.log('📱 Preparing backend for mobile packaging...');
    await prepareBackendForMobile();

    // Step 4: Copy assets and configure for mobile
    console.log('🎨 Copying mobile assets...');
    await copyMobileAssets();

    // Step 5: Configure iOS-specific settings
    console.log('🍎 Configuring iOS-specific settings...');
    await configureIOSSettings();

    // Step 6: Generate Capacitor resources
    console.log('⚡ Generating Capacitor resources...');
    try {
      execSync('npx capacitor-assets generate', { stdio: 'inherit' });
    } catch (error) {
      console.warn('Warning: Could not generate Capacitor assets. You may need to install @capacitor/assets');
      console.warn('Run: npm install -g @capacitor/assets');
    }

    // Step 7: Sync with Capacitor
    console.log('🔄 Syncing with Capacitor...');
    execSync('npx cap sync ios', { stdio: 'inherit' });

    console.log('\n✅ Mobile app build complete!');
    console.log('\nNext steps:');
    console.log('📱 For iOS: npx cap open ios');
    console.log('🤖 For Android: npx cap open android');
    console.log('\nOr run on device:');
    console.log('📱 iOS: npx cap run ios');
    console.log('🤖 Android: npx cap run android');

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

async function prepareBackendForMobile() {
  // Create a mobile-specific backend configuration
  const mobileBackendConfig = {
    name: 'arri-camera-control-mobile-backend',
    version: '1.0.0',
    description: 'Embedded backend for ARRI Camera Control mobile app',
    main: 'mobile-server.js',
    scripts: {
      start: 'node mobile-server.js'
    },
    dependencies: {
      express: '^4.18.2',
      'socket.io': '^4.7.4',
      cors: '^2.8.5',
      winston: '^3.11.0'
    }
  };

  // Create mobile backend directory
  const mobileBackendDir = path.join('build', 'mobile-backend');
  if (!fs.existsSync(mobileBackendDir)) {
    fs.mkdirSync(mobileBackendDir, { recursive: true });
  }

  // Write mobile backend package.json
  fs.writeFileSync(
    path.join(mobileBackendDir, 'package.json'),
    JSON.stringify(mobileBackendConfig, null, 2)
  );

  // Create a simplified mobile server
  const mobileServerCode = `
/**
 * Mobile Backend Server
 * Simplified backend server for mobile app deployment
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

class MobileBackendServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.static('public'));
  }

  setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.get('/api/info', (req, res) => {
      res.json({
        name: 'ARRI Camera Control Mobile Backend',
        version: '1.0.0',
        platform: 'mobile'
      });
    });
  }

  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Handle camera connection
      socket.on('camera:connect', (data) => {
        // Simulate camera connection
        setTimeout(() => {
          socket.emit('camera:connect:success', {
            model: 'ARRI ALEXA Mini LF',
            serialNumber: 'ALF001234',
            firmwareVersion: '7.2.1'
          });
        }, 1000);
      });

      // Handle camera controls
      socket.on('camera:frameRate:set', (data) => {
        if (data.frameRate >= 1 && data.frameRate <= 120) {
          socket.emit('camera:frameRate:success', { frameRate: data.frameRate });
        } else {
          socket.emit('camera:frameRate:error', {
            code: 'CAP_003',
            message: 'Invalid frame rate'
          });
        }
      });

      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }

  start(port = 3001) {
    return new Promise((resolve) => {
      this.server.listen(port, () => {
        console.log(\`Mobile backend server running on port \${port}\`);
        resolve();
      });
    });
  }
}

// Start the server
const server = new MobileBackendServer();
server.start().catch(console.error);
`;

  fs.writeFileSync(path.join(mobileBackendDir, 'mobile-server.js'), mobileServerCode);

  console.log('✅ Mobile backend prepared');
}

async function copyMobileAssets() {
  // Copy any additional mobile-specific assets
  const assetsDir = path.join('build', 'assets');
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Create a mobile app manifest
  const mobileManifest = {
    name: 'ARRI Camera Control',
    short_name: 'ARRI Control',
    description: 'Professional camera control for ARRI cameras',
    version: '1.0.0',
    orientation: 'landscape-primary',
    display: 'fullscreen',
    theme_color: '#1a1a1a',
    background_color: '#1a1a1a',
    offline: true
  };

  fs.writeFileSync(
    path.join('build', 'mobile-manifest.json'),
    JSON.stringify(mobileManifest, null, 2)
  );

  console.log('✅ Mobile assets copied');
}

async function configureIOSSettings() {
  // Create iOS-specific configuration
  const iosConfigDir = path.join('ios', 'App', 'App');
  
  if (fs.existsSync(iosConfigDir)) {
    // Copy Info.plist additions if they exist
    const infoPlistAdditions = path.join('ios', 'App', 'App', 'Info.plist.additions');
    if (fs.existsSync(infoPlistAdditions)) {
      console.log('📱 iOS Info.plist additions found');
    }
    
    // Create iOS-specific build configuration
    const iosConfig = {
      name: 'ARRI Camera Control',
      bundleId: 'com.arri.cameracontrol',
      version: '1.0.0',
      buildNumber: '1',
      deploymentTarget: '13.0',
      orientation: 'landscape',
      offline: true
    };
    
    fs.writeFileSync(
      path.join('build', 'ios-config.json'),
      JSON.stringify(iosConfig, null, 2)
    );
    
    console.log('✅ iOS settings configured');
  } else {
    console.log('⚠️  iOS platform not found. Run: npx cap add ios');
  }
}

// Run the build
buildMobileApp();