import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Simple, bulletproof configuration
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    open: true, // Auto-open browser
    cors: true,
    hmr: true,
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
  build: {
    target: 'esnext',
    minify: false, // Faster builds
  },
});
