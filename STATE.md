# STATE — StatRace

> **Frozen:** 2026-09-23 11:05
> **Branch:** `main` · public: https://github.com/moinsen-dev/StatisticVideoGenerator (MIT)
> **Live:** https://statrace.moinsen.dev (Cloudflare Pages, project `statrace`, static, BYOK)
> **Last commit:** „feat: Open-Source-Release – BYOK im Browser, Oberfläche EN/DE, Beispiel-Galerie, MIT“ + this update
> **Dirty:** clean · the local-only branch `idea-loop/monetarisierung` is deliberately not on GitHub

## Last work-unit

Open-source release and deploy (2026-09-23):

- **Research in the browser with the visitor's own Anthropic key.**
  - Anthropic SDK with `dangerouslyAllowBrowser`, web search `web_search_20260209`, the dataset arrives
    through the strict tool `submit_dataset`.
  - Live check against the real API: a request with an invalid key comes back as a clean 401
    (CORS and error handling work).
  - A full run with a valid key has not been done yet.
- **ElevenLabs with the visitor's own key**, called straight from the browser (the API allows CORS).
- **UI in English and German**; progress arrives as language-neutral codes.
- **Four examples** that play without a key: market cap (EN), smartphones (DE), CO₂ from OWID (EN),
  population from World Bank data (DE).
- **Repo public:** README (EN) with screenshots, CONTRIBUTING, MIT, green CI (typecheck + build),
  Open Graph preview.

Before that, 2026-09-22: v1 from topic to MP4 via the local `claude` CLI; the decision is not to
turn it into a commercial product.

## Next intended step

Uli runs a full research once on https://statrace.moinsen.dev with his own Anthropic key.
Success: a video with a dataset. If the API rejects the request body (400), the message shows up in
the research view verbatim; the fix goes into `src/lib/research-byok.ts`.

## Open friction

- A research run takes 2–5 min, mostly for writing the dataset (~11k characters).
- The figures are estimates from secondary sources. The app shows sources, and the prompt prefers open data.
  Before publishing, check the numbers in the Data tab.
- The local CLI mode uses your own subscription and is for your own use only; the hosted version uses BYOK.
- Emoji flags render on macOS, but are missing on Windows.
- `wrangler pages project create` needed `--force` once (wrangler 4.135 delegates Pages to Workers).
  Redeploys run without it.

## Live context for the agent

- **Hot files:** `src/lib/research-byok.ts`, `src/lib/i18n.ts`, `public/examples/`
- **Deploy:** `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`
- **Calibration:** OSS release incl. BYOK, i18n, examples and deploy took ~30 min

## Docs

- `README.md`: product, local operation, privacy, architecture · `CONTRIBUTING.md`: rules for contributors
- `CLAUDE.md`: commands, trigger map, fixed rules
