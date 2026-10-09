/**
 * Trip planner. Places and typical costs for the destinations Filipinos visit most, bundled so planning
 * works offline. Fees and daily costs are LakbayMate's rough estimates for 2026 (per person, in the
 * local currency), shown as "about" with a "check before you go" note; they are not live prices.
 * Code builds the plan and every total; the AI only adds friendly words on top.
 */
import type { CurrencyCode } from "./rates";

export type Aspect = "food" | "culture" | "shopping" | "views" | "nature" | "theme" | "nightlife";
export type Tier = 1 | 2 | 3;

export const ASPECTS: { id: Aspect; label: string; emoji: string }[] = [
  { id: "food", label: "Food", emoji: "🍜" },
  { id: "culture", label: "Culture", emoji: "⛩️" },
  { id: "shopping", label: "Shopping", emoji: "🛍️" },
  { id: "views", label: "Views", emoji: "🌆" },
  { id: "nature", label: "Nature", emoji: "🌳" },
  { id: "theme", label: "Theme parks", emoji: "🎢" },
  { id: "nightlife", label: "Nightlife", emoji: "🌙" },
];

export const TIERS: { id: Tier; label: string; sub: string }[] = [
  { id: 1, label: "Tipid", sub: "Budget" },
  { id: 2, label: "Sakto", sub: "A bit pricey" },
  { id: 3, label: "Bongga", sub: "Splurge" },
];

export interface Place {
  name: string;
  local: string;
  area: string;
  tags: Aspect[];
  /** Typical spend per person in the local currency (ticket, or food at a market). */
  fee: number;
  /** 1: fine on any budget; 2: Sakto and up; 3: Bongga only. */
  level: Tier;
  note: string;
}

export interface City {
  id: string;
  name: string;
  country: string;
  currency: CurrencyCode;
  /** Per person per day, by tier [Tipid, Sakto, Bongga]. */
  food: [number, number, number];
  transport: [number, number, number];
  /** Per room per night, by tier. */
  hotel: [number, number, number];
  places: Place[];
}

