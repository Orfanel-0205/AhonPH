# KitaPH — offline travel and money companion for Filipinos abroad

Abroad, data costs money and the language is a wall. KitaPH helps Filipino travelers and OFWs **talk, read and keep their trip budget with no internet**:

- **Usap (Talk):** the other person speaks their language; you read it in Filipino or English with **reply bubbles** that fit what they said. Tap one, edit it, and KitaPH says it aloud in their language, with a **"Means: …" back-translation** so you can check it. Japanese, Korean and Chinese are written by **Gemini Nano** in natural, polite phrasing (the offline translator alone was stiff), and common traveler phrases use **hand-checked translations**. A message from your host or driver in a chat app can be **shared to KitaPH** to read and answer.
- **Scan:** point at a menu, sign or receipt. KitaPH reads Latin, Japanese, Korean and Chinese text on the phone, shows every price **in pesos**, and **Gemini Nano names each dish** with a short note (pork, beef, seafood, alcohol). Receipts are broken down and checked against the printed total.
- **Trip budget:** set a peso budget for the trip. Everything you scan, say or type ("taxi 2,300 yen") updates it **immediately**: what's left, **what you can still spend today** in pesos and yen, your pace, and tips. Tips are computed by code; Gemini Nano can add tips in its own words, and any tip with an amount that isn't in your records is dropped.

**All the AI runs on the phone** (speech recognition, translation, text recognition and Gemini Nano), so it keeps working in airplane mode, on a plane, in the subway, or without roaming.

Built for the AppBuildersPH Hackathon 2026 (theme: Local AI). Android app + optional laptop hub + optional cloud backup.

## Why local AI

The challenge: an AI product that stays genuinely useful when the cloud disappears. Abroad, the cloud often *has* disappeared (no roaming, a dead pocket Wi-Fi, a subway). A cloud-only version would be:

- **Expensive:** roaming or pocket Wi-Fi just to translate a menu, answer a host or check a budget. KitaPH needs no data after a one-time setup; each scan shows "0 bytes sent" next to the real photo size.
- **Unavailable when it matters:** at the taxi stand, check-in desk or market stall with no signal. KitaPH works in airplane mode (verified on a POCO X7 Pro).
- **Not private:** passports, hotel addresses, messages from hosts, receipts and spending would be sent to servers. KitaPH keeps them on the phone; no account, no cloud AI, no analytics.
- **Slow:** a conversation can't wait for uploads over weak signal; on-device speech and translation answer immediately.

## What runs where

| Feature | Runs on | Model / engine | Internet needed? |
|---|---|---|---|
| Hear the other person (Usap) | **Phone** | Android on-device speech recognition (`requiresOnDeviceRecognition`) | Once per language pack |
| Natural Japanese, Korean, Chinese (both directions) | **Phone** | Gemini Nano (Android AICore, ML Kit GenAI Prompt API) + code checks; ML Kit fallback | Once, for Android's model download |
| Other languages, back-translation, language detection | **Phone** | Google ML Kit Translation + Language ID | Once per language pack (~30 MB) |
| Reply bubbles | **Phone** | Phrasebook answers that fit, then Gemini Nano ideas | No |
| Say your reply aloud | **Phone** | Android text-to-speech | No (offline voices) |
| Read menus, signs, receipts | **Phone** | Google ML Kit Text Recognition v2: Latin, Japanese, Korean and Chinese models, all bundled | No |
| Dish names and notes on a menu | **Phone** | Gemini Nano, streamed line by line | No |
| Trip budget, prices in pesos | **Phone** | KitaPH code + bundled BSP rates (Oct 8, 2026) | No |
| Budget tips in plain words | **Phone** | Gemini Nano, checked against computed facts | No |
| No-receipt logging ("taxi 2,300 yen"), money advisor | **Phone** | Gemini Nano + KitaPH code checks | No |
| Receipt breakdown, add-up check, tips | **Phone** | KitaPH TypeScript code (unit-tested) | No |
| Bigger Taglish model (optional) | **User's laptop** over local Wi-Fi | Gemma 3 4B via Ollama | No |
| Rates/PSA refresh, encrypted backup (optional) | KitaPH Cloud | FastAPI on Render + Supabase | Yes |

