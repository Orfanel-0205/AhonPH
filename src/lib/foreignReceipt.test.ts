import { describe, expect, it } from "vitest";
import { parseForeignReceipt } from "./foreignReceipt";
import { findPrices } from "./traveler";

// What ML Kit's Japanese model read on the phone (Oct 10, 2026) from a sample restaurant receipt photo,
// row by row, misreadings included (ボ for ポ, 搬 for 農, "2.000" for ¥2,000, 伝乗 for 伝票).
const JP_RECEIPT = [
  "領収証",
  "ボスモコキッチン",
  "大阪市中央区搬人橋",
  "Tel:06-1234-5678",
  "に来店ありがとうございます*",
  "2020年5月22日(金)  11:17:45",
  "担当  スタッフA",
  "テーブル:2",
  "商品名",
  "単価  数量  小計",
  "ランチセットA",
  "2.000  3¥6,000(外10店)",
  "ランチセットB",
  "¥2500  3¥7,500(外10店)",
  "※唐揚げ",
  "¥800  3 ¥2,400(内8持)",
  "※ナゲット",
  "¥600  2  ¥1,200(外8持)",
  "オレンジジュース",
  "¥400  6 ¥2,400(内10店)",
  "商品計  19,500",
  "合計  *20,940",
  "(税額  ¥1,842)",
  "8%対象 ¥3,696 (税額¥274)",
  "10%対象 ¥17,250 (税額¥1,568)",
  "信計",
  "VISA",
  "伝乗No.3",
  "No.00000102  5名様",
  "印は軽減税率対象商品",
];

describe("receipts abroad", () => {
  it("reads a Japanese restaurant receipt with two-line items", () => {
    const r = parseForeignReceipt(JP_RECEIPT)!;
    expect(r.store).toBe("ボスモコキッチン");
    expect(r.items).toEqual([
      { name: "ランチセットA", quantity: 3, unit: 2000, total: 6000 },
      { name: "ランチセットB", quantity: 3, unit: 2500, total: 7500 },
      { name: "唐揚げ", quantity: 3, unit: 800, total: 2400 },
      { name: "ナゲット", quantity: 2, unit: 600, total: 1200 },
      { name: "オレンジジュース", quantity: 6, unit: 400, total: 2400 },
    ]);
    expect(r.subtotal).toBe(19500);
    expect(r.total).toBe(20940);
    expect(r.tax).toBe(1842);
    expect(r.payment).toBe("VISA");
    expect(r.check).toEqual({ status: "ok", itemsSum: 19500, against: "subtotal", printed: 19500 });
  });

  it("skips an address with block numbers and reads the AI Lab's sample receipt", () => {
    const r = parseForeignReceipt([
      "居酒屋 さくら",
      "東京都新宿区西新宿1-2-3",
      "TEL 03-0000-0000",
      "2026年10月10日(土)  19:42",
      "生ビール",
      "¥600  2  ¥1,200",
      "枝豆",
      "¥400  1  ¥400",
      "焼き鳥盛り合わせ",
      "¥1,200  1  ¥1,200",
      "唐揚げ",
      "¥700  1  ¥700",
      "親子丼",
      "¥950  1  ¥950",
      "小計  ¥4,450",
      "消費税(10%)  ¥445",
      "合計  ¥4,895",
      "お預り  ¥5,000",
      "お釣り  ¥105",
    ])!;
    expect(r.store).toBe("居酒屋 さくら");
    expect(r.items.map((i) => i.name)).toEqual(["生ビール", "枝豆", "焼き鳥盛り合わせ", "唐揚げ", "親子丼"]);
    expect(r.check).toEqual({ status: "ok", itemsSum: 4450, against: "subtotal", printed: 4450 });
    expect(r.tax).toBe(445);
    expect(r.total).toBe(4895);
  });

  it("rejoins amounts that OCR splits after the comma (¥4, 450)", () => {
    const r = parseForeignReceipt(["生ビール", "¥600  2  ¥1, 200", "親子丼", "¥950  1  ¥950", "小計  ¥2, 150", "合計  ¥2, 365"])!;
    expect(r.items.map((i) => i.total)).toEqual([1200, 950]);
    expect(r.check).toEqual({ status: "ok", itemsSum: 2150, against: "subtotal", printed: 2150 });
    expect(r.total).toBe(2365);
  });

  it("repairs a total whose ¥ sign was read as 4, using subtotal + tax (real phone OCR of the demo receipt)", () => {
    // As read on the phone, Oct 10, 2026: ¥ came out as "Y", "\" and, before the big total, "4".
    const r = parseForeignReceipt([
      "居酒屋さきくら",
      "東京都新宿区西新宿1-2-3",
      "TEL 03-0000-0000",
      "2026年10月10日 (土) 19:42",
      "生ビール",
      "Y600  2  1, 200",
      "枝豆",
      "\\400  1  ¥400",
      "焼き鳥盛り合わせ",
      "¥1, 200  1  ¥1, 200",
      "唐揚げ",
      "¥700  1  ¥700",
      "親子井",
      "Y950  1  ¥950",
      "小計  Y4, 450",
      "消費税 (10%)  Y445",
      "合計  44, 895",
      "お預り  ¥5, 000",
      "お釣り  ¥105",
      "ありがとうございました",
    ])!;
    expect(r.items.map((i) => i.total)).toEqual([1200, 400, 1200, 700, 950]);
    expect(r.check.status).toBe("ok");
    expect(r.total).toBe(4895);
    expect(r.totalRead).toBe(44895);
  });

  it("leaves a tax-inclusive total alone", () => {
    expect(parseForeignReceipt(JP_RECEIPT)!.totalRead).toBeUndefined();
  });

  it("flags items that don't add up", () => {
    const r = parseForeignReceipt(["コーヒー  ¥450", "サンド  ¥600", "合計  ¥1,150"])!;
    expect(r.check.status).toBe("mismatch");
    expect(r.check.itemsSum).toBe(1050);
  });

  it("reads one-row Korean items and a total on the next row", () => {
    const r = parseForeignReceipt(["스타카페", "아메리카노 4,500 2 9,000", "치즈케이크 6,500 1 6,500", "합계", "15,500원", "카드"])!;
    expect(r.items.map((i) => [i.name, i.quantity, i.total])).toEqual([
      ["아메리카노", 2, 9000],
      ["치즈케이크", 1, 6500],
    ]);
    expect(r.total).toBe(15500);
    expect(r.check.status).toBe("ok");
    expect(r.payment).toBe("카드");
  });

  it("keeps decimals for Chinese yuan", () => {
    const r = parseForeignReceipt(["牛肉面  ¥28.50", "可乐  ¥6.00", "合计  ¥34.50"], { wholeNumbers: false })!;
    expect(r.total).toBe(34.5);
    expect(r.check.status).toBe("ok");
  });

  it("does not take a table number for a price", () => {
    expect(findPrices(JP_RECEIPT, "JPY", null).map((p) => p.label)).not.toContain("テーブル");
  });
});
