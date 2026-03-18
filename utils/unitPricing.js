/**
 * Server-side unit pricing: holiday pricing + stay-length discount.
 * Mirrors frontend lib/utils/unitPricing.ts logic.
 */

function parseYMD(s) {
  if (!s) return null;
  const datePart = String(s).split('T')[0];
  const parts = datePart.split('-').map(Number);
  if (parts.length < 3) return null;
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isDateInRange(dateStr, startStr, endStr) {
  const d = parseYMD(dateStr);
  const start = parseYMD(startStr);
  const end = parseYMD(endStr);
  if (!d || !start || !end) return false;
  const t = d.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

function getNightPriceWithHoliday(basePrice, dateStr, holidayRules) {
  const rules = holidayRules || [];
  for (const rule of rules) {
    if (!isDateInRange(dateStr, rule.startDate, rule.endDate)) continue;
    if (rule.adjustmentType === 'increase') {
      if (rule.adjustmentMode === 'percentage' && rule.adjustmentPercent != null) {
        return basePrice * (1 + rule.adjustmentPercent / 100);
      }
      if (rule.adjustmentMode === 'fixed' && rule.adjustmentAmount != null) {
        return basePrice + rule.adjustmentAmount;
      }
    } else {
      if (rule.adjustmentMode === 'percentage' && rule.adjustmentPercent != null) {
        return Math.max(0, basePrice * (1 - rule.adjustmentPercent / 100));
      }
      if (rule.adjustmentMode === 'fixed' && rule.adjustmentAmount != null) {
        return Math.max(0, basePrice - rule.adjustmentAmount);
      }
    }
  }
  return basePrice;
}

function getBestStayLengthDiscount(nights, rules) {
  const qualifying = (rules || []).filter((r) => nights >= (r.minNights || 0));
  if (qualifying.length === 0) return null;
  return qualifying.reduce((best, r) =>
    (r.minNights || 0) > (best?.minNights ?? 0) ? r : best
  );
}

/**
 * Compute subtotal for a stay using unit_pricing (holiday + stay-length discount).
 * Does NOT include excess pax fees — caller adds those.
 *
 * @param {number} basePricePerNight
 * @param {string} checkInDate - YYYY-MM-DD
 * @param {string} checkOutDate - YYYY-MM-DD
 * @param {Array} discountRules - stay_length_discount rules
 * @param {Array} holidayPricingRules - holiday_pricing rules
 * @returns {{ subtotal: number, nights: number, stayLengthDiscountAmount: number, subtotalBeforeDiscount: number }}
 */
function computeSubtotalWithPricing(basePricePerNight, checkInDate, checkOutDate, discountRules, holidayPricingRules) {
  const start = parseYMD(checkInDate);
  const end = parseYMD(checkOutDate);
  if (!start || !end || end.getTime() <= start.getTime()) {
    return { subtotal: 0, nights: 0, stayLengthDiscountAmount: 0, subtotalBeforeDiscount: 0 };
  }

  let subtotalWithHoliday = 0;
  const current = new Date(start);

  while (current.getTime() < end.getTime()) {
    const dateStr = formatYMD(current);
    const nightPrice = getNightPriceWithHoliday(basePricePerNight, dateStr, holidayPricingRules || []);
    subtotalWithHoliday += nightPrice;
    current.setDate(current.getDate() + 1);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const nights = Math.round((end.getTime() - start.getTime()) / msPerDay);
  const subtotalBeforeDiscount = subtotalWithHoliday;

  const stayDiscount = getBestStayLengthDiscount(nights, discountRules || []);
  let stayLengthDiscountAmount = 0;
  if (stayDiscount) {
    if (stayDiscount.discountType === 'percentage' && stayDiscount.discountPercent != null) {
      stayLengthDiscountAmount = subtotalBeforeDiscount * (stayDiscount.discountPercent / 100);
    } else if (stayDiscount.discountType === 'fixed' && stayDiscount.discountAmount != null) {
      stayLengthDiscountAmount = Math.min(subtotalBeforeDiscount, stayDiscount.discountAmount);
    }
  }

  const subtotal = Math.max(0, subtotalBeforeDiscount - stayLengthDiscountAmount);

  return {
    subtotal,
    nights,
    stayLengthDiscountAmount,
    subtotalBeforeDiscount,
  };
}

module.exports = { computeSubtotalWithPricing };