If a phone can't run Gemini Nano, KitaPH falls back to ML Kit translation, the phrasebook, keyword logging and code-only tips, so it always answers. On our test phone, Android offers offline speech for Japanese, English and German but not Filipino, so travelers type or tap Filipino replies (or speak English).

## How it works

```
 Android phone (Expo / React Native + Kotlin module "KitaOnDevice")
 ┌───────────────────────────────────────────────────────────────────────────┐
 │ Usap:   their speech / shared message → ML Kit (instant) → Gemini Nano      │
 │         reading → reply bubbles → you edit → checked phrase, or Gemini Nano │
 │         (ja/ko/zh) or ML Kit → back-translation → TTS aloud / share back    │
 │ Scan:   photo → ML Kit OCR (script picked from the trip) → prices in pesos  │
 │         → Gemini Nano names each dish (streamed) ; receipts → add-up check  │
 │ Budget: any expense → trip status (code) → tips (code) + Gemini Nano tips   │
 │         whose every amount must appear in the facts                         │
 │ Data:   on-phone storage only                                               │
 └───────────────────────────────────────────────────────────────────────────┘
        ┆ optional, same Wi-Fi, no internet            ┆ optional, online
        ▼                                              ▼
 KitaPH Hub (Next.js + Ollama, Gemma 3 4B)     KitaPH Cloud (FastAPI + Supabase)
```

**The AI proposes; code checks.** Money is stored as integer centavos, and every total, budget and tip amount is computed by tested code. The AI never does arithmetic:

- Gemini Nano's Japanese/Korean/Chinese is used only if it is one line, in the right script, keeps every number from the English, and isn't an English answer or chatter; otherwise ML Kit translates. Every reply is translated back so the traveler can check the meaning.
- Its English reading of what the other person said must keep every number and contain no Japanese/Korean/Chinese.
- Trip tips: Gemini Nano sees only the computed facts, and a tip that uses any amount not in those facts is dropped (the screen says how many).
- Menu readings that are hedged ("not sure") or just repeat the original are dropped; ML Kit's translation stays for those lines.
- Receipt items must add up to the printed TOTAL; a known misread (unit price taken as line total) is detected and repaired.
- Every amount the quick-log extracts is checked against what the user typed, and nothing is saved until the user confirms.
- Every peso amount and percentage in an advisor answer is checked against the data the model was given; anything else is flagged on screen.

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

**Observed on the phone (POCO X7 Pro, single runs, not a benchmark).**

- Oct 9, ~10:45 PM, airplane mode: Usap said "Anong oras po ang check-out?" as 「チェックアウトは何時ですか？」 aloud; Gemini Nano logged "kape 450 yen" as ₱178.74 (¥450) in 5.9 s; the header switched to "Offline · AI still on".
- Oct 9, ~11:48 PM: "Where I can find Beijing Towers." Before, ML Kit gave 北京の塔を見つけることができる場所を教えてください。 With Gemini Nano: 北京のタワーはどこですか？ (back-translation: "Where is Beijing Tower?").
- Oct 9, ~11:53 PM: a Japanese host message shared to KitaPH (明日のチェックアウトは11時です。荷物はフロントでお預かりできますので…) was read by Gemini Nano as "Your check-out time is 11:00 AM tomorrow. You can leave your luggage at the front desk…". The reply was then said in Japanese in airplane mode.
- Oct 10, ~1:45 AM: Gemini Nano trip tips took 4.3 s and 4.6 s, and both runs passed the amount check. Logging "taxi 2300 yen" (−₱913.56) turned the sample trip's "today" box from ₱764 left to ₱149 over its share at once.
- Oct 10, ~2:00 AM, on a **synthetic** Japanese menu image we rendered on the laptop (6 dishes): Japanese OCR took 0.2 s. Gemini Nano named 6 of 6 dishes in 18.1 s. With a prompt asking for shorter notes, two more runs named 6 of 6 in 18.3 s and 3 of 6 in 7.8 s; ML Kit's translation stayed for the 3 it skipped. Real menus have not been measured.
- Oct 10, ~2:15 AM, one photo of a sample Japanese restaurant receipt (30 printed lines). Japanese OCR read 18 of the 19 money amounts exactly; ¥2,000 came out as "2.000". Store, address and slip words had 4 character slips (e.g. 搬 for 農). Before this change the app found only a table number ("¥2") and the totals. **We then wrote the Japanese receipt reader using this receipt** (it is a unit-test fixture, so this is not a held-out result): it now finds all 5 items with quantities, checks that they add up to 商品計 ¥19,500, and shows 合計 ¥20,940 ≈ ₱8,317 with tax ¥1,842. Gemini Nano named 5 of 5 items in 11.2 s. Saving it updated the trip budget at once.
- Speech recognition starts on the phone for installed languages (ja-JP, en-GB). An end-to-end test with a live speaker is still to be done.

