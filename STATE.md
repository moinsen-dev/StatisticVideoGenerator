# STATE — StatRace

> **Frozen:** 2026-09-23 13:58
> **Branch:** `main` · public: https://github.com/moinsen-dev/StatisticVideoGenerator (MIT)
> **Live:** https://statrace.moinsen.dev (Cloudflare Pages, project `statrace`, static, BYOK): landing page at `/`, studio at `/app`, local models included (Codex only locally).
> **Last commit:** „feat: Recherche ohne API-Key – lokales Modell (Ollama, LM Studio) und Codex“ (a168a43, pushed, CI green) + hint fix for the hosted page
> **Dirty:** clean · the local-only branch `idea-loop/monetarisierung` is deliberately not on GitHub

## Last work-unit

Research without an API key (2026-09-23, ~47 min, of which ~25 min waiting for local model runs):

- **Codex CLI as a second subscription provider** (ChatGPT plan, local server only).
  - Runs `codex --search exec` with `--output-schema` and `--ignore-user-config`.
  - Real run, „Meistabonnierte YouTube-Kanäle“: 2:34 min, 4 searches, 18 channels 2010–2025.
- **Local model through Ollama, LM Studio or any OpenAI-compatible server**, also usable on the hosted site.
  - It researches open data through tools that run in the browser: OWID and Wikipedia.
  - The app fills OWID values in exactly, from the full table, so the model only references entities instead of copying numbers.
  - Measured with Qwen 3.8 27B MLX (CO₂ by country): 7:29 → **4:22 min**. 19 countries × 35 years, exact values, sources linked.
  - Qwen 3.5 4B: 92 s, but it read no source and got numbers wrong. Such datasets are now marked „nicht recherchiert“.
- **UI:**
  - Provider dropdown on the home screen.
  - Settings with connection check: server down vs. `OLLAMA_ORIGINS` missing.
  - Landing page: local model card („kostenlos“) and FAQ „Geht das ganz ohne API-Key?“.
- **Gemini CLI left out:** same grounding terms as the Gemini API.

## Next intended step

1. Uli uses a local model once on the hosted site:
   - Run `launchctl setenv OLLAMA_ORIGINS "https://statrace.moinsen.dev"` and restart Ollama.
   - Allow Chrome's prompt for access to apps on the device.
   - So far only tested from localhost. The Browser pane blocks localhost from public pages without asking.
2. Still open: a run with a real Anthropic key and a real OpenAI key.

## Open friction

- **Local speed:** on an M4 Pro, prompt processing runs at ~100 tokens/s and output at ~25 tokens/s.
  - Wikipedia tables are expensive, because Qwen reads every digit as a token.
  - Only OWID values are filled in exactly. Wikipedia numbers are still typed by the model.
- **Unverified request bodies:** neither BYOK path has seen a valid key:
  - OpenAI: strict JSON schema combined with `web_search`.
  - Anthropic: strict tool combined with web search.
- **Events come from the model's own knowledge** for local models; there is no web search. Check them in the Data tab.
- **Local CLI modes** (Claude Code, Codex) use your own subscription and are for your own use only.

## Live context for the agent

- **Hot files:**
  - `src/lib/research-local.ts`, `src/lib/open-data.ts`, `server/research-codex.ts`, `src/lib/providers.ts`
- **Deploy:** `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`
- **Test a local model:**
  - In the Browser pane: `/app`, choose „Lokales Modell“ as the research AI, then check the Ollama log in `~/.ollama/logs/server.log`.
  - It prints „Prompt processing progress … total=N“. N shows how many tokens were **not** served from the cache.

## Docs

- `README.md`: product, providers (incl. `OLLAMA_ORIGINS`), privacy, architecture · `CONTRIBUTING.md`: rules for contributors
- `CLAUDE.md`: commands, trigger map, fixed rules (incl. the local model design)
