# STATE – StatRace

> Stand: 2026-09-22 · erste lauffähige Version, an einem Nachmittag gebaut
> Versionskontrolle: Git, Branch `main`, Remote `moinsen-dev/StatisticVideoGenerator` (privat)

## Letzte Arbeitseinheit

Greenfield-Bau von Idee bis MP4:

- **Recherche** über die `claude`-CLI (Abo, `-p`, nur WebSearch/WebFetch, `--json-schema` aus dem Zod-Schema).
  Fortschritt per SSE: Suchen, gelesene Seiten, Notizen und ein Live-Zeichenzähler, während Claude den
  Datensatz schreibt. Gemessen: Smartphone-Nutzer (DE) 243 s mit 5 Suchen, 1 Abruf, 16 Länder,
  27 Jahre und 14 Ereignisse; Börsenwert (EN) 3–4 min.
- **Renderer** auf Canvas, 16:9 und 9:16: Intro-Titelkarte, gleitende Rangwechsel (Feder + Hysterese),
  Funken beim Überholen, „Neu auf Platz 1“ mit Krone, Jahreszähler, Chronik-Karten, Weltweit-Zähler,
  Zeitleiste mit Ereignismarken, Endstand-Karte mit Medaillen, Quellenzeile.
- **Musik**: KI-Komposition (Claude-Spec → Web-Audio-Synth, 5 Stile, Dramaturgie an das Video
  gekoppelt), ElevenLabs Music (`music_v2_5`, getestet: 10-s-Clip, HTTP 200, MP3 48 kHz), eigene Datei.
  Dazu SFX-Spur. Komposition rendert 68 s in 1,8 s (vorher 16 s, siehe CLAUDE.md-Regeln).
- **Export**: MP4 H.264 + AAC via Mediabunny. Nutzertest im Pane: 59 s 9:16 in 10 s gerendert, 35,7 MB.

## Nächster Schritt

Feedback aus echten Videos einarbeiten (Look, Musik, Datenqualität).

## Offene Reibung / Ideen

- Recherche dauert 2–5 min, meist für das Schreiben des Datensatzes (~11k Zeichen). Hebel: kürzeres
  Schema (Werte als kompakte Arrays gibt es schon), `--effort` testen, oder erst Daten, dann Ereignisse.
- Daten sind Schätzungen aus Sekundärquellen (Statista-Zusammenfassungen, Wikipedia). Die App zeigt
  Quellen und Hinweise, prüft aber nichts gegen. Vor Veröffentlichung Zahlen im Daten-Tab gegenlesen.
- Deploy/Teilen: heute nur lokal (Abo-CLI). Für einen öffentlichen Dienst braucht es einen API-Key-Pfad
  (Anthropic API mit Web-Search-Tool), siehe Vendor-Regeln in `~/.claude/refs/subscription-cli-structured-subprocess.md`.
- Emoji-Flaggen rendern auf macOS (Apple Color Emoji); unter Windows fehlen Flaggen-Emojis.

## Doku

- `README.md` – Nutzung, Ablauf, Architektur
- `CLAUDE.md` – Befehle, Trigger-Karte, feste Regeln
