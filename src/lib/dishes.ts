/**
 * Hand-checked dishes and drinks a Filipino traveler meets most in Japan, Korea, China, Taiwan and
 * Hong Kong. Used before any AI: a known dish gets this name and note, and its "contains" list is
 * a fact, not a guess. The AI only names what is not here. Written during the hackathon.
 */

export type Contains = "pork" | "beef" | "chicken" | "seafood" | "egg" | "alcohol" | "peanut";

export interface Dish {
  /** As printed (Japanese, Korean, Chinese, simplified and traditional). Longest match wins. */
  names: string[];
  en: string;
  note: string;
  /** Always or almost always in it. "Often" goes in the note instead. */
  contains: Contains[];
  /** Words people say for it (romaji, English), for splitting a bill by voice. */
  say: string[];
}

export const DISHES: Dish[] = [
  // ---------- Japan ----------
  { names: ["ノンアルコールビール", "ノンアルビール"], en: "Non-alcoholic beer", note: "Beer-taste drink without alcohol.", contains: [], say: ["drinks", "inumin", "non-alcoholic beer"] },
  { names: ["生ビール", "ビール", "生ビ"], en: "Draft beer", note: "Beer on tap.", contains: ["alcohol"], say: ["drinks", "inumin", "beer", "nama", "biiru"] },
  { names: ["焼きそば", "焼そば"], en: "Yakisoba", note: "Stir-fried wheat noodles, usually with pork and cabbage.", contains: ["pork"], say: ["yakisoba"] },
  { names: ["枝豆"], en: "Edamame", note: "Boiled young soybeans with salt.", contains: [], say: ["edamame", "soybeans"] },
  { names: ["焼き鳥盛り合わせ", "焼鳥盛り合わせ", "串盛り合わせ"], en: "Assorted yakitori", note: "Grilled skewers, mostly chicken; some shops add pork.", contains: ["chicken"], say: ["yakitori", "skewers", "barbecue"] },
  { names: ["焼き鳥", "焼鳥", "やきとり"], en: "Yakitori", note: "Grilled chicken skewers; some shops add pork.", contains: ["chicken"], say: ["yakitori", "skewers", "barbecue"] },
  { names: ["唐揚げ", "からあげ", "唐揚"], en: "Karaage", note: "Japanese fried chicken.", contains: ["chicken"], say: ["karaage", "fried chicken"] },
  { names: ["親子丼"], en: "Oyakodon", note: "Rice bowl of chicken simmered with egg and onion.", contains: ["chicken", "egg"], say: ["oyakodon", "chicken and egg"] },
  { names: ["牛丼"], en: "Gyudon", note: "Rice bowl of thin-sliced beef and onion.", contains: ["beef"], say: ["gyudon", "beef bowl"] },
  { names: ["カツ丼", "かつ丼"], en: "Katsudon", note: "Rice bowl with breaded pork cutlet and egg.", contains: ["pork", "egg"], say: ["katsudon", "katsu"] },
  { names: ["天丼"], en: "Tendon", note: "Rice bowl with tempura, usually shrimp and vegetables.", contains: ["seafood"], say: ["tendon", "tempura bowl"] },
  { names: ["海鮮丼"], en: "Kaisendon", note: "Rice bowl topped with raw seafood.", contains: ["seafood"], say: ["kaisendon", "seafood bowl"] },
  { names: ["とんかつ定食", "トンカツ定食"], en: "Tonkatsu set meal", note: "Breaded pork cutlet with rice, miso soup and cabbage.", contains: ["pork"], say: ["tonkatsu", "pork cutlet"] },
  { names: ["とんかつ", "トンカツ"], en: "Tonkatsu", note: "Breaded deep-fried pork cutlet.", contains: ["pork"], say: ["tonkatsu", "pork cutlet"] },
  { names: ["醤油ラーメン", "しょうゆラーメン"], en: "Shoyu ramen", note: "Noodle soup in soy-sauce broth, usually with chashu pork.", contains: ["pork"], say: ["ramen", "shoyu"] },
  { names: ["味噌ラーメン", "みそラーメン"], en: "Miso ramen", note: "Noodle soup in miso broth, usually with pork.", contains: ["pork"], say: ["ramen", "miso ramen"] },
  { names: ["豚骨ラーメン", "とんこつラーメン"], en: "Tonkotsu ramen", note: "Noodle soup in rich pork-bone broth.", contains: ["pork"], say: ["ramen", "tonkotsu"] },
  { names: ["ラーメン"], en: "Ramen", note: "Noodle soup; the broth and chashu are usually pork.", contains: ["pork"], say: ["ramen"] },
  { names: ["餃子", "ギョーザ", "ぎょうざ"], en: "Gyoza", note: "Pan-fried dumplings, usually pork and cabbage.", contains: ["pork"], say: ["gyoza", "dumplings"] },
  { names: ["寿司", "すし", "鮨"], en: "Sushi", note: "Vinegared rice with raw fish or seafood.", contains: ["seafood"], say: ["sushi"] },
  { names: ["刺身", "お造り"], en: "Sashimi", note: "Sliced raw fish.", contains: ["seafood"], say: ["sashimi"] },
  { names: ["天ぷら", "天麩羅"], en: "Tempura", note: "Battered and fried shrimp, fish or vegetables.", contains: ["seafood"], say: ["tempura"] },
  { names: ["うどん"], en: "Udon", note: "Thick wheat noodles in broth made with fish stock.", contains: ["seafood"], say: ["udon"] },
  { names: ["そば", "蕎麦"], en: "Soba", note: "Buckwheat noodles; the dipping broth has fish stock.", contains: ["seafood"], say: ["soba"] },
  { names: ["お好み焼き"], en: "Okonomiyaki", note: "Savory cabbage pancake, often with pork or seafood.", contains: ["egg"], say: ["okonomiyaki"] },
  { names: ["たこ焼き", "たこ焼"], en: "Takoyaki", note: "Batter balls with octopus pieces.", contains: ["seafood"], say: ["takoyaki"] },
  { names: ["味噌汁", "みそ汁"], en: "Miso soup", note: "Soybean-paste soup with tofu and seaweed; fish-stock base.", contains: ["seafood"], say: ["miso soup"] },
  { names: ["豚汁"], en: "Tonjiru", note: "Miso soup with pork and vegetables.", contains: ["pork"], say: ["tonjiru", "pork soup"] },
  { names: ["カレーライス", "カレー"], en: "Japanese curry rice", note: "Mild curry with rice, often with beef or pork.", contains: [], say: ["curry"] },
  { names: ["鯖の味噌煮", "さばの味噌煮"], en: "Saba misoni", note: "Mackerel simmered in miso.", contains: ["seafood"], say: ["saba", "mackerel"] },
  { names: ["焼き魚", "焼魚"], en: "Grilled fish", note: "Grilled fish of the day.", contains: ["seafood"], say: ["grilled fish", "fish"] },
  { names: ["茶碗蒸し"], en: "Chawanmushi", note: "Savory steamed egg custard, often with shrimp and chicken.", contains: ["egg"], say: ["chawanmushi"] },
  { names: ["おにぎり", "お握り"], en: "Onigiri", note: "Rice ball in seaweed; fillings vary (salmon, tuna, plum).", contains: [], say: ["onigiri", "rice ball"] },
  { names: ["しゃぶしゃぶ"], en: "Shabu-shabu", note: "Hot pot of thin-sliced beef or pork swirled in broth.", contains: [], say: ["shabu", "hot pot"] },
  { names: ["すき焼き"], en: "Sukiyaki", note: "Sweet soy hot pot with beef, dipped in raw egg.", contains: ["beef", "egg"], say: ["sukiyaki"] },
  { names: ["焼肉"], en: "Yakiniku", note: "Grill-it-yourself meat, mostly beef; pork too.", contains: ["beef"], say: ["yakiniku", "grill"] },
  { names: ["チキンナゲット", "ナゲット"], en: "Chicken nuggets", note: "Breaded fried chicken pieces.", contains: ["chicken"], say: ["nuggets"] },
  { names: ["日本酒"], en: "Sake", note: "Japanese rice wine.", contains: ["alcohol"], say: ["drinks", "inumin", "sake"] },
  { names: ["焼酎"], en: "Shochu", note: "Japanese distilled spirit.", contains: ["alcohol"], say: ["drinks", "inumin", "shochu"] },
  { names: ["ハイボール"], en: "Highball", note: "Whisky and soda.", contains: ["alcohol"], say: ["drinks", "inumin", "highball"] },
  { names: ["梅酒"], en: "Plum wine", note: "Sweet plum liqueur.", contains: ["alcohol"], say: ["drinks", "inumin", "plum wine", "umeshu"] },
  { names: ["ウーロン茶", "烏龍茶"], en: "Oolong tea", note: "Cold or hot oolong tea.", contains: [], say: ["drinks", "inumin", "oolong", "tea"] },
  { names: ["緑茶", "お茶"], en: "Green tea", note: "Japanese green tea.", contains: [], say: ["drinks", "inumin", "green tea", "tea"] },
  { names: ["オレンジジュース"], en: "Orange juice", note: "Orange juice.", contains: [], say: ["drinks", "inumin", "orange juice", "juice"] },
  { names: ["ランチセット"], en: "Lunch set", note: "Set meal; ask what's in it.", contains: [], say: ["lunch set", "set"] },
  // ---------- Korea ----------
  { names: ["김치찌개"], en: "Kimchi jjigae", note: "Spicy kimchi stew, usually with pork and tofu.", contains: ["pork"], say: ["kimchi stew", "jjigae"] },
  { names: ["된장찌개"], en: "Doenjang jjigae", note: "Soybean-paste stew with tofu; may have seafood or beef.", contains: [], say: ["doenjang", "soybean stew"] },
  { names: ["순두부찌개"], en: "Sundubu jjigae", note: "Spicy soft-tofu stew, often with seafood or pork.", contains: [], say: ["sundubu", "tofu stew"] },
  { names: ["비빔밥"], en: "Bibimbap", note: "Rice with vegetables, chili paste and egg; often a little beef.", contains: ["egg"], say: ["bibimbap"] },
  { names: ["불고기"], en: "Bulgogi", note: "Sweet marinated grilled beef.", contains: ["beef"], say: ["bulgogi"] },
  { names: ["삼겹살"], en: "Samgyeopsal", note: "Grilled pork belly.", contains: ["pork"], say: ["samgyeopsal", "pork belly"] },
  { names: ["떡볶이"], en: "Tteokbokki", note: "Chewy rice cakes in spicy sauce, often with fish cakes.", contains: [], say: ["tteokbokki"] },
  { names: ["김밥"], en: "Gimbap", note: "Seaweed rice rolls; fillings often ham, egg and crab stick.", contains: [], say: ["gimbap", "kimbap"] },
  { names: ["냉면"], en: "Naengmyeon", note: "Cold buckwheat noodles in beef broth.", contains: ["beef"], say: ["naengmyeon", "cold noodles"] },
  { names: ["양념치킨", "치킨"], en: "Korean fried chicken", note: "Crispy fried chicken, plain or in sweet-spicy sauce.", contains: ["chicken"], say: ["chicken", "fried chicken"] },
  { names: ["삼계탕"], en: "Samgyetang", note: "Whole young chicken soup with ginseng.", contains: ["chicken"], say: ["samgyetang", "chicken soup"] },
  { names: ["소주"], en: "Soju", note: "Korean distilled spirit.", contains: ["alcohol"], say: ["drinks", "inumin", "soju"] },
  { names: ["막걸리"], en: "Makgeolli", note: "Milky rice wine.", contains: ["alcohol"], say: ["drinks", "inumin", "makgeolli"] },
  { names: ["맥주"], en: "Beer", note: "Beer.", contains: ["alcohol"], say: ["drinks", "inumin", "beer"] },
  // ---------- China, Taiwan, Hong Kong ----------
  { names: ["小笼包", "小籠包"], en: "Xiaolongbao", note: "Soup dumplings, usually pork.", contains: ["pork"], say: ["xiaolongbao", "soup dumplings"] },
  { names: ["饺子", "水饺", "水餃"], en: "Jiaozi", note: "Boiled dumplings, often pork.", contains: ["pork"], say: ["dumplings", "jiaozi"] },
  { names: ["扬州炒饭", "揚州炒飯", "炒饭", "炒飯"], en: "Fried rice", note: "Fried rice, often with egg and pork or shrimp.", contains: ["egg"], say: ["fried rice"] },
  { names: ["麻婆豆腐"], en: "Mapo tofu", note: "Spicy tofu, usually with minced pork or beef.", contains: [], say: ["mapo tofu", "tofu"] },
  { names: ["宫保鸡丁", "宮保雞丁"], en: "Kung pao chicken", note: "Stir-fried chicken with peanuts and chili.", contains: ["chicken", "peanut"], say: ["kung pao"] },
  { names: ["北京烤鸭", "北京烤鴨", "烤鸭", "烤鴨"], en: "Peking duck", note: "Roast duck with thin pancakes.", contains: [], say: ["peking duck", "duck"] },
  { names: ["牛肉面", "牛肉麵"], en: "Beef noodle soup", note: "Noodles in beef broth with braised beef.", contains: ["beef"], say: ["beef noodles"] },
  { names: ["珍珠奶茶"], en: "Bubble milk tea", note: "Milk tea with tapioca pearls.", contains: [], say: ["drinks", "inumin", "milk tea", "bubble tea"] },
  { names: ["叉烧饭", "叉燒飯", "叉烧", "叉燒"], en: "Char siu", note: "Sweet barbecued pork.", contains: ["pork"], say: ["char siu", "barbecue pork"] },
  { names: ["云吞面", "雲吞麵", "馄饨", "餛飩"], en: "Wonton noodles", note: "Noodle soup with shrimp-and-pork wontons.", contains: ["pork", "seafood"], say: ["wonton"] },
  { names: ["糖醋排骨"], en: "Sweet and sour pork ribs", note: "Pork ribs in sweet and sour sauce.", contains: ["pork"], say: ["sweet and sour"] },
  { names: ["担担面", "擔擔麵"], en: "Dandan noodles", note: "Spicy sesame noodles with minced pork.", contains: ["pork"], say: ["dandan"] },
  { names: ["啤酒"], en: "Beer", note: "Beer.", contains: ["alcohol"], say: ["drinks", "inumin", "beer"] },
];

const norm = (s: string) => s.replace(/[\s※*・()（）]/g, "");

// Every name with its dish, longest first, so 醤油ラーメン wins over ラーメン.
const INDEX = DISHES.flatMap((d) => d.names.map((n) => ({ n: norm(n), d }))).sort((a, b) => b.n.length - a.n.length);

/** The hand-checked dish named in a menu or receipt line, if any. */
export function lookupDish(line: string): Dish | null {
  const l = norm(line);
  if (!l) return null;
  return INDEX.find((e) => l.includes(e.n))?.d ?? null;
}

/** "Contains: pork, egg" for the facts we are sure of. */
export function containsNote(d: Dish): string {
  return d.contains.length ? `Contains: ${d.contains.join(", ")}.` : "";
}
