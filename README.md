# KitaPH — offline travel and money companion for Filipinos abroad

Abroad, data costs money and the language is a wall. KitaPH helps Filipino travelers and OFWs **talk, read and track money with no internet**:

- **Usap (Talk):** the other person speaks their language; you see it in Filipino or English with **three suggested reply bubbles**. Tap one, edit it, and KitaPH says it aloud in their language. A big-text view and a "show my hotel to the driver" card cover noisy streets and taxis.
- **Scan:** point at a menu, sign or receipt. KitaPH translates it and shows every price **in pesos**. Receipts are broken down and checked against the printed total.
- **Gastos:** no receipt? Say or type "taxi 2,300 yen". It is logged in pesos, with a Taglish advisor for your trip budget.

**All the AI runs on the phone** — speech recognition, translation, text recognition and Gemini Nano — so it keeps working in airplane mode, on a plane, in the subway, or without roaming.

Built for the AppBuildersPH Hackathon 2026 (theme: Local AI). Android app + optional laptop hub + optional cloud backup.

## Why local AI

The challenge: an AI product that stays genuinely useful when the cloud disappears. Abroad, the cloud often *has* disappeared — no roaming, a dead pocket Wi-Fi, a subway. A cloud-only version would be:

- **Expensive:** roaming or pocket Wi-Fi just to translate a menu or ask a question. KitaPH needs no data after a one-time setup; each scan shows "0 bytes sent" next to the real photo size.
- **Unavailable when it matters:** at the taxi stand, check-in desk or market stall with no signal. KitaPH works in airplane mode (verified on a POCO X7 Pro).
- **Not private:** passports, hotel addresses, receipts and spending would be sent to servers. KitaPH keeps them on the phone; no account, no cloud AI, no analytics.
- **Slow:** a conversation can't wait for uploads over weak signal; on-device speech and translation answer immediately.

## What runs where

| Feature | Runs on | Model / engine | Internet needed? |
|---|---|---|---|
| Hear the other person (Usap) | **Phone** | Android on-device speech recognition (`requiresOnDeviceRecognition`) | Once per language pack |
| Translate speech, menus, signs | **Phone** | Google ML Kit Translation + Language ID | Once per language pack (~30 MB) |
| Suggested reply bubbles | **Phone** | Gemini Nano (Android AICore, ML Kit GenAI Prompt API); phrasebook when unavailable | Once, for Android's model download |
| Say your reply aloud | **Phone** | Android text-to-speech | No (offline voices) |
| Read receipts, menus, price tags | **Phone** | Google ML Kit Text Recognition v2 (bundled) | No |
| Prices and spending in pesos | **Phone** | KitaPH code + bundled BSP rates (Oct 8, 2026) | No |
| No-receipt logging ("taxi 2,300 yen"), money advisor | **Phone** | Gemini Nano + KitaPH code checks | No |
| Receipt breakdown, add-up check, tips, budgets | **Phone** | KitaPH TypeScript code (unit-tested) | No |
| Bigger Taglish model (optional) | **User's laptop** over local Wi-Fi | Gemma 3 4B via Ollama | No |
| Rates/PSA refresh, encrypted backup (optional) | KitaPH Cloud | FastAPI on Render + Supabase | Yes |

If a phone can't run Gemini Nano, KitaPH falls back to the laptop hub or to rules (phrasebook replies, keyword logging), so it always answers. On our test phone, Android offers offline speech for Japanese, English and German but not Filipino, so travelers type or tap Filipino replies (or speak English).

## How it works

