# Paperwork test fixtures

All letters are fictional ("MUSTERDOKUMENT"). Use them to test upload, extraction and validation.
Copy this folder into the project as `fixtures/letters/`.

| File                                         | Format           | Expected type    | What it tests                                              |
| -------------------------------------------- | ---------------- | ---------------- | ---------------------------------------------------------- |
| 01_krankenkasse_beitragsrechnung.pdf         | PDF (text layer) | invoice          | Happy path, all fields valid                               |
| 02_beitragsstelle_zahlungsaufforderung.pdf   | PDF              | invoice          | Deadline soon (15.10.2026)                                 |
| 03_auslaenderbehoerde_terminbestaetigung.jpg | Photo (OCR)      | appointment      | OCR on a slightly rotated photo, several "bring" items     |
| 04_lohnabrechnung_september_2026.pdf         | PDF              | payslip          | Work-day calculation (3 full, 11 half)                     |
| 05_nebenkostenabrechnung_2025.pdf            | PDF              | invoice          | **Invalid IBAN** -> IBAN field must be "check"             |
| 06_universitaet_information.pdf              | PDF              | information_only | No action, no task should be created                       |
| 07_stadtwerke_abschlag_unscharf.jpg          | Blurry photo     | invoice          | Low-quality OCR; direct debit, so no manual payment needed |

## Expected values

### 01 Health insurance invoice

- sender: Musterkasse Krankenversicherung
- letter date: 29.09.2026
- period: 01.10.2026 – 31.03.2027
- amount: 132,48 €
- due date: 15.11.2026
- reference: X123456789
- IBAN: DE89 3704 0044 0532 0130 00 (valid)
- expected task: pay 132,48 € by 15.11.2026

### 02 Fee notice

- sender: Beitragsstelle Musterland
- letter date: 26.09.2026
- amount: 55,08 €
- due date: 15.10.2026
- reference: 482 113 907
- IBAN: DE02 1203 0000 0000 2020 51 (valid)
- expected task: pay 55,08 € by 15.10.2026

### 03 Appointment (photo)

- sender: Stadt Musterstadt, Ausländerbehörde
- letter date: 30.09.2026
- case number: AB-2026-04417
- appointment: 22.10.2026, 09:30
- location: Zimmer 2.14, Rathausplatz 2
- bring: Reisepass, Immatrikulationsbescheinigung, Mietvertrag, Nachweis über die Krankenversicherung
- cancel by: 3 working days before
- expected tasks: attend 22.10.2026 09:30; prepare documents before

### 04 Payslip

- employer: Café Am Inn GmbH
- period: 09/2026 (01.09.2026 – 30.09.2026)
- total hours: 63,5
- days > 4 h: 3 (04.09., 11.09., 21.09. with 6,5 h)
- days <= 4 h: 11
- gross pay: 882,65 €
- net pay: 815,04 €
- expected work-day effect: +3 full, +11 half = 8,5 full-day equivalents
- expected task: none

### 05 Utility statement (invalid IBAN)

- sender: Hausverwaltung Muster
- letter date: 24.09.2026
- reference: MV-0412
- amount: 86,20 € (back-payment)
- due date: 31.10.2026
- IBAN: DE12 3704 0044 0532 0130 00 -> **fails checksum, state "check"**
- also mentions: new monthly prepayment 95,00 € from November 2026
- expected task: pay 86,20 € by 31.10.2026 (only after the user resolves the IBAN)

### 06 University information

- sender: Universität Musterstadt, Studierendenservice
- letter date: 15.09.2026
- type: information_only
- expected task: none

### 07 Blurry electricity plan (photo)

- sender: Stadtwerke Muster
- letter date: 01.10.2026
- customer number: SW-77120934
- amount: 45,00 € monthly, first on 01.11.2026
- paid by direct debit -> no payment task, at most an info note
- expected: some fields may come back "check" because of image quality