export const CITIES: City[] = [
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    currency: "JPY",
    food: [3000, 6000, 15000],
    transport: [1000, 1500, 4000],
    hotel: [8000, 18000, 45000],
    places: [
      { name: "Senso-ji and Nakamise", local: "浅草寺", area: "Asakusa", tags: ["culture", "food", "shopping"], fee: 0, level: 1, note: "Free temple; snacks on Nakamise street extra." },
      { name: "Meiji Jingu", local: "明治神宮", area: "Harajuku", tags: ["culture", "nature"], fee: 0, level: 1, note: "Free shrine in a forest; Takeshita Street is next door." },
      { name: "Tsukiji Outer Market", local: "築地場外市場", area: "Tsukiji", tags: ["food"], fee: 2500, level: 1, note: "Seafood and street food; go before noon." },
      { name: "Ueno Park and Ameyoko", local: "上野公園・アメ横", area: "Ueno", tags: ["nature", "shopping", "food"], fee: 0, level: 1, note: "Free park; Ameyoko market for cheap snacks." },
      { name: "Akihabara", local: "秋葉原", area: "Akihabara", tags: ["shopping", "nightlife"], fee: 0, level: 1, note: "Anime, games and electronics." },
      { name: "Shibuya Crossing and Shibuya Sky", local: "渋谷スカイ", area: "Shibuya", tags: ["views", "shopping"], fee: 2700, level: 2, note: "Rooftop view; book a sunset slot." },
      { name: "Tokyo Skytree", local: "東京スカイツリー", area: "Asakusa", tags: ["views"], fee: 3100, level: 2, note: "Tallest tower in Japan; next to Asakusa." },
      { name: "teamLab Planets", local: "チームラボプラネッツ", area: "Toyosu", tags: ["culture", "views"], fee: 4000, level: 2, note: "Walk-through digital art; book ahead." },
      { name: "Omoide Yokocho and Golden Gai", local: "思い出横丁", area: "Shinjuku", tags: ["nightlife", "food"], fee: 3000, level: 2, note: "Tiny bars and yakitori stalls." },
      { name: "Tokyo DisneySea", local: "東京ディズニーシー", area: "Maihama", tags: ["theme"], fee: 10000, level: 3, note: "Full day; prices vary by date." },
    ],
  },
  {
    id: "osaka",
    name: "Osaka",
    country: "Japan",
    currency: "JPY",
    food: [2800, 5500, 14000],
    transport: [900, 1400, 3500],
    hotel: [7000, 15000, 40000],
    places: [
      { name: "Dotonbori", local: "道頓堀", area: "Namba", tags: ["food", "nightlife", "shopping"], fee: 2000, level: 1, note: "Takoyaki, okonomiyaki and the neon signs." },
      { name: "Osaka Castle", local: "大阪城", area: "Osaka Castle", tags: ["culture", "nature"], fee: 1200, level: 1, note: "Park is free; the tower museum has a fee." },
      { name: "Shinsekai and Tsutenkaku", local: "新世界・通天閣", area: "Shinsekai", tags: ["food", "views"], fee: 1200, level: 1, note: "Kushikatsu alley and a retro tower." },
      { name: "Nara Park day trip", local: "奈良公園", area: "Nara", tags: ["nature", "culture"], fee: 1500, level: 1, note: "Deer and Todai-ji; about 45 min by train." },
      { name: "Kuromon Market", local: "黒門市場", area: "Namba", tags: ["food"], fee: 3000, level: 2, note: "Fresh seafood and wagyu skewers." },
      { name: "Umeda Sky Building", local: "梅田スカイビル", area: "Umeda", tags: ["views"], fee: 2000, level: 2, note: "Open-air rooftop; best at night." },
      { name: "Universal Studios Japan", local: "ユニバーサル・スタジオ・ジャパン", area: "Bay Area", tags: ["theme"], fee: 10000, level: 3, note: "Full day; Express Pass costs extra." },
    ],
  },
  {
    id: "seoul",
    name: "Seoul",
    country: "South Korea",
    currency: "KRW",
    food: [30000, 60000, 150000],
    transport: [6000, 10000, 40000],
    hotel: [60000, 130000, 350000],
    places: [
      { name: "Gyeongbokgung Palace", local: "경복궁", area: "Jongno", tags: ["culture"], fee: 3000, level: 1, note: "Free if you wear a hanbok." },
      { name: "Bukchon Hanok Village", local: "북촌한옥마을", area: "Jongno", tags: ["culture"], fee: 0, level: 1, note: "Traditional houses; people live here, keep quiet." },
      { name: "Gwangjang Market", local: "광장시장", area: "Jongno", tags: ["food"], fee: 15000, level: 1, note: "Bindaetteok and mayak gimbap." },
      { name: "Myeongdong", local: "명동", area: "Myeongdong", tags: ["shopping", "food"], fee: 20000, level: 1, note: "Skincare shops and street food." },
      { name: "Han River Park", local: "한강공원", area: "Yeouido", tags: ["nature", "food"], fee: 0, level: 1, note: "Picnic with convenience-store ramyeon." },
      { name: "N Seoul Tower", local: "N서울타워", area: "Namsan", tags: ["views"], fee: 26000, level: 2, note: "Observatory; the cable car is extra." },
      { name: "Hongdae", local: "홍대", area: "Mapo", tags: ["nightlife", "shopping"], fee: 20000, level: 2, note: "Buskers, cafes and clubs." },
      { name: "Lotte World", local: "롯데월드", area: "Jamsil", tags: ["theme"], fee: 62000, level: 3, note: "Indoor and outdoor park; full day." },
    ],
  },
  {
    id: "hongkong",
    name: "Hong Kong",
    country: "Hong Kong",
    currency: "HKD",
    food: [200, 400, 1000],
    transport: [50, 80, 300],
    hotel: [600, 1300, 3500],
    places: [
      { name: "Star Ferry and the harbour promenade", local: "天星小輪", area: "Tsim Sha Tsui", tags: ["views"], fee: 5, level: 1, note: "Cheapest harbour view; Symphony of Lights at 8 PM." },
      { name: "Temple Street Night Market", local: "廟街夜市", area: "Yau Ma Tei", tags: ["food", "shopping", "nightlife"], fee: 100, level: 1, note: "Claypot rice and street food." },
      { name: "Mong Kok markets", local: "旺角", area: "Mong Kok", tags: ["shopping"], fee: 0, level: 1, note: "Ladies' Market and sneaker street." },
      { name: "Victoria Peak", local: "太平山頂", area: "Central", tags: ["views", "nature"], fee: 150, level: 2, note: "Peak Tram return plus Sky Terrace." },
      { name: "Dim sum at a tea house", local: "飲茶", area: "Central", tags: ["food"], fee: 200, level: 2, note: "Go early for the best choice." },
      { name: "Tian Tan Buddha by cable car", local: "天壇大佛", area: "Lantau", tags: ["culture", "nature", "views"], fee: 300, level: 2, note: "Ngong Ping 360 cable car." },
      { name: "Hong Kong Disneyland", local: "香港迪士尼樂園", area: "Lantau", tags: ["theme"], fee: 700, level: 3, note: "Full day; prices vary by date." },
    ],
  },
  {
    id: "taipei",
    name: "Taipei",
    country: "Taiwan",
    currency: "TWD",
    food: [600, 1200, 3000],
    transport: [150, 250, 1000],
    hotel: [1500, 3500, 9000],
    places: [
      { name: "Shilin Night Market", local: "士林夜市", area: "Shilin", tags: ["food", "nightlife", "shopping"], fee: 300, level: 1, note: "Fried chicken cutlet and bubble tea." },
      { name: "Chiang Kai-shek Memorial Hall", local: "中正紀念堂", area: "Zhongzheng", tags: ["culture"], fee: 0, level: 1, note: "Free; changing of the guard on the hour." },
      { name: "Elephant Mountain", local: "象山", area: "Xinyi", tags: ["nature", "views"], fee: 0, level: 1, note: "Short steep hike to a Taipei 101 view." },
      { name: "Ximending", local: "西門町", area: "Wanhua", tags: ["shopping", "nightlife", "food"], fee: 300, level: 1, note: "Youth shopping street." },
      { name: "Jiufen Old Street", local: "九份老街", area: "Jiufen", tags: ["culture", "food", "views"], fee: 400, level: 1, note: "Day trip by bus; teahouses on the hill." },
      { name: "Taipei 101 Observatory", local: "台北101觀景台", area: "Xinyi", tags: ["views"], fee: 600, level: 2, note: "Skip the line at opening time." },
      { name: "Din Tai Fung", local: "鼎泰豐", area: "Xinyi", tags: ["food"], fee: 800, level: 2, note: "Famous xiaolongbao; queue numbers." },
      { name: "Beitou hot springs", local: "北投溫泉", area: "Beitou", tags: ["nature"], fee: 1000, level: 2, note: "Private hot-spring room." },
    ],
  },
  {
    id: "singapore",
    name: "Singapore",
    country: "Singapore",
    currency: "SGD",
    food: [30, 60, 150],
    transport: [10, 15, 50],
    hotel: [80, 200, 500],
    places: [
      { name: "Gardens by the Bay", local: "Gardens by the Bay", area: "Marina Bay", tags: ["nature", "views"], fee: 0, level: 1, note: "Supertrees free; the domes cost extra." },
      { name: "Hawker centre dinner", local: "Maxwell / Lau Pa Sat", area: "Chinatown", tags: ["food"], fee: 15, level: 1, note: "Chicken rice and satay." },
      { name: "Chinatown and Buddha Tooth Relic Temple", local: "Chinatown", area: "Chinatown", tags: ["culture", "shopping"], fee: 0, level: 1, note: "Free temple; dress modestly." },
      { name: "Little India and Kampong Glam", local: "Little India", area: "Kampong Glam", tags: ["culture", "food", "shopping"], fee: 0, level: 1, note: "Colourful streets and Arab Street cafes." },
      { name: "Orchard Road", local: "Orchard Road", area: "Orchard", tags: ["shopping"], fee: 0, level: 1, note: "Malls; Lucky Plaza for Filipino stores." },
      { name: "Marina Bay Sands SkyPark", local: "SkyPark", area: "Marina Bay", tags: ["views"], fee: 35, level: 2, note: "Observation deck." },
      { name: "Night Safari", local: "Night Safari", area: "Mandai", tags: ["nature"], fee: 55, level: 2, note: "Evening tram through the zoo." },
      { name: "Universal Studios Singapore", local: "Sentosa", area: "Sentosa", tags: ["theme"], fee: 83, level: 3, note: "Full day on Sentosa." },
    ],
  },
];

