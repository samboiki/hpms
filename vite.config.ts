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
      injectRegister: false, // registered in src/pwa/registerServiceWorker.ts, which asks before reloading
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
        theme_color: '#0f766e',
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
    force: true,
  },
  server: {
    host: true,
    port: 5000,
    cors: true,
    hmr: {
      port: 5000, // Use same port to avoid polling errors
      host: 'localhost',
    },
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  build: {
    target: 'esnext',
    minify: false,
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
