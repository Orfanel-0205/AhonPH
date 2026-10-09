# KitaPH — private money assistant for Filipino workers (and travelers)

Snap a receipt and KitaPH breaks down where your money went, checks every peso against the printed total, and gives savings tips in Taglish. **All the AI runs on your phone** — receipt reading, the Taglish assistant, translation — so it keeps working in airplane mode and your finances never leave the device. Travelers can scan Tagalog menus, signs and bills to translate them and convert prices offline.

Built for the AppBuildersPH Hackathon 2026 (theme: Local AI). Android app + optional laptop hub + optional cloud backup.

## Why local AI

KitaPH's users are minimum-wage workers. Their receipts, salaries, remittances and debts are the most private data they have, and mobile data costs money. Running the AI on the phone makes KitaPH:

- **Private by construction:** photos and finances never leave the phone. No account, no cloud AI, no analytics.
- **Free to use:** no per-question inference cost, so it can stay free for the people who need it most.
- **Offline:** works without load or signal, in the province, or abroad without roaming.

## What runs where

| Feature | Runs on | Model / engine | Internet needed? |
|---|---|---|---|
| Read receipts, menus, signs | **Phone** | Google ML Kit Text Recognition v2 (bundled in the APK) | No |
| Receipt parsing, add-up check, breakdown, savings tips, budgets, personal inflation | **Phone** | KitaPH TypeScript code (unit-tested) | No |
| Taglish quick-log and money advisor | **Phone** | Gemini Nano, Android's built-in model (AICore), via ML Kit GenAI Prompt API | Once, for Android's model download |
| Traveler translation + language detection | **Phone** | ML Kit Translation + Language ID | Once per language pack (~30 MB) |
| Same Taglish features, bigger model (optional) | **User's laptop** over local Wi-Fi | Gemma 3 4B via Ollama | No |
| High-accuracy receipt vision (optional) | **User's laptop** | Qwen3-VL 2B via Ollama | No |
| Rates/PSA refresh, encrypted backup (optional) | KitaPH Cloud | FastAPI on Render + Supabase | Yes |

If a phone can't run Gemini Nano, Kita AI falls back to the laptop hub, then to **basic mode** (keyword rules, no AI), so the app always answers.

## How it works

```
 Android phone (Expo / React Native + Kotlin native module "KitaOnDevice")
 ┌─────────────────────────────────────────────────────────────────────────┐
 │ Camera → ML Kit OCR → receipt parser → add-up check → breakdown & tips   │
 │ Taglish text → Gemini Nano → JSON → code validation → records            │
 │ Question + numbers computed by code → Gemini Nano → number check         │
 │ Menu photo → ML Kit OCR → language ID → ML Kit translate → BSP rates     │
 │ Data: on-phone storage only                                              │
 └─────────────────────────────────────────────────────────────────────────┘
        ┆ optional, same Wi-Fi, no internet            ┆ optional, online
        ▼                                              ▼
 KitaPH Hub (Next.js + Ollama, Gemma 3 4B)     KitaPH Cloud (FastAPI + Supabase)
```

**The AI proposes; code checks.** Money is stored as integer centavos, and every total, budget and tip is computed by tested code — the AI never does arithmetic:

- Receipt items must add up to the printed TOTAL; a known misread (unit price taken as line total) is detected and repaired.
- Every amount the quick-log extracts is checked against what the user typed.
- Every peso amount and percentage in an advisor answer is checked against the data the model was given; anything else is flagged on screen.
- Nothing is saved until the user confirms.

## Measured results (reproducible; no other numbers are claimed)

Taglish quick-log test set: 15 sentences in `src/lib/quicklogCases.json`, worded differently from the prompt's examples. Scoring requires every record's type, category and amount to match.

| Engine | Result | How measured / caveats |
|---|---|---|
| Gemma 3 4B, laptop hub (RTX 4050 Laptop) | **15/15 sentences, 20/20 records**, median 1.6 s | `node scripts/eval-quicklog.mjs`. Model alone 14/15; the remaining case is fixed by a code rule added after we saw that failure, so it is not a held-out result. |
| Gemini Nano, on a POCO X7 Pro | [fill in] | In the app: Privacy → Test the on-device AI (same 15 sentences, same scoring). |
| Basic mode (no AI) | 11/15 | `npx vitest run src/lib/basicParse.test.ts`. Written after the test set existed. |
| Gemma 3 1B / Qwen3 1.7B (laptop, via Ollama) | 3/15 / 6/15 | Why we did not ship an open small LLM inside the APK. |
| Receipt vision, Qwen3-VL 2B (hub) | 1 synthetic receipt read exactly | One generated image only. |