export interface PlanDay {
  day: number;
  area: string;
  places: Place[];
  activities: number;
}

export interface TripPlanResult {
  city: City;
  tier: Tier;
  days: PlanDay[];
  /** Per person, local currency. */
  totals: { activities: number; food: number; transport: number; pocket: number; hotel: number; all: number };
}

const PER_DAY = 3;

/**
 * A day-by-day plan. Places must match an aspect (any place when none is chosen) and fit the tier;
 * the best matches are kept, then grouped so each day stays in as few areas as possible.
 */
export function planTrip(city: City, days: number, tier: Tier, aspects: Aspect[], travelers = 1): TripPlanResult {
  const n = Math.max(1, Math.min(14, Math.round(days)));
  const score = (p: Place) => (aspects.length ? p.tags.filter((t) => aspects.includes(t)).length : 1);
  const picked = city.places
    .filter((p) => p.level <= tier && score(p) > 0)
    // Best match first; on Tipid cheaper first, on Bongga the special ones first.
    .sort((a, b) => score(b) - score(a) || (tier === 1 ? a.fee - b.fee : b.level - a.level || a.fee - b.fee))
    .slice(0, n * PER_DAY);
  // Keep each area on one day where possible: biggest areas first, each into the first day with room.
  const byArea = new Map<string, Place[]>();
  for (const p of picked) byArea.set(p.area, [...(byArea.get(p.area) ?? []), p]);
  const dayLists: Place[][] = Array.from({ length: n }, () => []);
  // Spread places evenly (8 places over 4 days is 2 a day, not 3+3+2 and a free day).
  const cap = Math.max(1, Math.min(PER_DAY, Math.ceil(picked.length / n)));
  for (const group of [...byArea.values()].sort((a, b) => b.length - a.length)) {
    for (let i = 0; i < group.length; i += cap) {
      const chunk = group.slice(i, i + cap);
      const whole = dayLists.find((d) => d.length + chunk.length <= cap);
      if (whole) whole.push(...chunk);
      else for (const p of chunk) dayLists.find((d) => d.length < cap)?.push(p);
    }
  }
  // Busy days first, free days at the end.
  dayLists.sort((a, b) => (b.length ? 1 : 0) - (a.length ? 1 : 0));
  const out: PlanDay[] = dayLists.map((places, d) => ({
    day: d + 1,
    area: [...new Set(places.map((p) => p.area))].join(" · ") || "Free day",
    places,
    activities: places.reduce((a, p) => a + p.fee, 0),
  }));
  const t = tier - 1;
  const activities = out.reduce((a, d) => a + d.activities, 0);
  const food = city.food[t] * n;
  const transport = city.transport[t] * n;
  const rooms = Math.ceil(Math.max(1, travelers) / 2);
  // A one-day trip (a layover or day trip) needs no hotel; otherwise nights = days - 1.
  const hotel = Math.round((city.hotel[t] * (n - 1) * rooms) / Math.max(1, travelers));
  const pocket = activities + food + transport;
  return { city, tier, days: out, totals: { activities, food, transport, pocket, hotel, all: pocket + hotel } };
}

