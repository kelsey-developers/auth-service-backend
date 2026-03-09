const express = require('express');
const { getBookings, getMyBookings, getBookingById, createBooking } = require('../controllers/bookings');
const { requireAuth, requireAdminOrAgent, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', getBookings);
router.get('/my', requireAuth, getMyBookings);
router.get('/:id', optionalAuth, getBookingById);
router.post('/', requireAuth, requireAdminOrAgent, createBooking);

module.exports = router;
