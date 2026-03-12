const authRoutes = require('./auth');
const statusRoutes = require('./status');
const unitRoutes = require('./units');
const bookingRoutes = require('./bookings');
const uploadRoutes = require('./upload');
const userRoutes = require('./users');
const siteRoutes = require('./sites');
const dtrRoutes = require('./dtr');
const employeeRoutes = require('./employees');
const payrollRoutes = require('./payroll');

function mountRoutes(app) {
  app.use('/', statusRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/units', unitRoutes);
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/sites', siteRoutes);
  app.use('/api/dtr', dtrRoutes);
  app.use('/api/employees', employeeRoutes);
  app.use('/api/payroll', payrollRoutes);
}

module.exports = { mountRoutes };