/** The only facts the AI sees when it writes a tip for each day; its numbers are checked against them. */
export function planFacts(plan: TripPlanResult): string {
  return [
    `Trip: ${plan.days.length} days in ${plan.city.name}, ${plan.city.country}. Budget level: ${TIERS[plan.tier - 1].label} (${TIERS[plan.tier - 1].sub}).`,
    ...plan.days.map((d) => `Day ${d.day} (${d.area}): ${d.places.map((p) => p.name).join(", ") || "free day"}.`),
  ].join("\n");
}

export function dayTipsPrompt(facts: string): string {
  return `You help a Filipino traveler enjoy a trip. Their plan:
${facts}
For each day, write one short, practical tip (at most 20 words) about that day's places: best time to go, what to try, or how to save. Mention only places from the plan. Do not mention prices.
One line per day, exactly like:
Day 1: tip`;
}

/**
 * Keeps a tip only if it is for a planned day, names one of that day's places (so it can't send people
 * somewhere off the plan), and has no prices (prices are code's job).
 */
export function parseDayTips(text: string, dayPlaces: string[][]): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of text.split("\n")) {
    const m = line.replace(/\*\*/g, "").match(/^\s*day\s*(\d+)\s*[:.\-–]\s*(.+)$/i);
    if (!m) continue;
    const d = Number(m[1]);
    const tip = m[2].trim();
    if (d < 1 || d > dayPlaces.length || out.has(d) || tip.length < 8 || tip.length > 200) continue;
    if (/[₱$¥€£₩]|\d{3,}/.test(tip)) continue;
    const words = dayPlaces[d - 1].flatMap((name) => name.split(/[\s,()]+/)).filter((w) => w.length >= 4 && /^\p{Lu}/u.test(w));
    if (words.length && !words.some((w) => tip.toLowerCase().includes(w.toLowerCase()))) continue;
    out.set(d, tip);
  }
  return out;
}
