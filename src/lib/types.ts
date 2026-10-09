/** All money is stored as integer centavos to avoid floating-point errors. */
export type Centavos = number;

export type TxType = "income" | "expense";

export const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "utilities",
  "rent",
  "load_internet",
  "family",
  "debt",
  "health",
  "education",
  "personal",
  "leisure",
  "other",
] as const;

export const INCOME_CATEGORIES = ["salary", "sideline", "allowance", "other_income"] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type CategoryId = ExpenseCategory | IncomeCategory;

export type TxSource = "manual" | "quicklog" | "receipt" | "sample";

export interface Transaction {
  id: string;
  type: TxType;
  category: CategoryId;
  description: string;
  amountCentavos: Centavos;
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  source: TxSource;
  receiptId?: string;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  lineTotalCentavos: Centavos;
}

export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  items: ReceiptItem[];
  totalCentavos: Centavos;
}

export type Budgets = Partial<Record<ExpenseCategory, Centavos>>;

/** One record per local AI call, shown in the Privacy panel. */
export interface AiCallLog {
  id: string;
  at: string;
  task: "quicklog" | "receipt" | "advisor";
  model: string;
  endpoint: string;
  durationMs: number;
  processor: string;
  ok: boolean;
}

export interface AppData {
  version: 1;
  transactions: Transaction[];
  receipts: Receipt[];
  budgets: Budgets;
  aiLog: AiCallLog[];
  isSample: boolean;
}
