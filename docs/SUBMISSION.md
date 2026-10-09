# KitaPH — submission answers

Copy each field into the Cerebral Valley form. Items in [brackets] still need filling in.

**Project name:** KitaPH

**Short description:** KitaPH is a private money assistant for Filipino workers. Snap a receipt and it breaks down where your money went, checks every peso, and gives savings tips in Taglish, with all the AI running on your phone, even in airplane mode. Travelers can scan Tagalog menus and bills to translate them and convert prices offline.

**Team members:** [official team name and member names from appbuildersph.com/hackathon]

**Public GitHub repository:** [https://github.com/…]

**Demo video:** [link] · **X / LinkedIn post:** [link]

## Why does this product benefit from running AI locally?

KitaPH's users are minimum-wage workers whose receipts, salaries, remittances and debts are the most private data they have, and who often have no mobile data to spare. Running the AI on the phone makes the product private by construction (receipts and finances never leave the device; there is no account and no cloud AI), free to use (no per-question inference cost, so it can stay free for the people who need it most), and available offline (it works in airplane mode, in the province, or abroad without roaming). A cloud-only version would need users to upload receipts and salaries, pay for data on every question, and stop working whenever the signal does.

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

- Taglish quick-log, Gemma 3 4B on the laptop hub: 15/15 sentences, 20/20 records, median 1.6 s (`node scripts/eval-quicklog.mjs`). Model alone 14/15; one case fixed by a code rule added after we saw the failure.
- Same 15 sentences, Gemini Nano on a POCO X7 Pro: [run Privacy → Test the on-device AI and fill in].
- Basic mode (no AI, keyword rules): 11/15, written after the test set existed.
- Phone-sized open models on the same set (laptop, via Ollama): Gemma 3 1B 3/15, Qwen3 1.7B 6/15.

## Suggested post (X / LinkedIn)

> We built KitaPH at #AppBuildersPH 2026: snap a receipt and see where your money went, with Taglish tips, and the AI runs entirely on your phone. Airplane mode on, still works. Private, free, offline. Built with @DevinAI / @cognition_labs tagged as required. [video link] [repo link]

Check the Devin / Cognition handles before posting.
