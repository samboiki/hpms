import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// Optimized configuration for large icon libraries
export default defineConfig({
  plugins: [
    react(),
    // Installable app for Android, iPhone and desktop. Only the app's own files are stored for offline start;
    // patient data always comes from the network (Supabase requests are never cached).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registered in src/pwa/registerServiceWorker.tsx; a new version waits for "Update" (src/pwa/UpdateBar.tsx)
      includeAssets: ['icons/apple-touch-icon.png', 'icons/favicon-48x48.png'],
      manifest: {
        name: 'OneHealth',
        short_name: 'OneHealth',
        description: 'Practice management for clinics: patients, visits, billing and medical aid claims.',
        lang: 'en-NA',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f3f4f6',
        theme_color: '#ffffff', // the white app bar, as index.html's theme-color and the store apps' status bar (capacitor.config.ts)
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // The build is not minified, so the main chunk is large (8.6 MB in Sept 2026; about 1.5 MB compressed)
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: ['lucide-react'], // Include instead of exclude
    // No `force`: re-bundling every dependency on each start made the first page load slow and threw away the
    // browser's cached copies. Vite re-bundles by itself when package-lock.json changes (or run `vite --force`).
  },
  server: {
    host: true,
    port: 5000,
    cors: true,
    hmr: {
      port: 5000, // Use same port to avoid polling errors
      // No fixed host: live updates connect back to the address the page came from, so a phone on the same Wi-Fi
      // (http://<this PC's IP>:5000) refreshes too; on this PC that is still localhost
    },
    // Prepared when the server starts, so the first sign-in and Dashboard open are not waiting for code to be compiled
    warmup: {
      clientFiles: ['./src/main.tsx', './src/StaffApp.tsx'],
    },
    watch: {
      // Windows (NTFS) reports file changes itself; polling every 500 ms kept the server busy (about 16% of a core
      // when idle, Oct 2026). Polling is only needed in WSL, Docker or network folders.
      // Native app projects (npx cap sync): thousands of build files that the dev server never serves
      ignored: ['**/android/**', '**/ios/**'],
    },
  },
  build: {
    target: 'esnext',
    minify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
