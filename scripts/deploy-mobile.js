#!/usr/bin/env node

/**
 * Mobile Deployment Script
 * Complete deployment pipeline for ARRI Camera Control mobile app
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🚀 ARRI Camera Control Mobile Deployment Pipeline\n');

async function deployMobileApp() {
  const deploymentConfig = {
    buildIOS: process.argv.includes('--ios') || process.argv.includes('--all'),
    buildAndroid: process.argv.includes('--android') || process.argv.includes('--all'),
    runTests: !process.argv.includes('--skip-tests'),
    generateAssets: !process.argv.includes('--skip-assets'),
    createPackages: !process.argv.includes('--skip-packages')
  };

  console.log('📋 Deployment Configuration:');
  console.log(`  iOS Build: ${deploymentConfig.buildIOS ? '✅' : '❌'}`);
  console.log(`  Android Build: ${deploymentConfig.buildAndroid ? '✅' : '❌'}`);
  console.log(`  Run Tests: ${deploymentConfig.runTests ? '✅' : '❌'}`);
  console.log(`  Generate Assets: ${deploymentConfig.generateAssets ? '✅' : '❌'}`);
  console.log(`  Create Packages: ${deploymentConfig.createPackages ? '✅' : '❌'}\n`);

  try {
    // Step 1: Pre-deployment checks
    console.log('🔍 Running pre-deployment checks...');
    await runPreDeploymentChecks();

    // Step 2: Run tests if enabled
    if (deploymentConfig.runTests) {
      console.log('🧪 Running mobile app tests...');
      await runMobileTests();
    }

    // Step 3: Build iOS app if requested
    if (deploymentConfig.buildIOS) {
      console.log('🍎 Building iOS app...');
      await buildIOSApp();
    }

    // Step 4: Build Android app if requested
    if (deploymentConfig.buildAndroid) {
      console.log('🤖 Building Android app...');
      await buildAndroidApp();
    }

    // Step 5: Create deployment packages
    if (deploymentConfig.createPackages) {
      console.log('📦 Creating deployment packages...');
      await createDeploymentPackages();
    }

    // Step 6: Generate deployment report
    console.log('📊 Generating deployment report...');
    await generateDeploymentReport(deploymentConfig);

    console.log('\n✅ Mobile app deployment complete!');
    console.log('📋 Deployment report: build/deployment-report.json');
    console.log('📦 Packages: build/packages/');

  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

async function runPreDeploymentChecks() {
  const checks = {
    nodeVersion: false,
    npmDependencies: false,
    capacitorCLI: false,
    buildDirectory: false,
    gitStatus: false
  };

  console.log('  🔍 Checking Node.js version...');
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    const majorVersion = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    checks.nodeVersion = majorVersion >= 16;
    console.log(`  ${checks.nodeVersion ? '✅' : '❌'} Node.js: ${nodeVersion} ${checks.nodeVersion ? '' : '(requires v16+)'}`);
  } catch (error) {
    console.log('  ❌ Node.js: Not found');
  }

  console.log('  🔍 Checking npm dependencies...');
  try {
    execSync('npm list --depth=0', { stdio: 'pipe' });
    checks.npmDependencies = true;
    console.log('  ✅ NPM dependencies: Installed');
  } catch (error) {
    console.log('  ❌ NPM dependencies: Missing or outdated');
    console.log('  💡 Run: npm install');
  }

  console.log('  🔍 Checking Capacitor CLI...');
  try {
    const capVersion = execSync('npx cap --version', { encoding: 'utf8' }).trim();
    checks.capacitorCLI = true;
    console.log(`  ✅ Capacitor CLI: ${capVersion}`);
  } catch (error) {
    console.log('  ❌ Capacitor CLI: Not found');
    console.log('  💡 Run: npm install @capacitor/cli');
  }

  console.log('  🔍 Preparing build directory...');
  if (!fs.existsSync('build')) {
    fs.mkdirSync('build', { recursive: true });
  }
  if (!fs.existsSync('build/packages')) {
    fs.mkdirSync('build/packages', { recursive: true });
  }
  checks.buildDirectory = true;
  console.log('  ✅ Build directory: Ready');

  console.log('  🔍 Checking git status...');
  try {
    const gitStatus = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    checks.gitStatus = gitStatus.length === 0;
    console.log(`  ${checks.gitStatus ? '✅' : '⚠️'} Git status: ${checks.gitStatus ? 'Clean' : 'Uncommitted changes'}`);
  } catch (error) {
    console.log('  ⚠️  Git status: Not a git repository');
    checks.gitStatus = true; // Don't fail deployment for this
  }

  // Save check results
  fs.writeFileSync(
    path.join('build', 'pre-deployment-checks.json'),
    JSON.stringify(checks, null, 2)
  );

  const failedChecks = Object.entries(checks).filter(([_, passed]) => !passed);
  if (failedChecks.length > 0) {
    console.log('\n⚠️  Some pre-deployment checks failed:');
    failedChecks.forEach(([check, _]) => {
      console.log(`  - ${check}`);
    });
    console.log('\nContinuing with deployment...\n');
  }
}

async function runMobileTests() {
  try {
    execSync('node scripts/test-mobile.js', { stdio: 'inherit' });
    console.log('✅ Mobile tests completed');
  } catch (error) {
    console.warn('⚠️  Some mobile tests failed, continuing with deployment...');
  }
}

async function buildIOSApp() {
  try {
    execSync('node scripts/build-ios.js', { stdio: 'inherit' });
    console.log('✅ iOS build completed');
    
    // Check if iOS build was successful
    const iosProjectPath = path.join('ios', 'App', 'App.xcodeproj');
    if (fs.existsSync(iosProjectPath)) {
      console.log('📱 iOS project ready for Xcode');
    }
  } catch (error) {
    console.error('❌ iOS build failed:', error.message);
    throw error;
  }
}

async function buildAndroidApp() {
  try {
    execSync('node scripts/build-android.js', { stdio: 'inherit' });
    console.log('✅ Android build completed');
    
    // Check if APK was created
    const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    if (fs.existsSync(apkPath)) {
      console.log('📦 Android APK created successfully');
      
      // Copy APK to packages directory
      const packageApkPath = path.join('build', 'packages', 'arri-camera-control-debug.apk');
      fs.copyFileSync(apkPath, packageApkPath);
      console.log(`📦 APK copied to: ${packageApkPath}`);
    }
  } catch (error) {
    console.error('❌ Android build failed:', error.message);
    throw error;
  }
}

async function createDeploymentPackages() {
  console.log('  📦 Creating deployment packages...');

  // Create iOS package if available
  if (fs.existsSync('ios')) {
    console.log('  🍎 Packaging iOS project...');
    await createIOSPackage();
  }

  // Create Android package if available
  if (fs.existsSync('android')) {
    console.log('  🤖 Packaging Android project...');
    await createAndroidPackage();
  }

  // Create source code package
  console.log('  📄 Creating source code package...');
  await createSourcePackage();

  // Create documentation package
  console.log('  📚 Creating documentation package...');
  await createDocumentationPackage();
}

async function createIOSPackage() {
  const iosPackagePath = path.join('build', 'packages', 'ios');
  
  if (!fs.existsSync(iosPackagePath)) {
    fs.mkdirSync(iosPackagePath, { recursive: true });
  }

  // Copy iOS project files
  if (fs.existsSync('ios')) {
    execSync(`cp -r ios/* ${iosPackagePath}/`, { stdio: 'pipe' });
  }

  // Create iOS deployment instructions
  const iosInstructions = `
# iOS Deployment Instructions

## Prerequisites
- macOS with Xcode 14.0 or later
- Apple Developer Account
- iOS device or simulator

## Build Steps
1. Open the project in Xcode:
   \`\`\`
   open ios/App/App.xcodeproj
   \`\`\`

2. Select your development team in Xcode project settings

3. Choose your target device or simulator

4. Build and run the project (Cmd+R)

## Distribution
1. Archive the project (Product > Archive)
2. Upload to App Store Connect or export for ad-hoc distribution
3. Follow Apple's app review guidelines

## Testing
- Test on physical device for camera connectivity
- Verify offline functionality
- Test CAP protocol communication with ARRI cameras

## Troubleshooting
- Ensure local network permissions are granted
- Check camera network connectivity
- Verify CAP protocol implementation
`;

  fs.writeFileSync(
    path.join(iosPackagePath, 'DEPLOYMENT.md'),
    iosInstructions
  );

  console.log('  ✅ iOS package created');
}

async function createAndroidPackage() {
  const androidPackagePath = path.join('build', 'packages', 'android');
  
  if (!fs.existsSync(androidPackagePath)) {
    fs.mkdirSync(androidPackagePath, { recursive: true });
  }

  // Copy APK if it exists
  const apkPath = path.join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (fs.existsSync(apkPath)) {
    fs.copyFileSync(apkPath, path.join(androidPackagePath, 'arri-camera-control-debug.apk'));
  }

  // Copy Android project files (excluding build directories)
  if (fs.existsSync('android')) {
    execSync(`rsync -av --exclude='build' --exclude='.gradle' android/ ${androidPackagePath}/`, { stdio: 'pipe' });
  }

  // Create Android deployment instructions
  const androidInstructions = `
# Android Deployment Instructions

## Prerequisites
- Android Studio 4.0 or later
- Android SDK 22 or later
- Android device with developer mode enabled

## Installation from APK
1. Enable "Unknown Sources" in Android settings
2. Install the APK:
   \`\`\`
   adb install arri-camera-control-debug.apk
   \`\`\`

## Build from Source
1. Open the project in Android Studio:
   \`\`\`
   npx cap open android
   \`\`\`

2. Build and run the project

## Distribution
1. Generate signed APK for production
2. Upload to Google Play Console
3. Follow Google Play policies

## Testing
- Test on physical device for camera connectivity
- Verify WiFi permissions are granted
- Test CAP protocol communication with ARRI cameras

## Troubleshooting
- Grant network permissions in app settings
- Check camera network connectivity
- Verify CAP protocol implementation
`;

  fs.writeFileSync(
    path.join(androidPackagePath, 'DEPLOYMENT.md'),
    androidInstructions
  );

  console.log('  ✅ Android package created');
}

async function createSourcePackage() {
  const sourcePackagePath = path.join('build', 'packages', 'source');
  
  if (!fs.existsSync(sourcePackagePath)) {
    fs.mkdirSync(sourcePackagePath, { recursive: true });
  }

  // Create source archive
  try {
    execSync(`tar -czf ${sourcePackagePath}/arri-camera-control-source.tar.gz --exclude=node_modules --exclude=build --exclude=.git --exclude=ios/App/build --exclude=android/app/build .`, { stdio: 'pipe' });
    console.log('  ✅ Source package created');
  } catch (error) {
    console.warn('  ⚠️  Could not create source archive');
  }
}

async function createDocumentationPackage() {
  const docsPackagePath = path.join('build', 'packages', 'documentation');
  
  if (!fs.existsSync(docsPackagePath)) {
    fs.mkdirSync(docsPackagePath, { recursive: true });
  }

  // Create comprehensive documentation
  const documentation = `
# ARRI Camera Control Mobile App

## Overview
Professional camera control application for ARRI cameras using the CAP (Camera Access Protocol).

## Features
- Real-time camera control (frame rate, white balance, ISO, ND filters)
- Playback control and clip browsing
- Timecode management and synchronization
- Color grading with CDL parameters
- Offline-first architecture
- Touch-optimized interface for mobile devices

## Architecture
- Frontend: SvelteKit with TypeScript
- Backend: Node.js with Express and Socket.io
- Mobile: Capacitor for iOS/Android packaging
- Protocol: CAP (Camera Access Protocol) over TCP
- Storage: Local storage with offline synchronization

## Installation
See platform-specific deployment instructions in the respective packages.

## Configuration
The app automatically discovers ARRI cameras on the local network and establishes CAP protocol connections.

## Support
For technical support and documentation, refer to the ARRI Camera Access Protocol specification.

## Version
1.0.0

## Build Date
${new Date().toISOString()}
`;

  fs.writeFileSync(
    path.join(docsPackagePath, 'README.md'),
    documentation
  );

  // Copy any existing documentation
  const docFiles = ['README.md', 'CHANGELOG.md', 'LICENSE'];
  docFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(docsPackagePath, file));
    }
  });

  console.log('  ✅ Documentation package created');
}

async function generateDeploymentReport(config) {
  const deploymentReport = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    configuration: config,
    platforms: {
      ios: {
        available: fs.existsSync('ios'),
        built: fs.existsSync('ios/App/App.xcodeproj'),
        packaged: fs.existsSync('build/packages/ios')
      },
      android: {
        available: fs.existsSync('android'),
        built: fs.existsSync('android/app/build/outputs/apk/debug/app-debug.apk'),
        packaged: fs.existsSync('build/packages/android')
      }
    },
    packages: {
      source: fs.existsSync('build/packages/source'),
      documentation: fs.existsSync('build/packages/documentation')
    },
    testResults: {},
    buildArtifacts: [],
    deploymentInstructions: {
      ios: 'See build/packages/ios/DEPLOYMENT.md',
      android: 'See build/packages/android/DEPLOYMENT.md'
    },
    nextSteps: [
      'Test on physical devices',
      'Validate camera connectivity',
      'Perform user acceptance testing',
      'Submit to app stores (if applicable)'
    ]
  };

  // Load test results if available
  const testReportPath = path.join('build', 'mobile-test-report.json');
  if (fs.existsSync(testReportPath)) {
    deploymentReport.testResults = JSON.parse(fs.readFileSync(testReportPath, 'utf8'));
  }

  // List build artifacts
  const packagesDir = path.join('build', 'packages');
  if (fs.existsSync(packagesDir)) {
    const artifacts = fs.readdirSync(packagesDir, { recursive: true });
    deploymentReport.buildArtifacts = artifacts.map(artifact => ({
      name: artifact,
      path: path.join('build', 'packages', artifact),
      size: fs.existsSync(path.join(packagesDir, artifact)) ? 
        fs.statSync(path.join(packagesDir, artifact)).size : 0
    }));
  }

  // Write deployment report
  fs.writeFileSync(
    path.join('build', 'deployment-report.json'),
    JSON.stringify(deploymentReport, null, 2)
  );

  // Create human-readable summary
  const summaryText = `
ARRI Camera Control Mobile App Deployment Report
===============================================

Deployment Date: ${deploymentReport.timestamp}
Version: ${deploymentReport.version}

Platform Status:
- iOS: ${deploymentReport.platforms.ios.built ? '✅ Built' : '❌ Not Built'}
- Android: ${deploymentReport.platforms.android.built ? '✅ Built' : '❌ Not Built'}

Packages Created:
- iOS Package: ${deploymentReport.platforms.ios.packaged ? '✅' : '❌'}
- Android Package: ${deploymentReport.platforms.android.packaged ? '✅' : '❌'}
- Source Package: ${deploymentReport.packages.source ? '✅' : '❌'}
- Documentation: ${deploymentReport.packages.documentation ? '✅' : '❌'}

Build Artifacts:
${deploymentReport.buildArtifacts.map(a => `- ${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB)`).join('\n')}

Next Steps:
${deploymentReport.nextSteps.map(s => `- ${s}`).join('\n')}

For detailed deployment instructions, see the platform-specific packages.
`;

  fs.writeFileSync(
    path.join('build', 'deployment-summary.txt'),
    summaryText
  );

  console.log(`  📊 Deployment report generated`);
}

// Parse command line arguments and run deployment
if (process.argv.length < 3) {
  console.log('Usage: node deploy-mobile.js [--ios] [--android] [--all] [--skip-tests] [--skip-assets] [--skip-packages]');
  console.log('');
  console.log('Options:');
  console.log('  --ios          Build iOS app');
  console.log('  --android      Build Android app');
  console.log('  --all          Build both iOS and Android');
  console.log('  --skip-tests   Skip running tests');
  console.log('  --skip-assets  Skip generating assets');
  console.log('  --skip-packages Skip creating packages');
  process.exit(1);
}

deployMobileApp();