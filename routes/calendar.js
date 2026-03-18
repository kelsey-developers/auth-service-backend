const express = require('express');
const {
  getBlockedRanges,
  createBlockedRange,
  deleteBlockedRange,
  getPricingRules,
  createPricingRule,
  deletePricingRule,
} = require('../controllers/calendar');
const { requireAuth, requireAdminOrAgent } = require('../middleware/auth');

const router = express.Router();

router.get('/blocked-ranges', getBlockedRanges);
router.post('/blocked-ranges', requireAuth, requireAdminOrAgent, createBlockedRange);
router.delete('/blocked-ranges/:id', requireAuth, requireAdminOrAgent, deleteBlockedRange);

router.get('/pricing-rules', getPricingRules);
router.post('/pricing-rules', requireAuth, requireAdminOrAgent, createPricingRule);
router.delete('/pricing-rules/:id', requireAuth, requireAdminOrAgent, deletePricingRule);

module.exports = router;
