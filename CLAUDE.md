# StatRace – Arbeitsnotizen

Web-App: Thema → Claude-Recherche → Bar-Chart-Race-Video mit Fun-Facts und Soundtrack → MP4.
Stand und nächste Schritte: `STATE.md`. Nutzersicht: `README.md`.

## Befehle

- `npm run dev` – API (Node `--watch`, Port 8790) + Vite (Port 5190), beide über `concurrently`
- `npm run typecheck` – TypeScript 7 (`tsc --noEmit`)
- `npm run build` / `npm start` – Produktion: Vite-Build, Hono liefert `dist/` aus
- Browser-Pane: `.claude/launch.json` → `statrace`

## Wenn du … → lies/prüf zuerst

| Aufgabe | Datei |
|---|---|
| Datensatz-Felder ändern | `shared/dataset.ts` – Schema ist zugleich der `--json-schema`-Vertrag für Claude; `normalizeDataset` repariert Modell-Ausreißer |
| Recherche-Verhalten, Prompt | `server/prompt.ts`, `server/research.ts` |
| Animation, Layout, Effekte | `src/engine/renderer.ts` (Layout pro Format oben in `makeLayout`) |
| Timing, Ränge, Überholungen | `src/engine/model.ts` |
| Musik, Sound | `src/audio/composer.ts`, `sfx.ts`, `soundtrack.ts` |
| Export | `src/export/exportMp4.ts` |

## Feste Regeln

- **Frames sind reine Funktionen von τ.** Alles mit Geschichte (Rang-Federn, Überholungen, Führungswechsel,
  Kartenzeiten) wird in `buildModel` vorberechnet. Kein Zustand zwischen Frames, sonst weichen Vorschau
  und Export voneinander ab. Zufall nur über `mulberry32(seed)`.
- **Recherche = unveränderte `claude`-CLI mit dem Abo des Nutzers.** Nur `WebSearch`/`WebFetch`,
  `--setting-sources ""`, `--strict-mcp-config`, leeres Temp-Verzeichnis als cwd. Nie `--bare`
  (verliert den OAuth-Login). Keine Credentials lesen oder speichern.
- **Node führt `server/*.ts` per Type-Stripping aus:** nur löschbare TS-Syntax (keine Parameter-Properties,
  keine Enums), Importe mit `.ts`-Endung. `tsconfig` erzwingt das mit `erasableSyntaxOnly`.
- **Keine Filter-Automation pro Note im Synth.** Automatisierte `BiquadFilter` rechnen in Chrome pro Sample
  und haben das Rendern vervierfacht; Filter liegen auf geteilten Bussen mit statischer Frequenz.
- **Zahlen im Canvas mit `numFont`** (Inter mit `tnum` per `FontFace.featureSettings`), sonst wackeln Labels.
- Port-Variable der API heißt `API_PORT`, nicht `PORT` (die Vorschau-Umgebung setzt `PORT` für Vite).

## Prüfen

Vorschau im Browser-Pane; im Dev-Modus hängt `window.__statrace = { transport, model }` für
`transport.seek(t)`. Einzelne Frames: `Renderer.create(model, format)` + `draw(ctx, t)` auf eigenem Canvas.
