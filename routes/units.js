const { Router } = require('express');
const { listUnits, getUnitById, listUnitsForManage, updateUnit, updateUnitFull, createUnit, deleteUnit } = require('../controllers/units');
const { requireAuth, requireAdminOrAgent, requireAdmin } = require('../middleware/auth');

const router = Router();

router.get('/', listUnits);
router.post('/', requireAuth, requireAdminOrAgent, createUnit);
router.get('/manage', requireAuth, requireAdminOrAgent, listUnitsForManage);
router.get('/:id', getUnitById);
router.put('/:id', requireAuth, requireAdminOrAgent, updateUnitFull);
router.patch('/:id', requireAuth, requireAdminOrAgent, updateUnit);
router.delete('/:id', requireAuth, requireAdmin, deleteUnit);

module.exports = router;
