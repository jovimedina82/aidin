const nextConfig = {
  // output: 'standalone', // Temporarily commented out to fix static file serving

  // Optimize images
  images: {
    unoptimized: false, // Enable Next.js image optimization
    formats: ['image/webp'], // Use modern formats
    minimumCacheTTL: 60, // Cache for 60 seconds
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/api/attachments/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3011',
        pathname: '/api/attachments/**',
      },
    ],
  },

  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },

  // Production optimizations
  swcMinify: true, // Use SWC for faster minification
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression

  experimental: {
    // Remove if not using Server Components
    serverComponentsExternalPackages: [
      'mongodb',
      'jsdom',
      'canvas',
      'jspdf',
      'jspdf-autotable',
      'whatwg-url',
      'webidl-conversions',
    ],
    // Enable instrumentation for server initialization
    instrumentationHook: true,
    // Optimize package imports
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Modularize imports for tree-shaking
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
      skipDefaultConversion: true,
    },
  },

  webpack(config, { dev, isServer }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules', '**/.git'],
      };
    }

    // Exclude browser-only libraries from server-side bundles
    if (isServer) {
      config.externals = [
        ...(config.externals || []),
        {
          canvas: 'commonjs canvas',
        }
      ];

      // Add fallback for browser globals that don't exist in Node.js
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        jsdom: false,
        'whatwg-url': false,
        'webidl-conversions': false,
      };
    }

    // Optimize for production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        runtimeChunk: 'single',
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk (only for client-side)
            vendor: {
              name: 'vendor',
              chunks: isServer ? 'async' : 'all',
              test: /node_modules/,
              priority: 20
            },
            // Common chunk
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true
            }
          }
        }
      };
    }

    return config;
  },

  onDemandEntries: {
    maxInactiveAge: 25 * 1000, // Keep pages in memory for 25 seconds
    pagesBufferLength: 2, // Only keep 2 pages in buffer
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Prevent clickjacking attacks
          { key: "X-Frame-Options", value: "DENY" },
          // Content Security Policy - restrict frame ancestors to self only
          { key: "Content-Security-Policy", value: "frame-ancestors 'self';" },
          // CORS - Only allow specific origins (never use '*' in production)
          { key: "Access-Control-Allow-Origin", value: "https://helpdesk.surterreproperties.com:3011" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          // Only allow specific headers (never use '*')
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Additional security headers
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
