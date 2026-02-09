const express = require('express');
const statusRoutes = require('./statusRoutes');
const { createAuthRouter } = require('./authRoutes');

function mountRoutes(app, { pool, jwtSecret }) {
  app.use('/', statusRoutes);
  app.use('/api/oauth2', createAuthRouter(pool, jwtSecret));
}

module.exports = { mountRoutes };
