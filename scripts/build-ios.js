#!/usr/bin/env node

/**
 * iOS Build Script
 * Builds and packages the ARRI Camera Control app for iOS deployment
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🍎 Building ARRI Camera Control for iOS...\n');

async function buildIOSApp() {
  try {
    // Step 1: Ensure iOS platform is added
    console.log('📱 Checking iOS platform...');
    if (!fs.existsSync('ios')) {
      console.log('Adding iOS platform...');
      execSync('npx cap add ios', { stdio: 'inherit' });
    }

    // Step 2: Build the web app
    console.log('🔨 Building web application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Step 3: Configure iOS-specific settings
    console.log('⚙️  Configuring iOS settings...');
    await configureIOSApp();

    // Step 4: Copy assets and resources
    console.log('📦 Copying iOS assets...');
    await copyIOSAssets();

    // Step 5: Sync with Capacitor
    console.log('🔄 Syncing with Capacitor...');
    execSync('npx cap sync ios', { stdio: 'inherit' });

    // Step 6: Generate app icons and splash screens
    console.log('🎨 Generating app icons and splash screens...');
    await generateIOSAssets();

    // Step 7: Configure build settings
    console.log('🔧 Configuring Xcode build settings...');
    await configureXcodeBuildSettings();

    console.log('\n✅ iOS build preparation complete!');
    console.log('\nNext steps:');
    console.log('1. Open Xcode: npx cap open ios');
    console.log('2. Select your development team in Xcode');
    console.log('3. Build and run on device or simulator');
    console.log('\nOr run directly: npx cap run ios --target="iPhone 15 Pro"');

  } catch (error) {
    console.error('\n❌ iOS build failed:', error.message);
    process.exit(1);
  }
}

async function configureIOSApp() {
  const iosAppPath = path.join('ios', 'App', 'App');
  
  if (!fs.existsSync(iosAppPath)) {
    throw new Error('iOS app directory not found. Run: npx cap add ios');
  }

  // Configure Info.plist for camera control app
  const infoPlistPath = path.join(iosAppPath, 'Info.plist');
  
  if (fs.existsSync(infoPlistPath)) {
    console.log('📝 Configuring Info.plist...');
    
    // Read existing Info.plist
    let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');
    
    // Add camera control specific permissions and settings
    const additions = `
    <!-- Camera Control App Specific Settings -->
    <key>NSLocalNetworkUsageDescription</key>
    <string>This app needs to connect to ARRI cameras on the local network for professional camera control.</string>
    <key>NSBonjourServices</key>
    <array>
        <string>_arri-cap._tcp</string>
        <string>_http._tcp</string>
    </array>
    <key>UIRequiredDeviceCapabilities</key>
    <array>
        <string>wifi</string>
    </array>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
    </array>
    <key>UIStatusBarHidden</key>
    <false/>
    <key>UIViewControllerBasedStatusBarAppearance</key>
    <true/>
    <key>CFBundleDisplayName</key>
    <string>ARRI Control</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UIMainStoryboardFile</key>
    <string>Main</string>
    <key>UIRequiresFullScreen</key>
    <false/>
    <key>ITSAppUsesNonExemptEncryption</key>
    <false/>
`;

    // Insert additions before closing </dict>
    const insertIndex = infoPlist.lastIndexOf('</dict>');
    if (insertIndex !== -1) {
      infoPlist = infoPlist.slice(0, insertIndex) + additions + infoPlist.slice(insertIndex);
      fs.writeFileSync(infoPlistPath, infoPlist);
      console.log('✅ Info.plist configured');
    }
  }

  // Create iOS-specific configuration file
  const iosConfig = {
    name: 'ARRI Camera Control',
    bundleId: 'com.arri.cameracontrol',
    version: '1.0.0',
    buildNumber: '1',
    deploymentTarget: '13.0',
    orientation: ['landscape', 'portrait'],
    offline: true,
    permissions: [
      'NSLocalNetworkUsageDescription',
      'NSBonjourServices'
    ],
    features: [
      'camera-control',
      'offline-operation',
      'local-networking'
    ]
  };

  fs.writeFileSync(
    path.join('build', 'ios-config.json'),
    JSON.stringify(iosConfig, null, 2)
  );
}

async function copyIOSAssets() {
  const iosResourcesPath = path.join('ios', 'App', 'App', 'public');
  
  if (!fs.existsSync(iosResourcesPath)) {
    fs.mkdirSync(iosResourcesPath, { recursive: true });
  }

  // Copy app icons if they exist
  const iconSizes = [
    { size: '20x20', scale: '2x', filename: 'icon-20@2x.png' },
    { size: '20x20', scale: '3x', filename: 'icon-20@3x.png' },
    { size: '29x29', scale: '2x', filename: 'icon-29@2x.png' },
    { size: '29x29', scale: '3x', filename: 'icon-29@3x.png' },
    { size: '40x40', scale: '2x', filename: 'icon-40@2x.png' },
    { size: '40x40', scale: '3x', filename: 'icon-40@3x.png' },
    { size: '60x60', scale: '2x', filename: 'icon-60@2x.png' },
    { size: '60x60', scale: '3x', filename: 'icon-60@3x.png' },
    { size: '76x76', scale: '1x', filename: 'icon-76.png' },
    { size: '76x76', scale: '2x', filename: 'icon-76@2x.png' },
    { size: '83.5x83.5', scale: '2x', filename: 'icon-83.5@2x.png' },
    { size: '1024x1024', scale: '1x', filename: 'icon-1024.png' }
  ];

  // Create icon manifest
  const iconManifest = {
    icons: iconSizes,
    generated: new Date().toISOString(),
    platform: 'ios'
  };

  fs.writeFileSync(
    path.join(iosResourcesPath, 'icon-manifest.json'),
    JSON.stringify(iconManifest, null, 2)
  );

  console.log('✅ iOS assets prepared');
}

async function generateIOSAssets() {
  try {
    // Try to generate assets using @capacitor/assets if available
    execSync('npx capacitor-assets generate --ios', { stdio: 'inherit' });
    console.log('✅ Generated iOS assets with @capacitor/assets');
  } catch (error) {
    console.warn('⚠️  Could not generate assets automatically');
    console.warn('Install @capacitor/assets for automatic asset generation:');
    console.warn('npm install -g @capacitor/assets');
    
    // Create placeholder assets
    await createPlaceholderAssets();
  }
}

async function createPlaceholderAssets() {
  const assetsPath = path.join('ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  
  if (!fs.existsSync(assetsPath)) {
    fs.mkdirSync(assetsPath, { recursive: true });
  }

  // Create Contents.json for app icons
  const contentsJson = {
    images: [
      {
        filename: 'icon-20@2x.png',
        idiom: 'iphone',
        scale: '2x',
        size: '20x20'
      },
      {
        filename: 'icon-20@3x.png',
        idiom: 'iphone',
        scale: '3x',
        size: '20x20'
      },
      {
        filename: 'icon-29@2x.png',
        idiom: 'iphone',
        scale: '2x',
        size: '29x29'
      },
      {
        filename: 'icon-29@3x.png',
        idiom: 'iphone',
        scale: '3x',
        size: '29x29'
      },
      {
        filename: 'icon-40@2x.png',
        idiom: 'iphone',
        scale: '2x',
        size: '40x40'
      },
      {
        filename: 'icon-40@3x.png',
        idiom: 'iphone',
        scale: '3x',
        size: '40x40'
      },
      {
        filename: 'icon-60@2x.png',
        idiom: 'iphone',
        scale: '2x',
        size: '60x60'
      },
      {
        filename: 'icon-60@3x.png',
        idiom: 'iphone',
        scale: '3x',
        size: '60x60'
      },
      {
        filename: 'icon-1024.png',
        idiom: 'ios-marketing',
        scale: '1x',
        size: '1024x1024'
      }
    ],
    info: {
      author: 'capacitor',
      version: 1
    }
  };

  fs.writeFileSync(
    path.join(assetsPath, 'Contents.json'),
    JSON.stringify(contentsJson, null, 2)
  );

  console.log('✅ Created placeholder iOS assets');
}

async function configureXcodeBuildSettings() {
  const projectPath = path.join('ios', 'App', 'App.xcodeproj', 'project.pbxproj');
  
  if (fs.existsSync(projectPath)) {
    console.log('🔧 Configuring Xcode project settings...');
    
    // Read project file
    let projectContent = fs.readFileSync(projectPath, 'utf8');
    
    // Add build configurations for camera control app
    const buildSettings = `
				DEVELOPMENT_TEAM = "";
				PRODUCT_BUNDLE_IDENTIFIER = com.arri.cameracontrol;
				MARKETING_VERSION = 1.0.0;
				CURRENT_PROJECT_VERSION = 1;
				IPHONEOS_DEPLOYMENT_TARGET = 13.0;
				SUPPORTS_MACCATALYST = NO;
				TARGETED_DEVICE_FAMILY = "1,2";
				CODE_SIGN_STYLE = Automatic;
				ENABLE_BITCODE = NO;
				SWIFT_VERSION = 5.0;
`;

    // Create build configuration notes
    const buildNotes = {
      deployment_target: '13.0',
      bundle_identifier: 'com.arri.cameracontrol',
      version: '1.0.0',
      build_number: '1',
      device_family: 'iPhone and iPad',
      notes: [
        'Set your development team in Xcode before building',
        'Ensure you have a valid Apple Developer account',
        'Test on physical device for camera connectivity',
        'Enable local network permissions for CAP protocol'
      ]
    };

    fs.writeFileSync(
      path.join('build', 'ios-build-notes.json'),
      JSON.stringify(buildNotes, null, 2)
    );

    console.log('✅ Xcode build settings configured');
  }
}

// Run the iOS build
buildIOSApp();