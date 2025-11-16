/**
 * Safe JSON parsing utilities
 *
 * Provides error-safe JSON parsing with logging and fallback values.
 * Prevents application crashes from malformed JSON responses.
 */

import logger from '@/lib/logger';

interface ParseOptions<T> {
  fallback: T;
  context?: string;
  logError?: boolean;
}

/**
 * Safely parse JSON string with fallback value
 *
 * @param jsonString - The JSON string to parse
 * @param options - Parse options including fallback value
 * @returns Parsed object or fallback value
 *
 * @example
 * ```typescript
 * const result = safeJsonParse(aiResponse, {
 *   fallback: { tags: [], confidence: 0 },
 *   context: 'AI classification response'
 * });
 * ```
 */
export function safeJsonParse<T>(
  jsonString: string | null | undefined,
  options: ParseOptions<T>
): T {
  const { fallback, context = 'JSON parse', logError = true } = options;

  if (!jsonString || typeof jsonString !== 'string') {
    if (logError) {
      logger.warn(`${context}: Empty or invalid input`, {
        inputType: typeof jsonString,
        inputValue: jsonString === null ? 'null' : jsonString === undefined ? 'undefined' : 'empty',
      });
    }
    return fallback;
  }

  try {
    // Clean up common issues in AI responses
    let cleaned = jsonString.trim();

    // Remove markdown code blocks if present
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    return parsed as T;
  } catch (error) {
    if (logError) {
      logger.error(`${context}: Failed to parse JSON`, error as Error, {
        inputLength: jsonString.length,
        inputPreview: jsonString.substring(0, 200),
      });
    }
    return fallback;
  }
}

/**
 * Safely parse JSON with validation
 *
 * @param jsonString - The JSON string to parse
 * @param validator - Function to validate the parsed object
 * @param options - Parse options including fallback value
 * @returns Parsed and validated object or fallback value
 *
 * @example
 * ```typescript
 * const result = safeJsonParseWithValidation(
 *   aiResponse,
 *   (data) => Array.isArray(data.tags) && typeof data.confidence === 'number',
 *   {
 *     fallback: { tags: [], confidence: 0 },
 *     context: 'AI classification'
 *   }
 * );
 * ```
 */
export function safeJsonParseWithValidation<T>(
  jsonString: string | null | undefined,
  validator: (data: unknown) => boolean,
  options: ParseOptions<T>
): T {
  const parsed = safeJsonParse(jsonString, { ...options, logError: false });

  if (parsed === options.fallback) {
    // Already failed parsing
    return options.fallback;
  }

  try {
    if (validator(parsed)) {
      return parsed;
    } else {
      logger.warn(`${options.context || 'JSON parse'}: Validation failed`, {
        parsedType: typeof parsed,
        parsedKeys: typeof parsed === 'object' && parsed !== null ? Object.keys(parsed) : [],
      });
      return options.fallback;
    }
  } catch (error) {
    logger.error(`${options.context || 'JSON parse'}: Validation error`, error as Error);
    return options.fallback;
  }
}

/**
 * Parse AI response JSON with common structure handling
 *
 * Handles OpenAI/Anthropic response formats automatically.
 *
 * @param response - The AI API response object
 * @param fallback - Default value if parsing fails
 * @param context - Context for logging
 */
export function parseAIResponseJson<T>(
  response: {
    choices?: Array<{ message?: { content?: string } }>;
    content?: Array<{ text?: string }>;
  } | null | undefined,
  fallback: T,
  context: string = 'AI response'
): T {
  if (!response) {
    logger.warn(`${context}: No response received`);
    return fallback;
  }

  // OpenAI format
  if (response.choices && response.choices[0]?.message?.content) {
    return safeJsonParse(response.choices[0].message.content, {
      fallback,
      context: `${context} (OpenAI format)`,
    });
  }

  // Anthropic format
  if (response.content && response.content[0]?.text) {
    return safeJsonParse(response.content[0].text, {
      fallback,
      context: `${context} (Anthropic format)`,
    });
  }

  logger.warn(`${context}: Unrecognized response format`, {
    hasChoices: !!response.choices,
    hasContent: !!response.content,
  });

  return fallback;
}

/**
 * Parse stored JSON field from database
 *
 * Handles cases where database stores JSON as string.
 *
 * @param value - The database field value (could be string or already parsed)
 * @param fallback - Default value if parsing fails
 * @param context - Context for logging
 */
export function parseStoredJson<T>(
  value: string | T | null | undefined,
  fallback: T,
  context: string = 'Stored JSON'
): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  // Already parsed (not a string)
  if (typeof value !== 'string') {
    return value;
  }

  // Empty string
  if (value.trim() === '') {
    return fallback;
  }

  return safeJsonParse(value, { fallback, context });
}

export default {
  safeJsonParse,
  safeJsonParseWithValidation,
  parseAIResponseJson,
  parseStoredJson,
};
