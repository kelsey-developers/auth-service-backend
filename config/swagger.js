const swaggerUi = require('swagger-ui-express');

function buildSpec(port) {
  const serverUrl = `http://localhost:${port}`;
  return {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication service with JWT tokens',
      contact: { name: 'API Support' },
    },
    servers: [{ url: serverUrl, description: 'Development server' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths: {
      '/status': {
        get: {
          summary: 'Check service status',
          tags: ['System'],
          responses: {
            200: {
              description: 'Service is running',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      service: { type: 'string', example: 'auth-service-backend' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          summary: 'User Authentication (Login)',
          tags: ['Authentication'],
          description: 'Authenticate user with email and password. Returns a JWT access token.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email', example: 'test@example.com' },
                    password: { type: 'string', format: 'password', example: 'secret' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Login successful - Returns JWT access token',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      accessToken: { type: 'string', description: 'JWT (valid 24h)' },
                      tokenType: { type: 'string', example: 'Bearer' },
                      expiresIn: { type: 'integer', example: 86400 },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Bad Request - Missing email or password',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Email and password are required' } },
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized - Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Invalid email or password' } },
                  },
                },
              },
            },
            500: {
              description: 'Internal Server Error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Internal server error' } },
                  },
                },
              },
            },
          },
        },
      },
      '/api/auth/userinfo': {
        get: {
          summary: 'Get user information',
          tags: ['Authentication'],
          description: 'Get authenticated user information using JWT access token',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'User information retrieved successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer', example: 1 },
                      email: { type: 'string', format: 'email', example: 'user@example.com' },
                      firstName: { type: 'string', example: 'Juan' },
                      middleName: { type: 'string', example: 'Santos', nullable: true },
                      lastName: { type: 'string', example: 'Dela Cruz' },
                      phone: { type: 'string', example: '+639171234567', nullable: true },
                      status: { type: 'string', example: 'active' },
                      roles: { type: 'array', items: { type: 'string' }, example: ['Agent'] },
                      createdAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            401: {
              description: 'Unauthorized - Invalid or missing token',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Authorization token required' } },
                  },
                },
              },
            },
            404: {
              description: 'User not found',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'User not found' } },
                  },
                },
              },
            },
            500: {
              description: 'Internal server error',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
      },
    },
  };
}

function setupSwagger(app, port) {
  const spec = buildSpec(port);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
}

module.exports = { setupSwagger, buildSpec };
