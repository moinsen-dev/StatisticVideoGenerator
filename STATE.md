# STATE — StatRace

> **Frozen:** 2026-09-23 12:45
> **Branch:** `main` · public: https://github.com/moinsen-dev/StatisticVideoGenerator (MIT)
> **Live:** https://statrace.moinsen.dev (Cloudflare Pages, project `statrace`, static, BYOK): landing page at `/`, studio at `/app`
> **Last commit:** „feat: Landingpage, Einstellungsseite und OpenAI als zweiter Recherche-Anbieter“ (4a7fefc, pushed, CI green) + this update
> **Dirty:** clean · the local-only branch `idea-loop/monetarisierung` is deliberately not on GitHub

## Last work-unit

Landing page, settings and a second AI provider (2026-09-23, ~40 min):

- **Landing page at `/`, studio at `/app`.**
  - Live demo: an example race plays through the real engine (portrait format on phones).
  - Four steps, "Why StatRace", examples, "Bring your own AI" and FAQ.
  - moinsen block: contact, the free AI analysis for SMEs, and moinsen.dev.
  - Footer: imprint and privacy link to moinsen.dev.
  - EN/DE.
- **Settings at `/app#settings`.**
  - Choose the research AI: Claude Code (local only), Claude via Anthropic, GPT via OpenAI.
  - One key per provider, the ElevenLabs key, and "remove all keys".
- **OpenAI as the second BYOK provider.**
  - Uses the Responses API with `web_search`, a strict JSON schema and `store: false`.
  - A key and model pre-check (`models.retrieve`) runs before research, because OpenAI sends rejected POSTs without CORS headers.
  - Checked in the browser:
    - An invalid key produces a clear 401 message in DE and EN.
    - Cancelling works.
  - A full run with a valid key is still missing.
- **Gemini left out on purpose:** the grounding terms forbid modifying or redistributing search results, and a published video does both.

## Next intended step

1. Run one full research each with a real Anthropic key and a real OpenAI key on https://statrace.moinsen.dev/app.
   - Success: a video with a dataset.
   - If the API rejects the request (400), the message appears verbatim in the research view. The fix goes into `src/lib/research-<provider>.ts`.

## Open friction

- **Unverified request bodies.** Neither BYOK path has seen a valid key:
  - OpenAI: strict JSON schema combined with `web_search`.
  - Anthropic: strict tool combined with web search.
- **Costs are estimates** from list prices, in `src/lib/providers.ts` and the adapters. Update them when models or prices change.
- **Research duration:** a run takes 2–5 min, mostly for writing the dataset (~11k characters).
- **The figures are estimates** from secondary sources. The app shows its sources and the prompt prefers open data. Check the numbers in the Data tab before publishing.
- **Local CLI mode:** it uses your own subscription and is for your own use only. The hosted version uses BYOK.
- **Emoji flags** render on macOS but are missing on Windows.

## Live context for the agent

- **Hot files:**
  - `src/lib/providers.ts`, `src/lib/research-openai.ts`, `src/lib/research-anthropic.ts`
  - `src/landing/Landing.tsx`, `src/lib/i18n.ts`
- **Deploy:** `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`
- **Calibration:**
  - OSS release (BYOK, i18n, examples, deploy): ~30 min.
  - Landing page + settings + OpenAI adapter, including research and browser checks: ~40 min.

## Docs

- `README.md`: product, providers, local operation, privacy, architecture
- `CONTRIBUTING.md`: rules for contributors, including how to add a provider
- `CLAUDE.md`: commands, trigger map, fixed rules
