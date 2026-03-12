const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  setupProfile,
  updateProfile,
} = require('../controllers/profile');
const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, getMyProfile);
router.post('/setup', requireAuth, setupProfile);
router.patch('/me', requireAuth, updateProfile);

module.exports = router;
