const express = require('express');
const { getBookings, getMyBookings, getAllBookings, getBookingById, createBooking, confirmBooking, declineBooking } = require('../controllers/bookings');
const { requireAuth, requireAdminOrAgent, requireAdmin, optionalAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', getBookings);
router.get('/my', requireAuth, getMyBookings);
router.get('/all', requireAuth, getAllBookings);
router.get('/:id', optionalAuth, getBookingById);
router.post('/', requireAuth, requireAdminOrAgent, createBooking);
router.patch('/:id/confirm', requireAuth, requireAdmin, confirmBooking);
router.patch('/:id/decline', requireAuth, requireAdmin, declineBooking);

module.exports = router;
