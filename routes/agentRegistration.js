const { Router } = require('express');
const multer = require('multer');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const { uploadAgentProof, submitAgentRegistration, getMyRegistration } = require('../controllers/agentRegistration');

const router = Router();

// GET /api/agent-registration/me — check if current user has an agent registration (requires auth)
router.get('/me', requireAuth, getMyRegistration);

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

// POST /api/agent-registration — multipart. If auth: feeProof, recruitedBy?, agreeTerms. If no auth: fullname, email, phone, password, recruitedBy?, feeProof, agreeTerms
router.post('/', optionalAuth, uploadAgentProof.single('feeProof'), handleMulterError, submitAgentRegistration);

module.exports = router;
