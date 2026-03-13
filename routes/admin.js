const { requireAuth, requireAdmin } = require('../middleware/auth');
const { getAgentAnalytics } = require('../controllers/agentAnalytics');
const { getAllPayouts, markPayoutPaid, markPayoutDeclined } = require('../controllers/payouts');

const router = require('express').Router();

router.use(requireAuth);

router.get('/analytics', requireAdmin, getAgentAnalytics);
router.get('/payouts', requireAdmin, getAllPayouts);
router.patch('/payouts/:id', requireAdmin, markPayoutPaid);
router.patch('/payouts/:id/decline', requireAdmin, markPayoutDeclined);

module.exports = router;
