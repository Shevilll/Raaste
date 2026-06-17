// Build a QR code as a boolean grid (true = dark module) from a string.
// Rendered as inline SVG by the component, so there is no canvas dependency.

import qrcode from "qrcode-generator";

export function qrModules(text: string): boolean[][] {
  const qr = qrcode(0, "M"); // 0 = auto-size, "M" = ~15% error correction
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const rows: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    rows.push(row);
  }
  return rows;
}
