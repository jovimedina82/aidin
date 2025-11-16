/**
 * Structured Logger for Aidin Helpdesk
 *
 * Replaces console.log/warn/error with structured, leveled logging
 * that's safe for production use.
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Structured JSON output in production
 * - Human-readable output in development
 * - Automatic sensitive data redaction
 * - Request context support
 * - Performance-optimized (no-op in production for debug)
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  requestId?: string;
  userId?: string;
  ip?: string;
  action?: string;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// Sensitive field patterns to redact
const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'session',
  'credit_card',
  'creditcard',
  'ssn',
  'social_security',
];

const isProduction = process.env.NODE_ENV === 'production';
const LOG_LEVEL = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check if a log level should be output
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[LOG_LEVEL as LogLevel];
}

/**
 * Redact sensitive fields from an object
 */
function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Redact long strings that look like tokens
    if (obj.length > 50 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(obj)) {
      return '[REDACTED_TOKEN]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_PATTERNS.some(pattern => lowerKey.includes(pattern));

      if (isSensitive) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = redactSensitive(value, depth + 1);
      }
    }
    return redacted;
  }

  return obj;
}

/**
 * Format log entry for output
 */
function formatLogEntry(entry: LogEntry): string {
  if (isProduction) {
    // JSON output for production (easier to parse by log aggregators)
    return JSON.stringify(entry);
  }

  // Human-readable format for development
  const timestamp = entry.timestamp.split('T')[1].split('.')[0];
  const levelIcon = {
    debug: '🔍',
    info: 'ℹ️ ',
    warn: '⚠️ ',
    error: '❌',
  }[entry.level];

  let output = `${timestamp} ${levelIcon} ${entry.message}`;

  if (entry.context && Object.keys(entry.context).length > 0) {
    output += ` | ${JSON.stringify(entry.context)}`;
  }

  if (entry.error) {
    output += `\n  Error: ${entry.error.message}`;
    if (!isProduction && entry.error.stack) {
      output += `\n  Stack: ${entry.error.stack.split('\n').slice(1, 4).join('\n        ')}`;
    }
  }

  return output;
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
  };

  if (context) {
    entry.context = redactSensitive(context) as LogContext;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
    };
    // Only include stack in non-production
    if (!isProduction) {
      entry.error.stack = error.stack;
    }
  }

  return entry;
}

/**
 * Output a log entry
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'debug':
    case 'info':
      console.log(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
}

/**
 * Logger instance
 */
class Logger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = context;
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger({ ...this.context, ...additionalContext });
  }

  /**
   * Debug level log (development only)
   */
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, { ...this.context, ...context });
    outputLog(entry);
  }

  /**
   * Info level log
   */
  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, { ...this.context, ...context });
    outputLog(entry);
  }

  /**
   * Warning level log
   */
  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, { ...this.context, ...context });
    outputLog(entry);
  }

  /**
   * Error level log
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!shouldLog('error')) return;

    const err = error instanceof Error ? error : undefined;
    const entry = createLogEntry('error', message, { ...this.context, ...context }, err);

    // If error is not an Error instance, add it to context
    if (error && !(error instanceof Error)) {
      entry.context = {
        ...entry.context,
        errorDetails: redactSensitive(error),
      } as LogContext;
    }

    outputLog(entry);
  }
}

// Default logger instance
const logger = new Logger();

export { Logger, logger };
export type { LogContext, LogLevel };
export default logger;