Unit tests: `npm test` (62, shared logic and hub) and `cd cloud && pytest` (5). The receipt parser tests use hand-built OCR layouts; real-receipt accuracy has been checked on device only on our test images so far.

## Running it

### KitaPH Android app

Install the APK from the GitHub release, or build it (JDK 17, Android SDK 35/36):

```bash
cd mobile
npm install
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# APK: mobile/android/app/build/outputs/apk/release/app-release.apk  (debug-signed, for side-loading)
```

On first launch, **Set up your private AI** downloads Gemini Nano (through Android) and the translation packs you pick. After that, everything works in airplane mode. Gemini Nano needs a supported Android device; other phones use the hub or basic mode.

### KitaPH Hub (optional, laptop)

Requires Node.js 22+ and [Ollama](https://ollama.com).

```bash
ollama pull gemma3:4b
ollama pull qwen3-vl:2b
npm install
npm run build && npx next start -H 0.0.0.0 -p 3000
```

Open http://localhost:3000 for model status and the address to type into the phone (Kita AI → Laptop hub). Allow Node.js through the firewall on private networks.

### KitaPH Cloud (optional)

```bash
cd cloud
pip install -r requirements-dev.txt
pytest
uvicorn app.main:app --reload
```

Deploy with `render.yaml` (Render Blueprint); set `SUPABASE_URL` and `SUPABASE_ANON_KEY` and run `cloud/supabase/schema.sql`. Backups are encrypted on the phone; the server stores ciphertext only. Without Supabase, `/v1/reference` serves the bundled data.

## Data sources (bundled, dated)

- Inflation: PSA, CPI (2018=100), September 2026, released Oct 6, 2026 — headline 7.2%, food 6.8%, rice 20.3%, transport 14.6%, housing/utilities 8.4%.
- Minimum wage: DOLE NWPC / RTWPB-NCR Wage Order No. NCR-28, effective Sep 26, 2026 — ₱755/day non-agriculture.
- Exchange rates: BSP Reference Exchange Rate Bulletin, Oct 8, 2026 (via taxcalculator.com.ph). Conversions are labeled approximate.
- The sample persona ("Joy") and its prices are illustrative, not survey data.

## Disclosures

- **Models:** Gemini Nano (Android AICore; ML Kit GenAI Prompt API 1.0.0-beta2); Google ML Kit Text Recognition v2, Translation 17.0.3, Language ID 17.0.6; optional hub: Gemma 3 4B and Qwen3-VL 2B via Ollama. Evaluated, not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Frameworks and libraries:** Expo SDK 57, React Native 0.86, Expo Modules API (Kotlin), expo-image-picker, expo-network, AsyncStorage, `@react-native-ml-kit/text-recognition`; Next.js 16, React 19, Tailwind CSS 4, Vitest; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Android AICore and Google ML Kit (on-device). Optional and secondary: Render and Supabase. No cloud AI APIs.
- **Existing code and assets:** scaffolds from `create-next-app`, `create-expo-app` (blank TypeScript, MIT) and `create-expo-module`. Everything else — code, app icon, test images — was made during the hackathon (git history from Oct 9, 2026, 2:38 PM).
- **AI development tools:** Claude Code (Anthropic).
- **Inspiration only:** PopLingo inspired traveler mode; none of its code or services are used.

## Repository layout

```
mobile/                       KitaPH Android app (Expo / React Native)
mobile/modules/kita-ondevice  Kotlin module: Gemini Nano, ML Kit translation, language ID
src/lib/                      shared, unit-tested logic (finance, receipt parsing, insights, traveler, prompts, test set)
src/app/                      KitaPH Hub (Next.js): status page + local AI API routes
cloud/                        optional KitaPH Cloud (FastAPI) + Supabase schema
scripts/                      reproducible evaluation script
docs/                         demo playbook and submission answers
```
