import type { CategoryId, ExpenseCategory, IncomeCategory } from "./types";

export interface CategoryInfo {
  label: string;
  tagalog: string;
  /** Essentials are hard to cut; flexible spending is where savings usually come from. */
  essential: boolean;
  /** Hint given to the local model when it classifies Taglish text. */
  hint: string;
}

export const EXPENSE_INFO: Record<ExpenseCategory, CategoryInfo> = {
  food: { label: "Food", tagalog: "Pagkain", essential: true, hint: "meals, karinderya, groceries, palengke, rice, ulam, snacks, coffee" },
  transport: { label: "Transport", tagalog: "Pamasahe", essential: true, hint: "jeep, bus, MRT/LRT, tricycle, Grab, Angkas, gasolina" },
  utilities: { label: "Bills", tagalog: "Kuryente at tubig", essential: true, hint: "Meralco, electricity, water, Maynilad, Manila Water, LPG/gasul" },
  rent: { label: "Rent", tagalog: "Upa", essential: true, hint: "rent, upa, boarding house, dorm, bedspace" },
  load_internet: { label: "Load & internet", tagalog: "Load", essential: false, hint: "Globe, Smart, TNT, DITO, prepaid load, promo, wifi, PLDT, Converge" },
  family: { label: "Family support", tagalog: "Padala", essential: true, hint: "nagpadala ako, pinadala sa probinsya, allowance na binigay ko sa kapatid, bigay kay nanay" },
  debt: { label: "Debt payments", tagalog: "Utang", essential: true, hint: "utang, loan, hulugan, Home Credit, credit card, SSS loan, 5-6" },
  health: { label: "Health", tagalog: "Kalusugan", essential: true, hint: "gamot, medicine, check-up, clinic, vitamins" },
  education: { label: "Education", tagalog: "Pag-aaral", essential: true, hint: "tuition, school supplies, baon ng anak, projects" },
  personal: { label: "Personal & shopping", tagalog: "Personal", essential: false, hint: "Shopee, Lazada, clothes, sapatos, toiletries, haircut" },
  leisure: { label: "Leisure", tagalog: "Libangan", essential: false, hint: "gimik, inuman, movies, Netflix, milk tea, games, lakad" },
  other: { label: "Other", tagalog: "Iba pa", essential: false, hint: "anything that does not fit the other categories" },
};

export const INCOME_INFO: Record<IncomeCategory, { label: string; tagalog: string; hint: string }> = {
  salary: { label: "Salary", tagalog: "Sweldo", hint: "sweldo, sahod, kinsenas, payroll" },
  sideline: { label: "Sideline", tagalog: "Raket", hint: "raket, sideline, online selling, freelance, tip" },
  allowance: { label: "Allowance / support", tagalog: "Allowance", hint: "allowance received, pinadalhan ako, ayuda, bonus, 13th month" },
  other_income: { label: "Other income", tagalog: "Iba pang kita", hint: "any other money received" },
};

export function categoryLabel(id: CategoryId): string {
  if (id in EXPENSE_INFO) return EXPENSE_INFO[id as ExpenseCategory].label;
  return INCOME_INFO[id as IncomeCategory].label;
}

export function isEssential(id: CategoryId): boolean {
  return id in EXPENSE_INFO && EXPENSE_INFO[id as ExpenseCategory].essential;
}
