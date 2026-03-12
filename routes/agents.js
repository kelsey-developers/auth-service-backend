const express = require('express');
const multer = require('multer');
const { requireAuth, requireAdmin, requireAdminOrAgent, optionalAuth } = require('../middleware/auth');
const { getBalance, getBalanceHistory, getNetwork, listAgents, getMyProperties, getPropertiesByUsername } = require('../controllers/agents');
const { uploadAgentProof, submitAgentRegistration, getMyRegistration } = require('../controllers/agentRegistration');
const { getProfileByUsername } = require('../controllers/profile');

const router = express.Router();

function handleMulterError(err, req, res, next) {
  if (!err) return next();
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: err.message });
  }
  return res.status(400).json({ error: err.message || 'Upload failed' });
}

// POST /api/agents/register — multipart. If auth: feeProof, recruitedBy?, agreeTerms. If no auth: fullname, email, phone, password, recruitedBy?, feeProof, agreeTerms
router.post('/register', optionalAuth, uploadAgentProof.single('feeProof'), handleMulterError, submitAgentRegistration);
// GET /api/agents/me/registration — check if current user has an agent registration (requires auth)
router.get('/me/registration', requireAuth, getMyRegistration);
// GET /api/agents/me/properties — current agent's assigned units (requires auth, Admin or Agent)
router.get('/me/properties', requireAuth, requireAdminOrAgent, getMyProperties);

router.get('/list', requireAuth, requireAdmin, listAgents);
// GET /api/agents/:username — agent profile by username (public, for agent profile page)
router.get('/:username', getProfileByUsername);
// GET /api/agents/:username/properties — agent's units by username (public, for agent profile page)
router.get('/:username/properties', getPropertiesByUsername);
// /api/agents/me/* — current agent's commission balance and history
router.get('/me/balance', requireAuth, requireAdminOrAgent, getBalance);
router.get('/me/balance-history', requireAuth, requireAdminOrAgent, getBalanceHistory);
router.get('/me/network', requireAuth, requireAdminOrAgent, getNetwork);

module.exports = router;
