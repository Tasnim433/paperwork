/**
 * Deterministic AI results for the fictional letters in fixtures/letters (see
 * EXPECTED_RESULTS.md there). Used by AI_PROVIDER=mock so the pipeline and the
 * tests run without an API key. Values are written as they appear in the letter;
 * normalization and validation happen in the pipeline as usual.
 */
import type { DocumentTypeKey } from "@/lib/schemas/document-fields";

export type MockValue = { value: string; sourceText?: string; confidence?: number };

export type MockLetter = {
  /** File in fixtures/letters. */
  file: string;
  /** Normalized text fragments (lowercase letters and digits) that identify the letter; any one matches. */
  markers: string[];
  type: DocumentTypeKey;
  fields: Record<string, MockValue>;
};

export const mockLetters: MockLetter[] = [
  {
    file: "01_krankenkasse_beitragsrechnung.pdf",
    markers: ["beitragsrechnungwintersemester"],
    type: "invoice",
    fields: {
      sender: { value: "Musterkasse Krankenversicherung" },
      letter_date: { value: "29.09.2026", sourceText: "Passau, 29.09.2026" },
      amount: { value: "132,48 €", sourceText: "Gesamtbetrag 132,48 €" },
      due_date: { value: "15.11.2026", sourceText: "bis zum 15.11.2026" },
      reference: { value: "X123456789", sourceText: "Versichertennummer: X123456789" },
      iban: { value: "DE89 3704 0044 0532 0130 00" },
      period: { value: "01.10.2026 bis 31.03.2027" },
    },
  },
  {
    file: "02_beitragsstelle_zahlungsaufforderung.pdf",
    markers: ["beitragsstellemusterland"],
    type: "invoice",
    fields: {
      sender: { value: "Beitragsstelle Musterland" },
      letter_date: { value: "26.09.2026", sourceText: "Musterstadt, 26.09.2026" },
      amount: { value: "55,08 €" },
      due_date: { value: "15.10.2026", sourceText: "bis spätestens 15.10.2026" },
      reference: { value: "482 113 907", sourceText: "Beitragsnummer: 482 113 907" },
      iban: { value: "DE02 1203 0000 0000 2020 51" },
      period: { value: "Oktober bis Dezember 2026" },
    },
  },
  {
    file: "03_auslaenderbehoerde_terminbestaetigung.jpg",
    markers: ["ab202604417", "ausländerbehörde"],
    type: "appointment",
    fields: {
      sender: { value: "Stadt Musterstadt, Ausländerbehörde" },
      letter_date: { value: "30.09.2026", sourceText: "Passau, 30.09.2026" },
      appointment_date: { value: "22.10.2026", sourceText: "am 22.10.2026" },
      time: { value: "09:30 Uhr" },
      location: { value: "Zimmer 2.14, Rathausplatz 2" },
      bring: {
        value:
          "Reisepass, Immatrikulationsbescheinigung, Mietvertrag, Nachweis über die Krankenversicherung",
      },
      case_number: { value: "AB-2026-04417", sourceText: "Aktenzeichen: AB-2026-04417" },
    },
  },
  {
    file: "04_lohnabrechnung_september_2026.pdf",
    markers: ["lohnabrechnungseptember2026", "caféaminn"],
    type: "payslip",
    fields: {
      sender: { value: "Café Am Inn GmbH" },
      period: { value: "September 2026", sourceText: "Lohnabrechnung September 2026" },
      total_hours: { value: "63,5", sourceText: "Summe 63,5" },
      full_days: { value: "3", sourceText: "Arbeitstage über 4 Stunden: 3" },
      half_days: { value: "11", sourceText: "Arbeitstage bis 4 Stunden: 11" },
      gross_pay: { value: "882,65 €", sourceText: "Bruttoverdienst: 882,65 €" },
      net_pay: { value: "815,04 €", sourceText: "Auszahlungsbetrag: 815,04 €" },
    },
  },
  {
    file: "05_nebenkostenabrechnung_2025.pdf",
    markers: ["nebenkostenabrechnung2025", "mv0412"],
    type: "invoice",
    fields: {
      sender: { value: "Hausverwaltung Muster" },
      letter_date: { value: "24.09.2026", sourceText: "Passau, 24.09.2026" },
      amount: { value: "86,20 €", sourceText: "Nachzahlung 86,20 €" },
      due_date: { value: "31.10.2026", sourceText: "bis zum 31.10.2026" },
      reference: { value: "MV-0412", sourceText: "Mieternummer: MV-0412" },
      // Fails the checksum on purpose: must end up as "check".
      iban: { value: "DE12 3704 0044 0532 0130 00" },
      period: { value: "01.01.2025 bis 31.12.2025" },
    },
  },
  {
    file: "06_universitaet_information.pdf",
    markers: ["informationzumwintersemester", "studierendenservice"],
    type: "information_only",
    fields: {
      sender: {
        value: "Universität Musterstadt, Studierendenservice",
        sourceText: "Universität Musterstadt · Studierendenservice",
      },
      letter_date: { value: "15.09.2026", sourceText: "Passau, 15.09.2026" },
      subject: { value: "Information zum Wintersemester 2026/27" },
    },
  },
  {
    // Blurry photo: most values cannot be found in the OCR text and end up as "check".
    file: "07_stadtwerke_abschlag_unscharf.jpg",
    markers: ["abschlagsplan", "stadtwerkemuster"],
    type: "invoice",
    fields: {
      sender: { value: "Stadtwerke Muster", confidence: 0.8 },
      letter_date: { value: "01.10.2026", confidence: 0.6 },
      amount: { value: "45,00 €", confidence: 0.6 },
      due_date: { value: "01.11.2026", confidence: 0.6 },
      reference: { value: "SW-77120934", confidence: 0.6 },
      period: { value: "monatlich ab 01.11.2026", confidence: 0.5 },
    },
  },
];
