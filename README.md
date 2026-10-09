# KitaPH — private money assistant for Filipino workers (and travelers)

KitaPH reads your receipts and tells you where your money went and how to stretch it — **with the AI running on your own phone and laptop, not in the cloud.** Snap a grocery receipt and KitaPH breaks it down, checks that the items add up, compares prices with your past receipts, and puts your spending next to official Philippine inflation. Travelers can scan a menu or bill and get it translated and converted to their currency, offline.

Built for the AppBuildersPH Hackathon 2026 (theme: Local AI).

## Why local AI

Receipts, GCash screenshots, salaries, and debts are some of the most private data a person has. A minimum-wage worker also can't pay for cloud AI per question or count on mobile data. Running the AI locally means:

- **Private by construction:** photos and finances never leave the device. There is no account and no server that could leak them.
- **Free to use:** no per-request cloud cost, so it can stay free for the people who need it most.
- **Works offline:** in airplane mode, in a province with weak signal, or abroad without roaming.

## What runs where

| Part | Runs on | Internet needed? |
|---|---|---|
| Text recognition on receipts, menus, signs | **Phone** — Google ML Kit on-device model, bundled in the APK | No |
| Translation (traveler mode) | **Phone** — ML Kit on-device translation | Once per language, to download its ~30 MB pack |
| Receipt parsing, add-up check, breakdown, savings tips, budgets, personal inflation | **Phone** — KitaPH TypeScript code | No |
| Taglish quick-log ("jeep 26, lunch 95") and Taglish advisor | **KitaPH Hub** — Gemma 3 4B via Ollama on the user's own laptop, reached over local Wi-Fi | No |
| High-accuracy receipt vision (hub) | **KitaPH Hub** — Qwen3-VL 2B via Ollama | No |
| Exchange-rate and PSA/DOLE data refresh, encrypted backup | **KitaPH Cloud** (optional) — FastAPI on Render + Supabase | Yes (optional) |

The app is fully usable with no cloud at all. The cloud only sees ciphertext for backups.

## How it works

```
 Phone (Android APK, Expo / React Native)              Laptop "KitaPH Hub" (Next.js + Ollama)
 ┌───────────────────────────────────────┐   local    ┌──────────────────────────────────────┐
 │ Camera → ML Kit OCR (on-device)        │   Wi-Fi    │ /api/ai/quicklog  → gemma3:4b (GPU)   │
 │ → receipt parser + add-up check (code) │ ─────────► │ /api/ai/advise    → gemma3:4b (GPU)   │
 │ → breakdown, tips, personal inflation  │  (no       │ /api/ai/receipt   → qwen3-vl:2b (GPU) │
 │ Traveler: ML Kit translate + BSP rates │ internet)  │ every answer validated by code         │
 │ Data: on-phone storage only            │            └──────────────────────────────────────┘
 └───────────────────────────────────────┘
            ┆ optional, when online
            ▼
 KitaPH Cloud: FastAPI (Render) + Supabase — reference data refresh, ciphertext-only backup
```

**The AI proposes; code checks.** All money is integer centavos. Totals, budgets, and insights are computed by tested code. The AI never does arithmetic:

- Receipt items must add up to the printed TOTAL. A known vision-model mistake (unit price read as line total) is detected and repaired.
- Every amount the quick-log extracts is checked against what the user actually typed.
- Every peso amount and percentage in an advisor answer is checked against the data the model was given; anything else is flagged on screen.

## Measured results (reproducible; no other numbers are claimed)

All measured on the development laptop (RTX 4050 Laptop GPU, 6 GB) on 2026-10-09.

