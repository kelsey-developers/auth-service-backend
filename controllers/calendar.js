const pool = require('../config/db');

const SOURCE_MAP = {
  manual: 'manual',
  airbnb: 'airbnb',
  'booking.com': 'booking.com',
  agoda: 'agoda',
  expedia: 'expedia',
  vrbo: 'vrbo',
  walk_in: 'walk_in',
  phone: 'phone',
  other: 'other',
};

function toDateOnly(val) {
  if (val == null) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.split('T')[0].substring(0, 10);
  }
  const d = val instanceof Date ? val : new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(d);
  const y = parts.find((p) => p.type === 'year').value;
  const m = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  return `${y}-${m}-${day}`;
}

function mapSource(src) {
  if (!src) return 'manual';
  const k = String(src).toLowerCase().replace(/\s+/g, '_');
  if (SOURCE_MAP[k]) return SOURCE_MAP[k];
  if (k.includes('airbnb')) return 'airbnb';
  if (k.includes('booking')) return 'booking.com';
  if (k.includes('agoda')) return 'agoda';
  if (k.includes('expedia')) return 'expedia';
  if (k.includes('vrbo')) return 'vrbo';
  if (k.includes('walk') || k.includes('direct')) return 'walk_in';
  if (k.includes('phone')) return 'phone';
  return 'other';
}

/**
 * GET /api/calendar/blocked-ranges
 * Query: listingId (single unit) or unit_ids (comma-separated)
 * Returns blocked date ranges for the given unit(s) + global blocks.
 */
