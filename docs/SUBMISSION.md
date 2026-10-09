# KitaPH — submission answers

Copy each field into the Cerebral Valley form. Items in [brackets] still need filling in.

**Project name:** KitaPH

**Short description:** KitaPH is an offline travel and money companion for Filipinos abroad. Talk with anyone — KitaPH hears their language, shows it in Filipino or English, suggests replies you can edit, and says your answer aloud. Scan menus and receipts to translate them and see prices in pesos, and log spending by voice with no receipt. All the AI runs on the phone, so it works in airplane mode.

**Team members:** [official team name and member names from appbuildersph.com/hackathon]

**Public GitHub repository:** [https://github.com/…]

**Demo video:** [link] · **X / LinkedIn post:** [link]

## Why does this product benefit from running AI locally?

Abroad, the cloud really does disappear: no roaming, a dead pocket Wi-Fi, a subway, a plane. That is exactly when a Filipino traveler or OFW needs to talk to a hotel clerk, a taxi driver or a cashier. KitaPH stays fully useful offline because every model runs on the phone:

- **Available when it matters.** On-device speech recognition, translation, text recognition and Gemini Nano work in airplane mode (verified on a POCO X7 Pro).
- **Not expensive.** No roaming or per-request cloud cost to translate a menu, ask a question or log spending. Each scan shows "0 bytes sent" next to the real photo size.
- **Private.** Passports, hotel addresses, receipts and spending stay on the phone; there is no account and no cloud AI.
- **Fast enough for a conversation.** Replies don't wait on uploads over weak signal.

## What runs locally

- Speech recognition of the other person: Android on-device speech recognition (offline language packs).
- Translation and language detection: Google ML Kit on-device translation and language identification.
- Suggested reply bubbles, no-receipt logging and the money advisor: Gemini Nano, Android's built-in model (AICore), via the ML Kit GenAI Prompt API; a phrasebook and keyword rules when it is unavailable.
- Reading your reply aloud: Android text-to-speech with offline voices.
- Receipt, menu and price-tag reading: Google ML Kit Text Recognition v2, bundled in the app.
- Prices and spending in pesos, receipt checks, breakdowns, tips, budgets: KitaPH code with bundled BSP exchange rates and PSA/DOLE figures.
- All user data: stored only on the phone.

## What requires internet

- One-time downloads: Gemini Nano (managed by Android), translation language packs (~30 MB each), offline speech packs.
- Optional KitaPH Cloud (FastAPI + Supabase): refreshing exchange rates and economic figures, and end-to-end encrypted backup. Not needed for any feature above.

## Disclosures

- **Models used:** Gemini Nano (Android AICore, via ML Kit GenAI Prompt API 1.0.0-beta2); Google ML Kit Text Recognition v2, Translation 17.0.3 and Language ID 17.0.6; Android on-device speech recognition and text-to-speech; optional laptop hub: Gemma 3 4B and Qwen3-VL 2B via Ollama. Evaluated and not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Technologies and frameworks:** Expo SDK 57, React Native 0.86, TypeScript, Kotlin (Expo Modules API), expo-speech-recognition, expo-speech, expo-image-picker, expo-network, AsyncStorage, `@react-native-ml-kit/text-recognition`; Next.js 16, React 19, Tailwind CSS 4; Vitest; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Android AICore, Android speech services and Google ML Kit (all on-device). Optional and secondary: Render (hosting) and Supabase (Postgres/Auth) for KitaPH Cloud. No cloud AI APIs.
- **Existing code and assets:** project scaffolds from `create-next-app`, `create-expo-app` (blank TypeScript template) and `create-expo-module`. All other code, the phrasebook, the app icon and the test images were made during the hackathon (git history starts Oct 9, 2026, 2:38 PM).
- **Data sources:** BSP Reference Exchange Rate Bulletin (Oct 8, 2026, 19 currencies), PSA CPI September 2026, DOLE Wage Order NCR-28.
- **AI development tools:** Claude Code (Anthropic).
- **Inspiration only:** PopLingo (on-device text lookup) inspired the read-and-translate idea; none of its code or services are used.

## Measured results (reproducible, no other numbers claimed)

Taglish quick-log, three sets of 15 sentences (dev; held-out committed before tuning; final committed before the local-knowledge step and scored once). "AI only → AI + local knowledge":

- Gemini Nano on a POCO X7 Pro, offline: dev 10 → 13, held-out 11 → 14, **final 8 → 12 of 15**; median 8.7 s.
- Gemma 3 4B on the laptop hub: dev 15 → 15, held-out 12 → 14, **final 14 → 14 of 15**; median 2.1 s.
- Basic mode (no AI): dev 11, held-out 7, final 9 of 15.

Verified on the phone in airplane mode: Filipino → Japanese translation in Usap, Gemini Nano logging "kape 450 yen" in pesos (5.9 s). All sentences were written by us; sets are small, so treat results as indicative.

## Suggested post (X / LinkedIn)

> We built KitaPH at #AppBuildersPH 2026: an offline travel companion for Filipinos abroad. Talk with anyone, get reply suggestions, scan menus in pesos, log spending by voice — with the AI running entirely on the phone. Airplane mode on, still works. [video link] [repo link]

Tag Devin / Cognition as required; check their handles before posting.
