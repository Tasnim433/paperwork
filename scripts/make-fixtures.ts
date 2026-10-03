/**
 * Generates the fictional sample letters in /fixtures for manual pipeline tests.
 *
 *   pnpm fixtures
 *
 * - invoice-stadtwerke.pdf: invoice with a real text layer (pdfjs path)
 * - appointment-auslaenderbehoerde.png: scanned-looking appointment letter (OCR path)
 *
 * All names, numbers and addresses are fictional. The IBAN is the well-known
 * documentation example (DE89 3704 0044 0532 0130 00).
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

const outDir = "fixtures";
mkdirSync(outDir, { recursive: true });

type Line = {
  text: string;
  /** Right-aligned value on the same line, e.g. an amount. */
  value?: string;
  bold?: boolean;
  size?: number;
  gapBefore?: number;
  right?: boolean;
};

const invoiceLines: Line[] = [
  { text: "Stadtwerke Musterstadt GmbH · Energiestraße 5 · 94032 Musterstadt", size: 8 },
  { text: "Frau", gapBefore: 30 },
  { text: "Lena Beispiel" },
  { text: "Innstraße 00" },
  { text: "94032 Musterstadt" },
  { text: "Musterstadt, 01.10.2026", right: true, gapBefore: 20 },
  { text: "Rechnung Strom September 2026", bold: true, size: 13, gapBefore: 24 },
  { text: "Kundennummer: 4711-0815-26", gapBefore: 10 },
  { text: "Rechnungsnummer: RE-2026-091734" },
  { text: "Abrechnungszeitraum: 01.09.2026 bis 30.09.2026" },
  { text: "Sehr geehrte Frau Beispiel,", gapBefore: 18 },
  { text: "für Ihren Stromverbrauch im September 2026 berechnen wir Ihnen:" },
  { text: "Arbeitspreis 212 kWh", value: "72,08 €", gapBefore: 10 },
  { text: "Grundpreis", value: "14,32 €" },
  { text: "Rechnungsbetrag", value: "86,40 €", bold: true },
  {
    text: "Bitte überweisen Sie den Rechnungsbetrag bis zum 30.10.2026 auf folgendes Konto:",
    gapBefore: 14,
  },
  { text: "IBAN: DE89 3704 0044 0532 0130 00" },
  { text: "Verwendungszweck: 4711-0815-26" },
  { text: "Mit freundlichen Grüßen", gapBefore: 18 },
  { text: "Ihre Stadtwerke Musterstadt" },
  { text: "Dies ist ein fiktives Beispieldokument für Testzwecke.", size: 7, gapBefore: 40 },
];

async function makeInvoicePdf() {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Rechnung Strom September 2026 (fiktiv)");
  const page = pdf.addPage([595.28, 841.89]); // A4 in points
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 800;
  for (const line of invoiceLines) {
    const size = line.size ?? 10.5;
    const font = line.bold ? bold : regular;
    y -= (line.gapBefore ?? 0) + size * 1.45;
    const width = font.widthOfTextAtSize(line.text, size);
    page.drawText(line.text, {
      x: line.right ? 595.28 - 60 - width : 60,
      y,
      size,
      font,
      color: rgb(0.1, 0.1, 0.12),
    });
    if (line.value) {
      const valueWidth = font.widthOfTextAtSize(line.value, size);
      page.drawText(line.value, {
        x: 595.28 - 60 - valueWidth,
        y,
        size,
        font,
        color: rgb(0.1, 0.1, 0.12),
      });
    }
  }
  writeFileSync(`${outDir}/invoice-stadtwerke.pdf`, await pdf.save());
}

const appointmentLines: Line[] = [
  { text: "Stadt Musterstadt · Ausländerbehörde · Rathausplatz 2 · 94032 Musterstadt", size: 18 },
  { text: "Frau", gapBefore: 50 },
  { text: "Lena Beispiel" },
  { text: "Innstraße 00" },
  { text: "94032 Musterstadt" },
  { text: "Musterstadt, 28.09.2026", right: true, gapBefore: 30 },
  { text: "Aktenzeichen: AB-2026-04417", gapBefore: 20 },
  { text: "Terminbestätigung: Verlängerung Aufenthaltstitel", bold: true, size: 30, gapBefore: 30 },
  { text: "Sehr geehrte Frau Beispiel,", gapBefore: 30 },
  { text: "wir bestätigen Ihren Termin am 22.10.2026 um 09:30 Uhr," },
  { text: "Zimmer 2.14, Rathausplatz 2, 94032 Musterstadt." },
  { text: "Bitte bringen Sie folgende Unterlagen mit:", gapBefore: 20 },
  { text: "Reisepass, Immatrikulationsbescheinigung, Mietvertrag." },
  { text: "Sollten Sie den Termin nicht wahrnehmen können,", gapBefore: 20 },
  { text: "sagen Sie ihn bitte rechtzeitig ab." },
  { text: "Mit freundlichen Grüßen", gapBefore: 30 },
  { text: "Stadt Musterstadt, Ausländerbehörde" },
  { text: "Dies ist ein fiktives Beispieldokument für Testzwecke.", size: 16, gapBefore: 60 },
];

function makeAppointmentPng() {
  // A4 at 150 dpi.
  const width = 1240;
  const height = 1754;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fbfbf8";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#1b1c1f";
  ctx.textBaseline = "alphabetic";

  let y = 110;
  for (const line of appointmentLines) {
    const size = line.size ?? 26;
    y += (line.gapBefore ?? 0) + size * 1.5;
    ctx.font = `${line.bold ? "bold " : ""}${size}px Arial, Helvetica, sans-serif`;
    const textWidth = ctx.measureText(line.text).width;
    ctx.fillText(line.text, line.right ? width - 120 - textWidth : 120, y);
  }
  writeFileSync(`${outDir}/appointment-auslaenderbehoerde.png`, canvas.toBuffer("image/png"));
}

async function main() {
  await makeInvoicePdf();
  makeAppointmentPng();
  console.log(`Wrote fixtures to ./${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
