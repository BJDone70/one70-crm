import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.one70group.crm',
  appName: 'ONE70 CRM',
  webDir: 'out',

  // Load the live deployed CRM — not a local build
  server: {
    url: 'https://crm.one70group.com',
    cleartext: false,
  },

  // iOS configuration
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    scheme: 'one70crm',
    scrollEnabled: true,
  },

  // Android configuration
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },

  // Plugin configuration
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 2000,
      backgroundColor: '#1A1A1A',
      showSpinner: true,
      spinnerColor: '#FFE500',
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1A1A1A',
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Keyboard: {
      resize: 'native' as any,
      resizeOnFullScreen: true,
      style: 'DARK' as any,
    },
  },
};

export default config;
