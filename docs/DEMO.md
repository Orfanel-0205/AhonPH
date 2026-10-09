# KitaPH — Demo Day playbook

5 minutes live + 3 minutes Q&A. Show the product; slides are optional (one title slide at most).

## Before you go on stage (do this at the 12:15 PM tech check)

- [ ] Phone charged above 60%, Do Not Disturb on, brightness high.
- [ ] KitaPH setup finished: Privacy shows **Gemini Nano: Ready** and the language packs you will demo (Tagalog + Korean, or your chosen language) are downloaded.
- [ ] Data ready: either your own real receipts, or **Privacy → Load sample data** (Joy). Decide which, and practice with it.
- [ ] Two printed or real receipts and one Tagalog menu in your pocket (the test images in `KitaPH-test` on the phone are the backup).
- [ ] Phone screen mirrored to the laptop with **scrcpy** over USB (works in airplane mode), laptop on HDMI. Test the projector.
- [ ] Optional: laptop hub running (`npx next start -H 0.0.0.0 -p 3000`) in case you want to show the bigger model.
- [ ] Backup: the 1-minute demo video on the laptop, ready to play.

## Script (5:00)

**0:00 – 0:40 · The problem.** "Meet Joy. Service crew in Makati, ₱755 a day, the new NCR minimum wage. Last month she spent 98% of what she earned and couldn't say where it went. Prices are up 7.2% this September; rice is up 20.3% (PSA). Budgeting apps want her bank login, a data plan, and her trust. She has none of those to spare."

**0:40 – 1:00 · The promise.** "The challenge asks for AI that stays useful when the cloud disappears. So let's make it disappear." *Turn on airplane mode now.* Point at the header: **Offline · AI still on**. "KitaPH reads Joy's receipts and answers her in Taglish — all on this phone."

**1:00 – 2:10 · Scan a receipt (live, airplane mode).** Scan → photo of a real receipt.
- "Read on this phone in under a second." Point at **Items add up to the TOTAL ✓**: "The AI reads; plain code checks every peso."
- Point at **0 bytes sent · cloud OCR would need this X MB photo**: "On load she pays for, a cloud app would upload this. KitaPH sends nothing."
- Show the breakdown and the tips: cheaper store from her own past receipts, price change since last purchase, rice inflation.
- Save.

**2:10 – 3:10 · Kita AI (still airplane mode).** Kita AI tab, engine **This phone**.
- Type: `jeep 26, lunch 95, load 50 sa Globe, pinadala ko kay mama 2k` → Basahin → records appear (family padala correctly an expense).
- Tap **Paano ako makakatipid sa susunod na buwan?** → the answer streams in Taglish.
- Point at **All numbers match your records ✓**: "If the AI ever invents a peso amount, KitaPH flags it."

**3:10 – 3:50 · Traveler mode.** Scan → Traveler → photo of a Tagalog menu.
- Auto-detects Filipino, translates to Korean on the phone, converts prices to won with BSP rates, explains that service charge goes 100% to staff by law (RA 11360).

**3:50 – 4:30 · Why local matters.** Privacy tab → **If the cloud disappears** card (still offline: every row ✓). Then Home → **Presyo**: "Her personal inflation is 10.7% while the official rate is 7.2% — that needs a year of her receipts, which only makes sense on her own phone."
- Private: receipts and salaries never leave the phone; no account, no cloud AI.
- Free: no per-question cloud cost, so it stays free for minimum-wage workers.
- Offline: works without load or signal — you just watched it.
- Honest numbers: "We measured it on sentences we never tuned for: on this phone, offline, 12 out of 15 fully right; on the laptop hub, 14 out of 15. Here is the test." (Privacy → Test the on-device AI.)

**4:30 – 5:00 · Close.** "KitaPH: pera mo, phone mo, AI mo. Your money, your phone, your AI. Thank you."

## If something breaks

| Problem | Do this |
|---|---|
| Gemini Nano errors or is slow | Kita AI → switch engine chip to **Laptop hub** (needs the same Wi-Fi as the laptop) or **Basic mode**. Say: "KitaPH falls back gracefully." |
| Camera won't focus | Scan → **Choose from gallery** → `KitaPH-test` album. |
| Translation pack missing | Use English as the target (always on the phone) or skip traveler mode. |
| Projector/mirroring fails | Hold the phone up to the camera and narrate, or play the backup video. |

## Likely judge questions

**Is the AI really on the device?** Yes. Airplane mode is on during the demo. Receipt reading and translation use Google ML Kit's on-device models; Taglish chat uses Gemini Nano, the model built into Android (AICore). The Privacy screen lists what runs where, and the code is public.

**What if a phone doesn't have Gemini Nano?** Receipt reading, breakdowns, tips and traveler mode work on any Android phone. For Taglish chat, KitaPH can use a laptop "hub" running Gemma 3 4B on the same Wi-Fi (no internet), or basic mode (keyword rules, 9 of 15 on the final set).

**How accurate is it?** We only quote what we measured, on a final test set committed before our last improvement and scored once: Gemini Nano on this phone got 12 of 15 Taglish sentences fully right (8 from the model alone, the rest from our local keyword knowledge); Gemma 3 4B on a laptop got 14 of 15. Receipt reading is checked against the printed total every time, and nothing is saved until the user confirms.

**How do you stop the AI from making up numbers?** The AI never does math. Totals, budgets and tips are computed by tested code (62 unit tests, plus 5 for the cloud service). The AI only explains, and every peso amount in its answer is checked against the user's records.

**Why not just use the cloud?** Because the people who need this most can't afford data or trust a server with their receipts and salary. Local AI also costs nothing per question.

**Where do the economic numbers come from?** PSA September 2026 inflation (released Oct 6), DOLE Wage Order NCR-28, and the BSP reference rates of Oct 8, 2026, bundled with their dates.

**What did you build versus reuse?** Everything was built during the hackathon from the `create-next-app` and `create-expo-app` templates. Models and libraries are open or Google-provided and are listed in the README.

**What's next?** MSME mode for sari-sari stores, Bisaya and Ilocano, reading GCash/Maya SMS on-device, and an opt-in anonymous community price index.
