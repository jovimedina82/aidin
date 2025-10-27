/**
 * Email Polling Service Starter (JavaScript Wrapper)
 *
 * This wrapper loads the TypeScript email-polling module and starts the service.
 * It's used by server.js to initialize the modern email processing system.
 */

/**
 * Start the new email polling service
 *
 * This function dynamically imports the TypeScript email-polling job module
 * and starts it using Next.js's built-in TypeScript transpilation.
 */
export async function startEmailPolling() {
  try {
    // Import new JavaScript wrapper for TypeScript service
    const { startEmailPolling: start } = await import('./email-polling-job.js');

    // Start the service
    start();
  } catch (error) {
    console.error('❌ Failed to load new email polling service:', error.message);
    console.error('   Falling back to old service...');

    // Fallback to old service if new service fails to load
    try {
      const { startEmailPolling: fallbackStart } = await import('./start-email-polling.js');
      fallbackStart();
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      throw error;
    }
  }
}

/**
 * Stop email polling
 */
export async function stopEmailPolling() {
  try {
    const { stopEmailPolling: stop } = await import('@/modules/email-polling/job');
    stop();
  } catch (error) {
    console.error('❌ Failed to stop email polling:', error.message);
  }
}
