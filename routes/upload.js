const { Router } = require('express');
const { upload, uploadImages } = require('../controllers/upload');
const { requireAuth, requireAdminOrAgent } = require('../middleware/auth');

const router = Router();

// POST /api/upload — multipart/form-data, field name "images" (up to 10 files)
router.post('/', requireAuth, requireAdminOrAgent, upload.array('images', 10), uploadImages);

module.exports = router;
