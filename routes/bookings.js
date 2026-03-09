const express = require('express');
const { getBookings, getBookingById, createBooking } = require('../controllers/bookings');
const { requireAuth, requireAdminOrAgent } = require('../middleware/auth');

const router = express.Router();

router.get('/', getBookings);
router.get('/:id', requireAuth, getBookingById);
router.post('/', requireAuth, requireAdminOrAgent, createBooking);

module.exports = router;
