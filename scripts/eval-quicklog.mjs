// Measures quick-log accuracy against the running app (npm run dev, Ollama running).
// Usage: node scripts/eval-quicklog.mjs [baseUrl]
// Cases are deliberately worded differently from the examples inside the prompt.

const BASE = process.argv[2] ?? "http://localhost:3000";

/** expected: [type, allowedCategories, pesos] */
const CASES = [
  ["Nag-jeep ako 26 papuntang trabaho, lunch sa karinderya 95, load 50 sa Globe", [["expense", ["transport"], 26], ["expense", ["food"], 95], ["expense", ["load_internet"], 50]]],
  ["Pinadala ko kay mama 3,000 ngayong kinsenas", [["expense", ["family"], 3000]]],
  ["Sweldo ko kanina 9,815", [["income", ["salary"], 9815]]],
  ["Meralco 1,850 tapos Maynilad 420", [["expense", ["utilities"], 1850], ["expense", ["utilities"], 420]]],
  ["upa sa boarding house 3,500", [["expense", ["rent"], 3500]]],
  ["bayad sa Home Credit 1,200", [["expense", ["debt"], 1200]]],
  ["milk tea 120 tapos sine 350 kasama barkada", [["expense", ["leisure", "food"], 120], ["expense", ["leisure"], 350]]],
  ["Binigyan ako ni tita ng 1,000 pang-birthday", [["income", ["allowance", "other_income"], 1000]]],
  ["Grab pauwi 1.5k kasi umuulan", [["expense", ["transport"], 1500]]],
  ["gamot sa Mercury 245.50", [["expense", ["health"], 245.5]]],
  ["nakabenta ako ng tocino sa officemates, 650", [["income", ["sideline"], 650]]],
  ["Shopee checkout 799 para sa sapatos", [["expense", ["personal"], 799]]],
  ["baon ng anak 100 at school project 250", [["expense", ["education"], 100], ["expense", ["education"], 250]]],
  ["kahapon gasul 1,100, ngayon bigas 280", [["expense", ["utilities", "food"], 1100], ["expense", ["food"], 280]]],
  ["Ang ganda ng araw ngayon!", []],
];

let casesPassed = 0;
let recordsExpected = 0;
let recordsCorrect = 0;
const times = [];

for (const [text, expected] of CASES) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/ai/quicklog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, today: "2026-10-09" }),
  });
  const ms = Date.now() - t0;
  times.push(ms);
  const data = await res.json();
  const got = (data.records ?? []).map((r) => [r.type, r.category, r.amountCentavos / 100]);
  const remaining = [...got];
  let correct = 0;
  for (const [type, cats, pesos] of expected) {
    const i = remaining.findIndex(([t, c, a]) => t === type && cats.includes(c) && a === pesos);
    if (i >= 0) {
      correct++;
      remaining.splice(i, 1);
    }
  }
  const pass = correct === expected.length && remaining.length === 0;
  recordsExpected += expected.length;
  recordsCorrect += correct;
  if (pass) casesPassed++;
  console.log(`${pass ? "PASS" : "FAIL"}  ${(ms / 1000).toFixed(1)}s  ${text}`);
  if (!pass) console.log(`      expected ${JSON.stringify(expected.map(([t, c, a]) => [t, c.join("|"), a]))}\n      got      ${JSON.stringify(got)}`);
}

times.sort((a, b) => a - b);
console.log(`\nCases passed:   ${casesPassed}/${CASES.length}`);
console.log(`Records right:  ${recordsCorrect}/${recordsExpected}`);
console.log(`Median latency: ${(times[Math.floor(times.length / 2)] / 1000).toFixed(1)}s (includes app overhead)`);
