import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Windows configuration for Vite 5.4.2
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Enable external access for better performance
    port: 8000,
    cors: true,
    strictPort: true,
    open: false, // Prevent auto-opening to save resources

    hmr: {
      port: 8001,
      host: 'localhost',
      overlay: false, // Disable overlay for faster development
    },

    watch: {
      usePolling: true, // Enable polling for better file change detection
      interval: 300, // Faster polling interval
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.next/**',
        '**/.vite/**'
      ]
    },

    fs: {
      strict: false,
      allow: ['..'] // Allow serving files from outside root
    }
  },

  css: {
    postcss: './postcss.config.js',
  },

  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@iconify/react',
      'zustand',
      '@tanstack/react-query'
    ],
    force: false, // Only force when needed
    esbuildOptions: {
      target: 'es2020' // Modern target for faster builds
    }
  },

  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          icons: ['@iconify/react'],
          query: ['@tanstack/react-query']
        }
      }
    }
  },

  esbuild: {
    target: 'es2020',
    logOverride: { 'this-is-undefined-in-esm': 'silent' }
  }
})
