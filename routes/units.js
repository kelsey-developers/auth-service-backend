const { Router } = require('express');
const { listUnits, getUnitById } = require('../controllers/units');

const router = Router();

router.get('/', listUnits);
router.get('/:id', getUnitById);

module.exports = router;
