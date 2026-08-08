import * as Print from 'expo-print';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  BLEPrinter,
  COMMANDS,
  ColumnAlignment,
  NetPrinter,
  NetPrinterEventEmitter,
  RN_THERMAL_RECEIPT_PRINTER_EVENTS,
  type IBLEPrinter,
  type INetPrinter,
} from 'react-native-thermal-receipt-printer-image-qr';
import { CUSTOMER_TYPES, type Bill, type PrinterDevice } from './db';
import { isWeb } from './theme';
import { formatMoney } from './ui';

export type { IBLEPrinter, INetPrinter };

// 58mm receipt printers (the common small counter printer) fit ~30
// characters per line in the default font.
const PAPER_COLUMNS = 30;

const NOT_AVAILABLE_ON_WEB = 'Printing is not available on the web version — use the Android app.';

// BLEPrinter and NetPrinter expose an identical set of print methods (only
// how you connect to them differs) — this narrow shape is all the
// receipt-formatting code below actually needs, so it can work against
// either client without caring which it is.
interface PrinterClient {
  printText: (text: string, opts?: {}) => void;
  printColumnsText: (
    texts: string[],
    columnWidth: number[],
    columnAlignment: ColumnAlignment[],
    columnStyle: string[],
    opts?: {},
  ) => void;
  printBill: (text: string, opts?: { beep?: boolean; cut?: boolean }) => void;
}

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

// Scans the local WiFi subnet for printers listening on the raw print port
// — can take a while (tens of seconds) since it has to probe the whole
// range. The phone and printer must be on the same WiFi network.
//
// NetPrinter.getDeviceList()'s own returned Promise is unusable — the
// native Android side (RNNetPrinterModule#getDeviceList) invokes its
// success callback with no arguments and always returns an empty list
// synchronously; the actual scan runs on a background thread and reports
// results later via the "scannerResolved" native event instead. So the
// scan has to be kicked off by calling getDeviceList() (ignoring what it
// resolves with) while listening for that event for the real results.
export async function scanNetworkPrinters(): Promise<INetPrinter[]> {
  if (isWeb) throw new Error(NOT_AVAILABLE_ON_WEB);
  await NetPrinter.init();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error('Scan timed out — no response from the network within 30 seconds.'));
    }, 30000);
    const subscription = NetPrinterEventEmitter.addListener(
      RN_THERMAL_RECEIPT_PRINTER_EVENTS.EVENT_NET_PRINTER_SCANNED_SUCCESS,
      (devices: INetPrinter[]) => {
        clearTimeout(timeout);
        subscription.remove();
        resolve(devices ?? []);
      },
    );
    NetPrinter.getDeviceList().catch((err) => {
      clearTimeout(timeout);
      subscription.remove();
      reject(err);
    });
  });
}

// Connects as a one-off check (used by the printer setup screen to confirm
// a picked device actually is a working printer before saving it).
export async function testConnectPrinter(device: PrinterDevice): Promise<void> {
  if (isWeb) throw new Error(NOT_AVAILABLE_ON_WEB);
  if (device.type === 'bluetooth') {
    await ensureBluetoothPermission();
    await BLEPrinter.init();
    await BLEPrinter.connectPrinter(device.address);
  } else {
    await NetPrinter.init();
    await NetPrinter.connectPrinter(device.host, device.port);
  }
}

function centerLine(text: string): string {
  return `${COMMANDS.TEXT_FORMAT.TXT_ALIGN_CT}${text}${COMMANDS.TEXT_FORMAT.TXT_ALIGN_LT}\n`;
}

