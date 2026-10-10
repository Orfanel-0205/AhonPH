# LakbayMate — Demo Day reviewer

For Clifford, Frances and Claude. Read this before going on stage. Every number below is one we measured; never quote anything else.

## The 15-second pitch

> "Abroad, the internet is the first thing to go. That's exactly when a Filipino traveler or OFW needs to talk to a hotel clerk, read a receipt, or know if they can still afford dinner. LakbayMate is a travel companion whose AI runs on the phone, so it keeps working in airplane mode."

## What it does (five things, in demo order)

| Feature | One line | The proof moment |
|---|---|---|
| **Usap** | Their language in, yours out; reply bubbles; your answer said aloud in natural Japanese/Korean/Chinese, with a back-translation | Host message → "read by Gemini Nano" |
| **Your phrases** | Most-used and starred phrases become one-tap bubbles with their saved translation | Instant, no AI needed |
| **Scan** | Menus, signs and receipts in 4 scripts; prices in pesos; dish names from a hand-checked list | "Total corrected: the camera read ¥44,895" |
| **Hatian** | Say who had what in Taglish; shares add up to the yen | ¥1,632 / ¥1,357 / ¥1,906 = ¥4,895 |
| **Plan + Budget** | Tipid / Sakto / Bongga plan becomes a live trip budget | Log "taxi 2,300 yen", the card turns red |
| **AI Lab** | 10 on-device AI steps live, with timings | **0 bytes sent**, measured by Android |

## How it maps to the judging criteria

| Criterion (weight) | Our answer |
|---|---|
| **Problem & usefulness (25%)** | Clear user: Filipinos traveling or working abroad (tourists, OFWs). Real pain: no roaming, language wall, overspending in a foreign currency. |
| **Local AI (25%)** | Gemini Nano (Android AICore), ML Kit text recognition (4 scripts), translation and language ID, on-device speech and voices. Airplane mode for the whole demo. The AI Lab measures 0 bytes sent. Local AI is fundamental: without the internet abroad, a cloud app does nothing. |
| **Technical execution (20%)** | 166 unit tests + 6 cloud tests; measured test sets (Taglish spending: final 12/15 on the phone; bill split: no wrong item ever shown as checked in 100); every AI answer checked by code; timeouts and fallbacks. |
| **Innovation (15%)** | "Facts first, AI second, always checked": hand-checked phrases and dishes, two readers that must agree, the receipt's own totals. Team laptop AI for phones without Gemini Nano. A Filipino-first design (Taglish, pesos, Tipid/Sakto/Bongga, Hatian). |
| **Product & demo (15%)** | Live on a real phone in airplane mode; 1-minute video; AI Lab as proof. |

## Architecture in one breath

Phone (Expo / React Native + our Kotlin module) runs all AI. An optional **team laptop hub** (Next.js + Ollama, Gemma 3 4B) lends AI to phones without Gemini Nano over the laptop's hotspot, protected by a team key and a rate limit. An optional **cloud** (FastAPI on Render; Supabase, or SQLite when Supabase isn't set up) only stores encrypted backups and serves exchange rates. **No AI runs in the cloud.**

## Likely questions and answers

**Is the AI really on the phone?** Yes. Airplane mode and Wi-Fi off for the whole demo. The AI Lab runs 10 AI steps and Android's own per-app counter shows 0 bytes sent and received.

**Which models?** Gemini Nano, built into Android (AICore), via the ML Kit GenAI Prompt API. Google ML Kit for text recognition, translation and language ID. Android's on-device speech recognition and text-to-speech. Optional: Gemma 3 4B and Qwen3-VL 2B on a laptop via Ollama. We bundle no model; Gemini Nano is Android's.

**How do you stop the AI from making things up?** The AI proposes; code checks. Japanese must be in Japanese script and keep every number, or ML Kit is used. Tips can only use amounts the code computed. Receipts must add up to their printed totals. Known dishes come from a hand-checked list. For bill splits, rules and the AI read the sentence separately: in 100 test items, a wrong item was never shown as checked.

**How accurate is it?** Taglish spending, a final set committed before tuning and scored once: 12 of 15 fully right on the phone, 14 of 15 with the laptop model. Bill split: 11/12 development and 5/8 held-out sentences, every miss flagged. Small sets we wrote ourselves; indicative.

**What if a phone doesn't have Gemini Nano?** ML Kit translation, scanning, pesos, the budget, the phrasebook and rules still work. Or join the team laptop's hotspot and use its model, still offline.

**Why not Google Translate offline?** It translates. LakbayMate holds the conversation (reply ideas, back-translation, your phrases), reads receipts into checked totals in pesos, splits bills and keeps a live trip budget, all offline, built for Filipinos.

**Filipino speech?** Android has no offline Filipino speech recognition on our test phone, so the traveler types, taps or speaks English. The other person's language is recognized offline.

**What's in the cloud and why?** Optional: encrypted backup (ciphertext only) and exchange-rate refresh, on Render with Supabase or SQLite. Nothing the app needs to work.

**Is the hub secure?** Team key as a Bearer token (401 without it), token-bucket rate limit (429 with Retry-After), JSON only (415). See docs/API.md.

**Privacy?** No account, no analytics, no cloud AI. Messages, receipts and spending stay on the phone.

**Where do the prices in the planner come from?** Our own 2026 estimates, labelled "about" and "check before you go". Not live prices. Exchange rates are the BSP bulletin of Oct 8, 2026.

**What did you build vs reuse?** Built during the hackathon (git history from Oct 9, 2:38 PM) on the Next.js, Expo and Expo-module templates. Models and libraries are Google's or open source, all listed in the README. AI development tool: Claude Code.

**What's next?** More hand-checked phrases for OFW destinations (Arabic, Cantonese), group trip budgets, real-menu testing, and a wider test set.

## Do not say

- Any number not in this file or the README.
- "It never makes mistakes." Say: "When it isn't sure, it tells you."
- "Real-time prices." Say: "Planning estimates."

## Before going on stage (12:15 tech check)

- [ ] Phone charged, Do Not Disturb on, volume up, airplane mode **and** Wi-Fi off; header says "Offline · AI still on".
- [ ] AI Lab → AI on this phone: all green. Run the AI Lab once to warm Gemini Nano.
- [ ] Sample trip reset (docs/DEMO.md). Usap set to English ⇄ 日本語.
- [ ] scrcpy mirroring tested on the projector. The video ready as a backup.
