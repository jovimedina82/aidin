import { ZodSchema, ZodError } from 'zod';

/**
 * Parse and validate data against a Zod schema
 * @throws Error with status 400 if validation fails
 */
export function parseOrThrow<T>(schema: ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  
  if (\!result.success) {
    const error: any = new Error('BAD_REQUEST: Validation failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.issues = result.error.issues;
    throw error;
  }
  
  return result.data;
}

/**
 * Create a typed JSON response
 */
export function json<T>(status: number, body: T): Response {
  return Response.json(body, { status });
}

/**
 * Create an error response with consistent structure
 */
export function errorResponse(status: number, code: string, message: string, details?: any): Response {
  return json(status, {
    error: {
      code,
      message,
      details,
    },
  });
}

/**
 * Handle errors in API routes consistently
 */
export function handleError(error: any): Response {
  console.error('API Error:', error);
  
  const status = error.status || 500;
  const code = error.code || 'INTERNAL_ERROR';
  const message = error.message || 'An unexpected error occurred';
  const details = error.issues || error.details || undefined;
  
  return errorResponse(status, code, message, details);
}