```
 Android phone (Expo / React Native + Kotlin module "KitaOnDevice")
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ Usap:  their speech → on-device ASR → ML Kit translate → Gemini Nano      │
 │        reply bubbles (or phrasebook) → you edit → translate → TTS aloud   │
 │ Scan:  photo → ML Kit OCR → language ID → translate → prices in pesos     │
 │        receipt → parser → add-up check → breakdown & tips                 │
 │ Gastos: "taxi 2,300 yen" → Gemini Nano → code checks → ₱913.56            │
 │ Data: on-phone storage only                                               │
 └──────────────────────────────────────────────────────────────────────────┘
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

**Taglish quick-log.** Three sets of 15 sentences in `src/lib/`, each worded differently from the prompt's examples. A sentence counts only if every record's type, category and amount is right.

- **Dev set** (`quicklogCases.json`): seen while building prompts and rules.
- **Held-out** (`quicklogHoldout.json`): committed at 20:44 on Oct 9, before tuning against on-device results.
- **Final** (`quicklogFinal.json`): committed at 20:47, *before* the local-knowledge step existed, and scored once per engine.

"AI only" is the model's validated answer. "AI + local" adds `refineWithLocalKnowledge` (`src/lib/basicParse.ts`): the model finds the amounts, and a keyword dictionary written before any test set corrects categories it recognizes.

| Engine | Dev (AI only → AI + local) | Held-out | **Final** | Median time |
|---|---|---|---|---|
| **Gemini Nano, on a POCO X7 Pro** (phone, offline) | 10 → 13 /15 | 11 → 14 /15 | **8 → 12 /15** | 8.7 s |
| Gemma 3 4B, laptop hub (RTX 4050 Laptop) | 15 → 15 /15 | 12 → 14 /15 | **14 → 14 /15** | 2.1 s |
| Basic mode (keyword rules, no AI) | 11/15 | 7/15 | 9/15 | instant |
| Gemma 3 1B / Qwen3 1.7B (laptop, via Ollama, dev only) | 3/15 / 6/15 | — | — | — |

How to reproduce: phone — in the app, Privacy → Test the on-device AI (runs all 45 sentences; the test paces itself and retries because Android's AICore throttles bursts of requests). Laptop — `node scripts/eval-quicklog.mjs http://localhost:3000 <dev|holdout|final> [raw]`. Basic mode — `npx vitest run src/lib/basicParse.test.ts --reporter=verbose`.

Caveats: we wrote all sentences ourselves; the "pinadala" family rule in `src/lib/ai.ts` was added after a dev-set failure; small sets, so treat these as indicative.

**Verified on a POCO X7 Pro in airplane mode (Oct 9, 2026, ~10:45 PM):** Usap translated "Anong oras po ang check-out?" to 「チェックアウトは何時ですか？」 and read it aloud; Gemini Nano logged "kape 450 yen" as ₱178.74 (¥450) in 5.9 s; the header switched to "Offline · AI still on". Offline speech recognition starts on the phone for installed languages (ja-JP, en-GB); an end-to-end test with a live speaker is still to be done before the demo.

**Other checks.** Receipt vision with Qwen3-VL 2B on the hub read 1 synthetic receipt exactly (one generated image only). The on-device receipt reader is unit-tested on hand-built OCR layouts and has been run on the phone with our labeled test images; accuracy on real receipts has not been measured yet. Unit tests: `npm test` (68) and `cd cloud && pytest` (5).

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

- **Models:** Gemini Nano (Android AICore; ML Kit GenAI Prompt API 1.0.0-beta2); Google ML Kit Text Recognition v2, Translation 17.0.3, Language ID 17.0.6; Android on-device speech recognition and text-to-speech (Speech Services by Google / Android System Intelligence); optional hub: Gemma 3 4B and Qwen3-VL 2B via Ollama. Evaluated, not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Frameworks and libraries:** Expo SDK 57, React Native 0.86, Expo Modules API (Kotlin), expo-image-picker, expo-network, expo-speech, expo-speech-recognition, AsyncStorage, `@react-native-ml-kit/text-recognition`; Next.js 16, React 19, Tailwind CSS 4, Vitest; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Android AICore, Android speech services and Google ML Kit (all on-device). Optional and secondary: Render and Supabase. No cloud AI APIs.
- **Existing code and assets:** scaffolds from `create-next-app`, `create-expo-app` (blank TypeScript, MIT) and `create-expo-module`. Everything else — code, app icon, test images — was made during the hackathon (git history from Oct 9, 2026, 2:38 PM).
- **AI development tools:** Claude Code (Anthropic).
- **Inspiration only:** PopLingo inspired the read-and-translate idea; none of its code or services are used.
- **Exchange rates:** BSP Reference Exchange Rate Bulletin, Oct 8, 2026, for 19 currencies including JPY, KRW, HKD, SGD, TWD, THB, VND, MYR, IDR, AED, SAR, QAR and KWD.

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
