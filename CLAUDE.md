# StatRace – Arbeitsnotizen

Web-App: Thema → KI-Recherche (Claude, GPT oder lokales Modell) → Bar-Chart-Race-Video mit Fun-Facts und Soundtrack → MP4.
Open Source (MIT), live auf https://statrace.moinsen.dev (statisch, BYOK): Landingpage unter `/`, Studio unter `/app`.
Stand und nächste Schritte: `STATE.md`. Nutzersicht (Englisch): `README.md`, Beiträge: `CONTRIBUTING.md`.

## Befehle

- `npm run dev` – API (Node `--watch`, Port 8790) + Vite (Port 5190), beide über `concurrently`
- `npm run typecheck` – TypeScript 7 (`tsc --noEmit`)
- `npm run build` / `npm start` – Produktion: Vite-Build, Hono liefert `dist/` aus
- Browser-Pane: `.claude/launch.json` → `statrace`
- Deploy (statisch): `npm run build && npx wrangler pages deploy dist --project-name statrace --branch main --commit-dirty=true`

## Wenn du … → lies/prüf zuerst

| Aufgabe | Datei |
|---|---|
| Datensatz-Felder ändern | `shared/dataset.ts` – Schema ist zugleich der `--json-schema`-Vertrag für Claude; `normalizeDataset` repariert Modell-Ausreißer |
| Recherche-Verhalten, Prompt | `shared/prompt.ts` (alle Wege; `research: 'web' \| 'open-data'`), `server/research.ts` (claude), `server/research-codex.ts` (codex), `src/lib/research-anthropic.ts` / `research-openai.ts` (Key im Browser), `src/lib/research-local.ts` (lokales Modell) |
| Offene Daten für lokale Modelle | `src/lib/open-data.ts`: Tools `search`, `owid_chart`, `wikipedia_tables` (OWID + Wikipedia, CORS, ohne Key); Verbindung/Modellwahl `src/lib/local-model.ts`, UI `LocalModelSetup.tsx` |
| Anbieter, Modelle, Preise | `src/lib/providers.ts` (Register + `runResearch`); Keys: `src/lib/keys.ts`; Einstellungsseite: `src/components/Settings.tsx` |
| Landingpage | `src/landing/Landing.tsx` (Texte `l*` in `i18n.ts`), Live-Demo `RaceDemo.tsx`, Stil `landing.css` |
| UI-Texte | `src/lib/i18n.ts`: jeder Text als DE- und EN-Eintrag, Komponenten nutzen `useT()` |
| Beispiele (Landing + Studio) | `public/examples/*.json` + `index.json` (normalisierte Datensätze, offene Quellen bevorzugt), Laden über `src/lib/examples.ts` |
| Animation, Layout, Effekte | `src/engine/renderer.ts` (Layout pro Format oben in `makeLayout`) |
| Timing, Ränge, Überholungen | `src/engine/model.ts` |
| Musik, Sound | `src/audio/composer.ts`, `sfx.ts`, `soundtrack.ts` |
| Export | `src/export/exportMp4.ts` |

## Feste Regeln

- **Frames sind reine Funktionen von τ.** Alles mit Geschichte (Rang-Federn, Überholungen, Führungswechsel,
  Kartenzeiten) wird in `buildModel` vorberechnet. Kein Zustand zwischen Frames, sonst weichen Vorschau
  und Export voneinander ab. Zufall nur über `mulberry32(seed)`.
- **Fünf Anbieter, ein Vertrag** (`DatasetSchema`, strikt über `strictDatasetJsonSchema()`). Lokal über den Server:
  unveränderte `claude`-CLI mit dem eigenen Abo (nur `WebSearch`/`WebFetch`, `--setting-sources ""`,
  `--strict-mcp-config`, leeres Temp-cwd, nie `--bare`) und `codex --search exec` mit dem ChatGPT-Abo
  (`--output-schema`, `--ignore-user-config --ignore-rules`, `-s read-only`, leeres Temp-cwd); beide nur für den
  eigenen Gebrauch. Im Browser: BYOK und lokales Modell, SDKs erst bei Bedarf geladen.
  Anthropic: Websuche `web_search_20260209`, Datensatz über das strikte Tool `submit_dataset`.
  OpenAI: Responses-API mit `web_search`, Datensatz als strikte JSON-Schema-Ausgabe, `store: false`.
  Lokales Modell (Ollama, LM Studio, OpenAI-kompatibel über `openai`-SDK mit `baseURL`): hat keine Websuche,
  recherchiert in zwei Phasen – erst Tool-Runden gegen offene Daten (schnell: 3 Runden, ohne Thinking),
  dann ein Aufruf mit `response_format` json_schema. **Zahlen tippt das Modell für OWID-Daten nicht ab:**
  `owid_chart` zeigt nur eine Übersicht (jedes 5. Jahr), die volle Tabelle bleibt im Browser; im Datensatz
  verweist `series[].data = {table, entity}`, `fillFromTables` trägt die exakten Werte ein. Grund: Qwen
  tokenisiert jede Ziffer einzeln, ein Laptop verarbeitet ~100 Token/s Prompt und schreibt ~25 Token/s
  (gemessen: 7:29 → 4:22 Min.). Phase 2 behält die `tools`-Liste, sonst ändert sich der Prompt-Anfang und
  Ollama verwirft den Cache (29,7k Token neu, 5 Min.). Budget 24k Zeichen Tool-Ergebnisse (Ollama lädt mit
  32k Kontext). Modelle ohne Tool-Support schreiben aus eigenem Wissen, `notes` sagt das. Gehostete Seite:
  Ollama braucht `OLLAMA_ORIGINS`, LM Studio den CORS-Schalter.
  Keys gehen nie an einen eigenen Server; kein Abo-Login in Drittprodukten (Anthropic-Bedingungen).
- **Gemini bewusst nicht eingebaut:** Die Bedingungen für Grounding mit Google Search verbieten, Suchergebnisse
  zu verändern oder weiterzugeben. Ein veröffentlichtes Video ist genau das. Neue Anbieter nur, wenn deren
  Bedingungen die Weiterverarbeitung zu veröffentlichten Videos erlauben.
- **OpenAI im Browser:** Abgelehnte POSTs (falscher Key, kein Guthaben) kommen ohne CORS-Header, der Browser
  sieht nur einen Netzwerkfehler. Deshalb prüft `models.retrieve(model)` vorher Key und Modell (diese Antwort
  trägt CORS-Header).
- **Fortschritt sprachneutral:** Status als `code` + `vars` (`ResearchProgress`), übersetzt wird in der UI.
- **Node führt `server/*.ts` per Type-Stripping aus:** nur löschbare TS-Syntax (keine Parameter-Properties,
  keine Enums), Importe mit `.ts`-Endung. `tsconfig` erzwingt das mit `erasableSyntaxOnly`.
- **Keine Filter-Automation pro Note im Synth.** Automatisierte `BiquadFilter` rechnen in Chrome pro Sample
  und haben das Rendern vervierfacht; Filter liegen auf geteilten Bussen mit statischer Frequenz.
- **Zahlen im Canvas mit `numFont`** (Inter mit `tnum` per `FontFace.featureSettings`), sonst wackeln Labels.
- Port-Variable der API heißt `API_PORT`, nicht `PORT` (die Vorschau-Umgebung setzt `PORT` für Vite).

## Prüfen

Vorschau im Browser-Pane; im Dev-Modus hängt `window.__statrace = { transport, model }` für
`transport.seek(t)`. Einzelne Frames: `Renderer.create(model, format)` + `draw(ctx, t)` auf eigenem Canvas.
