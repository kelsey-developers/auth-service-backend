const authRoutes = require('./auth');
const statusRoutes = require('./status');
const unitRoutes = require('./units');
const bookingRoutes = require('./bookings');

function mountRoutes(app) {
  app.use('/', statusRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/bookings', bookingRoutes);
}

module.exports = { mountRoutes };
