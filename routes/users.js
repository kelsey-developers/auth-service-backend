const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { listUsers, updateUser } = require('../controllers/users');

router.get('/', requireAuth, listUsers);
router.patch('/:id', requireAuth, updateUser);

module.exports = router;
