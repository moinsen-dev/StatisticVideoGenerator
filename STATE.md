# STATE — StatRace

> **Frozen:** 2026-09-24 13:15
> **Branch:** `main` · public: https://github.com/moinsen-dev/StatisticVideoGenerator (MIT)
> **Live:** https://statrace.moinsen.dev (Cloudflare Pages, project `statrace`, static, BYOK): landing page at `/`, studio at `/app`, local models included (Codex only locally).
> **Last commit:** „feat: Galerie ohne Moderationsteam – KI-Prüfung, Inhaltsregeln in der Recherche“ (local, not pushed; the gallery goes public with the next deploy)
> **Dirty:** clean · the local-only branch `idea-loop/monetarisierung` is deliberately not on GitHub

## Last work-unit

Gallery without a moderation team (2026-09-24, ~50 min). Uli has no staff to review anything, so the AI enforces the rules itself:

- **One rule list, three layers** (`CONTENT_RULES` in `shared/prompt.ts`):
  - The research refuses topics that break the rules (field `refusal`). Tested with the claude CLI:
    „Kriminalität nach ethnischer Herkunft“ is refused with the rule named.
  - Every submission is reviewed at once by Claude Sonnet 5 (`server/moderation.ts`). Tested: the CO₂ example
    is approved, „most criminal ethnic groups“ is rejected (about 5 s per review).
  - A report hides the entry and triggers a fresh review. Tested: reports about taste or climate denial leave it
    online. The decision mail goes to the notifier; the copy to business@moinsen.dev carries no personal data.
- **Hosted path tested** with `wrangler pages dev` and a local D1:
  - Without `ANTHROPIC_API_KEY`, submissions get 503 and nothing is published.
  - A report whose review fails keeps the entry hidden. The operator decides on `/app#moderate`, and the notifier
    then gets a mail with that decision.
- **Legal texts live in code:** `public/gallery-terms.html` (rules, Art. 14 automation, contact point
  business@moinsen.dev); the privacy section `#statrace` is committed in `website2025` (`86c635f`, not pushed).

## Next intended step

1. Go-live, after Uli's go:
   - `npx wrangler d1 create statrace-gallery`;
   - `wrangler.toml` with `pages_build_output_dir = "dist"` and D1 binding `DB`;
   - Uli sets the secrets `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `ADMIN_TOKEN` and `RATE_SALT`
     (`npx wrangler pages secret put <NAME> --project-name statrace`);
   - push and deploy StatRace, then push `website2025` (privacy section).
2. After the deploy, submit one entry and one report on the live site. That is the first run of the API review and
   of Resend.
3. Still open: a hosted local-model run with `OLLAMA_ORIGINS`, and runs with real Anthropic and OpenAI keys.

## Open friction

- **The AI decides alone:** it can wrongly reject or keep an entry.
  - Mitigation: a report means a second review; people who disagree write to business@moinsen.dev; `/app#moderate`
    can override.
  - Cost: about 1–2 cents per review, capped at 300 reviews a day.
  - No captcha yet. Add Cloudflare Turnstile if spam shows up.
- **Local speed:** on an M4 Pro, prompt processing runs at ~100 tokens/s and output at ~25 tokens/s.
  - Wikipedia tables are expensive, because Qwen reads every digit as a token.
  - Only OWID values are filled in exactly. Wikipedia numbers are still typed by the model.
- **Unverified request bodies:** none of these has run with a real key yet:
  - OpenAI: strict JSON schema combined with `web_search`.
  - Anthropic: strict tool combined with web search, and the gallery review via `messages.parse`.
- **Events come from the model's own knowledge** for local models; there is no web search. Check them in the Data tab.
- **Local CLI modes** (Claude Code, Codex, and the gallery review on the local server) use your own subscription
  and are for your own use only.

## Live context for the agent

- **Hot files:**
  - `server/gallery.ts`, `server/moderation.ts`, `server/mail.ts`, `shared/prompt.ts` (`CONTENT_RULES`), `public/gallery-terms.html`
  - `src/lib/research-local.ts`, `src/lib/providers.ts`
- **Deploy:** `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`
- **Test the gallery locally:** `npm run dev`, then `POST /api/gallery` on port 8790 (the claude CLI reviews, mails
  go to the console). Oversight: `/app#moderate`, token `local`.
- **Test a local model:**
  - In the Browser pane: `/app`, choose „Lokales Modell“ as the research AI, then check the Ollama log in `~/.ollama/logs/server.log`.
  - It prints „Prompt processing progress … total=N“. N shows how many tokens were **not** served from the cache.

## Docs

- `README.md`: product, providers (incl. `OLLAMA_ORIGINS`), privacy, gallery self-hosting, architecture · `CONTRIBUTING.md`: rules for contributors
- `CLAUDE.md`: commands, trigger map, fixed rules (incl. the local model design and the gallery layers)
- `RESEARCH.md` → `docs/research/`: legal review of the gallery
