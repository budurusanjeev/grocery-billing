import { formatBillNumber } from '../db';

describe('formatBillNumber', () => {
  it('formats as YY + DD + a zero-padded 3-digit counter, with no suffix when there is no device label', () => {
    expect(formatBillNumber(new Date(2026, 7, 4), 1, '')).toBe('2604001');
  });

  it('zero-pads the counter up to 3 digits', () => {
    expect(formatBillNumber(new Date(2026, 7, 4), 42, '')).toBe('2604042');
    expect(formatBillNumber(new Date(2026, 7, 4), 999, '')).toBe('2604999');
  });

  it('appends a device label suffix when one is set, so multiple devices never collide', () => {
    expect(formatBillNumber(new Date(2026, 7, 4), 1, 'PC')).toBe('2604001-PC');
    expect(formatBillNumber(new Date(2026, 7, 4), 1, 'Phone1')).toBe('2604001-Phone1');
  });

  it('pads a single-digit day of month to two digits', () => {
    expect(formatBillNumber(new Date(2026, 7, 4), 1, '')).toBe('2604001');
    expect(formatBillNumber(new Date(2026, 0, 4), 1, '')).toBe('2604001');
  });

  it('produces the same YYDD prefix for the same day-of-month across different months (a known, accepted limitation)', () => {
    const augFourth = formatBillNumber(new Date(2026, 7, 4), 1, '');
    const janFourth = formatBillNumber(new Date(2026, 0, 4), 1, '');
    expect(augFourth).toBe(janFourth);
  });
});
