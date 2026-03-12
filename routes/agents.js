const express = require('express');
const { requireAuth, requireAdminOrAgent } = require('../middleware/auth');
const { getBalance, getBalanceHistory, getNetwork } = require('../controllers/agents');

const router = express.Router();

// /api/agents/me/* — current agent's commission balance and history
router.get('/me/balance', requireAuth, requireAdminOrAgent, getBalance);
router.get('/me/balance-history', requireAuth, requireAdminOrAgent, getBalanceHistory);
router.get('/me/network', requireAuth, requireAdminOrAgent, getNetwork);

module.exports = router;
