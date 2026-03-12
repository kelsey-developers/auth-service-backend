const authRoutes = require('./auth');
const statusRoutes = require('./status');
const unitRoutes = require('./units');
const bookingRoutes = require('./bookings');
const uploadRoutes = require('./upload');
const userRoutes = require('./users');
const agentRoutes = require('./agents');
const profileRoutes = require('./profile');

function mountRoutes(app) {
  app.use('/', statusRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/agents', agentRoutes);
  app.use('/api/profile', profileRoutes);
}

module.exports = { mountRoutes };
