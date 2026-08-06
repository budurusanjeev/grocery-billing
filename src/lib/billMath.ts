// Pure money-math for a bill — no React, no storage, no side effects.
// Pulled out of state/bill.tsx specifically so this financial logic can be
// unit-tested directly instead of only being exercised indirectly through
// rendering a component.
import { discountPercentFor, type BillLine, type CustomerType } from './db';

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface BillTotals {
  subtotal: number;
  discountRate: number;
  discount: number;
  total: number;
}

export function computeBillTotals(lines: BillLine[], customerType: CustomerType): BillTotals {
  const subtotal = round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0));
  const discountRate = discountPercentFor(customerType);

  let discount = 0;
  if (discountRate > 0) {
    const discountable = lines.filter((l) => !l.noDiscount).reduce((sum, l) => sum + l.price * l.qty, 0);
    discount = round2(discountable * (discountRate / 100));
  }

  const total = round2(subtotal - discount);
  return { subtotal, discountRate, discount, total };
}
