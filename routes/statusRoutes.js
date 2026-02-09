const express = require('express');
const StatusController = require('../controllers/StatusController');

const router = express.Router();
const statusController = new StatusController();

router.get('/status', (req, res) => statusController.getStatus(req, res));

module.exports = router;
