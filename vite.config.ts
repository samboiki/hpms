import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Optimized configuration for large icon libraries
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['lucide-react'], // Include instead of exclude
    force: true,
  },
  server: {
    host: true,
    port: 5000, // Set correct port
    cors: true,
    hmr: {
      port: 5001, // Use different port for HMR
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
