# KitaPH — Demo Day playbook

5 minutes live + 3 minutes Q&A. Show the product; one title slide at most. You need two people on stage: **the traveler** (holds the phone) and **the clerk** (speaks English or Japanese).

## Before you go on stage (12:15 PM tech check)

- [ ] Phone charged above 60%, **Do Not Disturb on**, brightness high, volume high (the phone speaks).
- [ ] Privacy → **If the cloud disappears** shows ✓ for all three rows. Offline speech installed for the clerk's language (Privacy → Offline AI setup). Gemini Nano: Ready.
- [ ] Usap set to **Ako: Filipino**, **Sila: English** (or 日本語 if the clerk can speak Japanese), situation **Hotel**. Hotel saved under "My stay".
- [ ] Gastos trip currency set to **JPY**. A Japanese menu photo (or the test menu) ready in the gallery.
- [ ] Phone mirrored to the laptop with **scrcpy** over USB (works in airplane mode); laptop on HDMI. Test the projector.
- [ ] Rehearse the clerk's lines with the phone in the room's noise; speak clearly, close to the phone.
- [ ] Backup: the 1-minute demo video on the laptop.

## Script (5:00)

**0:00 – 0:40 · The problem.** "Every year, millions of Filipinos land in Tokyo, Seoul, Hong Kong or Dubai — as tourists or OFWs. The first thing that disappears is the internet: no roaming, the pocket Wi-Fi is dead, you're in the subway. And that's exactly when you need to talk to a hotel clerk, a taxi driver, a cashier."

**0:40 – 1:00 · Make the cloud disappear.** "The challenge asks for AI that stays useful when the cloud disappears. So let's make it disappear." *Turn on airplane mode.* Point at the header: **Offline · AI still on**.

**1:00 – 2:30 · Usap at the hotel (airplane mode).**
- Clerk taps nothing — the traveler taps **Sila magsalita** and the clerk says: *"Good evening. May I see your passport, please?"*
- The line appears with its Filipino translation. **Reply bubbles** appear — "Heto po ang pasaporte ko." Say: "Gemini Nano wrote these on the phone. No phrasebook guesswork."
- Tap a bubble, **edit it** ("…at ang booking ko"), tap **Isalin at sabihin** — the phone says it aloud in English. Tap ⤢ to show it big.
- Hotel/Taxi → **My stay** → show-to-driver card in the local language, read aloud.

**2:30 – 3:20 · Scan the menu (airplane mode).** Scan → Traveler → the Japanese menu. Detected Japanese, translated to Filipino on the phone, every price **in pesos** ("ラーメン ¥980 ≈ ₱389"). Point at **0 bytes sent**: "A cloud app would upload this photo over roaming you pay for."

**3:20 – 4:00 · No receipt? Say it (airplane mode).** Gastos → type or say "taxi 2,300 yen, ramen 980 yen" → **Basahin** → "taxi (¥2,300) −₱913.56". "Your trip budget, in pesos, without a single receipt or byte of data."

**4:00 – 4:40 · Why local, honestly.** Privacy → **If the cloud disappears** card (offline, every row ✓). "Speech, translation, text recognition and Gemini Nano all run on this phone. We measured our Taglish AI on sentences we never tuned for: 12 of 15 fully right on this phone, 14 of 15 with a laptop model — the test is in the app and the repo."

**4:40 – 5:00 · Close.** "KitaPH: kahit walang internet, may kausap ka. Even without internet, you can talk, read and keep track. Thank you."

## If something breaks

| Problem | Do this |
|---|---|
| Speech doesn't catch the clerk | Clerk speaks closer and slower, or type their line into the box; translation and bubbles still work. |
| Gemini Nano is slow or errors | Bubbles fall back to the phrasebook automatically; say "KitaPH degrades gracefully." |
| Camera won't focus | Scan → Choose from gallery → the saved menu photo. |
| Mirroring fails | Hold the phone up and narrate, or play the backup video. |

## Likely judge questions

**Is the AI really on the device?** Yes — airplane mode is on for the whole demo. Speech recognition uses Android's on-device recognizer (we require on-device mode), translation and text recognition are Google ML Kit's on-device models, and replies come from Gemini Nano, the model built into Android. The Privacy screen lists what runs where; the code is public.

**Why not just use Google Translate offline?** It translates; it doesn't hold the conversation with you. KitaPH suggests what to say next for the situation, lets you edit it, speaks it, keeps your hotel card ready for drivers, and turns prices and spending into pesos for your trip budget — all offline, in one place, built for Filipinos.

**What if a phone can't run Gemini Nano?** Translation, speech, scanning and peso conversion still work. Reply bubbles come from a phrasebook for each situation, and spending logs use keyword rules (9 of 15 on our final test set without any AI).

**Filipino speech?** Android doesn't offer offline Filipino speech recognition on our test phone, so the traveler types or taps Filipino replies (or speaks English). The other person's language is recognized offline.

**How accurate is it?** Only measured numbers: on a final Taglish test set committed before our last change and scored once, Gemini Nano on this phone got 12 of 15 fully right; Gemma 3 4B on a laptop 14 of 15. Every peso is computed by tested code, not the AI.

**What did you build versus reuse?** Built during the hackathon from the Next.js, Expo and Expo-module templates; models and libraries are open or Google-provided and listed in the README.

**What's next?** Offline packs for more OFW destinations, group trip budgets, reading GCash/remittance receipts, and more situations (clinic, airport, workplace).
