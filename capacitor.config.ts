import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android and iOS store apps. They run the same web build as the website (`npm run build` writes dist/), which
 * `npx cap sync` copies into android/ and ios/. Behaviour that only applies inside the apps lives in src/native/.
 *
 * appId identifies the app in Google Play and the App Store and can never change after the first upload:
 * the owner must confirm it before then.
 */
const config: CapacitorConfig = {
  appId: 'com.onehealthsystems.app',
  appName: 'OneHealth',
  webDir: 'dist',
  // The page's grey (index.html), so nothing flashes white or black before the first screen is drawn
  backgroundColor: '#f3f4f6',
  plugins: {
    SplashScreen: {
      // The app hides the splash as soon as its first screen is drawn (src/native/nativeApp.ts); this is the upper limit
      launchShowDuration: 3000,
      backgroundColor: '#0f766e',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP'
    },
    // White status bar with dark text above the white app header, as in the iPhone home-screen app (index.html)
    StatusBar: {
      overlaysWebView: false, // iOS: the page starts below the status bar and notch, not underneath them
      style: 'LIGHT', // dark text and icons
      backgroundColor: '#ffffff' // iOS, and Android 14 and older
    },
    // Android 15+ always draws apps edge to edge; Capacitor keeps the page clear of the status and navigation bars
    // because index.html does not ask for viewport-fit=cover there
    SystemBars: {
      style: 'LIGHT' // dark icons on the white bars, also when the phone is in dark mode (the app has no dark theme)
    }
  }
};

export default config;
