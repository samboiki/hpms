import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Windows configuration for Vite 5.4.2
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Enable external access for better performance
    port: 7000,
    cors: true,
    strictPort: true,
    open: false, // Prevent auto-opening to save resources

    hmr: {
      port: 7001,
      host: 'localhost',
      overlay: false, // Disable overlay for faster development
    },

    watch: {
      usePolling: false, // Disable polling for better performance on Windows
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/.next/**',
        '**/.vite/**',
        '**/onehealth/**',
        '**/hpms-landing/**',
        '**/onehealth-admin/**'
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
      '@tanstack/react-query',
      '@supabase/supabase-js',
      'react-hot-toast'
    ],
    exclude: ['@supabase/realtime-js'],
    force: false, // Only force when needed
    esbuildOptions: {
      target: 'es2020', // Modern target for faster builds
      keepNames: true // Helps with debugging
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