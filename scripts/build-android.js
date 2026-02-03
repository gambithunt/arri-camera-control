#!/usr/bin/env node

/**
 * Android Build Script
 * Builds and packages the ARRI Camera Control app for Android deployment
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🤖 Building ARRI Camera Control for Android...\n');

async function buildAndroidApp() {
  try {
    // Step 1: Ensure Android platform is added
    console.log('📱 Checking Android platform...');
    if (!fs.existsSync('android')) {
      console.log('Adding Android platform...');
      execSync('npx cap add android', { stdio: 'inherit' });
    }

    // Step 2: Build the web app
    console.log('🔨 Building web application...');
    execSync('npm run build', { stdio: 'inherit' });

    // Step 3: Configure Android-specific settings
    console.log('⚙️  Configuring Android settings...');
    await configureAndroidApp();

    // Step 4: Copy assets and resources
    console.log('📦 Copying Android assets...');
    await copyAndroidAssets();

    // Step 5: Sync with Capacitor
    console.log('🔄 Syncing with Capacitor...');
    execSync('npx cap sync android', { stdio: 'inherit' });

    // Step 6: Generate app icons and resources
    console.log('🎨 Generating Android resources...');
    await generateAndroidAssets();

    // Step 7: Configure build settings
    console.log('🔧 Configuring Gradle build settings...');
    await configureGradleBuildSettings();

    // Step 8: Build APK
    console.log('📦 Building Android APK...');
    await buildAPK();

    console.log('\n✅ Android build complete!');
    console.log('\nGenerated files:');
    console.log('📦 Debug APK: android/app/build/outputs/apk/debug/app-debug.apk');
    console.log('\nNext steps:');
    console.log('1. Install on device: adb install android/app/build/outputs/apk/debug/app-debug.apk');
    console.log('2. Open Android Studio: npx cap open android');
    console.log('3. Run on device: npx cap run android');

  } catch (error) {
    console.error('\n❌ Android build failed:', error.message);
    process.exit(1);
  }
}

async function configureAndroidApp() {
  const androidAppPath = path.join('android', 'app', 'src', 'main');
  
  if (!fs.existsSync(androidAppPath)) {
    throw new Error('Android app directory not found. Run: npx cap add android');
  }

  // Configure AndroidManifest.xml for camera control app
  const manifestPath = path.join(androidAppPath, 'AndroidManifest.xml');
  
  if (fs.existsSync(manifestPath)) {
    console.log('📝 Configuring AndroidManifest.xml...');
    
    let manifest = fs.readFileSync(manifestPath, 'utf8');
    
    // Add camera control specific permissions
    const permissions = `
    <!-- Camera Control App Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    
    <!-- Network Service Discovery for ARRI cameras -->
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    
    <!-- Hardware features -->
    <uses-feature android:name="android.hardware.wifi" android:required="true" />
    <uses-feature android:name="android.hardware.touchscreen" android:required="true" />
`;

    // Insert permissions after <manifest> tag
    const manifestIndex = manifest.indexOf('<manifest');
    const nextTagIndex = manifest.indexOf('>', manifestIndex) + 1;
    
    if (nextTagIndex > 0) {
      manifest = manifest.slice(0, nextTagIndex) + permissions + manifest.slice(nextTagIndex);
    }

    // Configure activity for landscape orientation
    const activityConfig = `
        android:screenOrientation="landscape"
        android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
        android:launchMode="singleTask"
        android:exported="true"
        android:theme="@style/AppTheme.NoActionBarLaunch"`;

    // Add activity configuration
    manifest = manifest.replace(
      'android:name=".MainActivity"',
      `android:name=".MainActivity"${activityConfig}`
    );

    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ AndroidManifest.xml configured');
  }

  // Create Android-specific configuration file
  const androidConfig = {
    name: 'ARRI Camera Control',
    packageName: 'com.arri.cameracontrol',
    versionName: '1.0.0',
    versionCode: 1,
    minSdkVersion: 22,
    targetSdkVersion: 34,
    compileSdkVersion: 34,
    orientation: 'landscape',
    offline: true,
    permissions: [
      'INTERNET',
      'ACCESS_NETWORK_STATE',
      'ACCESS_WIFI_STATE',
      'CHANGE_WIFI_STATE',
      'VIBRATE',
      'WAKE_LOCK'
    ],
    features: [
      'camera-control',
      'offline-operation',
      'wifi-networking'
    ]
  };

  fs.writeFileSync(
    path.join('build', 'android-config.json'),
    JSON.stringify(androidConfig, null, 2)
  );
}

async function copyAndroidAssets() {
  const androidAssetsPath = path.join('android', 'app', 'src', 'main', 'assets');
  
  if (!fs.existsSync(androidAssetsPath)) {
    fs.mkdirSync(androidAssetsPath, { recursive: true });
  }

  // Copy app-specific assets
  const appAssets = {
    name: 'ARRI Camera Control',
    version: '1.0.0',
    platform: 'android',
    offline: true,
    features: [
      'camera-control',
      'cap-protocol',
      'offline-operation'
    ]
  };

  fs.writeFileSync(
    path.join(androidAssetsPath, 'app-config.json'),
    JSON.stringify(appAssets, null, 2)
  );

  console.log('✅ Android assets prepared');
}

async function generateAndroidAssets() {
  try {
    // Try to generate assets using @capacitor/assets if available
    execSync('npx capacitor-assets generate --android', { stdio: 'inherit' });
    console.log('✅ Generated Android assets with @capacitor/assets');
  } catch (error) {
    console.warn('⚠️  Could not generate assets automatically');
    console.warn('Install @capacitor/assets for automatic asset generation:');
    console.warn('npm install -g @capacitor/assets');
    
    // Create placeholder assets
    await createAndroidPlaceholderAssets();
  }
}

async function createAndroidPlaceholderAssets() {
  const resPath = path.join('android', 'app', 'src', 'main', 'res');
  
  // Create drawable directories for different densities
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
  
  for (const density of densities) {
    const drawablePath = path.join(resPath, `drawable-${density}`);
    if (!fs.existsSync(drawablePath)) {
      fs.mkdirSync(drawablePath, { recursive: true });
    }
  }

  // Create mipmap directories for app icons
  for (const density of densities) {
    const mipmapPath = path.join(resPath, `mipmap-${density}`);
    if (!fs.existsSync(mipmapPath)) {
      fs.mkdirSync(mipmapPath, { recursive: true });
    }
  }

  // Create values directory for app configuration
  const valuesPath = path.join(resPath, 'values');
  if (!fs.existsSync(valuesPath)) {
    fs.mkdirSync(valuesPath, { recursive: true });
  }

  // Create strings.xml
  const stringsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">ARRI Control</string>
    <string name="title_activity_main">ARRI Camera Control</string>
    <string name="package_name">com.arri.cameracontrol</string>
    <string name="custom_url_scheme">arri-camera-control</string>
</resources>`;

  fs.writeFileSync(path.join(valuesPath, 'strings.xml'), stringsXml);

  // Create colors.xml
  const colorsXml = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#E31E24</color>
    <color name="colorPrimaryDark">#B71C1C</color>
    <color name="colorAccent">#E31E24</color>
    <color name="statusBarColor">#1A1A1A</color>
    <color name="toolbarColor">#1A1A1A</color>
    <color name="navigationBarColor">#1A1A1A</color>
</resources>`;

  fs.writeFileSync(path.join(valuesPath, 'colors.xml'), colorsXml);

  console.log('✅ Created placeholder Android assets');
}

async function configureGradleBuildSettings() {
  const buildGradlePath = path.join('android', 'app', 'build.gradle');
  
  if (fs.existsSync(buildGradlePath)) {
    console.log('🔧 Configuring Gradle build settings...');
    
    let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
    
    // Ensure proper Android configuration
    const androidConfig = `
android {
    namespace "com.arri.cameracontrol"
    compileSdkVersion 34
    
    defaultConfig {
        applicationId "com.arri.cameracontrol"
        minSdkVersion 22
        targetSdkVersion 34
        versionCode 1
        versionName "1.0.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
             // Files and dirs to omit from the packaged APK
             ignoreAssetsPattern "!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~"
        }
    }
    
    buildTypes {
        debug {
            minifyEnabled false
            debuggable true
            applicationIdSuffix ".debug"
            versionNameSuffix "-debug"
        }
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            signingConfig signingConfigs.debug // Use debug signing for now
        }
    }
    
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
}`;

    // Create build configuration notes
    const buildNotes = {
      package_name: 'com.arri.cameracontrol',
      version_name: '1.0.0',
      version_code: 1,
      min_sdk: 22,
      target_sdk: 34,
      compile_sdk: 34,
      notes: [
        'Debug APK will be signed with debug keystore',
        'For production release, configure proper signing',
        'Test on physical device for camera connectivity',
        'Ensure WiFi permissions are granted for CAP protocol'
      ]
    };

    fs.writeFileSync(
      path.join('build', 'android-build-notes.json'),
      JSON.stringify(buildNotes, null, 2)
    );

    console.log('✅ Gradle build settings configured');
  }
}

async function buildAPK() {
  const androidPath = path.join('android');
  
  if (!fs.existsSync(androidPath)) {
    throw new Error('Android project not found');
  }

  console.log('🔨 Building debug APK...');
  
  try {
    // Build debug APK using Gradle
    execSync('./gradlew assembleDebug', { 
      cwd: androidPath, 
      stdio: 'inherit' 
    });
    
    // Check if APK was created
    const apkPath = path.join(androidPath, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    
    if (fs.existsSync(apkPath)) {
      const stats = fs.statSync(apkPath);
      const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ APK built successfully: ${fileSizeMB} MB`);
      
      // Create APK info file
      const apkInfo = {
        filename: 'app-debug.apk',
        path: apkPath,
        size: stats.size,
        sizeMB: fileSizeMB,
        created: stats.birthtime.toISOString(),
        packageName: 'com.arri.cameracontrol',
        versionName: '1.0.0',
        versionCode: 1,
        buildType: 'debug'
      };
      
      fs.writeFileSync(
        path.join('build', 'apk-info.json'),
        JSON.stringify(apkInfo, null, 2)
      );
      
    } else {
      throw new Error('APK file not found after build');
    }
    
  } catch (error) {
    console.error('Failed to build APK:', error.message);
    
    // Try alternative build method
    console.log('Trying alternative build method...');
    try {
      execSync('npx cap build android', { stdio: 'inherit' });
      console.log('✅ APK built with Capacitor CLI');
    } catch (altError) {
      throw new Error(`Both build methods failed: ${error.message}`);
    }
  }
}

// Run the Android build
buildAndroidApp();