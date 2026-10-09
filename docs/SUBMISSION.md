# KitaPH — submission answers

Copy each field into the Cerebral Valley form. Items in [brackets] still need filling in.

**Project name:** KitaPH

**Short description:** KitaPH is a private money assistant for Filipino workers. Snap a receipt and it breaks down where your money went, checks every peso, and gives savings tips in Taglish, with all the AI running on your phone, even in airplane mode. Travelers can scan Tagalog menus and bills to translate them and convert prices offline.

**Team members:** [official team name and member names from appbuildersph.com/hackathon]

**Public GitHub repository:** [https://github.com/…]

**Demo video:** [link] · **X / LinkedIn post:** [link]

## Why does this product benefit from running AI locally?

KitaPH stays fully useful when the cloud disappears: in airplane mode it still reads receipts, breaks down spending, logs Taglish entries, explains receipts, shows personal inflation and translates menus. For our users, a cloud-only version would be:

- **Not private.** Receipts, salaries, remittances and debts are the most sensitive data a minimum-wage worker has. KitaPH never uploads them; there is no account and no cloud AI. The Privacy screen shows what stays on the phone.
- **Expensive.** Every cloud scan means uploading a 1–3 MB photo over paid mobile data and paying for inference per request. KitaPH shows "0 bytes sent" next to the real photo size on each scan, and costs nothing per use.
- **Slow or unavailable.** Text recognition runs on the phone (each scan shows how long it took) and never waits on a weak signal in the province or abroad without roaming.
- **Close to impossible.** "Presyo" compares the prices of the exact items you bought a year ago with today's, from a year of item-level receipts. That history is too personal to hand to a server; on the phone it is simply your data.

## What runs locally

- Receipt and menu text recognition: Google ML Kit Text Recognition v2, bundled in the app.
- Receipt parsing, add-up check against the printed total, spending breakdown, savings tips, budgets, personal inflation: KitaPH code on the phone.
- Taglish quick-log and money advisor: Gemini Nano, Android's built-in model (AICore), via the ML Kit GenAI Prompt API, on the phone. Optional: Gemma 3 4B via Ollama on the user's own laptop over local Wi-Fi.
- Traveler translation and language detection: ML Kit on-device translation and language identification.
- Currency conversion and economic context: bundled BSP, PSA and DOLE figures.
- All user data: stored only on the phone.

## What requires internet

- One-time downloads: Gemini Nano (managed by Android) and ML Kit translation language packs (~30 MB each).
- Optional KitaPH Cloud (FastAPI + Supabase): refreshing exchange rates and economic figures, and end-to-end encrypted backup. Not needed for any core feature.

## Disclosures

- **Models used:** Gemini Nano (Android AICore, via ML Kit GenAI Prompt API 1.0.0-beta2); Google ML Kit Text Recognition v2, Translation 17.0.3 and Language ID 17.0.6; Gemma 3 4B and Qwen3-VL 2B via Ollama on the optional laptop hub. Evaluated and not used: Llama 3.2 3B, Gemma 3 1B, Qwen3 1.7B.
- **Technologies and frameworks:** Expo SDK 57, React Native 0.86, TypeScript, Kotlin (Expo Modules API); Next.js 16, React 19, Tailwind CSS 4; Vitest; FastAPI, httpx, uvicorn, pytest.
- **APIs and cloud services:** Android AICore and Google ML Kit (on-device). Optional and secondary: Render (hosting) and Supabase (Postgres/Auth) for KitaPH Cloud. No cloud AI APIs.
- **Existing code and assets:** project scaffolds from `create-next-app`, `create-expo-app` (blank TypeScript template) and `create-expo-module`. All other code, the app icon and the test images were made during the hackathon (git history starts Oct 9, 2026, 2:38 PM).
- **AI development tools:** Claude Code (Anthropic).
- **Inspiration only:** PopLingo (on-device text lookup) inspired traveler mode; none of its code or services are used.

## Measured results (reproducible, no other numbers claimed)

Taglish quick-log, three sets of 15 sentences (dev; held-out committed before tuning; final committed before the local-knowledge step and scored once). "AI only → AI + local knowledge":

- Gemini Nano on a POCO X7 Pro, offline: dev 10 → 13, held-out 11 → 14, **final 8 → 12 of 15**; median 8.7 s.
- Gemma 3 4B on the laptop hub: dev 15 → 15, held-out 12 → 14, **final 14 → 14 of 15**; median 2.1 s.
- Basic mode (no AI): dev 11, held-out 7, final 9 of 15.
- Phone-sized open models on the dev set (laptop, via Ollama): Gemma 3 1B 3/15, Qwen3 1.7B 6/15 — why we use Android's Gemini Nano instead of shipping a small model.

All sentences were written by us; sets are small, so treat results as indicative. Reproduce with Privacy → Test the on-device AI (phone) and `scripts/eval-quicklog.mjs` (laptop).

## Suggested post (X / LinkedIn)

> We built KitaPH at #AppBuildersPH 2026: snap a receipt and see where your money went, with Taglish tips, and the AI runs entirely on your phone. Airplane mode on, still works. Private, free, offline. Built with @DevinAI / @cognition_labs tagged as required. [video link] [repo link]

Check the Devin / Cognition handles before posting.
