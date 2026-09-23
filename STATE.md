# STATE — StatRace

> **Frozen:** 2026-09-23 10:34
> **Branch:** `main` (Remote `moinsen-dev/StatisticVideoGenerator`, privat)
> **Last commit:** „feat: StatRace – KI-Statistikvideos vom Thema bis zum MP4“ + dieses STATE-Update
> **Dirty:** clean
> **Nebenbranch:** `idea-loop/monetarisierung`, enthält nur `brainstorm-monetarisierung.md`, bewusst nicht in `main`

## Last work-unit

**Entscheidung Uli, 2026-09-23: StatRace bleibt ein eigenes Werkzeug und wird nicht monetarisiert** (Option C).
Grundlage ist die Monetarisierungsprüfung auf dem Nebenbranch.

- Der Markt „KI macht ein Bar-Chart-Race aus einem Thema“ ist besetzt:
  - Alien Art Charts hat Musik, KI-Sprecher, 4K und MCP.
  - Chartimator liefert KI-Zahlen mit Quellen, Flowi recherchiert selbst.
  - „Die Konkurrenz ist schlechter“ ist unbelegt, weil nur Landingpages verglichen wurden, keine Videos.
- Das Modell „BYOK + öffentliche Galerie + Werbung“ ist geprüft und gestorben: Öffentliche Gratis-Galerien
  bringen Nutzung, aber kein Geld. Beispiele sind Many Eyes, Swivel, Plotly Chart Studio Cloud und Giphy.
- Offen gewirkt haben, aber ungeprüft sind: Event-Recap (live beim Event, danach Video), Beleg-Export für
  AI Act/YouTube, Recherche als MCP-Dienst.

Davor, 2026-09-22: Greenfield-Bau vom Thema bis zum MP4, in ca. 55 Min.
- **Recherche:** `claude -p` mit WebSearch/WebFetch und SSE-Live-Fortschritt.
- **Renderer:** Canvas in 16:9 und 9:16.
- **Musik:** KI-Komposition als Web-Audio-Synth, ElevenLabs Music oder eigene Datei, jeweils mit SFX.
- **Export:** MP4 über Mediabunny.
- **Messwerte:** Recherche 3–4 min; 66 s in 1080p werden in 10 s gerendert; die Komposition von 68 s braucht 1,8 s.

## Next intended step

Eigene Videos bauen und nutzen, dabei Look, Musik und Datenqualität verbessern. Erfolgskriterium: ein Video,
das du ohne Nacharbeit veröffentlichen würdest, plus eine Liste der drei größten Störfaktoren.

Nur falls C revidiert wird: Event-Recap als nächsten idea-loop-Lauf ansetzen (war die Empfehlung).

## Open friction

- Die Recherche dauert 2–5 min, meist fürs Schreiben des Datensatzes (~11k Zeichen). Hebel: `--effort`
  testen oder erst die Zahlen, dann die Ereignisse recherchieren.
- Die Daten sind Schätzungen aus Sekundärquellen. Die App zeigt Quellen und Hinweise, prüft aber nichts gegen.
  Vor jeder Veröffentlichung die Zahlen im Daten-Tab gegenlesen und bevorzugt offene Quellen nutzen (OWID,
  Weltbank; Statista nur mit Profi-Lizenz).
- Die Recherche läuft über dein Claude-Abo und ist deshalb nur für den eigenen Gebrauch zulässig. Ein Dienst
  für andere bräuchte die API (Abo-Logins in Drittprodukten verbietet Anthropic).
- Emoji-Flaggen rendern auf macOS, unter Windows fehlen sie.

## Live context for the agent

- **Heiße Dateien:** `src/engine/renderer.ts` (Look), `src/audio/composer.ts` (Musik), `server/prompt.ts` (Datenqualität)
- **Haltung:** positiv überrascht von der Qualität, die Geschäftsfrage ist bewusst geschlossen
- **Kalibrierung:** Der v1-Bau dauerte ~55 Min statt klassisch 2–3 Wochen (Datenpunkt in `~/.claude/refs/dna-calibration.md`)

## Doku

- `README.md`: Nutzung, Ablauf, Architektur · `CLAUDE.md`: Befehle, Trigger-Karte, feste Regeln
- `brainstorm-monetarisierung.md` auf `idea-loop/monetarisierung`: Marktkarte, Friedhof, Gründe für C
