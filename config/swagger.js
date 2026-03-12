const swaggerUi = require('swagger-ui-express');

function buildSpec(port) {
  const serverUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;
  return {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication, units, and bookings API with JWT tokens',
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
                        status: { type: 'string', enum: ['available', 'unavailable', 'maintenance'] },
                        is_featured: { type: 'boolean' },
                        owner: { type: 'string', nullable: true },
                        bookings_count: { type: 'integer' },
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
          description: 'Update unit status or featured flag only. Admin or Agent only.',
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
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Unit updated' },
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
          description: 'Get bookings for a listing (unit) by listingId. Used for availability/calendar.',
          parameters: [
            { name: 'listingId', in: 'query', required: true, schema: { type: 'string' }, description: 'Unit/listing ID' },
          ],
          responses: {
            200: {
              description: 'List of bookings for the listing',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        check_in_date: { type: 'string', format: 'date' },
                        check_out_date: { type: 'string', format: 'date' },
                        status: { type: 'string', enum: ['penciled', 'confirmed'] },
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
          description: 'Create a new booking. Admin or Agent only. Checks for overlapping dates. Returns reference_code.',
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
              description: 'Conflict - dates overlap with existing booking',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      error: { type: 'string' },
                      overlapping: { type: 'boolean', example: true },
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
            { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Search by reference code or client/agent name' },
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
