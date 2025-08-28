/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep existing settings
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Disable x-powered-by header for security
  poweredByHeader: false,
  
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'via.placeholder.com',
      },
      {
        protocol: 'https',
        hostname: 'jjxlfunlbyayxwvlpgwt.supabase.co',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  
  serverExternalPackages: ['@supabase/ssr'],
  
  // Experimental features for better performance
  experimental: {
    // Enable optimized package imports
    optimizePackageImports: [
      '@supabase/supabase-js',
      'lucide-react',
      '@iconify/react',
      'date-fns',
    ],
  },
  
  // Compiler options for better performance
  compiler: {
    // Remove console.log in production
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  
  // Webpack configuration for optimized builds
  webpack: (config, { dev, isServer }) => {
    // Optimize for development
    if (dev) {
      config.watchOptions = {
        poll: false,
        aggregateTimeout: 300,
        ignored: [
          '**/node_modules',
          '**/.git',
          '**/.next',
          '**/dist',
          '**/build',
        ],
      };
      
    }
    
    // Optimize module resolution
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json'];
    
    return config;
  },
  
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jjxlfunlbyayxwvlpgwt.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_dzxer8L4aIxCUOK7CnCM-A_YjHyS3En',
    NEXT_PUBLIC_APP_NAME: 'OneHealth Admin',
    NEXT_PUBLIC_APP_VERSION: '1.0.0',
  },
  
  // Redirect root to login for admin portal
  async redirects() {
    const port = process.env.PORT || '4000';
    
    // Only apply redirects for admin portal (port 4000)
    if (port === '4000') {
      return [
        {
          source: '/',
          destination: '/auth/login',
          permanent: false,
        },
      ];
    }
    
    return [];
  },
  
  // Headers for better performance and security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
    ];
  },
}

module.exports = nextConfig