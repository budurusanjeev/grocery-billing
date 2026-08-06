import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { computeBillTotals, round3 } from '../lib/billMath';
import type { BillLine, CustomerType, Item } from '../lib/db';

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

  const { subtotal, discountRate, discount, total } = useMemo(
    () => computeBillTotals(lines, customerType),
    [lines, customerType],
  );

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

export function useBill(): BillContextValue {
  const ctx = useContext(BillContext);
  if (!ctx) throw new Error('useBill must be used inside BillProvider');
  return ctx;
}
