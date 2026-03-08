const authRoutes = require('./auth');
const statusRoutes = require('./status');

function mountRoutes(app) {
  app.use('/', statusRoutes);
  app.use('/api/auth', authRoutes);
}

module.exports = { mountRoutes };
