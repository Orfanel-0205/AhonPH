// Measures quick-log accuracy against the running hub (npm run dev, Ollama running).
// Usage: node scripts/eval-quicklog.mjs [baseUrl] [dev|holdout|final] [raw]
// "raw" scores the model alone, without the local-knowledge refinement step.
// Cases live in src/lib/quicklogCases.json (shared with the in-app on-phone test) and are worded
// differently from the examples inside the prompt.
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SET = process.argv[3] ?? "dev";
const RAW = process.argv[4] === "raw";
const FILE = { dev: "quicklogCases.json", holdout: "quicklogHoldout.json", final: "quicklogFinal.json" }[SET];
const CASES = JSON.parse(readFileSync(new URL(`../src/lib/${FILE}`, import.meta.url), "utf8"));
console.log(`Set: ${SET} (${CASES.length} sentences) · ${RAW ? "model only" : "model + local knowledge"}`);

let casesPassed = 0;
let recordsExpected = 0;
let recordsCorrect = 0;
const times = [];

for (const { text, expected } of CASES) {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/ai/quicklog`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, today: "2026-10-09", raw: RAW }),
  });
  const ms = Date.now() - t0;
  times.push(ms);
  const data = await res.json();
  const remaining = [...(data.records ?? [])];
  let correct = 0;
  for (const e of expected) {
    const i = remaining.findIndex((r) => r.type === e.type && e.categories.includes(r.category) && r.amountCentavos === Math.round(e.pesos * 100));
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
  if (!pass) {
    console.log(`      expected ${JSON.stringify(expected.map((e) => [e.type, e.categories.join("|"), e.pesos]))}`);
    console.log(`      got      ${JSON.stringify((data.records ?? []).map((r) => [r.type, r.category, r.amountCentavos / 100]))}`);
  }
}

times.sort((a, b) => a - b);
console.log(`\nCases passed:   ${casesPassed}/${CASES.length}`);
console.log(`Records right:  ${recordsCorrect}/${recordsExpected}`);
console.log(`Median latency: ${(times[Math.floor(times.length / 2)] / 1000).toFixed(1)}s (includes app overhead)`);
