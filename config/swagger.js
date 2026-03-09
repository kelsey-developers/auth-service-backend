const swaggerUi = require('swagger-ui-express');

function buildSpec(port) {
  const serverUrl = `http://localhost:${port}`;
  return {
    openapi: '3.0.0',
    info: {
      title: 'Auth Service API',
      version: '1.0.0',
      description: 'Authentication, units, and bookings API with JWT tokens',
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
                        status: { type: 'string', enum: ['available', 'disabled'] },
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
                      location: { type: 'string' },
                      city: { type: 'string' },
                      images: { type: 'array', items: { type: 'string' } },
                      main_image_url: { type: 'string', nullable: true },
                      amenities: { type: 'array', items: { type: 'string' } },
                      latitude: { type: 'number', nullable: true },
                      longitude: { type: 'number', nullable: true },
                      check_in_time: { type: 'string', nullable: true },
                      check_out_time: { type: 'string', nullable: true },
                    },
                  },
                },
              },
            },
            404: { description: 'Unit not found' },
            500: { description: 'Internal server error' },
          },
        },
        patch: {
          summary: 'Update unit',
          tags: ['Units'],
          description: 'Update unit status, featured flag, etc. Admin or Agent only.',
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
                    status: { type: 'string', enum: ['available', 'disabled'] },
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
                  required: ['listing_id', 'check_in_date', 'check_out_date', 'num_guests'],
                  properties: {
                    listing_id: { type: 'string', description: 'Unit ID' },
                    check_in_date: { type: 'string', format: 'date' },
                    check_out_date: { type: 'string', format: 'date' },
                    num_guests: { type: 'integer', minimum: 1 },
                    extra_guests: { type: 'integer', minimum: 0, default: 0 },
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
                      num_guests: { type: 'integer' },
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
          summary: 'List my bookings',
          tags: ['Bookings'],
          description: 'Get bookings where agent_user_id = current user. Requires auth.',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'List of bookings for the current agent',
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
                        status: { type: 'string', enum: ['pending', 'pending-payment', 'booked', 'ongoing', 'completed', 'cancelled'] },
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
                        client: {
                          type: 'object',
                          properties: {
                            first_name: { type: 'string' },
                            last_name: { type: 'string' },
                          },
                        },
                        payment: {
                          type: 'object',
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
                      num_guests: { type: 'integer' },
                      extra_guests: { type: 'integer' },
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
  const spec = buildSpec(port);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec));
}

module.exports = { setupSwagger, buildSpec };
