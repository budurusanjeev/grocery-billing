import { computeBillTotals, round2, round3 } from '../billMath';
import type { BillLine } from '../db';

function line(overrides: Partial<BillLine> = {}): BillLine {
  return { itemId: '1', name: 'Item', unit: 'kg', price: 100, qty: 1, ...overrides };
}

describe('round2 / round3', () => {
  it('rounds to 2 and 3 decimal places respectively', () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.001)).toBe(10);
    expect(round3(0.12344)).toBe(0.123);
    expect(round3(0.12351)).toBe(0.124);
  });
});

describe('computeBillTotals', () => {
  it('applies no discount for a regular customer', () => {
    const result = computeBillTotals([line({ price: 100, qty: 2 })], 'regular');
    expect(result).toEqual({ subtotal: 200, discountRate: 0, discount: 0, total: 200 });
  });

  it('applies the retailer discount rate (5%) to the whole subtotal', () => {
    const result = computeBillTotals([line({ price: 100, qty: 2 })], 'retailer');
    expect(result).toEqual({ subtotal: 200, discountRate: 5, discount: 10, total: 190 });
  });

  it('applies the wholesaler discount rate (10%)', () => {
    const result = computeBillTotals([line({ price: 100, qty: 2 })], 'wholesaler');
    expect(result).toEqual({ subtotal: 200, discountRate: 10, discount: 20, total: 180 });
  });

  it('excludes noDiscount lines from the discount calculation but still counts them in the subtotal', () => {
    const lines = [line({ price: 100, qty: 1 }), line({ itemId: '2', price: 50, qty: 1, noDiscount: true })];
    const result = computeBillTotals(lines, 'wholesaler');
    // Subtotal is both lines (150), but only the discountable ₹100 line
    // gets the 10% cut — the ₹50 exempt line is untouched.
    expect(result).toEqual({ subtotal: 150, discountRate: 10, discount: 10, total: 140 });
  });

  it('never produces a negative total even with several discountable lines', () => {
    const lines = [
      line({ itemId: '1', price: 33.33, qty: 3 }),
      line({ itemId: '2', price: 10, qty: 7 }),
    ];
    const result = computeBillTotals(lines, 'wholesaler');
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.discount).toBeLessThanOrEqual(result.subtotal);
  });

  it('handles an empty bill as all zeroes', () => {
    expect(computeBillTotals([], 'retailer')).toEqual({
      subtotal: 0,
      discountRate: 5,
      discount: 0,
      total: 0,
    });
  });

  it('handles fractional quantities correctly (e.g. half a kg)', () => {
    const result = computeBillTotals([line({ price: 120, qty: 0.5 })], 'regular');
    expect(result.subtotal).toBe(60);
    expect(result.total).toBe(60);
  });
});
