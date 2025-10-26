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
    // Externalize server-only packages to prevent client bundling
    serverComponentsExternalPackages: [
      'mongodb',
      'jsdom',
      'canvas',
      'jspdf',
      'jspdf-autotable',
      'whatwg-url',
      'webidl-conversions',
      '@prisma/client', // Externalize Prisma to prevent node: imports in client
      'node-cron',      // Externalize node-cron to prevent node: imports in client
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

  webpack(config, { dev, isServer, webpack }) {
    // 1) Intercept and normalize 'node:' URI scheme imports BEFORE resolution
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /^node:/,
        (resource) => {
          resource.request = resource.request.replace(/^node:/, '');
        }
      )
    );

    // 2) Fallback alias normalization (backup layer)
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'node:buffer': 'buffer',
      'node:crypto': 'crypto',
      'node:stream': 'stream',
      'node:path': 'path',
      'node:url': 'url',
      'node:util': 'util',
      'node:events': 'events',
      'node:fs': 'fs',
      'node:fs/promises': 'fs/promises',
      'node:os': 'os',
      'node:child_process': 'child_process',
      'node:tty': 'tty',
    };

    // 3) For client bundles: set Node core module fallbacks to false
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        'fs/promises': false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        path: false,
        url: false,
        util: false,
        events: false,
        os: false,
        buffer: false,
        child_process: false,
        tty: false,
      };

      // Externalize Prisma and node-cron for client builds
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push({
          '@prisma/client': 'commonjs @prisma/client',
          'node-cron': 'commonjs node-cron',
        });
      }
    }

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
