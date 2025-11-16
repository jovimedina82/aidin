const nextConfig = {
  // output: 'standalone', // Temporarily commented out to fix static file serving

  // Make JWT_SECRET available in Edge Runtime (middleware)
  env: {
    JWT_SECRET: process.env.JWT_SECRET,
  },

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
      '@prisma/client',
      'prisma',
      'node-cron',
    ],
    // Enable instrumentation for server initialization
    instrumentationHook: true,
    // Optimize package imports
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },

  // Enable strict CSP with nonces (Next.js 14+ feature)
  // This automatically adds nonces to inline scripts
  // Note: Requires setting up nonce in middleware
  // See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy

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
    } else {
      // Client-side: exclude Node.js built-in modules
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        child_process: false,
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
    // NOTE: CSP is set dynamically in middleware.ts
    // Static security headers are set here, CSP is set per-request in middleware
    return [
      {
        source: "/(.*)",
        headers: [
          // Strict Transport Security (HSTS) - CRITICAL for security score
          // max-age=31536000 = 1 year
          // includeSubDomains = applies to all subdomains
          // preload = eligible for browser preload lists
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload"
          },
          // Prevent clickjacking attacks
          { key: "X-Frame-Options", value: "DENY" },
          // NOTE: Content-Security-Policy is set in middleware.ts with nonces
          // CORS - Only allow specific origins (never use '*' in production)
          { key: "Access-Control-Allow-Origin", value: "https://helpdesk.surterreproperties.com:3011" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          // Only allow specific headers (never use '*')
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, X-CSRF-Token" },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          // Prevent MIME type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // XSS Protection (legacy but still useful)
          { key: "X-XSS-Protection", value: "1; mode=block" },
          // Control referrer information
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Permissions Policy (formerly Feature-Policy)
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()"
          },
          // Cross-Origin policies for additional security
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
