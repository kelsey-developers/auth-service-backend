const pool = require('../config/db');

function mapPayrollRecord(r) {
  const base = {
    id: r.id,
    employee_id: r.employee_id,
    agent_id: r.agent_id,
    agent_name: r.agent_name || null,
    employee: r.employee || null,
    employment_type: r.employment_type,
    payPeriodStart: r.pay_period_start,
    payPeriodEnd: r.pay_period_end,
    status: r.status,
    overtimeHours: Number(r.overtime_hours || 0),
    overtimePay: Number(r.overtime_pay || 0),
    grossIncome: Number(r.gross_income || 0),
    totalDeductions: Number(r.total_deductions || 0),
    netPay: Number(r.net_pay || 0),
    reference_number: r.reference_number,
    paymentDate: r.payment_date || null,
    daysWorked: Number(r.days_worked || 0),
    dailyRate: Number(r.daily_rate || 0),
    basePay: Number(r.base_pay || 0),
    monthlyRate: Number(r.monthly_rate || 0),
    bonusAmount: Number(r.bonus_amount || 0),
    totalBookings: Number(r.total_bookings || 0),
    totalCommissionAmount: Number(r.gross_income || 0),
    taxes: Number(r.total_deductions || 0),
    netPayout: Number(r.net_pay || 0),
  };
  return base;
}

