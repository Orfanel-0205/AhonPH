# How LakbayMate was built

A short map of the engineering practices in this repository, for reviewers.

## Process

- **Agile and lean, in short loops.** Every feature went build → run on a real phone → fix → commit, usually within the hour. Feedback changed the plan: a Japanese-speaking teammate found the offline translations stiff, so Gemini Nano now writes Japanese, Korean and Chinese, and hand-checked phrases come first.
- **Measure before claiming.** Test sets were written and committed before tuning (Taglish spending: dev, held-out at 20:44, final at 20:47; bill split: held-out at 04:14), then scored once. The README reports both first and later scores.

## Design

- **Model / view / controller.** Tested logic and data live in `src/lib` (budgets, receipts, menus, splits, itineraries, prompts and their checks); screens in `mobile/src/screens` only display it; small engines (`nanoEngine.ts`, `localAI.ts`, `store.tsx`) connect the two.
- **Observer.** App-wide state (Gemini Nano status, the laptop hub, settings) is held in small stores that notify subscribed screens (`useSyncExternalStore`), instead of polling.
- **"AI proposes, code checks."** Every AI answer passes a code check before it is shown: right script, numbers kept, no invented amounts, names on the list, items that add up. Known facts (hand-checked phrases and dishes, the receipt's own totals) come before any AI.
- **Graceful degradation.** Gemini Nano → team laptop → ML Kit, phrasebook and rules. Every AI call has a timeout.

## APIs

The team laptop hub follows the REST conventions in [API.md](API.md): JSON resources, Bearer-key authentication, a token-bucket rate limit with `X-RateLimit-*` and `Retry-After`, standard status codes, and a client that troubleshoots by status code.

## Version control

Git from the first scaffold (Oct 9, 2:38 PM). Small commits with messages that say what changed and why. Generated Android code and secrets are not committed.

## Testing

- `npm test` (Vitest): unit tests for money, receipts (including real phone OCR output), translations' checks, menus, dishes, trip budget, bill split (including its measured accuracy), itineraries, rate limiting and authentication.
- `cd cloud && pytest`: the optional cloud API.
- On-device: the AI Lab runs every model on the phone and reports timings and bytes sent; the Taglish test runs all three sets on Gemini Nano.

## Data formats

JSON for every API and for stored data; YAML for deployment (`render.yaml`); SQL for the cloud schema (`cloud/supabase/schema.sql`).
