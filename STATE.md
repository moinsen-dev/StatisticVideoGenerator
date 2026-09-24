# STATE — StatRace

> **Frozen:** 2026-09-24 12:20
> **Branch:** `main` · public: https://github.com/moinsen-dev/StatisticVideoGenerator (MIT)
> **Live:** https://statrace.moinsen.dev (Cloudflare Pages, project `statrace`, static, BYOK): landing page at `/`, studio at `/app`, local models included (Codex only locally).
> **Last commit:** „feat: öffentliche Galerie mit Vorab-Moderation und DSA-Meldeweg“ (local, not pushed: the legal drafts go public only after Uli's review)
> **Dirty:** clean · the local-only branch `idea-loop/monetarisierung` is deliberately not on GitHub

## Last work-unit

Public gallery (2026-09-24, ~45 min, including an 18-min legal review in the background):

- **Legal review against primary sources** (DSA, DDG, AI Act Art. 50, UrhG, GDPR, provider terms, Google),
  53 citations. Result: **okay under conditions**.
  - File: `docs/research/2026-09-24-oeffentliche-galerie-rechtslage.md`, index in `RESEARCH.md`.
- **Gallery built and tested locally**, on SQLite and as a Pages Function with a local D1:
  - Submit from the studio tab „Galerie“: dataset JSON only, CC BY-SA 4.0, Statista/paywall sources blocked, 5 per day.
  - Moderation at `/app#moderate`: approve, reject or remove with a reason.
  - Reporting after DSA Art. 16(2): prepared mails for receipt and decision; notifier data is deleted afterwards.
  - Submitters can withdraw their entry, which deletes it.
  - Gallery on the landing page and the home screen: label „KI-recherchiert · von moinsen geprüft“, disclaimer,
    imprint and privacy links.
- **Draft texts for Uli** in `docs/legal/`: gallery terms (Art. 14, with the contact point) and a privacy policy addition.

Before that, 2026-09-23: research without an API key (local models via Ollama, Codex), landing page, OpenAI, OSS release.

## Next intended step

1. Uli reviews the drafts in `docs/legal/` and:
   - provides the contact email for the DSA contact point (`[E-MAIL]`);
   - adds the privacy section on moinsen.dev.
2. Go-live, after Uli's go:
   - `npx wrangler d1 create statrace-gallery`;
   - `wrangler.toml` with `pages_build_output_dir = "dist"` and D1 binding `DB`;
   - Uli sets `ADMIN_TOKEN` (`npx wrangler pages secret put ADMIN_TOKEN --project-name statrace`) and `RATE_SALT`;
   - publish the terms in the app;
   - deploy.
3. Still open: a hosted local-model run with `OLLAMA_ORIGINS`, and runs with real Anthropic and OpenAI keys.

## Open friction

- **Gallery moderation costs time:** each entry needs a real content review (the AI Act exception only applies
  then), about 2–5 min per entry.
  - Confirmation mails go out manually through mailto links; automating them with Resend would need a key.
  - No captcha yet: many IPs could flood the queue. Add Cloudflare Turnstile if that happens.

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
  - `server/gallery.ts`, `src/lib/gallery.ts`, `src/components/GalleryPanel.tsx`, `Moderation.tsx`, `docs/legal/`
  - `src/lib/research-local.ts`, `src/lib/providers.ts`
- **Deploy:** `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`
- **Test a local model:**
  - In the Browser pane: `/app`, choose „Lokales Modell“ as the research AI, then check the Ollama log in `~/.ollama/logs/server.log`.
  - It prints „Prompt processing progress … total=N“. N shows how many tokens were **not** served from the cache.

## Docs

- `README.md`: product, providers (incl. `OLLAMA_ORIGINS`), privacy, architecture · `CONTRIBUTING.md`: rules for contributors
- `CLAUDE.md`: commands, trigger map, fixed rules (incl. the local model design)
