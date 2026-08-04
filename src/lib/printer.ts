import * as Print from 'expo-print';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BLEPrinter,
  COMMANDS,
  ColumnAlignment,
  type IBLEPrinter,
} from 'react-native-thermal-receipt-printer-image-qr';
import { CUSTOMER_TYPES, type Bill } from './db';
import { isWeb } from './theme';
import { formatMoney } from './ui';

export type { IBLEPrinter };

// 58mm receipt printers (the common small counter printer) fit ~30
// characters per line in the default font.
const PAPER_COLUMNS = 30;

const NOT_AVAILABLE_ON_WEB = 'Printing is not available on the web version — use the Android app.';

// Android 12+ requires these as runtime-requested "nearby devices"
// permissions, separate from the older BLUETOOTH/BLUETOOTH_ADMIN manifest
// permissions the printer library already declares on its own.
async function ensureBluetoothPermission(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const granted = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
  ]);
  const ok = Object.values(granted).every((v) => v === PermissionsAndroid.RESULTS.GRANTED);
  if (!ok) throw new Error('Bluetooth permission is required to use a receipt printer.');
}

// Lists devices already paired with the phone via Android's Bluetooth
// settings — pairing a new device has to happen there first, this library
// doesn't do discovery/pairing itself.
export async function listPairedPrinters(): Promise<IBLEPrinter[]> {
  if (isWeb) throw new Error(NOT_AVAILABLE_ON_WEB);
  await ensureBluetoothPermission();
  await BLEPrinter.init();
  return BLEPrinter.getDeviceList();
}

// Connects as a one-off check (used by the printer setup screen to confirm
// a picked device actually is a working printer before saving it).
export async function connectPrinter(address: string): Promise<void> {
  if (isWeb) throw new Error(NOT_AVAILABLE_ON_WEB);
  await ensureBluetoothPermission();
  await BLEPrinter.init();
  await BLEPrinter.connectPrinter(address);
}

function centerLine(text: string): string {
  return `${COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT}${text}${COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT}\n`;
}

// Connects fresh each time rather than keeping a persistent connection —
// Bluetooth links to cheap receipt printers drop easily, and reconnecting
// right before every print is more reliable than assuming a stale
// connection from earlier in the session is still good.
export async function printBillReceipt(address: string, bill: Bill, shopName: string): Promise<void> {
  if (isWeb) throw new Error(NOT_AVAILABLE_ON_WEB);
  await ensureBluetoothPermission();
  await BLEPrinter.init();
  await BLEPrinter.connectPrinter(address);

  const { TXT_BOLD_ON, TXT_BOLD_OFF, TXT_2HEIGHT, TXT_NORMAL } = COMMANDS.TEXT_FORMAT;
  const divider = `${'-'.repeat(PAPER_COLUMNS)}\n`;
  const time = new Date(bill.created_at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  BLEPrinter.printText(
    `${TXT_BOLD_ON}${TXT_2HEIGHT}${centerLine(shopName)}${TXT_NORMAL}${TXT_BOLD_OFF}${centerLine(time)}${divider}`,
  );

  const nameWidth = PAPER_COLUMNS - 14;
  const amountColumns = (label: string, qty: string, amount: string, style = '') =>
    BLEPrinter.printColumnsText(
      [label, qty, amount],
      [nameWidth, 6, 8],
      [ColumnAlignment.LEFT, ColumnAlignment.CENTER, ColumnAlignment.RIGHT],
      [style, style, style],
    );

  amountColumns('Item', 'Qty', 'Amt', TXT_BOLD_ON);
  for (const line of bill.lines) {
    amountColumns(line.name, String(line.qty), formatMoney(line.price * line.qty));
  }

  BLEPrinter.printText(divider);

  const totalsColumns = (label: string, amount: string, style = '') =>
    BLEPrinter.printColumnsText(
      [label, amount],
      [PAPER_COLUMNS - 10, 10],
      [ColumnAlignment.LEFT, ColumnAlignment.RIGHT],
      [style, style],
    );

  if (bill.discount) {
    const label = CUSTOMER_TYPES.find((c) => c.key === bill.customerType)?.label ?? 'Discount';
    totalsColumns(`Discount (${label})`, `-${formatMoney(bill.discount)}`);
  }
  totalsColumns('TOTAL', formatMoney(bill.total), `${TXT_BOLD_ON}${TXT_2HEIGHT}`);
  BLEPrinter.printText(TXT_NORMAL + TXT_BOLD_OFF);

  let footer = '\n';
  if (bill.paymentMethod) {
    footer += centerLine(`Paid via ${bill.paymentMethod.toUpperCase()}`);
  }
  footer += centerLine('Thank you, visit again!');
  BLEPrinter.printBill(footer, { beep: true, cut: true });
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildReceiptHtml(bill: Bill, shopName: string): string {
  const time = new Date(bill.created_at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const rows = bill.lines
    .map(
      (l) => `
        <tr>
          <td>${escapeHtml(l.name)}</td>
          <td class="center">${l.qty} ${escapeHtml(l.unit)}</td>
          <td class="right">${formatMoney(l.price)}</td>
          <td class="right">${formatMoney(l.price * l.qty)}</td>
        </tr>`,
    )
    .join('');
  const discountLabel = CUSTOMER_TYPES.find((c) => c.key === bill.customerType)?.label ?? 'Discount';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; }
          h1 { text-align: center; margin: 0 0 4px; font-size: 22px; }
          .subtitle { text-align: center; color: #64748b; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px 6px; text-align: left; font-size: 14px; }
          th { border-bottom: 2px solid #0f172a; font-size: 12px; text-transform: uppercase; color: #64748b; }
          tr:not(:last-child) td { border-bottom: 1px solid #e2e8f0; }
          .center { text-align: center; }
          .right { text-align: right; }
          .totals { margin-top: 12px; width: 100%; }
          .totals td { border: none; padding: 4px 6px; font-size: 14px; }
          .totals .label { text-align: left; color: #64748b; }
          .totals .value { text-align: right; }
          .grand-total td { font-size: 20px; font-weight: 800; border-top: 2px solid #0f172a; padding-top: 10px; }
          .footer { text-align: center; margin-top: 28px; color: #64748b; font-size: 13px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(shopName)}</h1>
        <div class="subtitle">${time}</div>
        <table>
          <thead>
            <tr><th>Item</th><th class="center">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <table class="totals">
          ${
            bill.discount
              ? `<tr><td class="label">Discount (${escapeHtml(discountLabel)})</td><td class="value">−${formatMoney(bill.discount)}</td></tr>`
              : ''
          }
          <tr class="grand-total"><td class="label">Total</td><td class="value">${formatMoney(bill.total)}</td></tr>
          ${
            bill.paymentMethod
              ? `<tr><td class="label">Paid via</td><td class="value">${bill.paymentMethod.toUpperCase()}</td></tr>`
              : ''
          }
        </table>
        <div class="footer">Thank you for shopping with us!</div>
      </body>
    </html>`;
}

// Uses Android/iOS's own system Print dialog (or the browser's print dialog
// on web) — works with any WiFi/network printer already set up on the
// device, or "Save as PDF", with no pairing or permissions needed at all.
// This is deliberately separate from the Bluetooth thermal receipt printer
// above: different hardware, different button, both available side by side.
export async function printBillSystemDialog(bill: Bill, shopName: string): Promise<void> {
  const html = buildReceiptHtml(bill, shopName);
  await Print.printAsync({ html });
}
