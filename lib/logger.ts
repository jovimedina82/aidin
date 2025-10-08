import pino from 'pino'

/**
 * Structured logging with Pino
 * Provides child logger support and request ID binding
 */

const isDevelopment = process.env.NODE_ENV === 'development'

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
  formatters: {
    level: (label) => {
      return { level: label }
    },
  },
})

/**
 * Create a child logger with additional context
 * @param bindings - Additional fields to include in all log messages
 * @returns Child logger instance
 */
export function createChildLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings)
}

/**
 * Create a logger bound to a specific request ID
 * @param requestId - Unique request identifier
 * @returns Logger with requestId bound
 */
export function createRequestLogger(requestId: string) {
  return logger.child({ requestId })
}

/**
 * Generate a unique request ID
 * @returns Request ID string
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