Japanese quality was judged by our team, not formally evaluated. The hand-written Japanese, Korean and Chinese phrases are in `src/lib/talk.ts` for anyone to check.

**Other checks.** Receipt vision with Qwen3-VL 2B on the hub read 1 synthetic receipt exactly (one generated image only). The on-device receipt reader is unit-tested on hand-built OCR layouts and one real phone OCR fixture; accuracy on real receipts has not been measured. Unit tests: `npm test` (118) and `cd cloud && pytest` (5).

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

On first launch, **Set up your private AI** downloads Gemini Nano (through Android) and the translation packs you pick. After that, everything works in airplane mode. Gemini Nano needs a supported Android device; other phones use ML Kit, the hub or basic mode. To try the trip budget without a trip, tap **Try a sample trip (Tokyo)** on Home; it is labeled "Sample".

### KitaPH Hub (optional, laptop)

Requires Node.js 22+ and [Ollama](https://ollama.com).

```bash
ollama pull gemma3:4b
ollama pull qwen3-vl:2b
npm install
npm run build && npx next start -H 0.0.0.0 -p 3000
```

Open http://localhost:3000 for model status and the address to type into the phone (Gastos → Laptop hub). Allow Node.js through the firewall on private networks.

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
- The sample persona ("Joy"), the sample Tokyo trip and their prices are illustrative, not survey data.

## Disclosures

- **Models:** Gemini Nano (Android AICore; ML Kit GenAI Prompt API 1.0.0-beta2); Google ML Kit Text Recognition v2 (Latin, Japanese, Korean, Chinese), Translation 17.0.3, Language ID 17.0.6; Android on-device speech recognition and text-to-speech (Speech Services by Google / Android System Intelligence); optional hub: Gemma 3 4B and Qwen3-VL 2B via Ollama. Evaluated, not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Frameworks and libraries:** Expo SDK 57, React Native 0.86, Expo Modules API (Kotlin), expo-image-picker, expo-network, expo-speech, expo-speech-recognition, AsyncStorage, `@react-native-ml-kit/text-recognition`; Next.js 16, React 19, Tailwind CSS 4, Vitest; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Android AICore, Android speech services, Android share sheet and Google ML Kit (all on-device). Optional and secondary: Render and Supabase. No cloud AI APIs.
- **Existing code and assets:** scaffolds from `create-next-app`, `create-expo-app` (blank TypeScript, MIT) and `create-expo-module`. Everything else, including code, phrasebook translations, app icon and test images, was made during the hackathon (git history from Oct 9, 2026, 2:38 PM).
- **AI development tools:** Claude Code (Anthropic).
- **Inspiration only:** PopLingo inspired the read-and-translate idea; none of its code or services are used.
- **Exchange rates:** BSP Reference Exchange Rate Bulletin, Oct 8, 2026, for 19 currencies including JPY, KRW, HKD, SGD, TWD, THB, VND, MYR, IDR, AED, SAR, QAR and KWD.

## Repository layout

```
mobile/                       KitaPH Android app (Expo / React Native)
mobile/modules/kita-ondevice  Kotlin module: Gemini Nano, ML Kit translation, language ID, share intent
src/lib/                      shared, unit-tested logic (trip budget, phrasebook and translation checks,
                              menu reading, finance, receipt parsing, insights, prompts, test sets)
src/app/                      KitaPH Hub (Next.js): status page + local AI API routes
cloud/                        optional KitaPH Cloud (FastAPI) + Supabase schema
scripts/                      reproducible evaluation script
docs/                         demo playbook and submission answers
```
