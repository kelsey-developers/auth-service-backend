const { Router } = require('express');
const multer = require('multer');
const {
  getDTR,
  timeIn,
  timeOut,
  getTasks,
  uploadTask,
  getDTRRange,
  getAllDTR,
  verifyDTR,
  getDTRSummary,
} = require('../controllers/dtr');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Match existing TS backend route structure
router.get('/range', getDTRRange);
router.get('/all', getAllDTR);
router.get('/summary', getDTRSummary);
router.get('/tasks', getTasks);
router.post('/time-in', timeIn);
router.post('/time-out', timeOut);
router.post('/tasks', upload.single('file'), uploadTask);
router.patch('/:id/verify', verifyDTR);
router.get('/', getDTR);

module.exports = router;