// The actual receipt formatting/sending — shared between Bluetooth and
// network printers, since both clients expose the same print methods.
function sendReceipt(client: PrinterClient, bill: Bill, shopName: string): void {
  const { TXT_BOLD_ON, TXT_BOLD_OFF, TXT_2HEIGHT, TXT_NORMAL } = COMMANDS.TEXT_FORMAT;
  const divider = `${'-'.repeat(PAPER_COLUMNS)}\n`;
  const time = new Date(bill.created_at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  let header = `${TXT_BOLD_ON}${TXT_2HEIGHT}${centerLine(shopName)}${TXT_NORMAL}${TXT_BOLD_OFF}${centerLine(time)}`;
  if (bill.billNumber) header += centerLine(`Bill #${bill.billNumber}`);
  if (bill.customerName) header += centerLine(`Customer: ${bill.customerName}`);
  if (bill.customerMobile) header += centerLine(`Mobile: ${bill.customerMobile}`);
  header += divider;
  client.printText(header);

  const nameWidth = PAPER_COLUMNS - 14;
  const amountColumns = (label: string, qty: string, amount: string, style = '') =>
    client.printColumnsText(
      [label, qty, amount],
      [nameWidth, 6, 8],
      [ColumnAlignment.LEFT, ColumnAlignment.CENTER, ColumnAlignment.RIGHT],
      [style, style, style],
    );

  amountColumns('Item', 'Qty', 'Amt', TXT_BOLD_ON);
  for (const line of bill.lines) {
    amountColumns(line.name, String(line.qty), formatMoney(line.price * line.qty));
  }

  client.printText(divider);

  const totalsColumns = (label: string, amount: string, style = '') =>
    client.printColumnsText(
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
  client.printText(TXT_NORMAL + TXT_BOLD_OFF);

  let footer = '\n';
  if (bill.paymentMethod) {
    footer += centerLine(`Paid via ${bill.paymentMethod.toUpperCase()}`);
  }
  footer += centerLine('Thank you, visit again!');
  client.printBill(footer, { beep: true, cut: true });
}

// Connects fresh each time rather than keeping a persistent connection —
// Bluetooth/network links to cheap receipt printers drop easily, and
// reconnecting right before every print is more reliable than assuming a
// stale connection from earlier in the session is still good.
export async function printBillReceipt(device: PrinterDevice, bill: Bill, shopName: string): Promise<void> {
  if (isWeb) throw new Error(NOT_AVAILABLE_ON_WEB);
  if (device.type === 'bluetooth') {
    await ensureBluetoothPermission();
    await BLEPrinter.init();
    await BLEPrinter.connectPrinter(device.address);
    sendReceipt(BLEPrinter, bill, shopName);
  } else {
    await NetPrinter.init();
    await NetPrinter.connectPrinter(device.host, device.port);
    sendReceipt(NetPrinter, bill, shopName);
  }
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
          .customer { text-align: center; color: #334155; font-size: 13px; margin-bottom: 4px; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(shopName)}</h1>
        <div class="subtitle">${time}${bill.billNumber ? ` · Bill #${escapeHtml(bill.billNumber)}` : ''}</div>
        ${bill.customerName ? `<div class="customer">Customer: ${escapeHtml(bill.customerName)}</div>` : ''}
        ${bill.customerMobile ? `<div class="customer">Mobile: ${escapeHtml(bill.customerMobile)}</div>` : ''}
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

// expo-print's web implementation is just a `window.print()` stub — it
// ignores the `html` option entirely and prints whatever's on the current
// page (which was showing the raw app UI instead of the receipt). Work
// around it with the standard technique for printing custom content on the
// web: write the HTML into a hidden iframe and print that iframe instead.
function printHtmlOnWeb(html: string): void {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    throw new Error('Could not open the print preview.');
  }
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  // Give the browser's print dialog time to actually open before tearing
  // down the iframe it's reading from.
  setTimeout(() => document.body.removeChild(iframe), 1000);
}

// Uses Android/iOS's own system Print dialog (or the browser's print dialog
// on web) — works with any WiFi/network printer already set up on the
// device, or "Save as PDF", with no pairing or permissions needed at all.
// This is deliberately separate from the Bluetooth thermal receipt printer
// above: different hardware, different button, both available side by side.
export async function printBillSystemDialog(bill: Bill, shopName: string): Promise<void> {
  const html = buildReceiptHtml(bill, shopName);
  if (isWeb) {
    printHtmlOnWeb(html);
    return;
  }
  await Print.printAsync({ html });
}
