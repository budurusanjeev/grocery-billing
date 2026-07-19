import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { BillLine, Item } from '../lib/db';

interface BillContextValue {
  lines: BillLine[];
  total: number;
  addLine: (item: Item, qty?: number) => void;
  updateQty: (itemId: string, qty: number) => void;
  removeLine: (itemId: string) => void;
  clear: () => void;
}

const BillContext = createContext<BillContextValue | null>(null);

export function BillProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<BillLine[]>([]);

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
        { itemId: item.id, name: item.name_en, unit: item.unit, price: item.price, qty: round3(qty) },
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

  const total = useMemo(
    () => Math.round(lines.reduce((sum, l) => sum + l.price * l.qty, 0) * 100) / 100,
    [lines],
  );

  const value = useMemo(
    () => ({ lines, total, addLine, updateQty, removeLine, clear }),
    [lines, total, addLine, updateQty, removeLine, clear],
  );

  return <BillContext.Provider value={value}>{children}</BillContext.Provider>;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function useBill(): BillContextValue {
  const ctx = useContext(BillContext);
  if (!ctx) throw new Error('useBill must be used inside BillProvider');
  return ctx;
}
