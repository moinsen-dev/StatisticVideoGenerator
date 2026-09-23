# StatRace – Arbeitsnotizen

Web-App: Thema → KI-Recherche (Claude oder GPT) → Bar-Chart-Race-Video mit Fun-Facts und Soundtrack → MP4.
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
| Recherche-Verhalten, Prompt | `shared/prompt.ts` (alle Wege), `server/research.ts` (CLI), `src/lib/research-anthropic.ts` / `research-openai.ts` (Key im Browser) |
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
- **Drei Recherchewege, ein Vertrag** (`DatasetSchema`). Lokal: unveränderte `claude`-CLI mit dem eigenen Abo
  (nur `WebSearch`/`WebFetch`, `--setting-sources ""`, `--strict-mcp-config`, leeres Temp-cwd, nie `--bare`),
  nur für den eigenen Gebrauch. Öffentlich: BYOK im Browser, SDKs erst bei Bedarf geladen.
  Anthropic: Websuche `web_search_20260209`, Datensatz über das strikte Tool `submit_dataset`.
  OpenAI: Responses-API mit `web_search`, Datensatz als strikte JSON-Schema-Ausgabe, `store: false`.
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
