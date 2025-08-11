import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.arri.cameracontrol',
  appName: 'ARRI Camera Control',
  webDir: 'build',
  server: {
    // For development, we can use the dev server
    // For production, the app will start its own local server
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a1a'
    }
  },
  ios: {
    contentInset: 'automatic',
    scrollEnabled: true,
    backgroundColor: '#1a1a1a',
    allowsLinkPreview: false,
    handleApplicationURL: false,
    preferredContentMode: 'mobile',
    limitsNavigationsToAppBoundDomains: true,
    scheme: 'arri-camera-control'
  },
  android: {
    backgroundColor: '#1a1a1a',
    allowMixedContent: true,
    captureInput: true
  }
};

export default config;
