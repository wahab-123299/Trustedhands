import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.trustedhand',
  appName: 'TrustedHand',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#10B981',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
  },
};

export default config;