async function getBlockedRanges(req, res) {
  try {
    const { listingId, unit_ids } = req.query;
    let unitIdList = [];
    if (listingId) unitIdList = [String(listingId).trim()];
    else if (unit_ids) unitIdList = String(unit_ids).split(',').map((id) => id.trim()).filter(Boolean);

    const validUnitIds = unitIdList
      .map((id) => parseInt(id, 10))
      .filter((n) => !Number.isNaN(n));
    if (validUnitIds.length === 0) {
      return res.json([]);
    }

    const placeholders = validUnitIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT block_id, unit_id, start_date, end_date, reason, source, guest_name
       FROM unit_block_dates
       WHERE unit_id IS NULL OR unit_id IN (${placeholders})
       ORDER BY start_date`,
      validUnitIds
    );

    const ranges = rows.map((r) => ({
      id: String(r.block_id),
      start_date: toDateOnly(r.start_date) || r.start_date,
      end_date: toDateOnly(r.end_date) || r.end_date,
      reason: r.reason || 'Blocked',
      scope: r.unit_id == null ? 'global' : 'unit',
      source: r.source || 'manual',
      guest_name: r.guest_name || null,
      unit_ids: r.unit_id != null ? [String(r.unit_id)] : undefined,
    }));

    res.json(ranges);
  } catch (error) {
    console.error('Get blocked ranges error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/calendar/blocked-ranges
 * Body: { start_date, end_date, reason, source?, guest_name?, scope, unit_ids? }
 * scope: 'global' | 'unit'
 * unit_ids: required when scope is 'unit'
 */
async function createBlockedRange(req, res) {
  try {
    const body = req.body || {};
    const startDate = toDateOnly(body.start_date) || body.start_date;
    const endDate = toDateOnly(body.end_date) || body.end_date;
    const reason = (body.reason || 'Blocked').trim().substring(0, 255);
    const source = mapSource(body.source || 'manual');
    const guestName = (body.guest_name || '').trim() || null;
    const scope = body.scope === 'unit' ? 'unit' : 'global';
    const unitIds = Array.isArray(body.unit_ids)
      ? body.unit_ids.map((id) => parseInt(String(id), 10)).filter((n) => !Number.isNaN(n))
      : [];

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }
    if (scope === 'unit' && unitIds.length === 0) {
      return res.status(400).json({ error: 'unit_ids required when scope is unit' });
    }

    const toInsert = scope === 'global' ? [null] : unitIds;
    const inserted = [];

    for (const unitId of toInsert) {
      const [result] = await pool.query(
        `INSERT INTO unit_block_dates (unit_id, start_date, end_date, reason, source, guest_name)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [unitId, startDate, endDate, reason, source, guestName]
      );
      inserted.push({
        id: String(result.insertId),
        start_date: startDate,
        end_date: endDate,
        reason,
        scope: scope === 'global' ? 'global' : 'unit',
        source,
        guest_name: guestName,
        unit_ids: unitId != null ? [String(unitId)] : undefined,
      });
    }

    res.status(201).json(scope === 'global' ? inserted[0] : inserted);
  } catch (error) {
    console.error('Create blocked range error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/calendar/blocked-ranges/:id
 */
async function deleteBlockedRange(req, res) {
  try {
    const blockId = parseInt(req.params.id, 10);
    if (Number.isNaN(blockId)) {
      return res.status(400).json({ error: 'Invalid block id' });
    }

    const [result] = await pool.query('DELETE FROM unit_block_dates WHERE block_id = ?', [blockId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Delete blocked range error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/calendar/pricing-rules
 * Query: listingId (single unit) or unit_ids (comma-separated)
 * Returns holiday_pricing rules from unit_pricing.
 */
async function getPricingRules(req, res) {
  try {
    const { listingId, unit_ids } = req.query;
    let unitIdList = [];
    if (listingId) unitIdList = [String(listingId).trim()];
    else if (unit_ids) unitIdList = String(unit_ids).split(',').map((id) => id.trim()).filter(Boolean);

    const validUnitIds = unitIdList
      .map((id) => parseInt(id, 10))
      .filter((n) => !Number.isNaN(n));
    if (validUnitIds.length === 0) {
      return res.json([]);
    }

    const placeholders = validUnitIds.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT unit_pricing_id, unit_id, rule_data
       FROM unit_pricing
       WHERE unit_id IN (${placeholders}) AND pricing_type = 'holiday_pricing'
       ORDER BY unit_id, sort_order ASC`,
      validUnitIds
    );

    const rules = [];
    for (const r of rows) {
      try {
        const data = typeof r.rule_data === 'string' ? JSON.parse(r.rule_data) : r.rule_data;
        const id = data.id || `rule-${r.unit_pricing_id}`;
        rules.push({
          id,
          unit_pricing_id: r.unit_pricing_id,
          unit_id: String(r.unit_id),
          start_date: data.startDate || data.start_date,
          end_date: data.endDate || data.end_date,
          name: data.name || '',
          adjustmentType: data.adjustmentType || 'increase',
          adjustmentMode: data.adjustmentMode || 'percentage',
          adjustmentPercent: data.adjustmentPercent ?? null,
          adjustmentAmount: data.adjustmentAmount ?? null,
          price: data.adjustmentMode === 'fixed' && data.adjustmentAmount != null
            ? data.adjustmentAmount
            : null,
          note: data.note || data.name || '',
        });
      } catch (_) {
        /* skip invalid JSON */
      }
    }

    res.json(rules);
  } catch (error) {
    console.error('Get pricing rules error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/calendar/pricing-rules
 * Body: { unit_id or unit_ids, start_date, end_date, name, adjustmentType?, adjustmentMode?, adjustmentPercent?, adjustmentAmount?, price? }
 * price: fixed amount when adjustmentMode is fixed
 */
async function createPricingRule(req, res) {
  try {
    const body = req.body || {};
    let unitIds = [];
    if (Array.isArray(body.unit_ids) && body.unit_ids.length > 0) {
      unitIds = body.unit_ids.map((id) => parseInt(String(id), 10)).filter((n) => !Number.isNaN(n));
    } else if (body.unit_id != null) {
      const u = parseInt(body.unit_id, 10);
      if (!Number.isNaN(u)) unitIds = [u];
    }

    const startDate = toDateOnly(body.start_date) || body.start_date;
    const endDate = toDateOnly(body.end_date) || body.end_date;
    const name = (body.name || body.note || '').trim() || 'Special pricing';
    const adjustmentType = body.adjustmentType === 'decrease' ? 'decrease' : 'increase';
    const adjustmentMode = body.adjustmentMode === 'fixed' ? 'fixed' : 'percentage';
    let adjustmentPercent = null;
    let adjustmentAmount = null;

    if (adjustmentMode === 'fixed') {
      adjustmentAmount = parseFloat(body.adjustmentAmount ?? body.price ?? 0) || 0;
    } else {
      adjustmentPercent = parseFloat(body.adjustmentPercent ?? body.percentage ?? 0) || 0;
    }

    if (unitIds.length === 0) {
      return res.status(400).json({ error: 'unit_id or unit_ids is required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'start_date and end_date are required' });
    }
    if (endDate < startDate) {
      return res.status(400).json({ error: 'end_date must be on or after start_date' });
    }

    const ruleId = `holiday-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const ruleData = JSON.stringify({
      id: ruleId,
      name,
      startDate: startDate,
      endDate: endDate,
      adjustmentType,
      adjustmentMode,
      ...(adjustmentMode === 'percentage' ? { adjustmentPercent } : { adjustmentAmount }),
    });

    const inserted = [];
    for (const unitId of unitIds) {
      const [result] = await pool.query(
        `INSERT INTO unit_pricing (unit_id, pricing_type, rule_data, sort_order)
         VALUES (?, 'holiday_pricing', ?, 0)`,
        [unitId, ruleData]
      );
      inserted.push({
        id: ruleId,
        unit_pricing_id: result.insertId,
        unit_id: String(unitId),
        start_date: startDate,
        end_date: endDate,
        name,
        adjustmentType,
        adjustmentMode,
        adjustmentPercent,
        adjustmentAmount,
      });
    }

    res.status(201).json(inserted.length === 1 ? inserted[0] : inserted);
  } catch (error) {
    console.error('Create pricing rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * DELETE /api/calendar/pricing-rules/:id
 * id can be rule id (from rule_data.id) or unit_pricing_id
 */
async function deletePricingRule(req, res) {
  try {
    const id = req.params.id;
    const asNum = parseInt(id, 10);

    if (!Number.isNaN(asNum)) {
      const [result] = await pool.query(
        'DELETE FROM unit_pricing WHERE unit_pricing_id = ? AND pricing_type = ?',
        [asNum, 'holiday_pricing']
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Pricing rule not found' });
      }
      return res.status(204).send();
    }

    const [rows] = await pool.query(
      `SELECT unit_pricing_id FROM unit_pricing
       WHERE pricing_type = 'holiday_pricing' AND JSON_UNQUOTE(JSON_EXTRACT(rule_data, '$.id')) = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Pricing rule not found' });
    }
    await pool.query('DELETE FROM unit_pricing WHERE unit_pricing_id = ?', [rows[0].unit_pricing_id]);
    res.status(204).send();
  } catch (error) {
    console.error('Delete pricing rule error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  getBlockedRanges,
  createBlockedRange,
  deleteBlockedRange,
  getPricingRules,
  createPricingRule,
  deletePricingRule,
};
