const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, WebP, GIF)'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter,
});

const proofDir = path.join(__dirname, '..', 'uploads', 'payout_proof');
if (!fs.existsSync(proofDir)) fs.mkdirSync(proofDir, { recursive: true });

const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, proofDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `payout-${Date.now()}-${Math.random().toString(36).substring(2, 10)}${ext}`);
  },
});

const proofFileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only images (JPEG, PNG, WebP, GIF) or PDF are allowed'));
};

const uploadProof = multer({
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: proofFileFilter,
});

/**
 * POST /api/upload
 * Upload one or more images. Returns array of public URLs.
 * Requires Admin or Agent role.
 */
async function uploadImages(req, res) {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const baseUrl = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');

    const urls = req.files.map((f) => `${baseUrl}/uploads/${f.filename}`);

    res.json({ urls });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}

/**
 * POST /api/upload/proof
 * Upload a single proof file (image or PDF). Returns { url }.
 * Requires Admin role. Used for payout proof of payment.
 */
async function uploadProofFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No proof file provided' });
    }
    const baseUrl = (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3001}`).replace(/\/$/, '');
    const url = `${baseUrl}/uploads/payout_proof/${req.file.filename}`;
    res.json({ url });
  } catch (error) {
    console.error('Proof upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
}

module.exports = { upload, uploadImages, uploadProof, uploadProofFile };
