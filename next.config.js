const nextConfig = {
  // output: 'standalone', // Temporarily commented out to fix static file serving
  images: {
    unoptimized: true,
  },
  experimental: {
    // Remove if not using Server Components
    serverComponentsExternalPackages: ['mongodb'],
    // Enable instrumentation for server initialization
    instrumentationHook: true,
  },
  webpack(config, { dev }) {
    if (dev) {
      // Reduce CPU/memory from file watching
      config.watchOptions = {
        poll: 2000, // check every 2 seconds
        aggregateTimeout: 300, // wait before rebuilding
        ignored: ['**/node_modules'],
      };
    }
    return config;
  },
  onDemandEntries: {
    maxInactiveAge: 10000,
    pagesBufferLength: 2,
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
          { key: "Access-Control-Allow-Origin", value: "https://helpdesk.surterreproperties.com" },
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
