# LakbayMate — submission answers

Copy each field into the Cerebral Valley form. Items in [brackets] still need filling in.

**Project name:** LakbayMate — Your Smart Travel Companion

**Short description:** LakbayMate is an offline travel companion for Filipinos abroad. Talk with anyone: LakbayMate hears their language, shows it in Filipino or English, suggests replies you can edit, says your answer aloud in natural Japanese, Korean or Chinese, and translates it back so you can check it. Scan menus to get dish names and prices in pesos. Set a trip budget that updates the moment you log spending, with tips. All the AI runs on the phone (Gemini Nano, ML Kit, on-device speech), so it works in airplane mode, and the built-in AI Lab proves it: nine live AI steps with timings, and Android's own count of the bytes sent (zero).

**Team members:** [official team name and member names from appbuildersph.com/hackathon]

**Public GitHub repository:** [https://github.com/…]

**Demo video:** [link] · **X / LinkedIn post:** [link]

## Why does this product benefit from running AI locally?

Abroad, the cloud really does disappear: no roaming, a dead pocket Wi-Fi, a subway, a plane. That is exactly when a Filipino traveler or OFW needs to talk to a hotel clerk, read a menu, or check if they can still afford dinner. LakbayMate stays fully useful offline because every model runs on the phone:

- **Available when it matters.** On-device speech recognition, translation, text recognition and Gemini Nano work in airplane mode (verified on a POCO X7 Pro).
- **Not expensive.** No roaming or per-request cloud cost to translate a menu, answer a host or check a budget. Each scan shows "0 bytes sent" next to the real photo size.
- **Private.** Passports, hotel addresses, messages from hosts, receipts and spending stay on the phone. There is no account and no cloud AI.
- **Fast enough for a conversation.** Replies don't wait on uploads over weak signal, and the budget updates the instant you log something.

## What runs locally

- Speech recognition of the other person: Android on-device speech recognition (offline language packs).
- Natural Japanese, Korean and Chinese in both directions, reply ideas, menu dish names, budget tips in plain words, no-receipt logging and the money advisor: Gemini Nano, Android's built-in model (AICore), via the ML Kit GenAI Prompt API. Every answer is checked by code; ML Kit, a phrasebook, keyword rules or code-only tips take over when it is unavailable or fails a check.
- Other languages, back-translations and language detection: Google ML Kit on-device translation and language identification.
- Hand-checked Japanese, Korean and Chinese for common traveler phrases.
- Reading your reply aloud: Android text-to-speech with offline voices.
- Menu, sign and receipt reading: Google ML Kit Text Recognition v2 (Latin, Japanese, Korean and Chinese models, bundled in the app).
- Trip budget (left, today's share, pace), prices in pesos, receipt checks and tips: LakbayMate code with bundled BSP exchange rates.
- All user data: stored only on the phone.

## What requires internet

- One-time downloads: Gemini Nano (managed by Android), translation language packs (~30 MB each), offline speech packs.
- Optional LakbayMate Cloud (FastAPI + Supabase): refreshing exchange rates and economic figures, and end-to-end encrypted backup. Not needed for any feature above.

## Disclosures

- **Models used:** Gemini Nano (Android AICore, via ML Kit GenAI Prompt API 1.0.0-beta2); Google ML Kit Text Recognition v2 (Latin, Japanese, Korean, Chinese), Translation 17.0.3 and Language ID 17.0.6; Android on-device speech recognition and text-to-speech; optional laptop hub: Gemma 3 4B and Qwen3-VL 2B via Ollama. Evaluated and not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Technologies and frameworks:** Expo SDK 57, React Native 0.86, TypeScript, Kotlin (Expo Modules API), expo-speech-recognition, expo-speech, expo-image-picker, expo-network, AsyncStorage, `@react-native-ml-kit/text-recognition`; Next.js 16, React 19, Tailwind CSS 4; Vitest; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Android AICore, Android speech services, the Android share sheet and Google ML Kit (all on-device). Optional and secondary: Render (hosting) and Supabase (Postgres/Auth) for LakbayMate Cloud. No cloud AI APIs.
- **Existing code and assets:** project scaffolds from `create-next-app`, `create-expo-app` (blank TypeScript template) and `create-expo-module`. All other code, the phrasebook and its translations, the app icon and the test images were made during the hackathon (git history starts Oct 9, 2026, 2:38 PM).
- **Data sources:** BSP Reference Exchange Rate Bulletin (Oct 8, 2026, 19 currencies), PSA CPI September 2026, DOLE Wage Order NCR-28.
- **AI development tools:** Claude Code (Anthropic).
- **Inspiration only:** PopLingo (on-device text lookup) inspired the read-and-translate idea; none of its code or services are used.

## Measured results (reproducible, no other numbers claimed)

Taglish quick-log, three sets of 15 sentences (dev; held-out committed before tuning; final committed before the local-knowledge step and scored once). "AI only → AI + local knowledge":

- Gemini Nano on a POCO X7 Pro, offline: dev 10 → 13, held-out 11 → 14, **final 8 → 12 of 15**; median 8.7 s.
- Gemma 3 4B on the laptop hub: dev 15 → 15, held-out 12 → 14, **final 14 → 14 of 15**; median 2.1 s.
- Basic mode (no AI): dev 11, held-out 7, final 9 of 15.

Observed on the phone (single runs, not benchmarks): the AI Lab ran 9 of 9 on-device AI steps in 30.0 s and 28.2 s in airplane mode, with 0 bytes sent and received by the app (Android TrafficStats); Gemini Nano budget tips in 4.3 s and 4.6 s; Japanese OCR of a synthetic test menu in 0.2 s; Gemini Nano menu reading in 7.8–18.3 s over three runs. All test sentences were written by us; sets are small, so treat results as indicative. Details and caveats are in the README.

## Suggested post (X / LinkedIn)

> We built LakbayMate at #AppBuildersPH 2026: an offline travel companion for Filipinos abroad. Talk with anyone in natural Japanese, read menus as dish names in pesos, and keep a live trip budget, with the AI running entirely on the phone (Gemini Nano + ML Kit). Airplane mode on, still works. [video link] [repo link]

Tag Devin / Cognition as required; check their handles before posting.
