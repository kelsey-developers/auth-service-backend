const { Router } = require('express');
const { listUnits, getUnitById, listUnitsForManage, updateUnit, createUnit } = require('../controllers/units');
const { requireAuth, requireAdminOrAgent } = require('../middleware/auth');

const router = Router();

router.get('/', listUnits);
router.post('/', requireAuth, requireAdminOrAgent, createUnit);
router.get('/manage', requireAuth, requireAdminOrAgent, listUnitsForManage);
router.get('/:id', getUnitById);
router.patch('/:id', requireAuth, requireAdminOrAgent, updateUnit);

module.exports = router;
