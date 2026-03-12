const { Router } = require('express');
const { listEmployees } = require('../controllers/employees');

const router = Router();

// Read-only view of employees derived from users/roles
router.get('/', listEmployees);

module.exports = router;

