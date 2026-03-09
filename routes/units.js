const { Router } = require('express');
const { listUnits, getUnitById, listUnitsForManage, updateUnit } = require('../controllers/units');
const { requireAuth, requireAdminOrAgent } = require('../middleware/auth');

const router = Router();

router.get('/', listUnits);
router.get('/manage', requireAuth, requireAdminOrAgent, listUnitsForManage);
router.get('/:id', getUnitById);
router.patch('/:id', requireAuth, requireAdminOrAgent, updateUnit);

module.exports = router;
