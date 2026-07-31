import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { discountPercentFor, type BillLine, type CustomerType, type Item } from '../lib/db';

interface BillContextValue {
  lines: BillLine[];
  customerType: CustomerType;
  setCustomerType: (type: CustomerType) => void;
  subtotal: number;
  discountRate: number;
  discount: number;
  total: number;
  addLine: (item: Item, qty?: number) => void;
  updateQty: (itemId: string, qty: number) => void;
  removeLine: (itemId: string) => void;
  clear: () => void;
}

const BillContext = createContext<BillContextValue | null>(null);

export function BillProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<BillLine[]>([]);
  const [customerType, setCustomerType] = useState<CustomerType>('regular');

  const addLine = useCallback((item: Item, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.itemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, qty: round3(l.qty + qty) } : l,
        );
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name_en,
          unit: item.unit,
          price: item.price,
          qty: round3(qty),
          noDiscount: item.noDiscount,
        },
      ];
    });
  }, []);

  const updateQty = useCallback((itemId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.itemId !== itemId)
        : prev.map((l) => (l.itemId === itemId ? { ...l, qty: round3(qty) } : l)),
    );
  }, []);

  const removeLine = useCallback((itemId: string) => {
    setLines((prev) => prev.filter((l) => l.itemId !== itemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotal = useMemo(() => round2(lines.reduce((sum, l) => sum + l.price * l.qty, 0)), [lines]);

  const discountRate = discountPercentFor(customerType);

  const discount = useMemo(() => {
    if (discountRate === 0) return 0;
    const discountable = lines
      .filter((l) => !l.noDiscount)
      .reduce((sum, l) => sum + l.price * l.qty, 0);
    return round2(discountable * (discountRate / 100));
  }, [lines, discountRate]);

  const total = useMemo(() => round2(subtotal - discount), [subtotal, discount]);

  const value = useMemo(
    () => ({
      lines,
      customerType,
      setCustomerType,
      subtotal,
      discountRate,
      discount,
      total,
      addLine,
      updateQty,
      removeLine,
      clear,
    }),
    [lines, customerType, subtotal, discountRate, discount, total, addLine, updateQty, removeLine, clear],
  );

  return <BillContext.Provider value={value}>{children}</BillContext.Provider>;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function useBill(): BillContextValue {
  const ctx = useContext(BillContext);
  if (!ctx) throw new Error('useBill must be used inside BillProvider');
  return ctx;
}
