# LakbayMate — Demo Day playbook

5 minutes live + 3 minutes Q&A. Show the product; one title slide at most. Two people on stage: **the traveler** (holds the phone) and **the clerk** (speaks Japanese or English).

## Before you go on stage (12:15 PM tech check)

- [ ] Phone charged above 60%, **Do Not Disturb on**, brightness high, volume high (the phone speaks).
- [ ] Privacy → **If the cloud disappears** shows ✓ for all three rows. Offline speech installed for the clerk's language. Gemini Nano: Ready.
- [ ] Usap: **Ako: Filipino** (or English), **Sila: 日本語** (or English), situation **Hotel**. Hotel saved under "My stay".
- [ ] Fresh data for the demo: Privacy → **Delete all data**; Home → ✎ on the trip → **End and remove this trip** → **Try a sample trip** (Tokyo, day 3 of 5). Check that "Today you can still spend" is green and under ₱900 so the taxi in step 4 tips it over.
- [ ] The Japanese test menu (or a real one) in the gallery. A Japanese host message ready to share (a note or a chat message on the phone).
- [ ] Phone mirrored to the laptop with **scrcpy** over USB (works in airplane mode); laptop on HDMI. Test the projector.
- [ ] Rehearse the clerk's lines with the room's noise; speak clearly, close to the phone.
- [ ] Backup: the 1-minute demo video on the laptop.

## Script (5:00)

**0:00 – 0:30 · The problem.** "Millions of Filipinos land in Tokyo, Seoul, Hong Kong or Dubai every year, as tourists or OFWs. The first thing that disappears is the internet: no roaming, a dead pocket Wi-Fi, the subway. That's exactly when you need to talk to a hotel clerk, read a menu, and not overspend."

**0:30 – 0:45 · Make the cloud disappear.** *Turn on airplane mode.* Point at the header: **Offline · AI still on**.

**0:45 – 2:00 · Usap at the hotel.**
- Tap **Sila · 日本語**; the clerk says: *「パスポートを見せていただけますか？」* It appears in Filipino, with "✨ read by Gemini Nano".
- Reply bubbles: "Heto po ang pasaporte ko." Tap it, **edit** it, tap **Isalin at sabihin**. The phone says it in Japanese. Point at **"Means: …"**: "It translates my answer back, so I know it says what I meant."
- "Our Japanese-speaking teammate found the offline translator stiff, so Gemini Nano now writes Japanese the way people actually say it, and code checks every answer."
- Share the host's Japanese message to LakbayMate: it opens in Usap, read and with replies ready. Tap the share icon on your reply to send it back.

**2:00 – 2:50 · Scan the menu.** Scan → the Japanese menu. Japanese OCR on the phone, every price **in pesos**, and Gemini Nano names each dish as it reads ("Tonkatsu set meal · deep-fried pork cutlet"). Point at the allergy note and **0 bytes sent**.

**2:50 – 3:50 · Trip budget, live.** Home: **₱… left, today you can still spend ₱… (≈ ¥…)**. Gastos → say or type "taxi 2,300 yen" → **Basahin** → Save. The card turns red: **"Today is over its share by ₱…"**, and a pace warning appears. Back on Home, tap **Tips from Gemini Nano**: "✓ Checked: every amount comes from your own records. If the AI invents a number, we drop the tip."

**3:50 – 4:30 · Why local, honestly.** Privacy → **If the cloud disappears**. "Speech, translation, text recognition and Gemini Nano all run on this phone. We only show numbers we measured: on a Taglish test set we never tuned for, 12 of 15 fully right on this phone, 14 of 15 with a laptop model. The test is in the app and the repo."

**4:30 – 5:00 · Close.** "LakbayMate: kahit walang internet, may kasama ka sa lakbay. Even offline, you can talk, read and stay on budget. Thank you."

## If something breaks

| Problem | Do this |
|---|---|
| Speech doesn't catch the clerk | Clerk speaks closer and slower, or tap **Type what they said**. Or share the host message instead. |
| Gemini Nano is slow or errors | Translation falls back to ML Kit and bubbles to the phrasebook automatically; say "LakbayMate degrades gracefully." |
| Menu reading is slow | Prices in pesos show first; Gemini Nano's names stream in. Keep talking. |
| Camera won't focus | Scan → Choose from gallery → the saved menu photo. |
| Mirroring fails | Hold the phone up and narrate, or play the backup video. |

## Likely judge questions

**Is the AI really on the device?** Yes, airplane mode is on for the whole demo. Speech recognition uses Android's on-device recognizer (we require on-device mode), translation and text recognition are Google ML Kit's on-device models, and Gemini Nano is the model built into Android. The Privacy screen lists what runs where; the code is public.

**Why not just use Google Translate offline?** It translates; it doesn't hold the conversation with you. LakbayMate reads what was said, suggests what to answer, checks your answer by translating it back, reads menus into dish names in pesos, and keeps your trip budget live, all offline and in one place, built for Filipinos.

**How do you stop the AI from making things up?** The AI proposes and code checks. Japanese from Gemini Nano must be in Japanese script and keep every number, or we use ML Kit. Budget tips can only use amounts the code computed; others are dropped. Receipts must add up to the printed total. Money is computed by tested code, never by the model.

**What if a phone can't run Gemini Nano?** Translation (ML Kit), speech, scanning, pesos and the trip budget still work. Reply bubbles come from the phrasebook, tips come from code, and spending logs use keyword rules (9 of 15 on our final test set without any AI).

**Filipino speech?** Android doesn't offer offline Filipino speech recognition on our test phone, so the traveler types or taps Filipino replies (or speaks English). The other person's language is recognized offline.

**How accurate is it?** Only measured numbers: on a final Taglish test set committed before our last change and scored once, Gemini Nano on this phone got 12 of 15 fully right and Gemma 3 4B on a laptop 14 of 15. Translations and menu readings are shown with the original and a back-translation so the user can check them; we haven't run a formal translation evaluation.

**What did you build versus reuse?** Built during the hackathon from the Next.js, Expo and Expo-module templates; models and libraries are Google-provided or open and listed in the README.

**What's next?** More hand-checked phrases for OFW destinations (Arabic, Cantonese), group trip budgets, airport and clinic situations, and reading remittance receipts.
