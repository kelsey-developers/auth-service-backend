const { Router } = require('express');
const { getStatus } = require('../controllers/status');

const router = Router();

router.get('/status', getStatus);

module.exports = router;
