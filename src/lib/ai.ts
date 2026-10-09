/**
 * Prompts, output schemas, and the deterministic post-processing applied to every local-model answer.
 * The model proposes; this code validates. Nothing here runs the model, so it is unit-tested directly.
 */
import { EXPENSE_INFO, INCOME_INFO } from "./categories";
import { addDays, isValidISODate } from "./dates";
import { toCentavos } from "./money";
import { isAmountInText } from "./numbers";
import { checkReceipt, sanitizeQuantity, type ReceiptCheck } from "./receipt";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type Centavos,
  type CategoryId,
  type ExpenseCategory,
  type ReceiptItem,
  type TxType,
} from "./types";

const MAX_PESOS = 1_000_000;

const SENT_BY_USER = /\b(nagpadala ako|pinadala ko|ipinadala ko|nagbigay ako|binigyan ko)\b/i;
const RECEIVED_BY_USER = /\b(pinadalhan ako|nakatanggap ako|natanggap ko|binigyan ako)\b/i;
const FAMILY_WORDS = /padala|bigay|nanay|mama|inay|tatay|papa|itay|lola|lolo|kapatid|kuya|ate|anak|pamilya|probinsya/i;

// ---------- Quick-log (Taglish text → records) ----------

export const QUICKLOG_SCHEMA = {
  type: "object",
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["expense", "income"] },
          category: { type: "string", enum: [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES] },
          description: { type: "string" },
          amount: { type: "number" },
          when: { type: "string", enum: ["today", "yesterday"] },
        },
        required: ["type", "category", "description", "amount", "when"],
      },
    },
  },
  required: ["records"],
};

export function quickLogSystemPrompt(): string {
  const exp = EXPENSE_CATEGORIES.map((c) => `- ${c}: ${EXPENSE_INFO[c].hint}`).join("\n");
  const inc = INCOME_CATEGORIES.map((c) => `- ${c}: ${INCOME_INFO[c].hint}`).join("\n");
  return `You turn a Filipino worker's message (English, Tagalog, or Taglish) into money records.
Rules:
- Make one record for every peso amount in the message. Never invent amounts or records.
- amount: copy the number exactly as written. "2k" means 2000 and "1.5k" means 1500.
- type: "income" only for money the user RECEIVED (sweldo, sahod, bayad sa raket, natanggap ko, pinadalhan ako). Everything the user paid, spent, gave, or SENT is "expense".
- Sending money: "nagpadala ako", "pinadala ko", "binigyan ko si nanay" are expenses with category "family". Only "pinadalhan ako" or "nakatanggap ako ng padala" is income.
- category: choose the closest category below.
- description: 2 to 5 words in the user's own language, e.g. "Jeep papuntang trabaho".
- when: "yesterday" only if that specific amount happened kahapon or yesterday; otherwise "today".
- If the message contains no peso amounts, return an empty records list.

Expense categories:
${exp}

Income categories:
${inc}

Examples:
"nagpadala ako kay nanay 2k" → expense, family, amount 2000
"pinadalhan ako ni kuya 1,500" → income, allowance, amount 1500
"bayad sa utang kay Aling Nena 500" → expense, debt, amount 500
"nakabenta ako ng 3 tumbler, 450" → income, sideline, amount 450`;
}

export interface ParsedRecord {
  type: TxType;
  category: CategoryId;
  description: string;
  amountCentavos: Centavos;
  date: string;
  /** False when the amount does not literally appear in what the person typed. */
  amountVerified: boolean;
}

interface RawRecord {
  type?: unknown;
  category?: unknown;
  description?: unknown;
  amount?: unknown;
  when?: unknown;
}

export function normalizeQuickLog(raw: unknown, text: string, today: string): ParsedRecord[] {
  const records = (raw as { records?: RawRecord[] } | null)?.records;
  if (!Array.isArray(records)) return [];
  const out: ParsedRecord[] = [];
  const userSentMoney = SENT_BY_USER.test(text) && !RECEIVED_BY_USER.test(text);
  for (const r of records) {
    if (typeof r.amount !== "number" || !Number.isFinite(r.amount) || r.amount <= 0 || r.amount > MAX_PESOS) continue;
    let type: TxType = r.type === "income" ? "income" : "expense";
    let category = String(r.category) as CategoryId;
    const description = typeof r.description === "string" ? r.description.trim() : "";
    // Small models often read "pinadala ko" (I sent) as income. Sending money to family is too common to get wrong.
    if (type === "income" && userSentMoney && (records.length === 1 || FAMILY_WORDS.test(description))) {
      type = "expense";
      category = "family";
    }
    // Keep type and category consistent even if the model mixes them up.
    if (type === "income" && !(INCOME_CATEGORIES as readonly string[]).includes(category)) category = "other_income";
    if (type === "expense" && !(EXPENSE_CATEGORIES as readonly string[]).includes(category)) category = "other";
    const amountCentavos = toCentavos(r.amount);
    out.push({
      type,
      category,
      description: (description || category).slice(0, 80),
      amountCentavos,
      date: r.when === "yesterday" ? addDays(today, -1) : today,
      amountVerified: isAmountInText(amountCentavos, text),
    });
  }
  return out;
}

