const authRoutes = require('./auth');
const statusRoutes = require('./status');
const unitRoutes = require('./units');

function mountRoutes(app) {
  app.use('/', statusRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/units', unitRoutes);
}

module.exports = { mountRoutes };
