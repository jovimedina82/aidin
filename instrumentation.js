// This file is automatically loaded by Next.js on server startup
// See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  // Only run on Node.js server runtime (not during build or in edge runtime)
  if (typeof process !== 'undefined' && process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic imports wrapped to avoid webpack bundling during build
    const registerServer = () => import('./instrumentation.server.js')
      .then(mod => mod.registerServer())
      .catch(err => {
        console.error('Failed to load server instrumentation:', err)
      })

    await registerServer()
  }
}
