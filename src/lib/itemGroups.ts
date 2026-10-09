/** Classifies receipt item names into everyday groups with a keyword list (common Philippine brands included). */

export type ItemGroup =
  | "rice"
  | "noodles"
  | "canned"
  | "dairy"
  | "drinks"
  | "snacks"
  | "produce"
  | "meat_fish"
  | "eggs_bread"
  | "cooking"
  | "personal_care"
  | "household"
  | "dishes"
  | "service"
  | "discount"
  | "other";

export const GROUP_LABEL: Record<ItemGroup, string> = {
  rice: "Bigas / Rice",
  noodles: "Noodles",
  canned: "De lata / Canned goods",
  dairy: "Gatas / Dairy",
  drinks: "Kape at inumin / Drinks",
  snacks: "Snacks",
  produce: "Gulay at prutas / Produce",
  meat_fish: "Karne at isda / Meat & fish",
  eggs_bread: "Itlog at tinapay / Eggs & bread",
  cooking: "Mantika at pampalasa / Cooking",
  personal_care: "Personal care",
  household: "Panlinis / Household",
  dishes: "Ulam / Restaurant dishes",
  service: "Service charge",
  discount: "Discount",
  other: "Iba pa / Other",
};

// Order matters: more specific groups first (e.g. "PANCIT CANTON" is noodles before "PANCIT" is a dish).
const KEYWORDS: [ItemGroup, string[]][] = [
  ["personal_care", ["SAFEGUARD", "PALMOLIVE", "SHAMPOO", "CONDITIONER", "SOAP", "SABON", "TOOTHPASTE", "COLGATE", "CLOSE UP", "HEAD & SHOULDERS", "CREAMSILK", "SUNSILK", "DEODORANT", "REXONA", "NAPKIN", "MODESS", "WHISPER", "DIAPER", "LOTION", "TISSUE", "ALCOHOL", "TOOTHBRUSH"]],
  ["household", ["TIDE", "ARIEL", "SURF", "DOWNY", "ZONROX", "JOY", "DISHWASHING", "DISHWASH", "DETERGENT", "BLEACH", "CHAMPION", "PRIDE", "KATOL", "BAYGON", "GARBAGE BAG", "BATTERY", "BATTERIES", "SPONGE"]],
  ["rice", ["RICE", "BIGAS", "DINORADO", "JASMINE", "SINANDOMENG", "MILAGROSA", "NFA"]],
  ["noodles", ["PANCIT CANTON", "LUCKY ME", "NISSIN", "PAYLESS", "NOODLE", "NOODLES", "CUP NOODLES", "MAMI", "BIHON", "SOTANGHON", "MISUA", "SPAGHETTI PASTA"]],
  ["canned", ["SARDINES", "SARDINAS", "CORNED", "TUNA", "MEAT LOAF", "LUNCHEON", "SPAM", "LIGO", "MEGA", "555", "ARGENTINA", "CENTURY", "SAN MARINO", "VIENNA", "BEEF LOAF", "DE LATA", "PORK AND BEANS"]],
  ["dairy", ["EVAP", "EVAPORATED", "CONDENSED", "ALASKA", "BEAR BRAND", "NIDO", "MILK", "BIRCH TREE", "CHEESE", "EDEN", "BUTTER", "YOGURT"]],
  ["produce", ["ONION", "SIBUYAS", "GARLIC", "BAWANG", "TOMATO", "KAMATIS", "POTATO", "PATATAS", "CARROT", "CABBAGE", "REPOLYO", "PECHAY", "KANGKONG", "SITAW", "EGGPLANT", "TALONG", "AMPALAYA", "BANANA", "SAGING", "MANGO", "APPLE", "CALAMANSI", "GINGER", "LUYA", "GULAY", "MALUNGGAY"]],
  ["eggs_bread", ["EGG", "ITLOG", "BREAD", "TINAPAY", "PANDESAL", "GARDENIA", "LOAF"]],
  ["meat_fish", ["CHICKEN", "MANOK", "PORK", "BABOY", "LIEMPO", "BEEF", "BAKA", "FISH", "ISDA", "BANGUS", "TILAPIA", "GALUNGGONG", "HOTDOG", "LONGGANISA", "TOCINO", "HAM", "SHRIMP", "HIPON", "PUSIT", "STEAK"]],
  ["cooking", ["OIL", "MANTIKA", "SOY SAUCE", "TOYO", "VINEGAR", "SUKA", "PATIS", "SALT", "ASIN", "SUGAR", "ASUKAL", "KETCHUP", "MAGIC SARAP", "KNORR", "SEASONING", "PEPPER", "PAMINTA", "SAUCE"]],
  ["drinks", ["NESCAFE", "KOPIKO", "GREAT TASTE", "COFFEE", "KAPE", "MILO", "COKE", "COCA", "ROYAL", "SPRITE", "PEPSI", "C2", "ZEST", "TANG", "JUICE", "WATER", "WILKINS", "ABSOLUTE", "BEER", "SAN MIGUEL", "RED HORSE", "TEA", "SOFTDRINKS"]],
  ["snacks", ["PIATTOS", "NOVA", "OISHI", "SKYFLAKES", "REBISCO", "CHIPS", "BISCUIT", "BISCUITS", "COOKIES", "CHOCOLATE", "CANDY", "JACK N JILL", "FITA", "MAGIC FLAKES", "CRACKERS"]],
  ["dishes", ["SINIGANG", "ADOBO", "KARE-KARE", "KARE KARE", "LECHON", "SISIG", "PANCIT", "CHICKENJOY", "BURGER", "FRIES", "SPAGHETTI", "LUMPIA", "MEAL", "TAPSILOG", "SILOG", "BULALO", "TINOLA", "HALO-HALO"]],
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const MATCHERS: [ItemGroup, RegExp][] = KEYWORDS.map(([g, kws]) => [g, new RegExp(`(^|[^A-Z0-9])(${kws.map(escape).join("|")})S?($|[^A-Z0-9])`)]);

export function classifyItem(name: string, lineTotalCentavos: number): ItemGroup {
  if (lineTotalCentavos < 0) return "discount";
  const n = name.toUpperCase();
  if (/SERVICE CHARGE/.test(n)) return "service";
  for (const [g, re] of MATCHERS) if (re.test(n)) return g;
  return "other";
}
