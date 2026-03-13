const { Router } = require('express');
const { upload, uploadImages, uploadProof, uploadProofFile } = require('../controllers/upload');
const { requireAuth, requireAdminOrAgent, requireAdmin } = require('../middleware/auth');

const router = Router();

// POST /api/upload — multipart/form-data, field name "images" (up to 10 files)
router.post('/', requireAuth, requireAdminOrAgent, upload.array('images', 10), uploadImages);

// POST /api/upload/proof — single file (image or PDF), field name "proof". For payout proof of payment.
router.post('/proof', requireAuth, requireAdmin, uploadProof.single('proof'), uploadProofFile);

module.exports = router;
