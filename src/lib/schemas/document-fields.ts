/**
 * Fixed field definitions per document type. The AI extraction schema and the
 * validation rules are both derived from these.
 */

export const documentTypes = [
  "invoice",
  "appointment",
  "decision_letter",
  "contract",
  "payslip",
  "information_only",
  "other",
] as const;

export type DocumentTypeKey = (typeof documentTypes)[number];

export type FieldKind =
  "text" | "date" | "time" | "month" | "amount" | "iban" | "reference" | "integer" | "number";

export type FieldDefinition = {
  key: string;
  kind: FieldKind;
  required: boolean;
  /** Instruction for the model: what to look for. */
  description: string;
  /** May be marked "not stated in document" in Review (payslips without a day breakdown). */
  canBeNotStated?: boolean;
};

const field = (
  key: string,
  kind: FieldKind,
  description: string,
  required = false,
): FieldDefinition => ({ key, kind, required, description });

const sender = field("sender", "text", "Organisation or person that sent the letter.", true);
const letterDate = field("letter_date", "date", "Date printed on the letter.");

export const documentFields: Record<DocumentTypeKey, FieldDefinition[]> = {
  invoice: [
    sender,
    letterDate,
    field("amount", "amount", "Total amount to pay, including currency symbol if shown.", true),
    field("due_date", "date", "Date by which the amount must be paid.", true),
    field("reference", "reference", "Payment reference, customer, contract or insurance number."),
    field("iban", "iban", "IBAN the payment should go to."),
    field("period", "text", "Billing period the invoice covers."),
    field(
      "payment_method",
      "text",
      "How the amount is paid: by the recipient (bank transfer, Überweisung) or collected by the sender (direct debit, SEPA-Lastschrift, Abbuchung). Copy the wording from the letter.",
    ),
  ],
  appointment: [
    sender,
    letterDate,
    field("appointment_date", "date", "Date of the appointment.", true),
    field("time", "time", "Start time of the appointment.", true),
    field("location", "text", "Address and room of the appointment.", true),
    field("bring", "text", "Documents or items the recipient must bring."),
    field("case_number", "reference", "Case number (Aktenzeichen) or file reference."),
  ],
  decision_letter: [
    sender,
    field("letter_date", "date", "Date printed on the letter.", true),
    field("subject", "text", "What the decision is about.", true),
    field("decision", "text", "The decision itself, e.g. approved, rejected, amount granted."),
    field("case_number", "reference", "Case number (Aktenzeichen) or file reference."),
    field("response_deadline", "date", "Deadline to object or respond (Widerspruchsfrist)."),
    field("amount", "amount", "Amount granted or demanded, if any."),
  ],
  contract: [
    sender,
    letterDate,
    field("subject", "text", "What the contract is about.", true),
    field("start_date", "date", "Date the contract starts."),
    field("end_date", "date", "Date the contract ends, if fixed."),
    field("notice_period", "text", "Notice period for cancellation."),
    field("monthly_amount", "amount", "Recurring monthly amount."),
    field("reference", "reference", "Contract or customer number."),
  ],
  payslip: [
    field("sender", "text", "Employer that issued the payslip.", true),
    field("period", "month", "Month the payslip covers.", true),
    field("total_hours", "number", "Total hours worked in the period."),
    {
      ...field(
        "full_days",
        "integer",
        "Number of days with more than 4 hours of work, only if the payslip states it or lists hours per day. Monthly salary slips usually do not: then return null. Never return 0 for a number that is not stated, and never estimate.",
        true,
      ),
      canBeNotStated: true,
    },
    {
      ...field(
        "half_days",
        "integer",
        "Number of days with 4 hours of work or less, only if the payslip states it or lists hours per day. Monthly salary slips usually do not: then return null. Never return 0 for a number that is not stated, and never estimate.",
        true,
      ),
      canBeNotStated: true,
    },
    field("gross_pay", "amount", "Gross pay for the period."),
    field("net_pay", "amount", "Net pay for the period."),
  ],
  information_only: [sender, letterDate, field("subject", "text", "What the letter is about.")],
  other: [
    sender,
    letterDate,
    field("subject", "text", "What the letter is about."),
    field("deadline", "date", "Any deadline mentioned in the letter."),
    field("reference", "reference", "Any reference or case number."),
  ],
};

/** Fields that are deadlines and must lie after the letter date. */
export const deadlineFields = ["due_date", "appointment_date", "response_deadline", "deadline"];
