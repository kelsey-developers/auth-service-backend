const swaggerUi = require('swagger-ui-express');

function buildSpec(port) {
  const serverUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
  return {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication, units, bookings, calendar (blocked dates, pricing rules), agent registration, agent commission, and payout withdrawal API with JWT tokens',
      contact: { name: 'API Support' },
    },
    servers: [{ url: serverUrl, description: process.env.PUBLIC_URL ? 'Live server' : 'Local development' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Payout: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'payout_id' },
            agentId: { type: 'string', description: 'agent user_id' },
            agentName: { type: 'string' },
            amount: { type: 'number' },
            method: { type: 'string', enum: ['gcash', 'maya', 'bank_transfer'] },
            recipientNumber: { type: 'string', nullable: true },
            recipientName: { type: 'string', nullable: true },
            bankName: { type: 'string', nullable: true },
            accountNumber: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['pending', 'paid', 'declined'] },
            proofOfPaymentUrl: { type: 'string', nullable: true },
            notes: { type: 'string', nullable: true },
            requestedAt: { type: 'string', format: 'date-time' },
            processedAt: { type: 'string', format: 'date-time', nullable: true },
          },
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
      '/api/auth/register': {
        post: {
          summary: 'Register a new user account',
          tags: ['Authentication'],
          description: 'Create a new guest user account. Returns 201 on success. Automatically assigns the Guest role.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['firstName', 'lastName', 'email', 'password'],
                  properties: {
                    firstName:  { type: 'string', minLength: 2, maxLength: 100, example: 'Juan' },
                    lastName:   { type: 'string', minLength: 2, maxLength: 100, example: 'Dela Cruz' },
                    email:      { type: 'string', format: 'email', example: 'juan@example.com' },
                    password:   { type: 'string', minLength: 8, maxLength: 128, description: 'Min 8 chars, must include uppercase, lowercase, and number', example: 'Secret123' },
                    phone:      { type: 'string', example: '+639171234567', nullable: true },
                    gender:     { type: 'string', enum: ['male', 'female', 'non-binary', 'other', 'prefer_not_to_say'], nullable: true },
                    birthDate:  { type: 'string', format: 'date', example: '1995-06-15', nullable: true },
                    street:     { type: 'string', example: '123 Rizal St', nullable: true },
                    barangay:   { type: 'string', example: 'Poblacion', nullable: true },
                    city:       { type: 'string', example: 'Davao City', nullable: true },
                    zipCode:    { type: 'string', example: '8000', nullable: true },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Account created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string', example: 'Account created successfully' },
                    },
                  },
                },
              },
            },
            400: {
              description: 'Validation error — missing required fields or invalid format',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Password must contain at least one uppercase letter' } },
                  },
                },
              },
            },
            409: {
              description: 'Conflict — email already registered',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'An account with this email already exists' } },
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
                    properties: { error: { type: 'string', example: 'Internal server error' } },
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
      '/api/profile/me': {
        get: {
          summary: 'Get my profile',
          tags: ['Profile'],
          description: 'Get the authenticated user\'s profile (username, aboutMe, socialLinks, etc.).',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Profile or null if not set up',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      profile: {
                        type: 'object',
                        nullable: true,
                        properties: {
                          id: { type: 'integer' },
                          userId: { type: 'integer' },
                          username: { type: 'string' },
                          aboutMe: { type: 'string' },
                          contactInfo: { type: 'string' },
                          socialLinks: {
                            type: 'object',
                            properties: {
                              facebook: { type: 'string', nullable: true },
                              instagram: { type: 'string', nullable: true },
                              twitter: { type: 'string', nullable: true },
                              linkedin: { type: 'string', nullable: true },
                              whatsapp: { type: 'string', nullable: true },
                            },
                          },
                          profilePhotoUrl: { type: 'string', nullable: true },
                          firstName: { type: 'string' },
                          lastName: { type: 'string' },
                          email: { type: 'string' },
                          phone: { type: 'string', nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            500: { description: 'Internal server error' },
          },
        },
        patch: {
          summary: 'Update my profile',
          tags: ['Profile'],
          description: 'Update aboutMe and/or socialLinks for the authenticated user.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    aboutMe: { type: 'string', maxLength: 2000 },
                    socialLinks: {
                      type: 'object',
                      properties: {
                        facebook: { type: 'string', maxLength: 500 },
                        instagram: { type: 'string', maxLength: 500 },
                        twitter: { type: 'string', maxLength: 500 },
                        linkedin: { type: 'string', maxLength: 500 },
                        whatsapp: { type: 'string', maxLength: 500 },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Profile updated' },
            400: { description: 'No valid fields to update' },
            401: { description: 'Unauthorized' },
            404: { description: 'Profile not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/profile/setup': {
        post: {
          summary: 'Create my profile',
          tags: ['Profile'],
          description: 'Create a profile for the authenticated user. Username is required and must be unique.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username'],
                  properties: {
                    username: { type: 'string', minLength: 2, maxLength: 50, example: 'johndoe' },
                    aboutMe: { type: 'string', maxLength: 2000 },
                    socialLinks: {
                      type: 'object',
                      properties: {
                        facebook: { type: 'string', maxLength: 500 },
                        instagram: { type: 'string', maxLength: 500 },
                        twitter: { type: 'string', maxLength: 500 },
                        linkedin: { type: 'string', maxLength: 500 },
                        whatsapp: { type: 'string', maxLength: 500 },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Profile created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      message: { type: 'string', example: 'Profile created' },
                      username: { type: 'string' },
                    },
                  },
                },
              },
            },
            400: { description: 'Username required or invalid' },
            401: { description: 'Unauthorized' },
            409: { description: 'Profile already exists or username taken' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/users': {
        get: {
          summary: 'List all users (Admin only)',
          tags: ['Users'],
          description: 'Paginated list of all users with their roles. Supports search by name/email and filter by role. Admin role required.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by name or email' },
            {
              name: 'role',
              in: 'query',
              schema: { type: 'string', enum: ['Guest', 'Agent', 'Admin', 'Finance', 'Inventory', 'Housekeeping'] },
              description: 'Filter by role name',
            },
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page (max 100)' },
          ],
          responses: {
            200: {
              description: 'Paginated list of users',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      users: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            firstName: { type: 'string', example: 'Juan' },
                            lastName: { type: 'string', example: 'Dela Cruz' },
                            fullname: { type: 'string', example: 'Juan Dela Cruz' },
                            email: { type: 'string', format: 'email' },
                            phone: { type: 'string', nullable: true },
                            gender: { type: 'string', nullable: true },
                            birthDate: { type: 'string', format: 'date', nullable: true },
                            status: { type: 'string', example: 'active' },
                            createdAt: { type: 'string', format: 'date-time' },
                            roles: { type: 'array', items: { type: 'string' }, example: ['Guest'] },
                          },
                        },
                      },
                      total: { type: 'integer', example: 42 },
                      page: { type: 'integer', example: 1 },
                      limit: { type: 'integer', example: 20 },
                      total_pages: { type: 'integer', example: 3 },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/users/{id}': {
        patch: {
          summary: 'Update user (Admin only)',
          tags: ['Users'],
          description: 'Update a user\'s first name, last name, email, and/or role. Admin role required. Role change updates the user_role record directly.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'User ID' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    firstName: { type: 'string', example: 'Juan' },
                    lastName: { type: 'string', example: 'Dela Cruz' },
                    email: { type: 'string', format: 'email', example: 'juan@example.com' },
                    status: { type: 'string', enum: ['active', 'inactive', 'suspended'], example: 'active' },
                    role: { type: 'string', enum: ['Guest', 'Agent', 'Admin', 'Finance', 'Inventory', 'Housekeeping'], example: 'Agent' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Updated user object',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      firstName: { type: 'string' },
                      lastName: { type: 'string' },
                      fullname: { type: 'string' },
                      email: { type: 'string' },
                      roles: { type: 'array', items: { type: 'string' }, example: ['Agent'] },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error — invalid field or unknown role' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'User not found' },
            409: { description: 'Conflict — email already in use by another account' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/{username}': {
        get: {
          summary: 'Get agent profile by username',
          tags: ['Agents'],
          description: 'Get public agent profile by username. No auth required. Used by agent profile page.',
          parameters: [
            { name: 'username', in: 'path', required: true, schema: { type: 'string' }, description: 'Profile username (e.g. mokong)' },
          ],
          responses: {
            200: {
              description: 'Profile details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      userId: { type: 'integer' },
                      username: { type: 'string' },
                      aboutMe: { type: 'string' },
                      contactInfo: { type: 'string' },
                      socialLinks: {
                        type: 'object',
                        properties: {
                          facebook: { type: 'string', nullable: true },
                          instagram: { type: 'string', nullable: true },
                          twitter: { type: 'string', nullable: true },
                          linkedin: { type: 'string', nullable: true },
                          whatsapp: { type: 'string', nullable: true },
                        },
                      },
                      profilePhotoUrl: { type: 'string', nullable: true },
                      firstName: { type: 'string' },
                      lastName: { type: 'string' },
                      fullName: { type: 'string' },
                      email: { type: 'string' },
                      phone: { type: 'string', nullable: true },
                      location: { type: 'string' },
                    },
                  },
                },
              },
            },
            400: { description: 'Username required' },
            404: { description: 'Profile not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/units': {
        get: {
          summary: 'List units',
          tags: ['Units'],
          description: 'List available units (listings). Filter by featured, city, limit, offset.',
          parameters: [
            { name: 'featured', in: 'query', schema: { type: 'string', enum: ['true', 'false'] }, description: 'Filter featured units' },
            { name: 'city', in: 'query', schema: { type: 'string' }, description: 'Filter by city' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 }, description: 'Max results' },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 }, description: 'Offset for pagination' },
          ],
          responses: {
            200: {
              description: 'List of units',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number' },
                        price_unit: { type: 'string', example: 'night' },
                        currency: { type: 'string', example: '₱' },
                        location: { type: 'string' },
                        city: { type: 'string' },
                        country: { type: 'string' },
                        bedrooms: { type: 'integer' },
                        bathrooms: { type: 'integer' },
                        property_type: { type: 'string' },
                        main_image_url: { type: 'string', nullable: true },
                        is_featured: { type: 'boolean' },
                        min_pax: { type: 'integer', nullable: true, description: 'Minimum guests' },
                        max_capacity: { type: 'integer', nullable: true, description: 'Maximum guests' },
                        excess_pax_fee: { type: 'number', nullable: true, description: 'Fee per extra guest over max_capacity' },
                        latitude: { type: 'number', nullable: true },
                        longitude: { type: 'number', nullable: true },
                        check_in_time: { type: 'string', nullable: true },
                        check_out_time: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          summary: 'Create a new unit',
          tags: ['Units'],
          description: 'Create a new unit/listing. Admin or Agent only. Admin can set any owner; Agent is automatically the owner.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['unit_name', 'min_pax', 'max_capacity', 'base_price'],
                  properties: {
                    unit_name:       { type: 'string', maxLength: 150, example: 'Sea View Studio' },
                    description:     { type: 'string', nullable: true, example: 'A cozy studio with ocean view.' },
                    unit_type:       { type: 'string', enum: ['apartment', 'condo', 'villa', 'house', 'studio', 'townhouse', 'cabin', 'penthouse', 'duplex', 'other'], default: 'apartment' },
                    status:          { type: 'string', enum: ['available', 'unavailable', 'maintenance'], default: 'available' },
                    location:        { type: 'string', nullable: true, example: '123 Beach Rd' },
                    city:            { type: 'string', nullable: true, example: 'Davao City' },
                    country:         { type: 'string', nullable: true, example: 'Philippines' },
                    bedroom_count:   { type: 'integer', minimum: 0, default: 0 },
                    bathroom_count:  { type: 'integer', minimum: 0, default: 0 },
                    area_sqm:        { type: 'number', nullable: true, example: 45.5 },
                    min_pax:         { type: 'integer', minimum: 1, example: 2 },
                    max_capacity:    { type: 'integer', example: 6 },
                    base_price:      { type: 'number', minimum: 0, example: 2500 },
                    excess_pax_fee:  { type: 'number', minimum: 0, default: 0, example: 500 },
                    amenities:       { type: 'array', items: { type: 'string' }, example: ['WiFi', 'Pool', 'Air Conditioning'] },
                    check_in_time:   { type: 'string', nullable: true, example: '14:00' },
                    check_out_time:  { type: 'string', nullable: true, example: '12:00' },
                    latitude:        { type: 'number', nullable: true, example: 7.0707 },
                    longitude:       { type: 'number', nullable: true, example: 125.6087 },
                    is_featured:     { type: 'boolean', default: false },
                    owner_user_id:   { type: 'integer', nullable: true, description: 'Admin only — override owner. Ignored for Agent.' },
                    images: {
                      type: 'array',
                      description: 'Array of image objects. First image with is_main=true becomes the main photo.',
                      items: {
                        type: 'object',
                        properties: {
                          url:        { type: 'string', example: 'https://example.com/uploads/photo.jpg' },
                          is_main:    { type: 'boolean', default: false },
                          sort_order: { type: 'integer', default: 0 },
                        },
                      },
                    },
                    assigned_agent_ids: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'User IDs of agents to assign to this unit.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Unit created successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id:             { type: 'string', example: '42' },
                      title:          { type: 'string' },
                      unit_type:      { type: 'string' },
                      status:         { type: 'string' },
                      base_price:     { type: 'number' },
                      min_pax:        { type: 'integer' },
                      max_capacity:   { type: 'integer' },
                      excess_pax_fee: { type: 'number' },
                      city:           { type: 'string', nullable: true },
                      is_featured:    { type: 'boolean' },
                      main_image_url: { type: 'string', nullable: true },
                      images:         { type: 'array', items: { type: 'string' } },
                      amenities:      { type: 'array', items: { type: 'string' } },
                      latitude:       { type: 'number', nullable: true },
                      longitude:      { type: 'number', nullable: true },
                    },
                  },
                },
              },
            },
            400: { description: 'Validation error — missing or invalid fields' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/units/manage': {
        get: {
          summary: 'List units for management',
          tags: ['Units'],
          description: 'List units for Admin/Agent. Admin sees all; Agent sees only their own. Requires auth.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of units with owner, status, bookings_count',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        price: { type: 'number' },
                        unit_number: { type: 'string', nullable: true },
                        location: { type: 'string' },
                        city: { type: 'string', nullable: true },
                        country: { type: 'string', nullable: true },
                        bedrooms: { type: 'integer' },
                        bathrooms: { type: 'integer' },
                        property_type: { type: 'string' },
                        main_image_url: { type: 'string', nullable: true },
                        status: { type: 'string', enum: ['available', 'unavailable', 'maintenance'] },
                        is_featured: { type: 'boolean' },
                        min_pax: { type: 'integer', nullable: true },
                        max_capacity: { type: 'integer', nullable: true },
                        excess_pax_fee: { type: 'number', nullable: true },
                        owner: { type: 'object', nullable: true, properties: { id: { type: 'string' }, fullname: { type: 'string' }, email: { type: 'string' } } },
                        bookings_count: { type: 'integer' },
                        assigned_agents: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              username: { type: 'string' },
                              fullname: { type: 'string' },
                            },
                          },
                          description: 'Agents assigned to this unit',
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/units/{id}': {
        get: {
          summary: 'Get unit by ID',
          tags: ['Units'],
          description: 'Get a single unit (listing) by ID.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Unit ID' },
          ],
          responses: {
            200: {
              description: 'Unit details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      title: { type: 'string' },
                      description: { type: 'string' },
                      price: { type: 'number' },
                      price_unit: { type: 'string', example: 'night' },
                      currency: { type: 'string', example: '₱' },
                      location: { type: 'string' },
                      city: { type: 'string' },
                      country: { type: 'string', nullable: true },
                      bedrooms: { type: 'integer' },
                      bathrooms: { type: 'integer' },
                      square_feet: { type: 'number', nullable: true },
                      area_sqm: { type: 'number', nullable: true },
                      property_type: { type: 'string' },
                      main_image_url: { type: 'string', nullable: true },
                      image_urls: { type: 'array', items: { type: 'string' } },
                      amenities: { type: 'array', items: { type: 'string' } },
                      min_pax: { type: 'integer' },
                      max_capacity: { type: 'integer' },
                      excess_pax_fee: { type: 'number' },
                      is_available: { type: 'boolean' },
                      is_featured: { type: 'boolean' },
                      latitude: { type: 'number', nullable: true },
                      longitude: { type: 'number', nullable: true },
                      check_in_time: { type: 'string', nullable: true },
                      check_out_time: { type: 'string', nullable: true },
                      created_at: { type: 'string', format: 'date-time' },
                      updated_at: { type: 'string', format: 'date-time' },
                      assigned_agent_ids: { type: 'array', items: { type: 'string' }, description: 'User IDs of assigned agents' },
                    },
                  },
                },
              },
            },
            404: { description: 'Unit not found' },
            500: { description: 'Internal server error' },
          },
        },
        put: {
          summary: 'Full update unit',
          tags: ['Units'],
          description: 'Full update of unit (all fields + images). Admin or Agent only. Agent can only update units they own.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Unit ID' },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['unit_name', 'min_pax', 'max_capacity', 'base_price'],
                  properties: {
                    unit_name:       { type: 'string', maxLength: 150, example: 'Sea View Studio' },
                    description:     { type: 'string', nullable: true },
                    unit_type:       { type: 'string', enum: ['apartment', 'condo', 'villa', 'house', 'studio', 'townhouse', 'cabin', 'penthouse', 'duplex', 'other'] },
                    location:        { type: 'string', nullable: true },
                    city:            { type: 'string', nullable: true },
                    country:         { type: 'string', nullable: true },
                    bedroom_count:   { type: 'integer', minimum: 0 },
                    bathroom_count:  { type: 'integer', minimum: 0 },
                    area_sqm:        { type: 'number', nullable: true },
                    min_pax:         { type: 'integer', minimum: 1 },
                    max_capacity:    { type: 'integer' },
                    base_price:      { type: 'number', minimum: 0 },
                    excess_pax_fee:  { type: 'number', minimum: 0 },
                    amenities:       { type: 'array', items: { type: 'string' } },
                    check_in_time:   { type: 'string', nullable: true },
                    check_out_time:  { type: 'string', nullable: true },
                    latitude:        { type: 'number', nullable: true },
                    longitude:       { type: 'number', nullable: true },
                    images: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          url:        { type: 'string' },
                          is_main:    { type: 'boolean' },
                          sort_order: { type: 'integer' },
                        },
                      },
                    },
                    assigned_agent_ids: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'User IDs of agents to assign. Replaces existing assignments.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Unit updated successfully' },
            400: { description: 'Validation error' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin or Agent only; Agent can only update own units' },
            404: { description: 'Unit not found' },
            500: { description: 'Internal server error' },
          },
        },
        patch: {
          summary: 'Partial update unit',
          tags: ['Units'],
          description: 'Update unit status, featured flag, or assigned agents. Admin only.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Unit ID' },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', enum: ['available', 'unavailable', 'maintenance'] },
                    is_featured: { type: 'boolean' },
                    assigned_agent_ids: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'User IDs of agents to assign. Replaces existing assignments.',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Unit updated',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', enum: ['available', 'unavailable', 'maintenance'] },
                      is_available: { type: 'boolean' },
                      is_featured: { type: 'boolean' },
                      updated_at: { type: 'string', format: 'date-time' },
                      assigned_agent_ids: { type: 'array', items: { type: 'string' }, description: 'Present when assigned_agent_ids was updated' },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            404: { description: 'Unit not found' },
            500: { description: 'Internal server error' },
          },
        },
        delete: {
          summary: 'Delete unit',
          tags: ['Units'],
          description: 'Delete a unit. Admin only. Fails if unit has existing bookings.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Unit ID' },
          ],
          responses: {
            200: {
              description: 'Unit deleted',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      deleted: { type: 'boolean', example: true },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid unit ID' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'Unit not found' },
            409: { description: 'Cannot delete — unit has existing bookings' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/bookings': {
        get: {
          summary: 'List bookings for a listing',
          tags: ['Bookings'],
          description: 'Get bookings for a listing (unit) by listingId. Includes blocked date ranges as items with status `blocked` so they appear unavailable. Used for availability/calendar.',
          parameters: [
            { name: 'listingId', in: 'query', required: true, schema: { type: 'string' }, description: 'Unit/listing ID' },
          ],
          responses: {
            200: {
              description: 'List of bookings and blocked ranges for the listing',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'Booking ID or block-{block_id} for blocked ranges' },
                        check_in_date: { type: 'string', format: 'date' },
                        check_out_date: { type: 'string', format: 'date' },
                        status: { type: 'string', enum: ['penciled', 'confirmed', 'blocked'] },
                        reason: { type: 'string', description: 'Present when status is blocked' },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'listingId required' },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          summary: 'Create booking',
          tags: ['Bookings'],
          description: 'Create a new booking. Admin or Agent only. Checks for overlapping dates and blocked periods (unit_block_dates). Rejects if dates overlap an existing booking or blocked range. Returns reference_code.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['listing_id', 'check_in_date', 'check_out_date', 'total_guests'],
                  properties: {
                    listing_id: { type: 'string', description: 'Unit ID' },
                    check_in_date: { type: 'string', format: 'date' },
                    check_out_date: { type: 'string', format: 'date' },
                    total_guests: { type: 'integer', minimum: 1, description: 'Total guests (primary + extra combined)' },
                    landmark: { type: 'string' },
                    parking_info: { type: 'string' },
                    notes: { type: 'string' },
                    payment_method: { type: 'string', enum: ['cash', 'bank_transfer', 'credit_card', 'gcash', 'company_account'] },
                    client: {
                      type: 'object',
                      properties: {
                        first_name: { type: 'string' },
                        last_name: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        contact_number: { type: 'string' },
                        gender: { type: 'string' },
                        birth_date: { type: 'string' },
                        preferred_contact: { type: 'string' },
                        referred_by: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Booking created',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      booking_id: { type: 'integer' },
                      reference_code: { type: 'string', example: 'BKG-A7X9K2M1B4C5' },
                      check_in_date: { type: 'string' },
                      check_out_date: { type: 'string' },
                      total_guests: { type: 'integer' },
                      status: { type: 'string', example: 'penciled' },
                      total_amount: { type: 'number' },
                    },
                  },
                },
              },
            },
            400: { description: 'Bad request - missing/invalid fields' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent required' },
            409: {
              description: 'Conflict - dates overlap with existing booking or blocked period',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string' },
                      overlapping: { type: 'boolean', example: true },
                      blocked: { type: 'boolean', description: 'True when overlap is with a blocked date range' },
                    },
                  },
                },
              },
            },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/bookings/my': {
        get: {
          summary: 'List my bookings (or all bookings for Admin)',
          tags: ['Bookings'],
          description: 'Agent: returns bookings created by the current user. Admin: returns all bookings across all agents. Supports optional `status` filter.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['penciled', 'confirmed', 'cancelled', 'completed'] },
              description: 'Filter by booking status (raw DB value)',
            },
          ],
          responses: {
            200: {
              description: 'List of bookings',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        reference_code: { type: 'string', example: 'BKG-A7X9K2M1B4C5' },
                        check_in_date: { type: 'string' },
                        check_out_date: { type: 'string' },
                        status: { type: 'string', enum: ['pending', 'booked', 'completed', 'cancelled'] },
                        raw_status: { type: 'string', enum: ['penciled', 'confirmed', 'cancelled', 'completed'] },
                        total_amount: { type: 'number' },
                        transaction_number: { type: 'string' },
                        listing: {
                          type: 'object',
                          properties: {
                            title: { type: 'string' },
                            location: { type: 'string' },
                            main_image_url: { type: 'string' },
                          },
                        },
                        agent: {
                          type: 'object',
                          nullable: true,
                          description: 'Included when caller is Admin',
                          properties: {
                            first_name: { type: 'string' },
                            last_name: { type: 'string' },
                          },
                        },
                        client: {
                          type: 'object',
                          properties: {
                            first_name: { type: 'string' },
                            last_name: { type: 'string' },
                          },
                        },
                        payment: {
                          type: 'object',
                          nullable: true,
                          properties: {
                            reference_number: { type: 'string' },
                            status: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/bookings/all': {
        get: {
          summary: 'List all bookings (Admin only)',
          tags: ['Bookings'],
          description: 'Paginated list of all bookings. Admin role required. Supports filtering by status, unit, agent, and search.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 }, description: 'Items per page (max 100)' },
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['penciled', 'confirmed', 'cancelled', 'completed'] },
              description: 'Filter by booking status',
            },
            { name: 'unit_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by unit ID' },
            { name: 'agent_id', in: 'query', schema: { type: 'integer' }, description: 'Filter by agent user ID' },
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by reference code, client/agent name, or unit name' },
          ],
          responses: {
            200: {
              description: 'Paginated list of bookings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            reference_code: { type: 'string', example: 'BKG-A7X9K2M1B4C5' },
                            check_in_date: { type: 'string', format: 'date' },
                            check_out_date: { type: 'string', format: 'date' },
                            nights: { type: 'integer' },
                            total_guests: { type: 'integer' },
                            status: { type: 'string', enum: ['pending', 'booked', 'completed', 'cancelled'] },
                            raw_status: { type: 'string', enum: ['penciled', 'confirmed', 'cancelled', 'completed'] },
                            total_amount: { type: 'number' },
                            created_at: { type: 'string', format: 'date-time' },
                            listing: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                title: { type: 'string' },
                                location: { type: 'string' },
                                main_image_url: { type: 'string' },
                              },
                            },
                            agent: {
                              type: 'object',
                              properties: {
                                id: { type: 'string', nullable: true },
                                first_name: { type: 'string' },
                                last_name: { type: 'string' },
                                email: { type: 'string' },
                              },
                            },
                            client: {
                              type: 'object',
                              properties: {
                                first_name: { type: 'string' },
                                last_name: { type: 'string' },
                                email: { type: 'string' },
                                contact_number: { type: 'string' },
                              },
                            },
                            payment: {
                              type: 'object',
                              nullable: true,
                              properties: {
                                payment_method: { type: 'string' },
                                reference_number: { type: 'string' },
                                status: { type: 'string' },
                                deposit_amount: { type: 'number' },
                              },
                            },
                          },
                        },
                      },
                      pagination: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer', example: 1 },
                          limit: { type: 'integer', example: 20 },
                          total: { type: 'integer', example: 150 },
                          total_pages: { type: 'integer', example: 8 },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/bookings/{id}/confirm': {
        patch: {
          summary: 'Confirm penciled booking (Admin only)',
          tags: ['Bookings'],
          description: 'Confirm a penciled booking (penciled → confirmed). Admin role required. Verifies payment if present.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Booking ID' },
          ],
          responses: {
            200: {
              description: 'Booking confirmed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'confirmed' },
                      confirmed_at: { type: 'string', format: 'date-time' },
                      confirmed_by_user_id: { type: 'integer' },
                    },
                  },
                },
              },
            },
            400: { description: 'Only penciled bookings can be confirmed' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'Booking not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/bookings/{id}/decline': {
        patch: {
          summary: 'Decline penciled booking (Admin only)',
          tags: ['Bookings'],
          description: 'Decline a penciled booking (penciled → cancelled). Admin role required.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Booking ID' },
          ],
          responses: {
            200: {
              description: 'Booking declined',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'cancelled' },
                    },
                  },
                },
              },
            },
            400: { description: 'Only penciled bookings can be declined' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'Booking not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/bookings/{id}': {
        get: {
          summary: 'Get booking by ID or reference',
          tags: ['Bookings'],
          description: 'Get a single booking by numeric ID or reference_code (e.g. BKG-A7X9K2M1B4C5). Auth optional for guest confirmation links.',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Booking ID (numeric) or reference_code (BKG-xxx)' },
          ],
          security: [],
          responses: {
            200: {
              description: 'Booking details',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      reference_code: { type: 'string' },
                      listing_id: { type: 'string' },
                      check_in_date: { type: 'string' },
                      check_out_date: { type: 'string' },
                      nights: { type: 'integer' },
                      total_guests: { type: 'integer' },
                      excess_pax_charge: { type: 'number', description: 'Fee for guests over unit max capacity' },
                      unit_charge: { type: 'number' },
                      service_charge: { type: 'number' },
                      total_amount: { type: 'number' },
                      currency: { type: 'string', example: 'PHP' },
                      status: { type: 'string' },
                      listing: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          title: { type: 'string' },
                          location: { type: 'string' },
                          main_image_url: { type: 'string' },
                          property_type: { type: 'string' },
                          check_in_time: { type: 'string' },
                          check_out_time: { type: 'string' },
                          latitude: { type: 'number' },
                          longitude: { type: 'number' },
                        },
                      },
                      agent: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          fullname: { type: 'string' },
                          email: { type: 'string' },
                        },
                      },
                      client: {
                        type: 'object',
                        properties: {
                          first_name: { type: 'string' },
                          last_name: { type: 'string' },
                          email: { type: 'string' },
                          contact_number: { type: 'string' },
                        },
                      },
                      payment: {
                        type: 'object',
                        properties: {
                          payment_method: { type: 'string' },
                          reference_number: { type: 'string' },
                          payment_status: { type: 'string' },
                          deposit_amount: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid booking ID or reference' },
            403: { description: 'Forbidden - not agent or Admin' },
            404: { description: 'Booking not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/calendar/blocked-ranges': {
        get: {
          summary: 'List blocked date ranges',
          tags: ['Calendar'],
          description: 'Get blocked date ranges for unit(s). Use listingId for a single unit or unit_ids (comma-separated) for multiple. Returns global blocks (unit_id null) and unit-specific blocks.',
          parameters: [
            { name: 'listingId', in: 'query', schema: { type: 'string' }, description: 'Single unit ID' },
            { name: 'unit_ids', in: 'query', schema: { type: 'string' }, description: 'Comma-separated unit IDs (e.g. 1,2,3)' },
          ],
          responses: {
            200: {
              description: 'List of blocked ranges',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        start_date: { type: 'string', format: 'date' },
                        end_date: { type: 'string', format: 'date' },
                        reason: { type: 'string' },
                        scope: { type: 'string', enum: ['global', 'unit'] },
                        source: { type: 'string', enum: ['manual', 'airbnb', 'booking.com', 'agoda', 'expedia', 'vrbo', 'walk_in', 'phone', 'other'] },
                        guest_name: { type: 'string', nullable: true },
                        unit_ids: { type: 'array', items: { type: 'string' }, description: 'Present when scope is unit' },
                      },
                    },
                  },
                },
              },
            },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          summary: 'Create blocked date range',
          tags: ['Calendar'],
          description: 'Block dates for a unit or globally. Admin or Agent only.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['start_date', 'end_date', 'reason', 'scope'],
                  properties: {
                    start_date: { type: 'string', format: 'date' },
                    end_date: { type: 'string', format: 'date' },
                    reason: { type: 'string', example: 'Maintenance' },
                    source: { type: 'string', enum: ['manual', 'airbnb', 'booking.com', 'agoda', 'expedia', 'vrbo', 'walk_in', 'phone', 'other'], default: 'manual' },
                    guest_name: { type: 'string', nullable: true },
                    scope: { type: 'string', enum: ['global', 'unit'] },
                    unit_ids: { type: 'array', items: { type: 'string' }, description: 'Required when scope is unit' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Block created' },
            400: { description: 'Bad request - missing fields or unit_ids required when scope is unit' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/calendar/blocked-ranges/{id}': {
        delete: {
          summary: 'Delete blocked date range',
          tags: ['Calendar'],
          description: 'Remove a blocked date range. Admin or Agent only.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Block ID' },
          ],
          responses: {
            204: { description: 'Block deleted' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            404: { description: 'Block not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/calendar/pricing-rules': {
        get: {
          summary: 'List holiday pricing rules',
          tags: ['Calendar'],
          description: 'Get holiday/special pricing rules from unit_pricing for unit(s). Use listingId or unit_ids.',
          parameters: [
            { name: 'listingId', in: 'query', schema: { type: 'string' }, description: 'Single unit ID' },
            { name: 'unit_ids', in: 'query', schema: { type: 'string' }, description: 'Comma-separated unit IDs' },
          ],
          responses: {
            200: {
              description: 'List of pricing rules',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        unit_id: { type: 'string' },
                        start_date: { type: 'string', format: 'date' },
                        end_date: { type: 'string', format: 'date' },
                        name: { type: 'string' },
                        adjustmentType: { type: 'string', enum: ['increase', 'decrease'] },
                        adjustmentMode: { type: 'string', enum: ['percentage', 'fixed'] },
                        adjustmentPercent: { type: 'number', nullable: true },
                        adjustmentAmount: { type: 'number', nullable: true },
                      },
                    },
                  },
                },
              },
            },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          summary: 'Create holiday pricing rule',
          tags: ['Calendar'],
          description: 'Add a holiday/special pricing rule. Admin or Agent only. Supports percentage or fixed price adjustment.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['start_date', 'end_date', 'name'],
                  properties: {
                    unit_id: { type: 'string', description: 'Single unit (alternative to unit_ids)' },
                    unit_ids: { type: 'array', items: { type: 'string' }, description: 'Multiple units (for global scope)' },
                    start_date: { type: 'string', format: 'date' },
                    end_date: { type: 'string', format: 'date' },
                    name: { type: 'string', example: 'Christmas' },
                    adjustmentType: { type: 'string', enum: ['increase', 'decrease'], default: 'increase' },
                    adjustmentMode: { type: 'string', enum: ['percentage', 'fixed'], default: 'percentage' },
                    adjustmentPercent: { type: 'number', description: 'When adjustmentMode is percentage' },
                    adjustmentAmount: { type: 'number', description: 'When adjustmentMode is fixed' },
                    price: { type: 'number', description: 'Alias for adjustmentAmount when fixed' },
                    percentage: { type: 'number', description: 'Alias for adjustmentPercent' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Rule created' },
            400: { description: 'Bad request - unit_id or unit_ids required' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/calendar/pricing-rules/{id}': {
        delete: {
          summary: 'Delete pricing rule',
          tags: ['Calendar'],
          description: 'Remove a holiday pricing rule by rule id or unit_pricing_id. Admin or Agent only.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'Rule id (from rule_data) or unit_pricing_id' },
          ],
          responses: {
            204: { description: 'Rule deleted' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden' },
            404: { description: 'Rule not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/register': {
        post: {
          summary: 'Submit agent registration (become-an-agent)',
          tags: ['Agents'],
          description: 'Submit an agent registration application. Two modes: (1) Unauthenticated: send fullname, email, phone, password, feeProof (file), recruitedBy (optional), agreeTerms. (2) Authenticated: send feeProof (file), recruitedBy (optional), agreeTerms. Content-Type: multipart/form-data.',
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    fullname: { type: 'string', description: 'Required when not authenticated' },
                    email: { type: 'string', format: 'email', description: 'Required when not authenticated' },
                    phone: { type: 'string', description: 'Required when not authenticated' },
                    password: { type: 'string', description: 'Required when not authenticated' },
                    recruitedBy: { type: 'string', description: 'Optional - Agent user ID (for agent_relationship)' },
                    feeProof: { type: 'string', format: 'binary', description: 'Required - proof of payment (image or PDF, max 5MB)' },
                    agreeTerms: { type: 'string', enum: ['true', 'false'], description: 'Required - must be true' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Application submitted successfully',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { message: { type: 'string', example: 'Application submitted successfully' } },
                  },
                },
              },
            },
            400: {
              description: 'Validation error - missing fields or invalid file',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Proof of payment file is required' } },
                  },
                },
              },
            },
            409: {
              description: 'Conflict - email already exists or already applied',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string' } },
                  },
                },
              },
            },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/me/registration': {
        get: {
          summary: 'Get my agent registration status',
          tags: ['Agents'],
          description: 'Check if the current user has submitted an agent registration. Requires auth.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Registration status',
              content: {
                'application/json': {
                  schema: {
                    oneOf: [
                      {
                        type: 'object',
                        properties: {
                          hasRegistration: { type: 'boolean', example: false },
                        },
                      },
                      {
                        type: 'object',
                        properties: {
                          hasRegistration: { type: 'boolean', example: true },
                          status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                          email: { type: 'string', format: 'email' },
                          fullname: { type: 'string' },
                        },
                      },
                    ],
                  },
                },
              },
            },
            401: { description: 'Authorization required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/me/properties': {
        get: {
          summary: 'Get my properties',
          tags: ['Agents'],
          description: 'List units assigned to the current agent. Requires auth.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of units assigned to the agent',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        price: { type: 'number' },
                        price_unit: { type: 'string', example: 'night' },
                        currency: { type: 'string', example: '₱' },
                        location: { type: 'string' },
                        city: { type: 'string' },
                        country: { type: 'string', nullable: true },
                        bedrooms: { type: 'integer' },
                        bathrooms: { type: 'integer' },
                        main_image_url: { type: 'string', nullable: true },
                        min_pax: { type: 'integer', nullable: true },
                        max_capacity: { type: 'integer', nullable: true },
                        excess_pax_fee: { type: 'number', nullable: true },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Authentication required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/{username}/properties': {
        get: {
          summary: 'Get agent properties by username',
          tags: ['Agents'],
          description: 'List units assigned to an agent by their profile username. Public endpoint for agent profile page.',
          parameters: [
            { name: 'username', in: 'path', required: true, schema: { type: 'string' }, description: 'Agent profile username' },
          ],
          responses: {
            200: {
              description: 'List of units assigned to the agent',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        title: { type: 'string' },
                        price: { type: 'number' },
                        price_unit: { type: 'string', example: 'night' },
                        currency: { type: 'string', example: '₱' },
                        location: { type: 'string' },
                        city: { type: 'string' },
                        country: { type: 'string', nullable: true },
                        bedrooms: { type: 'integer' },
                        bathrooms: { type: 'integer' },
                        main_image_url: { type: 'string', nullable: true },
                        min_pax: { type: 'integer', nullable: true },
                        max_capacity: { type: 'integer', nullable: true },
                        excess_pax_fee: { type: 'number', nullable: true },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Username required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/list': {
        get: {
          summary: 'List agents',
          tags: ['Agents'],
          description: 'List agents (users with role=Agent who have a profile). Admin only. For manage-units assign dropdown. Supports search by username, email, or name.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'search', in: 'query', required: false, schema: { type: 'string' }, description: 'Search by username, email, or full name' },
          ],
          responses: {
            200: {
              description: 'List of agents',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'User ID' },
                        fullname: { type: 'string' },
                        email: { type: 'string' },
                        username: { type: 'string', description: 'Profile username for /agent/{username}' },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/me/balance': {
        get: {
          summary: 'Get agent balance',
          tags: ['Agents'],
          description: 'Get current commission balance for the authenticated agent. Creates balance row with 0 if none exists.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Agent balance',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      current_amount: { type: 'number', example: 1500.5 },
                      updatedAt: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/me/balance-history': {
        get: {
          summary: 'Get agent balance history',
          tags: ['Agents'],
          description: 'Get add/remove ledger entries for the authenticated agent.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Balance history entries',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        type: { type: 'string', enum: ['add', 'remove'] },
                        amount: { type: 'number' },
                        referenceType: { type: 'string', nullable: true },
                        referenceId: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/admin/analytics': {
        get: {
          summary: 'Get agent analytics (Admin only)',
          tags: ['Admin'],
          description: 'Returns totalAgents, activeAgents, totalCommissionsPaid (from payout_withdrawal status=paid, all time), totalCommissionsPending, and topAgents. Top agents are ranked by commission this month from balance_history (type=add, reference_type=booking).',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Agent analytics',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      totalAgents: { type: 'integer' },
                      activeAgents: { type: 'integer' },
                      totalCommissionsPaid: { type: 'number', description: 'Sum of payout_withdrawal.status=paid (all time)' },
                      totalCommissionsPending: { type: 'number' },
                      topAgents: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            agentId: { type: 'string' },
                            agentName: { type: 'string' },
                            referralCode: { type: 'string' },
                            totalCommissions: { type: 'number', description: 'This month only' },
                            totalBookings: { type: 'integer', description: 'This month only' },
                            activeSubAgents: { type: 'integer' },
                          },
                        },
                      },
                      monthlyCommissionData: { type: 'array', items: { type: 'object' } },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/admin/viewagent/{agentId}': {
        get: {
          summary: 'View agent profile and stats (Admin only)',
          tags: ['Admin'],
          description: 'Returns agent profile, wallet (available, pending, approved, totalPaid), commissions list, payouts, and network stats for a specific agent.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'agentId', in: 'path', required: true, schema: { type: 'integer' }, description: 'Agent user_id' },
          ],
          responses: {
            200: {
              description: 'Agent view data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      agent: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          fullname: { type: 'string' },
                          email: { type: 'string' },
                          phone: { type: 'string' },
                          username: { type: 'string' },
                          status: { type: 'string', enum: ['active', 'inactive'] },
                          joinedAt: { type: 'string', format: 'date-time', nullable: true },
                        },
                      },
                      wallet: {
                        type: 'object',
                        properties: {
                          available: { type: 'number', description: 'Balance (current_amount)' },
                          pending: { type: 'number', description: 'Commission from penciled bookings' },
                          approved: { type: 'number', description: 'Commission from confirmed bookings' },
                          totalPaid: { type: 'number', description: 'Sum of payout_withdrawal where status=paid' },
                        },
                      },
                      totalCommissions: { type: 'integer', description: 'Count of bookings (penciled, confirmed, completed)' },
                      commissions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            bookingRef: { type: 'string' },
                            property: { type: 'string' },
                            guest: { type: 'string' },
                            status: { type: 'string', enum: ['penciled', 'confirmed', 'completed'] },
                            commission: { type: 'number' },
                            checkIn: { type: 'string', format: 'date', nullable: true },
                            checkOut: { type: 'string', format: 'date', nullable: true },
                            nights: { type: 'integer' },
                            totalAmount: { type: 'number' },
                          },
                        },
                      },
                      payouts: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            amount: { type: 'number' },
                            method: { type: 'string' },
                            status: { type: 'string', enum: ['pending', 'paid', 'declined'] },
                            requestedAt: { type: 'string', format: 'date-time' },
                            proofOfPaymentUrl: { type: 'string', nullable: true },
                          },
                        },
                      },
                      network: {
                        type: 'object',
                        properties: {
                          totalSubAgents: { type: 'integer' },
                          activeSubAgents: { type: 'integer' },
                          networkBookings: { type: 'integer' },
                        },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'Invalid agent ID' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'Agent not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/me/network': {
        get: {
          summary: 'Get agent referral network',
          tags: ['Agents'],
          description: 'Get referral tree and stats (sub-agents, network bookings, commissions) for the authenticated agent.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Network tree and stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tree: {
                        type: 'object',
                        properties: {
                          agentId: { type: 'string' },
                          agentName: { type: 'string' },
                          email: { type: 'string' },
                          referralCode: { type: 'string' },
                          level: { type: 'integer' },
                          status: { type: 'string', enum: ['active', 'inactive'] },
                          joinedAt: { type: 'string', format: 'date-time' },
                          totalCommissionsEarned: { type: 'number' },
                          totalBookings: { type: 'integer' },
                          children: { type: 'array', items: { type: 'object' } },
                        },
                      },
                      stats: {
                        type: 'object',
                        properties: {
                          totalSubAgents: { type: 'integer' },
                          activeSubAgents: { type: 'integer' },
                          networkBookings: { type: 'integer' },
                          totalNetworkCommissions: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/register/pending': {
        get: {
          summary: 'List all agent registrations (Admin only)',
          tags: ['Agents'],
          description: 'Get all agent registration applications from agent_registration table. Admin role required.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of registrations',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', description: 'agent_registration_id' },
                        fullname: { type: 'string' },
                        email: { type: 'string', format: 'email' },
                        contactNumber: { type: 'string' },
                        recruitedById: { type: 'string', nullable: true },
                        recruitedByName: { type: 'string', nullable: true },
                        registrationFeeStatus: { type: 'string', enum: ['paid', 'unpaid'] },
                        status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                        appliedAt: { type: 'string', format: 'date-time' },
                        proofOfPaymentUrl: { type: 'string', nullable: true },
                      },
                    },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/register/{id}/approve': {
        patch: {
          summary: 'Approve agent registration (Admin only)',
          tags: ['Agents'],
          description: 'Approve a pending registration. Sets status to approved and grants Agent role to the user.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'agent_registration_id' },
          ],
          responses: {
            200: {
              description: 'Registration approved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'approved' },
                    },
                  },
                },
              },
            },
            400: { description: 'Only pending registrations can be approved' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'Registration not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/register/{id}/reject': {
        patch: {
          summary: 'Reject agent registration (Admin only)',
          tags: ['Agents'],
          description: 'Reject a pending registration. Sets status to rejected.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' }, description: 'agent_registration_id' },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    reason: { type: 'string', description: 'Reason for rejection (optional)' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Registration rejected',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string', example: 'rejected' },
                    },
                  },
                },
              },
            },
            400: { description: 'Only pending registrations can be rejected' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden — Admin role required' },
            404: { description: 'Registration not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/agents/payouts': {
        get: {
          summary: 'Get my payout requests',
          tags: ['Agents'],
          description: 'List payout withdrawal requests for the authenticated agent. Ordered by requested_at DESC.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of payouts',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Payout' },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          summary: 'Request payout withdrawal',
          tags: ['Agents'],
          description: 'Create a payout request. Deducts amount from agent balance. Requires sufficient balance.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount', 'method', 'recipientName'],
                  properties: {
                    amount: { type: 'number', minimum: 0.01, example: 5000 },
                    method: { type: 'string', enum: ['gcash', 'maya', 'bank_transfer'] },
                    recipientNumber: { type: 'string', example: '09171234567', description: 'Required for gcash/maya' },
                    recipientName: { type: 'string', example: 'Juan Dela Cruz' },
                    bankName: { type: 'string', example: 'BDO', description: 'Required for bank_transfer' },
                    accountNumber: { type: 'string', example: '1234567890', description: 'Required for bank_transfer' },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: 'Payout request created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Payout' },
                },
              },
            },
            400: {
              description: 'Validation error or insufficient balance',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { error: { type: 'string', example: 'Insufficient balance' } },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/admin/payouts': {
        get: {
          summary: 'Get all payout requests (Admin only)',
          tags: ['Admin'],
          description: 'List all payout withdrawal requests. Ordered by pending first, then requested_at ASC.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'paid', 'declined'] }, description: 'Filter by status' },
            { name: 'agentId', in: 'query', schema: { type: 'string' }, description: 'Filter by agent user ID' },
          ],
          responses: {
            200: {
              description: 'List of payouts',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Payout' },
                  },
                },
              },
            },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin role required' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/admin/payouts/{id}': {
        patch: {
          summary: 'Mark payout as paid (Admin only)',
          tags: ['Admin'],
          description: 'Mark a pending payout as paid. Upload proof first via POST /api/upload/proof, then pass proofOfPaymentUrl here.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'payout_id' },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    proofOfPaymentUrl: { type: 'string', description: 'URL from POST /api/upload/proof' },
                    notes: { type: 'string', description: 'Optional note to agent' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Payout updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Payout' },
                },
              },
            },
            400: { description: 'Payout already processed' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin role required' },
            404: { description: 'Payout not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/admin/payouts/{id}/decline': {
        patch: {
          summary: 'Decline payout (Admin only)',
          tags: ['Admin'],
          description: 'Decline a pending payout. Refunds the amount to the agent balance.',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'payout_id' },
          ],
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notes: { type: 'string', description: 'Optional reason for the agent' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Payout declined and refunded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/Payout' },
                },
              },
            },
            400: { description: 'Payout already processed' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin role required' },
            404: { description: 'Payout not found' },
            500: { description: 'Internal server error' },
          },
        },
      },
      '/api/upload': {
        post: {
          summary: 'Upload images',
          tags: ['Upload'],
          description: 'Upload one or more images. Multipart form-data, field name "images" (up to 10 files, max 10MB each). Admin or Agent only.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    images: {
                      type: 'array',
                      items: { type: 'string', format: 'binary' },
                      description: 'Up to 10 image files (JPEG, PNG, WebP, GIF)',
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Uploaded file URLs',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      urls: {
                        type: 'array',
                        items: { type: 'string', example: 'http://localhost:3001/uploads/1234567890-abc.jpg' },
                      },
                    },
                  },
                },
              },
            },
            400: { description: 'No image files provided' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin or Agent required' },
            500: { description: 'Upload failed' },
          },
        },
      },
      '/api/upload/proof': {
        post: {
          summary: 'Upload payout proof file',
          tags: ['Upload'],
          description: 'Upload a single proof file (image or PDF) for payout proof of payment. Admin only. Use the returned URL in PATCH /api/admin/payouts/:id.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    proof: { type: 'string', format: 'binary', description: 'Proof image (JPEG, PNG, WebP, GIF) or PDF. Max 5MB.' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Uploaded file URL',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      url: { type: 'string', example: 'http://localhost:3002/uploads/payout_proof/payout-1234567890-abc.jpg' },
                    },
                  },
                },
              },
            },
            400: { description: 'No proof file provided' },
            401: { description: 'Unauthorized' },
            403: { description: 'Forbidden - Admin role required' },
            500: { description: 'Upload failed' },
          },
        },
      },
    },
  };
}

function setupSwagger(app, port) {
  // Serve raw spec fresh on every request — no caching
  app.get('/api-docs/spec.json', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(buildSpec(port));
  });

  // Serve Swagger UI pointed at the live spec endpoint
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(null, {
      swaggerOptions: {
        url: '/api-docs/spec.json',
      },
      customCacheControl: 'no-store',
    })
  );
}

module.exports = { setupSwagger, buildSpec };
