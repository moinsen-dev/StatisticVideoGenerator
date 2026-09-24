# Ergänzung der Datenschutzerklärung (moinsen.dev) für StatRace

> **Entwurf vom 24.09.2026, vor Veröffentlichung von Uli prüfen.** Abschnitt zum Einfügen in die
> Datenschutzerklärung auf moinsen.dev. Grundlage: `docs/research/2026-09-24-oeffentliche-galerie-rechtslage.md`, Frage 6.

## StatRace (statrace.moinsen.dev)

**Verarbeitung im Browser.** StatRace läuft in deinem Browser:
- API-Schlüssel und Projekte speichert StatRace nur in deinem Browser (localStorage, IndexedDB); moinsen erhält
  sie nicht.
- Recherchierst du mit einem eigenen Schlüssel, sendet dein Browser die Anfrage direkt an den gewählten
  Anbieter (Anthropic oder OpenAI). Dafür gelten dessen Datenschutzbestimmungen.
- Ein lokales Modell verarbeitet deine Anfrage auf deinem eigenen Rechner. Die Recherchewerkzeuge rufen dabei
  ourworldindata.org und wikipedia.org auf.

**Öffentliche Galerie – Einreichungen.**
- Wenn du ein Projekt einreichst, speichern wir den Datensatz (Titel, Zahlen, Ereignistexte, Quellen,
  Musik-Parameter) und den Prüfstatus.
- Um Missbrauch zu begrenzen (höchstens einige Einreichungen pro Tag), verarbeiten wir deine IP-Adresse
  ausschließlich als Hashwert mit einem täglich wechselnden Salt. Die IP-Adresse selbst wird nicht gespeichert.
- Der Hashwert wird spätestens am Folgetag gelöscht.
- Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse ist der Schutz der Galerie vor
  Spam und Missbrauch.
- Ziehst du einen Eintrag zurück, löschen wir ihn sofort. Abgelehnte oder entfernte Einträge löschen wir nach
  30 Tagen.

**Öffentliche Galerie – Meldungen.**
- Wenn du einen Eintrag meldest, verarbeiten wir die Begründung, deinen Namen und deine E-Mail-Adresse. Wir
  nutzen sie, um die Meldung zu bearbeiten, dir den Eingang zu bestätigen und dir die Entscheidung mitzuteilen.
- Rechtsgrundlage: Art. 6 Abs. 1 lit. c DSGVO in Verbindung mit Art. 16 der Verordnung (EU) 2022/2065
  (Digital Services Act).
- Name und E-Mail-Adresse löschen wir, sobald die Entscheidung mitgeteilt ist. Die Meldung selbst löschen wir
  30 Tage nach ihrer Erledigung.
- Für das Tageslimit bei Meldungen verarbeiten wir die IP-Adresse ebenfalls nur als gesalzenen Hashwert, wie oben beschrieben.

**Hosting und Auftragsverarbeitung.** StatRace und die Galerie laufen auf Cloudflare (Cloudflare Pages,
Cloudflare D1). Cloudflare, Inc. verarbeitet dabei Verbindungsdaten wie IP-Adressen als Auftragsverarbeiter nach
Art. 28 DSGVO auf Grundlage des Cloudflare Data Processing Addendum. `[Falls Cloudflare Web Analytics aktiv
bleibt: Reichweitenmessung ohne Cookies über Cloudflare Web Analytics; Rechtsgrundlage Art. 6 Abs. 1 lit. f
DSGVO.]`

**Deine Rechte** richten sich nach dem allgemeinen Abschnitt dieser Datenschutzerklärung (Auskunft, Berichtigung,
Löschung, Einschränkung, Widerspruch, Beschwerde bei der Aufsichtsbehörde).
