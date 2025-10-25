#!/usr/bin/env tsx
/**
 * OpenAPI 3.1 Generator for AidIN Admin APIs
 *
 * Generates a valid OpenAPI specification for the admin module APIs.
 * Run with: npm run openapi:gen
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const openApiSpec = {
  openapi: '3.1.0',
  info: {
    title: 'AidIN Helpdesk API',
    version: '1.0.0',
    description: 'API documentation for AidIN helpdesk system - Admin Module Management',
    contact: {
      name: 'AidIN Support',
      email: 'support@aidin.com',
    },
  },
  servers: [
    {
      url: 'https://helpdesk.surterreproperties.com',
      description: 'Production server',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development server',
    },
  ],
  tags: [
    {
      name: 'Admin',
      description: 'Administrative operations (requires admin role)',
    },
  ],
  paths: {
    '/api/admin/modules': {
      get: {
        tags: ['Admin'],
        summary: 'List available modules',
        description: 'Returns a list of all available modules in the system',
        operationId: 'listModules',
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    modules: {
                      type: 'array',
                      items: {
                        type: 'string',
                        enum: ['tickets', 'reports', 'presence', 'kb', 'uploads'],
                      },
                    },
                  },
                  required: ['modules'],
                },
                example: {
                  modules: ['tickets', 'reports', 'presence', 'kb', 'uploads'],
                },
              },
            },
          },
        },
      },
    },
    '/api/admin/role-modules': {
      get: {
        tags: ['Admin'],
        summary: 'Get role-level module assignments',
        description: 'Returns module assignments for all roles',
        operationId: 'getRoleModules',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/RoleModule',
                  },
                },
                example: [
                  {
                    role: 'requester',
                    modules: ['tickets', 'kb'],
                    createdAt: '2025-01-15T10:00:00Z',
                    updatedAt: '2025-01-15T10:00:00Z',
                  },
                  {
                    role: 'staff',
                    modules: ['tickets', 'kb', 'presence'],
                    createdAt: '2025-01-15T10:00:00Z',
                    updatedAt: '2025-01-15T10:00:00Z',
                  },
                ],
              },
            },
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError',
          },
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update role-level module assignments',
        description: 'Sets module assignments for a specific role',
        operationId: 'updateRoleModules',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  role: {
                    type: 'string',
                    enum: ['requester', 'staff', 'manager', 'admin'],
                  },
                  modules: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    maxItems: 64,
                  },
                },
                required: ['role', 'modules'],
              },
              example: {
                role: 'staff',
                modules: ['tickets', 'kb', 'presence'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                    },
                  },
                },
                example: {
                  ok: true,
                },
              },
            },
          },
          '400': {
            $ref: '#/components/responses/ValidationError',
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError',
          },
        },
      },
    },
    '/api/admin/user-modules': {
      get: {
        tags: ['Admin'],
        summary: 'Get user-specific module overrides',
        description: 'Returns module assignments for a specific user',
        operationId: 'getUserModules',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'userId',
            in: 'query',
            description: 'User ID to query',
            required: true,
            schema: {
              type: 'string',
            },
          },
        ],
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/UserModule',
                },
                example: {
                  userId: 'user123',
                  modules: ['tickets', 'reports'],
                  createdAt: '2025-01-15T10:00:00Z',
                  updatedAt: '2025-01-15T10:00:00Z',
                },
              },
            },
          },
          '400': {
            description: 'Missing userId parameter',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Error',
                },
                example: {
                  error: 'userId query parameter required',
                },
              },
            },
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError',
          },
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update user-specific module overrides',
        description: 'Sets module assignments for a specific user (overrides role defaults)',
        operationId: 'updateUserModules',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: {
                    type: 'string',
                    minLength: 1,
                  },
                  modules: {
                    type: 'array',
                    items: {
                      type: 'string',
                    },
                    maxItems: 128,
                  },
                },
                required: ['userId', 'modules'],
              },
              example: {
                userId: 'user123',
                modules: ['tickets', 'reports', 'uploads'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Successful response',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: {
                      type: 'boolean',
                    },
                  },
                },
                example: {
                  ok: true,
                },
              },
            },
          },
          '400': {
            $ref: '#/components/responses/ValidationError',
          },
          '403': {
            $ref: '#/components/responses/ForbiddenError',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /api/auth/login',
      },
    },
    schemas: {
      RoleModule: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            enum: ['requester', 'staff', 'manager', 'admin'],
            description: 'User role',
          },
          modules: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of module keys assigned to this role',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when record was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when record was last updated',
          },
        },
        required: ['role', 'modules', 'createdAt', 'updatedAt'],
      },
      UserModule: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID',
          },
          modules: {
            type: 'array',
            items: {
              type: 'string',
            },
            description: 'Array of module keys assigned to this user (overrides role defaults)',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when record was created',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
            description: 'Timestamp when record was last updated',
          },
        },
        required: ['userId', 'modules'],
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message',
          },
          code: {
            type: 'string',
            description: 'Error code',
          },
          details: {
            type: 'object',
            description: 'Additional error details',
          },
        },
        required: ['error'],
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'BAD_REQUEST: Validation failed',
              code: 'VALIDATION_ERROR',
              details: {
                issues: [
                  {
                    path: ['role'],
                    message: 'Invalid enum value',
                  },
                ],
              },
            },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error',
            },
            example: {
              error: 'FORBIDDEN: Insufficient role level',
              code: 'INSUFFICIENT_ROLE',
            },
          },
        },
      },
    },
  },
};

// Write to file
const outputPath = resolve(process.cwd(), 'docs', 'openapi.yaml');

// Convert to YAML manually (simple implementation)
function toYAML(obj: any, indent = 0): string {
  const spaces = '  '.repeat(indent);
  let result = '';

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      result += `${spaces}${key}: null\n`;
    } else if (Array.isArray(value)) {
      result += `${spaces}${key}:\n`;
      for (const item of value) {
        if (typeof item === 'object') {
          result += `${spaces}- \n${toYAML(item, indent + 1)}`;
        } else {
          result += `${spaces}- ${JSON.stringify(item)}\n`;
        }
      }
    } else if (typeof value === 'object') {
      result += `${spaces}${key}:\n${toYAML(value, indent + 1)}`;
    } else if (typeof value === 'string') {
      result += `${spaces}${key}: ${JSON.stringify(value)}\n`;
    } else {
      result += `${spaces}${key}: ${value}\n`;
    }
  }

  return result;
}

const yamlContent = toYAML(openApiSpec);

try {
  writeFileSync(outputPath, yamlContent, 'utf8');
  console.log('✅ OpenAPI specification generated successfully!');
  console.log(`📄 File: ${outputPath}`);
  console.log(`📊 Documented ${Object.keys(openApiSpec.paths).length} endpoints`);
} catch (error) {
  console.error('❌ Error generating OpenAPI spec:', error);
  process.exit(1);
}
