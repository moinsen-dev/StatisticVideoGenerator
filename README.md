# StatRace – KI-Statistikvideos

Aus einem Thema wird ein Bar-Chart-Race-Video, wie man es von YouTube kennt: Claude recherchiert
Zahlen, Ereignisse und Quellen im Web, die App animiert daraus ein Balkenrennen mit Jahreszähler,
Fun-Fact-Karten und Soundtrack und exportiert es als MP4 (16:9 oder 9:16).

## Starten

```bash
npm install
npm run dev
```

Dann <http://localhost:5190> öffnen (Chrome oder ein anderer Chromium-Browser).

Voraussetzung: [Claude Code](https://claude.com/claude-code) ist installiert und angemeldet
(`claude auth status` → `loggedIn: true`). Die Recherche läuft über dein eigenes Claude-Abo, ein
API-Key ist nicht nötig.

Optional: `cp .env.example .env` und `ELEVENLABS_API_KEY` eintragen, wenn der AI-Musikgenerator
(ElevenLabs Music, bezahlter Plan) Tracks erzeugen soll.

## Ablauf

1. **Thema** eingeben, Sprache, Balkenzahl und Recherchetiefe wählen (Sonnet schnell, Opus gründlich).
2. **Recherche:** `claude -p` mit Websuche und Seitenabruf liefert einen Datensatz nach festem Schema:
   Zeitreihen pro Land oder Firma, Gesamtwert, 10–16 datierte Ereignisse, Quellen, Hinweise und eine
   Soundtrack-Komposition. Dauer meist 2–5 Minuten, der Fortschritt läuft live mit.
3. **Studio:** Vorschau mit Zeitleiste, Daten bearbeiten (Titel, Farben, Symbole, Ereignisse, JSON),
   Musikquelle wählen, Länge und Format einstellen.
4. **Export:** MP4 (H.264 + AAC), Bild für Bild im Browser gerendert (WebCodecs + Mediabunny).

## Musik

| Quelle | Was passiert |
|---|---|
| KI-Komposition | Claude legt Stil, Tempo, Tonart, Akkorde und ein Melodie-Motiv fest; ein Web-Audio-Synthesizer spielt es passend zur Dramaturgie (Intro, Start auf dem Taktschlag, Breakdown, Finale, Schlussakkord). Kostenlos. |
| AI-Musikgenerator | ElevenLabs Music erzeugt aus Claudes Prompt einen Instrumental-Track in exakt der Videolänge. |
| Eigene Datei | Beliebige Audiodatei, etwa aus Suno. |

Soundeffekte (Impact beim Start, Whoosh pro Karte, Fanfare bei neuem Platz 1) liegen als eigene Spur
darüber und funktionieren mit jeder Musikquelle.

## Architektur

```
shared/dataset.ts      Zod-Schema: Vertrag für Claudes Structured Output, Validierung, Normalisierung
server/                Hono auf Node (Type-Stripping, kein Build): /api/status, /api/research (SSE), /api/music
src/engine/            Zeitmodell (Splines, Rang-Federn, Überholungen) + Canvas-Renderer, zustandslos pro Frame
src/audio/             Komponist (Offline-Web-Audio), Effekte, Mixdown, Wiedergabe-Uhr
src/export/            MP4-Export mit Mediabunny
src/components/        React-UI: Start, Recherche, Studio mit Panels
```

Projekte und Audiodateien liegen im Browser (IndexedDB), der Server hält keinen Zustand.