// ---------- Receipt / screenshot (image → receipt) ----------

export const RECEIPT_SCHEMA = {
  type: "object",
  properties: {
    merchant: { type: "string" },
    date: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, quantity: { type: "number" }, line_total: { type: "number" } },
        required: ["name", "quantity", "line_total"],
      },
    },
    total: { type: "number" },
    category: { type: "string", enum: [...EXPENSE_CATEGORIES] },
  },
  required: ["merchant", "date", "items", "total", "category"],
};

export const RECEIPT_PROMPT = `Read this receipt or payment screenshot (for example GCash or Maya).
Extract:
- merchant: the store or recipient name.
- date: the transaction date exactly as printed.
- items: each purchased item with its quantity and line_total. line_total is the amount for the whole line (quantity × unit price), not the unit price.
- total: the final TOTAL amount paid.
- category: the best spending category for the whole receipt.
Copy every number exactly as printed. Do not list VAT, subtotal, cash tendered, or change as items.
If it is a payment screenshot without items, return an empty items list and put the amount paid in total.`;

/** Accepts YYYY-MM-DD, MM/DD/YYYY, MM-DD-YYYY, or MM/DD/YY (the usual Philippine receipt formats). */
export function parseReceiptDate(s: string): string | null {
  const t = s.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return isValidISODate(iso[0]) ? iso[0] : null;
  const mdy = t.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  if (mdy) {
    const y = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    const d = `${y}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
    return isValidISODate(d) ? d : null;
  }
  return null;
}

export interface ParsedReceipt {
  merchant: string;
  date: string;
  /** False when the date was missing, unreadable, or implausible and today was used instead. */
  dateFromReceipt: boolean;
  items: ReceiptItem[];
  totalCentavos: Centavos;
  category: ExpenseCategory;
  check: ReceiptCheck;
}

interface RawReceipt {
  merchant?: unknown;
  date?: unknown;
  items?: { name?: unknown; quantity?: unknown; line_total?: unknown }[];
  total?: unknown;
  category?: unknown;
}

export function normalizeReceipt(raw: unknown, today: string): ParsedReceipt | null {
  const r = raw as RawReceipt | null;
  if (!r || typeof r.total !== "number" || !Number.isFinite(r.total) || r.total <= 0 || r.total > MAX_PESOS) return null;
  const items: ReceiptItem[] = (Array.isArray(r.items) ? r.items : [])
    .filter((i) => typeof i.line_total === "number" && Number.isFinite(i.line_total) && i.line_total > 0)
    .map((i) => ({
      name: (typeof i.name === "string" && i.name.trim() ? i.name.trim() : "Item").slice(0, 80),
      quantity: sanitizeQuantity(i.quantity),
      lineTotalCentavos: toCentavos(i.line_total as number),
    }));
  const totalCentavos = toCentavos(r.total);
  const checked = checkReceipt(items, totalCentavos);
  const parsedDate = typeof r.date === "string" ? parseReceiptDate(r.date) : null;
  // A receipt from the future or more than two years back is almost certainly a misread.
  const plausible = parsedDate !== null && parsedDate <= today && parsedDate >= addDays(today, -730);
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(String(r.category)) ? (r.category as ExpenseCategory) : "other";
  return {
    merchant: (typeof r.merchant === "string" && r.merchant.trim() ? r.merchant.trim() : "Receipt").slice(0, 80),
    date: plausible ? parsedDate! : today,
    dateFromReceipt: plausible,
    items: checked.items,
    totalCentavos,
    category,
    check: checked.check,
  };
}

// ---------- Advisor ----------

export const ADVISOR_SYSTEM_PROMPT = `Ikaw si Kita, ang private money assistant ng KitaPH para sa mga Pilipinong manggagawa. You run entirely on the user's own device; their data never leaves it.
RULES:
1. Use ONLY the numbers in the DATA section. Never calculate, estimate, or invent new numbers. If the answer needs a number that is not in DATA, say you don't have that information yet.
2. Reply in the same language the user writes in (Taglish if they write Taglish). Use simple words, friendly, like an ate or kuya who is good with money.
3. Keep the reply under 120 words: one short sentence, then 2 to 4 bullet points with specific next steps.
4. When you mention inflation or wages, name the source (PSA or DOLE) and the month.
5. These are estimates, not professional financial advice. Do not recommend specific investment products, lenders, or apps.`;

export function advisorUserMessage(context: string, question: string): string {
  return `DATA (computed by the KitaPH app from the user's records):\n${context}\n\nQUESTION: ${question}`;
}
