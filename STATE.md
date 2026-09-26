# STATE — StatRace

> **Frozen:** 2026-09-25 12:05
> **Branch:** `main` · public: https://github.com/moinsen-dev/StatisticVideoGenerator (MIT)
> **Live:** https://statrace.moinsen.dev (Cloudflare Pages, project `statrace`, BYOK): landing page at `/`, studio at `/app`, local models included (Codex only locally). Public gallery live since 2026-09-25 (Pages Function + D1 `statrace-gallery`, EU jurisdiction), still empty.
> **Last commit:** „docs(state): Galerie live“ (pushed, deployed)
> **Dirty:** clean · the local-only branch `idea-loop/monetarisierung` is deliberately not on GitHub

## Last work-unit

Gallery without our own AI key (2026-09-24, ~35 min). StatRace is non-profit, so the review runs on the submitter's own AI:

- **One rule list, two AI steps, both with the user's AI** (`CONTENT_RULES` in `shared/prompt.ts`):
  - The research refuses topics that break the rules (field `refusal`).
  - Before submitting, the chosen research AI reviews the entry (`src/lib/review.ts`; prompt in `shared/review.ts`).
    It works with the Anthropic key, the OpenAI key, a local model, or `/api/review` for the local CLIs.
    Only approved entries are submitted, and they are public at once.
- **Tested (Claude Code and Codex CLI):** the CO₂ example passes; „most criminal ethnic groups“ and „vaccines cause autism“
  are rejected. In the browser: „Deine KI prüft …“ → published; a religion ranking → „Deine KI hat den Eintrag abgelehnt“.
  - Before the prompt fix, both AIs also rejected the CO₂ example over small factual slips. The fix: rule violations
    only, no fact-checking.
- **Reports** hide the entry at once. The notifier gets a receipt, business@moinsen.dev a note, and Uli decides on
  `/app#moderate`; the decision mail then goes to the notifier. Tested locally with console mails.
- The gallery runs no AI of its own. The gallery rules (`public/gallery-terms.html`) and the privacy section
  `#statrace` in `website2025` say so.

## Next intended step

1. **Deploy the website (open question to Uli):** the privacy section `#statrace` is pushed to `website2025/develop`
   (`75580e1`), but moinsen.dev still shows „Stand: Januar 2026“. moinsen.dev runs behind Cloudflare Tunnel
   `8b6b20db-…` (DNS), not on Coolify: the repo README is stale. A push does not deploy. Until the deploy, the
   gallery's privacy link points to a page without the StatRace section.
2. **First live run:** submit one entry on statrace.moinsen.dev (your key or local model), report it with your own
   email, decide it on `/app#moderate` with the `ADMIN_TOKEN`. That is the first live test of Resend and D1 writes.
3. Still open: a hosted local-model run with `OLLAMA_ORIGINS`, and runs with real Anthropic and OpenAI keys
   (research and gallery review).

## Open friction

- **The browser review can be bypassed:** anyone can call the API directly with a forged entry.
  - What protects the gallery: fixed server checks, daily limits, and reports that hide an entry at once.
  - Reports need Uli's decision. Someone could also report many entries and hide them all.
  - Free server-side screening with Cloudflare Workers AI (Llama Guard) would close part of the gap. Not built.
- **Local speed:** on an M4 Pro, prompt processing runs at ~100 tokens/s and output at ~25 tokens/s.
  - Wikipedia tables are expensive, because Qwen reads every digit as a token.
  - Only OWID values are filled in exactly. Wikipedia numbers are still typed by the model.
- **Unverified request bodies:** these have not run with a real key yet:
  - OpenAI: strict JSON schema with `web_search`, and the review via Responses with a strict schema.
  - Anthropic: strict tool with web search, and the review via `messages.parse`.
- **Events come from the model's own knowledge** for local models; there is no web search. Check them in the Data tab.
- **Local CLI modes** (Claude Code, Codex, and their gallery reviews) use your own subscription and are for your own
  use only.

## Live context for the agent

- **Hot files:**
  - `shared/review.ts`, `src/lib/review.ts`, `server/review-cli.ts`, `server/gallery.ts`, `src/components/GalleryPanel.tsx`,
    `public/gallery-terms.html`
  - `src/lib/research-local.ts`, `src/lib/providers.ts`
- **Deploy:** `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`
- **Test the gallery locally:**
  - `npm run dev`, open a project, go to the „Galerie“ tab; the AI saved in the settings reviews the entry.
  - Mails go to the console. Oversight: `/app#moderate`, token `local`.
- **Test a local model:**
  - In the Browser pane: `/app`, choose „Lokales Modell“ as the research AI, then check the Ollama log in `~/.ollama/logs/server.log`.
  - It prints „Prompt processing progress … total=N“. N shows how many tokens were **not** served from the cache.

## Docs

- `README.md`: product, providers (incl. `OLLAMA_ORIGINS`), privacy, gallery self-hosting, architecture · `CONTRIBUTING.md`: rules for contributors
- `CLAUDE.md`: commands, trigger map, fixed rules (incl. the local model design and the gallery)
- `RESEARCH.md` → `docs/research/`: legal review of the gallery
