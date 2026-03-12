const { Router } = require('express');
const {
  getPayroll,
  getPayrollById,
  markCommissionPaid,
  generatePayroll,
  updatePayrollStatus,
  previewPayroll,
} = require('../controllers/payroll');

const router = Router();

router.post('/generate', generatePayroll);
router.post('/preview', previewPayroll);
router.patch('/commission/mark-paid', markCommissionPaid);

router.get('/', getPayroll);
router.get('/:id', getPayrollById);
router.patch('/:id/status', updatePayrollStatus);

module.exports = router;

