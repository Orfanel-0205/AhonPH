/**
 * Receipts abroad (Japan, Korea, China, Taiwan, Hong Kong). They differ from Philippine receipts:
 * whole-yen/won amounts, labels like 合計 / 합계 / 合计, tax-type marks like (外10店), and items
 * printed on two lines (name, then "unit  qty  line total"). Amounts are in the receipt's currency.
 */

export interface ForeignItem {
  name: string;
  quantity: number;
  /** Unit price, when the receipt prints one. */
  unit: number | null;
  total: number;
}

export interface ForeignReceipt {
  store: string | null;
  items: ForeignItem[];
  subtotal: number | null;
  total: number | null;
  tax: number | null;
  payment: string | null;
  /** Items must add up to the subtotal (or the total when there is no subtotal). */
  check: { status: "ok" | "mismatch" | "unknown"; itemsSum: number; against: "subtotal" | "total" | null; printed: number | null };
}

const TOTAL = /(合\s*計|総合計|お会計|ご請求|합\s*계|총\s*액|결제\s*금액|合计|总计|總計|應付|应付|\bTOTAL\b)/i;
const SUBTOTAL = /(小\s*計|商品計|小计|소\s*계|\bSUB\s*-?\s*TOTAL\b)/i;
const TAX = /(税額|消費税|内税|外税|부가세|세액|税额|增值税|\bTAX\b)/i;
const PAYMENT = /\b(VISA|MASTER(?:CARD)?|JCB|AMEX|DINERS|UNIONPAY|PAYPAY|SUICA|PASMO|ALIPAY|WECHAT)\b|現金|クレジット|신용|카드|现金|現金|微信|支付宝/i;
/** Rows that hold numbers but are not items: dates, phone, slip and table numbers, change, tax bases. */
const SKIP =
  /(Tel|TEL|電話|No\.|伝票|担当|テーブル|卓|名様|人数|領収|レシート|年.*月.*日|\d{1,2}:\d{2}|お預|預り|お釣|釣銭|現計|信計|対象|ポイント|받은|거스름|테이블|번호|영수증|实收|找零|桌|发票|收据|点数|\bCHANGE\b|\bCASH\b)/i;
const HEADER = /^(商品名|品名|単価|数量|金額|상품명|단가|수량|금액|品名|单价|数量|金额|\s)+$/;
/** Tax-type marks printed after an amount: (外10店), (内8持), ※. */
const TAX_MARK = /[(（](?:外|内|税)[^)）]*[)）]|※|\*/g;

/** Amount tokens: "¥2,500", "2,500円", "₩9,000", "128.00", and "2.000" (a misread "2,000" in whole-number currencies). */
const AMOUNT = /[¥￥₩$]?\s?(\d{1,3}(?:[,，]\d{3})+(?:\.\d{1,2})?|\d{1,3}\.\d{3}(?!\d)|\d+(?:\.\d{1,2})?)\s*(?:円|원|元)?/g;

function amounts(row: string, wholeNumbers: boolean): number[] {
  const out: number[] = [];
  for (const m of row.matchAll(AMOUNT)) {
    let t = m[1].replace(/[,，]/g, "");
    if (wholeNumbers && /^\d{1,3}\.\d{3}$/.test(m[1])) t = m[1].replace(".", "");
    const v = Number(t);
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
const cleanName = (s: string) =>
  s
    .replace(TAX_MARK, "")
    .replace(/[\s:：.…\-]+$/u, "")
    .trim();

/** "unit qty total" when unit × qty = total; otherwise the last number is the line total. */
function itemNumbers(nums: number[]): { quantity: number; unit: number | null; total: number } | null {
  if (!nums.length) return null;
  if (nums.length >= 3) {
    const [unit, qty, total] = nums.slice(-3);
    if (Number.isInteger(qty) && qty > 0 && qty < 100 && Math.abs(unit * qty - total) < 0.01) return { quantity: qty, unit, total };
  }
  if (nums.length === 2) {
    const [a, b] = nums;
    // "qty total" (2  ¥1,200) or "unit total" with qty 1.
    if (Number.isInteger(a) && a > 0 && a < 100 && b >= a) return { quantity: a, unit: b / a, total: b };
  }
  return { quantity: 1, unit: null, total: nums[nums.length - 1] };
}

export function parseForeignReceipt(rows: string[], opts: { wholeNumbers?: boolean } = {}): ForeignReceipt | null {
  const whole = opts.wholeNumbers ?? true;
  const items: ForeignItem[] = [];
  let store: string | null = null;
  let subtotal: number | null = null;
  let total: number | null = null;
  let tax: number | null = null;
  let payment: string | null = null;
  let pendingName: string | null = null;
  let awaiting: "total" | "subtotal" | null = null;

  for (const raw of rows) {
    const row = raw.trim();
    if (!row) continue;
    const pay = row.match(PAYMENT);
    if (pay && !payment) payment = pay[0].toUpperCase();

    // Tax lines keep their parentheses: "(税額 ¥1,842)". Tax bases ("8%対象 ¥3,696") are skipped.
    if (TAX.test(row) && !/対象|과세|应税/.test(row)) {
      const n = amounts(row.replace(/\d+(?:\.\d+)?\s?%/g, ""), whole);
      if (n.length && tax === null) tax = n[n.length - 1];
      continue;
    }
    const body = row.replace(TAX_MARK, " ");
    const nums = amounts(body, whole);

    if (TOTAL.test(row) && !SUBTOTAL.test(row)) {
      if (nums.length) total = nums[nums.length - 1];
      else awaiting = "total";
      pendingName = null;
      continue;
    }
    if (SUBTOTAL.test(row)) {
      // "単価 数量 小計" is a column header, not a subtotal.
      if (nums.length) subtotal = nums[nums.length - 1];
      else if (letters(row.replace(SUBTOTAL, "")) === 0) awaiting = "subtotal";
      pendingName = null;
      continue;
    }
    if (awaiting && nums.length && letters(body.replace(/円|원|元/g, "")) === 0) {
      if (awaiting === "total") total = nums[nums.length - 1];
      else subtotal = nums[nums.length - 1];
      awaiting = null;
      continue;
    }
    awaiting = null;
    if (SKIP.test(row) || HEADER.test(row)) {
      pendingName = null;
      continue;
    }

    const firstAmount = body.search(/[¥￥₩$]?\s?\d/);
    const label = cleanName(firstAmount >= 0 ? body.slice(0, firstAmount) : body);
    if (letters(label) >= 2 && nums.length) {
      // Name and numbers on one row: "アメリカノ 4,500 2 9,000".
      const n = itemNumbers(amounts(body.slice(firstAmount), whole));
      if (n && n.total > 0) items.push({ name: label, ...n });
      pendingName = null;
    } else if (letters(label) >= 2) {
      if (!store && !items.length) store = label;
      else pendingName = label;
    } else if (nums.length && pendingName) {
      // Numbers on the row after the name: "¥2,500  3  ¥7,500".
      const n = itemNumbers(nums);
      if (n && n.total > 0) items.push({ name: pendingName, ...n });
      pendingName = null;
    }
  }

  if (!items.length && total === null) return null;
  const itemsSum = Math.round(items.reduce((a, i) => a + i.total, 0) * 100) / 100;
  const against = subtotal !== null ? "subtotal" : total !== null ? "total" : null;
  const printed = against === "subtotal" ? subtotal : total;
  const status = !items.length || printed === null ? "unknown" : Math.abs(itemsSum - printed) < 0.01 ? "ok" : "mismatch";
  return { store, items, subtotal, total, tax, payment, check: { status, itemsSum, against, printed } };
}