// GET /api/payroll?type=DAILY|MONTHLY|COMMISSION|all
async function getPayroll(req, res) {
  try {
    const { type } = req.query;

    let sql = `SELECT pr.* FROM payroll_records pr`;
    const params = [];

    if (type && type !== 'all') {
      sql += ` WHERE pr.employment_type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY pr.created_at DESC`;

    const [records] = await pool.query(sql, params);
    const rows = records || [];

    const employeeIds = [
      ...new Set(rows.map((r) => r.employee_id).filter(Boolean)),
    ];
    let employeeMap = {};
    if (employeeIds.length > 0) {
      const [employees] = await pool.query(
        `SELECT * FROM employees WHERE employee_id IN (?)`,
        [employeeIds]
      );
      employeeMap = Object.fromEntries(
        employees.map((e) => [e.employee_id, e])
      );
    }

    const merged = rows.map((r) => ({
      ...r,
      employee: r.employee_id ? employeeMap[r.employee_id] || null : null,
    }));

    return res.json(merged.map(mapPayrollRecord));
  } catch (error) {
    console.error('getPayroll error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/payroll/:id
async function getPayrollById(req, res) {
  try {
    const { id } = req.params;

    const [rows] = await pool.query(
      `SELECT * FROM payroll_records WHERE id = ? LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Payroll record not found' });
    }

    const payroll = rows[0];
    let employeeData = null;
    if (payroll.employee_id) {
      const [empRows] = await pool.query(
        `SELECT * FROM employees WHERE employee_id = ?`,
        [payroll.employee_id]
      );
      employeeData = empRows[0] || null;
    }

    const normalized = mapPayrollRecord({ ...payroll, employee: employeeData });

    if (payroll.employment_type === 'COMMISSION') {
      const [commRows] = await pool.query(
        `SELECT * FROM booking_commissions WHERE payroll_id = ? ORDER BY booking_date ASC`,
        [id]
      );
      return res.json({ ...normalized, bookingDetails: commRows || [] });
    }

    return res.json(normalized);
  } catch (error) {
    console.error('getPayrollById error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/payroll/commission/mark-paid
async function markCommissionPaid(req, res) {
  try {
    const { payroll_id, booking_id, gcash_reference, gcash_receipt_url } =
      req.body || {};

    if (!payroll_id || !booking_id) {
      return res
        .status(400)
        .json({ error: 'payroll_id and booking_id are required' });
    }

    await pool.query(
      `UPDATE booking_commissions
       SET commission_status = 'paid',
           paid_date = CURRENT_DATE,
           approved_by = 'Admin',
           gcash_reference = ?,
           gcash_receipt_url = ?
       WHERE payroll_id = ? AND booking_id = ?`,
      [gcash_reference || null, gcash_receipt_url || null, payroll_id, booking_id]
    );

    const [rows] = await pool.query(
      `SELECT * FROM booking_commissions WHERE payroll_id = ? AND booking_id = ?`,
      [payroll_id, booking_id]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error('markCommissionPaid error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper calculators (copied from back-end logic)
function computeDailyPayroll(dailyRate, daysWorked) {
  const totalPay = parseFloat((dailyRate * daysWorked).toFixed(2));
  return { daysWorked, dailyRate, totalPay };
}

function computeMonthlyPayroll(monthlyRate) {
  return { monthlyRate, totalPay: parseFloat(monthlyRate.toFixed(2)) };
}

function computeCommissionPayout(bookingCommissions) {
  const totalBookings = bookingCommissions.length;
  const totalCommission = parseFloat(
    bookingCommissions.reduce((sum, c) => sum + c, 0).toFixed(2)
  );
  return { totalBookings, totalCommission, netPayout: totalCommission };
}

// POST /api/payroll/generate
async function generatePayroll(req, res) {
  try {
    const {
      employment_type,
      employee_id,
      agent_id,
      pay_period_start,
      pay_period_end,
      days_worked,
      daily_rate,
      monthly_rate,
      booking_commissions,
    } = req.body || {};

    if (!employment_type || !pay_period_start || !pay_period_end) {
      return res.status(400).json({
        error: 'employment_type, pay_period_start, and pay_period_end are required',
      });
    }

    const timestamp = Date.now();
    let record = {};

    if (employment_type === 'DAILY') {
      if (!employee_id || !days_worked || !daily_rate) {
        return res.status(400).json({
          error: 'employee_id, days_worked, and daily_rate are required',
        });
      }
      const result = computeDailyPayroll(
        Number(daily_rate),
        Number(days_worked)
      );
      record = {
        id: `PAY-D-${timestamp}`,
        employee_id: Number(employee_id),
        employment_type: 'DAILY',
        pay_period_start,
        pay_period_end,
        status: 'pending',
        days_worked: Number(days_worked),
        daily_rate: Number(daily_rate),
        base_pay: result.totalPay,
        overtime_hours: 0,
        overtime_pay: 0,
        gross_income: result.totalPay,
        total_deductions: 0,
        net_pay: result.totalPay,
        reference_number: `PAY-D-${timestamp}`,
      };
    } else if (employment_type === 'MONTHLY') {
      if (!employee_id || !monthly_rate) {
        return res.status(400).json({
          error: 'employee_id and monthly_rate are required',
        });
      }
      const result = computeMonthlyPayroll(Number(monthly_rate));
      record = {
        id: `PAY-M-${timestamp}`,
        employee_id: Number(employee_id),
        employment_type: 'MONTHLY',
        pay_period_start,
        pay_period_end,
        status: 'pending',
        monthly_rate: Number(monthly_rate),
        bonus_amount: 0,
        overtime_hours: 0,
        overtime_pay: 0,
        gross_income: result.totalPay,
        total_deductions: 0,
        net_pay: result.totalPay,
        reference_number: `PAY-M-${timestamp}`,
      };
    } else if (employment_type === 'COMMISSION') {
      if (!agent_id || !Array.isArray(booking_commissions)) {
        return res.status(400).json({
          error: 'agent_id and booking_commissions[] are required',
        });
      }
      const amounts = booking_commissions.map(Number);
      const result = computeCommissionPayout(amounts);
      record = {
        id: `COMM-${timestamp}`,
        agent_id: Number(agent_id),
        employment_type: 'COMMISSION',
        pay_period_start,
        pay_period_end,
        status: 'pending',
        overtime_hours: 0,
        overtime_pay: 0,
        gross_income: result.totalCommission,
        total_deductions: 0,
        net_pay: result.netPayout,
        total_bookings: result.totalBookings,
        reference_number: `COMM-${timestamp}`,
      };
    } else {
      return res
        .status(400)
        .json({ error: `Unknown employment_type: ${employment_type}` });
    }

    await pool.query(
      `INSERT INTO payroll_records
       (id, employee_id, agent_id, employment_type, pay_period_start, pay_period_end, status,
        days_worked, daily_rate, base_pay, monthly_rate, bonus_amount,
        overtime_hours, overtime_pay, gross_income, total_deductions, net_pay,
        reference_number, total_bookings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.employee_id || null,
        record.agent_id || null,
        record.employment_type,
        record.pay_period_start,
        record.pay_period_end,
        record.status,
        record.days_worked || null,
        record.daily_rate || null,
        record.base_pay || null,
        record.monthly_rate || null,
        record.bonus_amount || null,
        record.overtime_hours || 0,
        record.overtime_pay || 0,
        record.gross_income || 0,
        record.total_deductions || 0,
        record.net_pay || 0,
        record.reference_number,
        record.total_bookings || null,
      ]
    );

    // For commission, optionally we could insert booking_commissions here if needed

    const [rows] = await pool.query(
      `SELECT * FROM payroll_records WHERE id = ?`,
      [record.id]
    );

    return res.status(201).json(rows[0]);
  } catch (error) {
    console.error('generatePayroll error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// PATCH /api/payroll/:id/status
async function updatePayrollStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, payment_date } = req.body || {};

    const allowed = ['pending', 'approved', 'processed', 'paid', 'declined'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${allowed.join(', ')}`,
      });
    }

    const updates = { status };
    const params = [];
    const setClauses = ['status = ?'];
    params.push(status);

    if (status === 'paid' && payment_date) {
      setClauses.push('payment_date = ?');
      params.push(payment_date);
      updates.payment_date = payment_date;
    }

    params.push(id);

    await pool.query(
      `UPDATE payroll_records SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const [rows] = await pool.query(
      `SELECT * FROM payroll_records WHERE id = ?`,
      [id]
    );

    return res.json(rows[0]);
  } catch (error) {
    console.error('updatePayrollStatus error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/payroll/preview
async function previewPayroll(req, res) {
  try {
    const {
      employment_type,
      days_worked,
      daily_rate,
      monthly_rate,
      booking_commissions,
    } = req.body || {};

    if (!employment_type) {
      return res
        .status(400)
        .json({ error: 'employment_type is required' });
    }

    if (employment_type === 'DAILY') {
      if (!days_worked || !daily_rate) {
        return res
          .status(400)
          .json({ error: 'days_worked and daily_rate are required' });
      }
      const result = computeDailyPayroll(
        Number(daily_rate),
        Number(days_worked)
      );
      return res.json(result);
    }

    if (employment_type === 'MONTHLY') {
      if (!monthly_rate) {
        return res
          .status(400)
          .json({ error: 'monthly_rate is required' });
      }
      const result = computeMonthlyPayroll(Number(monthly_rate));
      return res.json(result);
    }

    if (employment_type === 'COMMISSION') {
      if (!Array.isArray(booking_commissions)) {
        return res
          .status(400)
          .json({ error: 'booking_commissions[] is required' });
      }
      const result = computeCommissionPayout(
        booking_commissions.map(Number)
      );
      return res.json(result);
    }

    return res
      .status(400)
      .json({ error: `Unknown employment_type: ${employment_type}` });
  } catch (error) {
    console.error('previewPayroll error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getPayroll,
  getPayrollById,
  markCommissionPaid,
  generatePayroll,
  updatePayrollStatus,
  previewPayroll,
};