| Test | Result | How to reproduce / caveats |
|---|---|---|
| Taglish quick-log, Gemma 3 4B | **15/15 sentences, 20/20 records**, median 1.6 s | `node scripts/eval-quicklog.mjs` with the hub running. We wrote the 15 sentences. The model alone scored 14/15; the remaining case ("Pinadala ko kay mama…" read as income) is fixed by a code rule added after we saw that failure, so it is not a held-out result. |
| Same test, phone-sized models | Gemma 3 1B **3/15**, Qwen3 1.7B **6/15** | Run on the laptop via Ollama, not on a phone. This is why the phone uses ML Kit + code instead of a small LLM. |
| Receipt vision, Qwen3-VL 2B (hub) | 1 synthetic test receipt read exactly (5/5 items, total ₱575.75), ~6.7 s | Only one generated image; real-receipt accuracy not yet measured. Gemma 3 4B misread the same image (caught by the add-up check). |
| Unit tests | Web/shared: `npm test` · Cloud: `pytest` | Parser tests use hand-built OCR layouts, not real phone output. |

## Running it

### 1. KitaPH Hub (laptop)

Requirements: Node.js 22+, [Ollama](https://ollama.com).

```bash
ollama pull gemma3:4b
ollama pull qwen3-vl:2b
npm install
npm run build && npx next start -H 0.0.0.0 -p 3000   # or: npx next dev -H 0.0.0.0 -p 3000
```

Open http://localhost:3000. The page shows the model status and the address to type into the phone (e.g. `192.168.1.20:3000`). Allow Node.js through the Windows firewall on private networks when asked.

### 2. KitaPH mobile app (Android)

Install the APK from the release, or build it:

```bash
cd mobile
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# APK: mobile/android/app/build/outputs/apk/release/app-release.apk
```

Requires JDK 17 and the Android SDK (platform 35/36). The release build is signed with the debug key for side-loading only.

### 3. KitaPH Cloud (optional)

```bash
cd cloud
pip install -r requirements-dev.txt
pytest
uvicorn app.main:app --reload
```

Deploy with `render.yaml` (Render Blueprint). Set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, and run `cloud/supabase/schema.sql` in Supabase. Without them, `/v1/reference` serves the bundled data and backup returns 503.

## Data sources (bundled, dated)

- Inflation: PSA, CPI (2018=100), September 2026, released Oct 6, 2026 — headline 7.2%, food 6.8%, rice 20.3%, transport 14.6%, housing/utilities 8.4%.
- Minimum wage: DOLE NWPC / RTWPB-NCR Wage Order No. NCR-28, effective Sep 26, 2026 — ₱755/day non-agriculture.
- Exchange rates: BSP Reference Exchange Rate Bulletin, Oct 8, 2026 (via taxcalculator.com.ph). Conversions are labeled approximate.
- The sample persona ("Joy") and its prices are illustrative, not survey data.

## Disclosures

- **Models:** Gemma 3 4B (`gemma3:4b`), Qwen3-VL 2B (`qwen3-vl:2b`) via Ollama; Google ML Kit Text Recognition v2 and ML Kit Translation (on-device). Evaluated but not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Frameworks and libraries:** Next.js 16, React 19, Tailwind CSS 4, Vitest; Expo SDK 57, React Native 0.86, expo-image-picker, AsyncStorage, `@react-native-ml-kit/text-recognition`, `@react-native-ml-kit/translate-text`; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Ollama (local), Google ML Kit (on-device); optional Render (hosting) and Supabase (Postgres/Auth) for the cloud service.
- **Existing code and assets:** project scaffolds from `create-next-app` and `create-expo-app` (Expo blank template, MIT). Everything else was written during the hackathon (see git history from Oct 9, 2026, 2:38 PM).
- **AI development tools:** Claude Code (Anthropic) was used to write and test code.
- **Inspiration only:** PopLingo (on-device text lookup app) inspired traveler mode; none of its code or services are used.

## Repository layout

```
src/lib/        shared, unit-tested logic (finance, receipt parsing, insights, traveler, prompts)
src/app/        KitaPH Hub (Next.js): status page + local AI API routes
mobile/         KitaPH Android app (Expo / React Native)
cloud/          optional KitaPH Cloud (FastAPI) + Supabase schema
scripts/        reproducible evaluation scripts
```
