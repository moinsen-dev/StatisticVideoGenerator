import { useSyncExternalStore } from 'react';

// UI language (independent of the language a video is researched in). English by default,
// German for German browsers, switchable in the header.

export type Lang = 'de' | 'en';

const STORAGE = 'statrace:lang';
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved === 'de' || saved === 'en') return saved;
  } catch {
    // storage unavailable
  }
  return navigator.language?.toLowerCase().startsWith('de') ? 'de' : 'en';
}

let current: Lang = detect();
document.documentElement.lang = current;

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE, lang);
  } catch {
    // storage unavailable
  }
  for (const listener of listeners) listener();
}

export function getLang(): Lang {
  return current;
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
}

const DE = {
  tagline: 'KI-Statistikvideos',
  heroTitle: 'Welche Statistik soll zum Video werden?',
  heroLead:
    'Eine KI recherchiert Zahlen, Ereignisse und Quellen im Web. Daraus entsteht ein animiertes Balkenrennen mit Fun-Facts und Soundtrack, fertig als MP4.',
  topicLabel: 'Thema',
  topicPlaceholder: 'z. B. Smartphone-Nutzer nach Ländern, 2000 bis heute',
  videoLanguage: 'Videosprache',
  bars: 'Balken',
  depth: 'Recherche',
  depthFast: 'Schnell · {model}',
  depthThorough: 'Gründlich · {model}',
  start: 'Recherchieren & Video bauen',
  via: 'Recherche mit',
  claudeCodeLocal: 'Claude Code · lokal',
  codexLocal: 'Codex · lokal',
  localModel: 'Lokales Modell',
  cliReady: 'Claude CLI angemeldet ({subscription}, {version})',
  cliMissing: 'Claude CLI nicht angemeldet: im Terminal `claude` starten und einloggen',
  codexReady: 'Codex CLI angemeldet ({subscription}, {version})',
  keyLabel: '{vendor}-API-Key',
  keyRemember: 'In diesem Browser merken',
  keyHint:
    'Der Key geht direkt von deinem Browser an {host}, nie an einen Server von StatRace. Eine Recherche kostet etwa {cost}.',
  keyCreate: 'Key erstellen',
  keyMissing: 'Für die Recherche fehlt noch ein API-Key.',
  elevenReady: 'ElevenLabs Music über den lokalen Server bereit',
  examples: 'Beispiele',
  examplesHint: 'Fertig recherchiert: sofort ansehen, bearbeiten und exportieren, ganz ohne Key.',
  yourVideos: 'Deine Videos',
  importJson: 'JSON importieren',
  noProjects: 'Noch keine Projekte. Das erste entsteht aus deinem Thema oben oder aus einem Beispiel.',
  deleteConfirm: '„{title}“ löschen?',
  delete: 'Löschen',
  footer: 'Open Source (MIT) auf GitHub',
  researching: '{name} recherchiert',
  researchFailed: 'Recherche fehlgeschlagen',
  researchStats: '{time} · {searches} Suchen · {fetches} Seiten gelesen',
  researchUsual: ' · meist 2–5 Minuten',
  researchUsualLocal: ' · lokal meist 5–10 Minuten',
  cancel: 'Abbrechen',
  back: 'Zurück',
  retry: 'Nochmal versuchen',
  pStart: '{model} startet die Recherche …',
  pAssembling: 'Datensatz wird zusammengesetzt …',
  pChecking: 'Datensatz wird geprüft …',
  pWriting: 'Schreibt den Datensatz … {n} Zeichen',
  pThinking: 'Denkt nach …',
  pDone: 'Fertig: {series} Reihen · {points} Zeitpunkte · {events} Ereignisse',
  newTopic: '← Neues Thema',
  saveJson: 'JSON sichern',
  tabVideo: 'Video',
  tabData: 'Daten',
  tabMusic: 'Musik',
  tabExport: 'Export',
  play: 'Abspielen',
  pause: 'Pause',
  timeline: 'Zeitleiste',
  audioWorking: 'Soundtrack wird erzeugt …',
  audioError: 'Audio-Fehler: {message}',
  audioReady: 'Soundtrack bereit · Leertaste spielt ab',
  audioNone: 'Ohne Ton · Leertaste spielt ab',
  audioNoFile: 'Für diese Musikquelle gibt es noch keine Datei.',
  format: 'Format',
  formatLandscape: '16:9 · YouTube',
  formatPortrait: '9:16 · Shorts, Reels',
  length: 'Länge',
  visibleBars: 'Sichtbare Balken',
  videoHint: 'Intro 3 s, Rennen, Endstand 5 s. Leertaste spielt ab, Pfeiltasten springen 3 s.',
  researchMeta: 'Recherche: {model} · {searches} Suchen · {fetches} Seiten · {seconds} s',
  researchCost: ' · ca. {cost} $',
  title: 'Titel',
  subtitle: 'Untertitel',
  series: 'Reihen',
  events: 'Ereignisse',
  sources: 'Quellen',
  addEvent: '+ Ereignis',
  newEvent: 'Neues Ereignis',
  colorOf: 'Farbe {name}',
  iconOf: 'Symbol {name}',
  name: 'Name',
  eventTime: 'Zeitpunkt (Jahr)',
  icon: 'Symbol',
  headline: 'Überschrift',
  text: 'Text',
  removeEvent: 'Ereignis entfernen',
  editJson: 'JSON bearbeiten (alle Werte)',
  apply: 'Übernehmen',
  musicSource: 'Musikquelle',
  srcComposition: 'KI-Komposition',
  srcCompositionDesc:
    'Die KI hat Stil, Tempo, Tonart, Akkorde und eine Melodie komponiert. Der Browser spielt sie als Synthesizer, passend zu Intro, Breakdown und Finale. Kostenlos.',
  srcAi: 'AI-Musikgenerator',
  srcAiDesc:
    'ElevenLabs Music erzeugt aus dem Musik-Prompt der Recherche einen voll produzierten Instrumental-Track in exakt der Videolänge. Braucht einen bezahlten ElevenLabs-Plan.',
  srcUpload: 'Eigene Datei',
  srcUploadDesc: 'MP3, WAV oder M4A, zum Beispiel aus Suno oder deiner Bibliothek. Längere Tracks werden am Ende ausgeblendet.',
  srcNone: 'Keine Musik',
  srcNoneDesc: 'Nur Soundeffekte oder ganz ohne Ton.',
  style: 'Stil',
  tempo: 'Tempo (BPM)',
  key: 'Tonart',
  scale: 'Tongeschlecht',
  major: 'Dur',
  minor: 'Moll',
  chordsHint: 'Akkordstufen {chords} · Melodie {motif}',
  musicPrompt: 'Prompt für den Musikgenerator',
  generating: 'Track wird komponiert …',
  generate: 'Track generieren ({seconds} s)',
  elevenKey: 'ElevenLabs-API-Key',
  elevenKeyHint: 'Geht direkt von deinem Browser an api.elevenlabs.io.',
  currentTrack: 'Aktueller Track: {name}',
  noTrack: 'Noch kein Track erzeugt.',
  audioFile: 'Audiodatei',
  current: 'Aktuell: {name}',
  musicVolume: 'Musik',
  sfx: 'Soundeffekte: Start-Impact, Whoosh pro Karte, Fanfare bei neuem Platz 1',
  sfxVolume: 'Effekte',
  frameRate: 'Bildrate',
  exportInfo: 'MP4 · H.264 · {w}×{h} · {seconds} s · {audio}. Gerendert wird Bild für Bild im Browser, unabhängig von der Abspielgeschwindigkeit.',
  withAudio: 'mit Ton (AAC)',
  withoutAudio: 'ohne Ton',
  exportMp4: 'MP4 exportieren',
  waitAudio: 'Warte auf Soundtrack …',
  exportProgress: '{pct} % · Bild {done} von {total}',
  exportEta: ' · noch ca. {seconds} s',
  exportDone: '{mb} MB · gerendert in {seconds} s',

  // settings
  settings: 'Einstellungen',
  settingsLead: 'Wähle, welche KI recherchiert, und hinterlege deine API-Keys. Alles bleibt in diesem Browser.',
  researchAi: 'Recherche-KI',
  provAnthropicDesc: 'Recherchiert mit Anthropics Websuche und liest Quellseiten direkt. Damit wurde StatRace entwickelt.',
  provOpenaiDesc: 'Recherchiert über OpenAIs Responses-API mit Websuche.',
  provClaudeCodeDesc:
    'Nutzt dein Claude-Abo über die lokale claude CLI. Kein API-Key nötig, nur für den eigenen Gebrauch auf deinem Rechner.',
  perResearch: 'Etwa {cost} pro Recherche',
  provCodexDesc:
    'Nutzt dein ChatGPT-Abo über die lokale codex CLI, mit Websuche. Kein API-Key nötig, nur für den eigenen Gebrauch auf deinem Rechner.',
  provLocalDesc:
    'Ollama, LM Studio oder ein anderer OpenAI-kompatibler Server auf deinem Rechner. Kostenlos und ohne Key; recherchiert wird in offenen Daten (Our World in Data, Wikipedia).',
  localServer: 'Server-Adresse',
  localConnect: 'Verbinden',
  localModelLabel: 'Modell',
  localChecking: 'Verbinde …',
  localFound: '{n} Modelle gefunden. Brauchbare Daten liefern Modelle ab etwa 14 Mrd. Parametern; lokal dauert eine Recherche einige Minuten.',
  localNone: 'Der Server läuft, hat aber noch kein Modell. Zum Beispiel im Terminal: ollama pull qwen3.8',
  localBlocked:
    'Der Server antwortet, erlaubt diese Seite aber nicht. Ollama: im Terminal launchctl setenv OLLAMA_ORIGINS "{origin}" ausführen und Ollama neu starten (Linux, Windows: Umgebungsvariable OLLAMA_ORIGINS setzen). LM Studio: in den Server-Einstellungen CORS einschalten.',
  localOffline:
    'Kein Server erreichbar. Starte Ollama oder den Server in LM Studio. Chrome fragt beim ersten Mal, ob diese Seite auf Apps auf deinem Gerät zugreifen darf: erlauben.',
  localOfflineHosted:
    'Keine Verbindung. Läuft Ollama oder der Server in LM Studio? Für diese Seite zusätzlich: Chrome fragt einmal, ob sie auf Apps auf deinem Gerät zugreifen darf (erlauben), und Ollama muss sie freigeben: im Terminal launchctl setenv OLLAMA_ORIGINS "{origin}" ausführen und Ollama neu starten. LM Studio: in den Server-Einstellungen CORS einschalten.',
  localNoModel: 'Kein Modell gewählt',
  localNoTools: 'Dieses Modell kann keine Werkzeuge nutzen: Die Werte kommen aus seinem eigenen Wissen.',
  keySaved: 'Key hinterlegt',
  keyNone: 'Noch kein Key',
  keyForget: 'Key entfernen',
  keyChange: 'Ändern',
  musicGenerator: 'Musikgenerator',
  musicSettingsDesc:
    'Optional: ElevenLabs Music produziert einen Track in exakt der Videolänge. Ohne Key spielt die kostenlose KI-Komposition.',
  privacy: 'Datenschutz',
  privacyText:
    'Keys gehen nur direkt an die jeweilige API, nie an einen Server von StatRace. Ohne „merken“ bleiben sie nur in diesem Tab. Projekte liegen in der IndexedDB deines Browsers.',
  forgetAll: 'Alle Keys aus diesem Browser löschen',
  keysForgotten: 'Alle Keys gelöscht.',

  // errors from the research adapters
  errAuth: 'Der API-Key wurde abgelehnt (401). Bitte prüfen.',
  errPermission: 'Keine Berechtigung (403): {message} Sind Websuche und Modell für deinen Key freigeschaltet?',
  errRateLimit: 'Limit erreicht (429): {message}',
  errBadRequest: 'Anfrage abgelehnt (400): {message}',
  errAborted: 'Recherche abgebrochen.',
  errConnection: 'Keine Verbindung zur {vendor}-API: {message}',
  errNoAnswer:
    'Die {vendor}-API hat ohne lesbare Antwort abgebrochen. Häufige Ursachen: kein Guthaben auf dem Konto, eine Netzwerksperre oder eine Störung beim Anbieter.',
  errModel: 'Das Modell {model} ist für deinen Key nicht verfügbar (404).',
  errRefusal: '{name} hat die Anfrage abgelehnt. Formuliere das Thema anders.',
  errTruncated: 'Der Datensatz wurde abgeschnitten (Token-Limit).',
  errNoDataset: '{name} hat keinen Datensatz geliefert.',
  errLocalConnection: 'Keine Verbindung zum lokalen Server unter {url}. Läuft er, und erlaubt er diese Seite? Hinweise in den Einstellungen.',
  errLocalModel: 'Das Modell {model} ist auf dem lokalen Server nicht installiert.',

  // landing page
  lNavHow: 'So geht’s',
  lNavFaq: 'Fragen',
  lOpenStudio: 'Studio öffnen',
  lEyebrow: 'Kostenlos · Open Source · läuft im Browser',
  lHeroTitle: 'Bar-Chart-Race-Videos aus einem einzigen Satz.',
  lHeroLead:
    'Du tippst ein Thema. Eine KI recherchiert Zahlen, Ereignisse und Quellen im Web. StatRace macht daraus ein animiertes Rennen mit Fun-Fact-Karten und Soundtrack und rendert das MP4 direkt in deinem Browser.',
  lCtaStart: 'Eigenes Video erstellen',
  lCtaHow: 'So funktioniert’s',
  lCtaNote: 'Kein Konto. Die Beispiele laufen ohne Key. Neue Themen recherchiert dein eigener Claude- oder OpenAI-Key oder kostenlos ein lokales Modell.',
  lDemoBadge: 'Live gerendert',
  lDemoCaption: 'Kein Video, sondern die StatRace-Engine, die gerade in deinem Browser rechnet.',
  lDemoOpen: 'Im Studio öffnen',
  lDemoPick: 'Beispiel wählen',
  lFact1: 'Recherche in 2–5 Minuten',
  lFact2: '10–20 Teilnehmer, 10–16 Ereignisse',
  lFact3: '16:9 und 9:16 in 1080p',
  lFact4: 'MP4-Export direkt im Browser',
  lHowTitle: 'Vom Thema zum MP4 in vier Schritten',
  lStep1Title: 'Thema eingeben',
  lStep1Text:
    'Alles, was über die Zeit gegeneinander antritt: CO₂ nach Ländern, die wertvollsten Konzerne, die größten YouTube-Kanäle.',
  lStep2Title: 'Die KI recherchiert',
  lStep2Text:
    'Claude, GPT oder ein Modell auf deinem Rechner sucht Jahreswerte, datierte Ereignisse und Quellen. Offene Daten wie Our World in Data und die Weltbank kommen zuerst.',
  lStep3Title: 'StatRace animiert',
  lStep3Text:
    'Balken gleiten und überholen im Funkenflug, die Spitze trägt die Krone, Fun-Fact-Karten erscheinen im richtigen Moment, und ein eigens komponierter Soundtrack folgt der Geschichte.',
  lStep4Title: 'Exportieren und posten',
  lStep4Text:
    'Titel, Farben und Ereignisse anpassen, dann rendert dein Browser das MP4 Bild für Bild. Kein Upload, kein Wasserzeichen.',
  lWhyTitle: 'Warum StatRace?',
  lWhyLead:
    'Bar-Chart-Races sind ein YouTube-Klassiker. Eins zu bauen heißt meist: stundenlang Zahlen suchen, Tabellen putzen, animieren, Musik aussuchen. StatRace übernimmt die Fleißarbeit, damit du dich um die Geschichte kümmern kannst.',
  lWhy1Title: 'Recherche mit Belegen',
  lWhy1Text:
    'Jeder Datensatz nennt seine Quellen und markiert, welche Werte geschätzt sind. Du prüfst die Zahlen im Daten-Tab, bevor du veröffentlichst.',
  lWhy2Title: 'Gemacht zum Anschauen',
  lWhy2Text:
    'Federphysik, Überholmanöver mit Funken, Krone für die Spitze, Jahreszähler und Ereigniskarten: der Look der Kanäle, die du kennst, nicht der einer Tabelle.',
  lWhy3Title: 'Deine Keys bleiben deine',
  lWhy3Text:
    'Kein Konto, kein StatRace-Server. API-Keys gehen direkt von deinem Browser an den Anbieter, Projekte bleiben auf deinem Gerät.',
  lWhy4Title: 'Open Source',
  lWhy4Text: 'MIT-Lizenz. Lokal mit deinem Claude-Abo betreiben, selbst hosten oder auf GitHub mitbauen.',
  lExamplesTitle: 'Beispiele zum Sofort-Öffnen',
  lAiTitle: 'Bring deine eigene KI mit',
  lAiLead:
    'StatRace selbst kostet nichts. Recherchiere mit deinem eigenen API-Key, dann zahlst du direkt beim Anbieter, meist weniger als einen Dollar pro Video. Oder kostenlos mit einem Modell auf deinem Rechner.',
  lAiLocal:
    'Lokal installiert? Dann recherchiert StatRace auch über dein Claude- oder ChatGPT-Abo mit Claude Code oder Codex, ganz ohne API-Key.',
  lLocalCard: 'Zum Beispiel Qwen 3.8 · recherchiert in offenen Daten',
  lFree: 'Kostenlos',
  lAiCta: 'KI einrichten',
  lMoinsenEyebrow: 'Gebaut von moinsen',
  lMoinsenTitle: 'Ideen rein, laufende Software raus.',
  lMoinsenText:
    'StatRace kommt aus der Werkstatt von moinsen in Hamburg. Dahinter steht Ulrich Diedrichsen: 40 Jahre Softwareentwicklung, heute ein Ein-Mann-Produktstudio, das mit KI in Tagen baut, wofür früher Monate nötig waren.',
  lMoinsenOffer:
    'Du brauchst so etwas für dein Unternehmen: ein internes KI-Werkzeug, ein eigenes Produkt oder die Rettung eines festgefahrenen Softwareprojekts? Lass uns reden.',
  lMoinsenCta: 'Kontakt aufnehmen',
  lMoinsenKmu: 'Kostenlose KI-Analyse für KMU',
  lFaqTitle: 'Häufige Fragen',
  lFaq1Q: 'Was kostet das?',
  lFaq1A:
    'StatRace ist kostenlos und Open Source. Die Recherche rechnet dein KI-Anbieter über deinen Key ab, mit Claude Sonnet 5 oder GPT-6 Sol meist 0,30–0,60 $ pro Video. Ein lokales Modell kostet nichts, Beispiele, Bearbeiten und Export auch nicht.',
  lFaq7Q: 'Geht das ganz ohne API-Key?',
  lFaq7A:
    'Ja, mit einem lokalen Modell über Ollama oder LM Studio, zum Beispiel Qwen 3.8. Es recherchiert in offenen Daten von Our World in Data und Wikipedia; Werte aus Our World in Data trägt die App exakt ein. Lokal installiert geht es auch über dein Claude- oder ChatGPT-Abo mit Claude Code oder Codex.',
  lFaq2Q: 'Stimmen die Zahlen?',
  lFaq2A:
    'Die KI arbeitet mit echten Quellen und listet sie auf, aber viele Jahreswerte sind Schätzungen oder interpoliert. Prüf sie im Daten-Tab und korrigiere, was nicht passt, bevor du veröffentlichst.',
  lFaq3Q: 'Darf ich die Videos veröffentlichen?',
  lFaq3A:
    'Ja. Nenne die Datenquellen (das Video blendet sie unten ein) und bevorzuge offen lizenzierte Daten wie Our World in Data oder die Weltbank (CC BY). Der eingebaute Soundtrack entsteht in deinem Browser; ElevenLabs-Tracks unterliegen den Bedingungen von ElevenLabs.',
  lFaq4Q: 'Wohin gehen meine API-Keys?',
  lFaq4A:
    'Direkt von deinem Browser an die API des Anbieters, api.anthropic.com oder api.openai.com. Es gibt keinen StatRace-Server. Ohne „merken“ bleibt ein Key nur im aktuellen Tab.',
  lFaq5Q: 'Welche Browser funktionieren?',
  lFaq5A: 'Am besten ein aktueller Chrome oder Edge am Desktop. Der MP4-Export nutzt WebCodecs.',
  lFaq6Q: 'Kann ich StatRace selbst betreiben?',
  lFaq6A:
    'Ja: Repository klonen, npm install, npm run dev. Lokal recherchiert StatRace auf Wunsch über dein Claude-Abo mit Claude Code, ohne API-Key.',
  lFinalTitle: 'Welche Statistik rennt als Nächstes?',
  lFooterMade: 'Gebaut in Hamburg von',
  lImprint: 'Impressum',

  // public gallery
  tabGallery: 'Galerie',
  galleryTitle: 'Öffentliche Galerie',
  galleryLead:
    'Von der Community eingereicht. Vor dem Einreichen prüft die KI der Einreichenden jeden Eintrag nach den Galerie-Regeln; moinsen prüft nicht vorab. Jedes Video läuft live aus seinen Daten. KI-recherchiert, Angaben ohne Gewähr; die Datensätze stehen unter CC BY-SA 4.0.',
  galleryFrom:
    'Aus der öffentlichen Galerie: von der Community eingereicht, KI-recherchiert, Angaben ohne Gewähr.',
  galleryEmpty: 'Noch keine Einträge. Deiner kann der erste sein: im Studio unter „Galerie“ einreichen.',
  galleryLabel: 'KI-recherchiert · ohne Gewähr',
  galleryReport: 'Melden',
  reportTitle: 'Eintrag melden',
  reportLead:
    'Was stimmt nicht? Zum Beispiel falsche Zahlen, rechtswidrige oder beleidigende Inhalte oder verletzte Rechte. Der Eintrag wird sofort ausgeblendet, bis moinsen die Meldung geprüft hat.',
  reportReason: 'Begründung',
  reportLocation: 'Fundstelle',
  reportName: 'Dein Name (optional)',
  reportEmail: 'Deine E-Mail (optional, für die Entscheidung)',
  reportGoodFaith: 'Ich versichere nach bestem Wissen, dass meine Angaben richtig und vollständig sind.',
  reportPending: 'Danke. Der Eintrag ist ausgeblendet, bis moinsen entschieden hat.',
  reportMailed: 'Eingangsbestätigung und Entscheidung bekommst du per E-Mail.',
  reportQuestions: 'Fragen? Schreib an',
  reportLimit: 'Für heute sind die Meldungen aufgebraucht. Schreib uns direkt an business@moinsen.dev.',
  reportSend: 'Meldung senden',
  close: 'Schließen',
  publishLead:
    'Zeig dein Video in der öffentlichen Galerie. Eingereicht wird nur der Datensatz: Titel, Zahlen, Ereignisse, Quellen und die Musik-Parameter. Keine Audiodateien, keine Keys, keine persönlichen Daten. Vorher prüft deine eigene KI den Eintrag nach den Galerie-Regeln; besteht er, ist er sofort öffentlich.',
  publishRules: 'Galerie-Regeln',
  publishRulesText:
    'Nur Inhalte, die du veröffentlichen darfst: nichts Rechtswidriges, Beleidigendes oder bewusst Irreführendes, keine Angaben über Privatpersonen.\nNichts, was Menschen wegen Herkunft, Religion, Geschlecht, sexueller Orientierung oder Behinderung abwertet, keine verherrlichte Gewalt, kein Extremismus, keine sexuellen Inhalte, kein Wahlkampf, keine Verschwörungserzählungen.\nDie Quellen müssen eine Veröffentlichung erlauben. Offene Daten wie Our World in Data oder die Weltbank passen, Zahlen hinter Bezahlschranken wie Statista nicht.\nDeine KI (dein Key, dein lokales Modell) prüft den Eintrag vor dem Einreichen nach diesen Regeln. Lehnt sie ab, wird nichts eingereicht.\nmoinsen prüft nicht vorab. Gemeldete Einträge werden sofort ausgeblendet; moinsen entscheidet dann und nennt dir hier im Studio den Grund, wenn ein Eintrag entfernt wird.\nDer Eintrag erscheint mit allen Quellen und dem Hinweis, dass eine KI ihn recherchiert hat.\nDu kannst deinen Eintrag jederzeit zurückziehen, dann wird er gelöscht.',
  publishLicense: 'Veröffentlichte Datensätze stehen unter',
  publishTerms: 'Vollständige Galerie-Regeln, Kontakt und Meldeweg',
  publishPaywall: 'Nicht einreichbar: Quellen hinter einer Bezahlschranke ({sources}) dürfen nicht veröffentlicht werden. Ersetze diese Zahlen im Daten-Tab durch offene Daten.',
  publishAccept: 'Ich habe die Regeln gelesen und darf diesen Datensatz veröffentlichen.',
  publishSubmit: 'Zur Veröffentlichung einreichen',
  publishResubmit: 'Aktuellen Stand neu einreichen',
  publishChecking: 'Deine KI prüft …',
  publishApproved: 'Öffentlich in der Galerie.',
  publishOpen: 'Ansehen',
  publishRejected: 'Deine KI hat den Eintrag abgelehnt: {reason}',
  publishRemoved: 'Entfernt: {reason}',
  publishReported: 'Gemeldet und ausgeblendet, bis moinsen entschieden hat.',
  publishNeedsAi:
    'Vor dem Einreichen prüft deine eigene KI den Eintrag. Richte dafür einen Key oder ein lokales Modell ein:',
  publishReviewer: 'Prüft vor dem Einreichen: {ai}. Ändern unter',
  publishReviewRefused: 'Deine KI hat die Prüfung verweigert; das spricht für einen Regelverstoß.',
  publishContact: 'Nicht einverstanden? Schreib an',
  publishGone: 'Der Eintrag existiert nicht mehr.',
  publishWithdraw: 'Zurückziehen',
  publishLimit: 'Für heute sind die Einreichungen aufgebraucht. Morgen geht es wieder.',
  noReason: 'ohne Begründung',
  moderation: 'Moderation',
  modLead:
    'moinsen prüft nicht vorab: Ein Eintrag erscheint, sobald die KI der Einreichenden ihn freigegeben hat. Gemeldete Einträge sind ausgeblendet und warten hier auf deine Entscheidung; wer eine E-Mail hinterlassen hat, bekommt sie automatisch.',
  modToken: 'Admin-Token',
  modLoad: 'Laden',
  modReports: 'Meldungen ({n} offen)',
  modRecent: 'Letzte Einträge ({n})',
  modReviewedBy: 'geprüft von {ai}',
  modApprove: 'Freigeben',
  modRemove: 'Entfernen',
  modView: 'Ansehen',
  modReasonPrompt: 'Begründung (sieht die einreichende Person im Studio, die meldende per E-Mail):',
  modKeepReason: 'Der Eintrag verstößt nicht gegen die Galerie-Regeln.',
  modEmpty: 'Nichts zu tun.',
  modApproved: 'online',
  modRemoved: 'entfernt',
  modReported: 'gemeldet, ausgeblendet',
  modOpen: 'offen',
  modDone: 'erledigt',
  modHasContact: 'Melder-E-Mail hinterlegt',
} as const;

export type MessageKey = keyof typeof DE;

const EN: Record<MessageKey, string> = {
  tagline: 'AI statistics videos',
  heroTitle: 'Which statistic should become a video?',
  heroLead:
    'An AI researches numbers, events and sources on the web. StatRace turns them into an animated bar chart race with fun facts and a soundtrack, ready as MP4.',
  topicLabel: 'Topic',
  topicPlaceholder: 'e.g. Smartphone users by country, 2000 to today',
  videoLanguage: 'Video language',
  bars: 'Bars',
  depth: 'Research',
  depthFast: 'Fast · {model}',
  depthThorough: 'Thorough · {model}',
  start: 'Research & build video',
  via: 'Research with',
  claudeCodeLocal: 'Claude Code · local',
  codexLocal: 'Codex · local',
  localModel: 'Local model',
  cliReady: 'Claude CLI signed in ({subscription}, {version})',
  cliMissing: 'Claude CLI not signed in: run `claude` in a terminal and log in',
  codexReady: 'Codex CLI signed in ({subscription}, {version})',
  keyLabel: '{vendor} API key',
  keyRemember: 'Remember in this browser',
  keyHint:
    'Your key goes straight from your browser to {host}, never to a StatRace server. One research run costs about {cost}.',
  keyCreate: 'Create a key',
  keyMissing: 'Add an API key to start researching.',
  elevenReady: 'ElevenLabs Music ready via the local server',
  examples: 'Examples',
  examplesHint: 'Already researched: watch, edit and export right away, no key needed.',
  yourVideos: 'Your videos',
  importJson: 'Import JSON',
  noProjects: 'No projects yet. The first one starts from your topic above or from an example.',
  deleteConfirm: 'Delete “{title}”?',
  delete: 'Delete',
  footer: 'Open source (MIT) on GitHub',
  researching: '{name} is researching',
  researchFailed: 'Research failed',
  researchStats: '{time} · {searches} searches · {fetches} pages read',
  researchUsual: ' · usually 2–5 minutes',
  researchUsualLocal: ' · locally usually 5–10 minutes',
  cancel: 'Cancel',
  back: 'Back',
  retry: 'Try again',
  pStart: '{model} starts researching …',
  pAssembling: 'Assembling the dataset …',
  pChecking: 'Checking the dataset …',
  pWriting: 'Writing the dataset … {n} characters',
  pThinking: 'Thinking …',
  pDone: 'Done: {series} series · {points} time points · {events} events',
  newTopic: '← New topic',
  saveJson: 'Save JSON',
  tabVideo: 'Video',
  tabData: 'Data',
  tabMusic: 'Music',
  tabExport: 'Export',
  play: 'Play',
  pause: 'Pause',
  timeline: 'Timeline',
  audioWorking: 'Creating the soundtrack …',
  audioError: 'Audio error: {message}',
  audioReady: 'Soundtrack ready · space plays',
  audioNone: 'No sound · space plays',
  audioNoFile: 'There is no file for this music source yet.',
  format: 'Format',
  formatLandscape: '16:9 · YouTube',
  formatPortrait: '9:16 · Shorts, Reels',
  length: 'Length',
  visibleBars: 'Visible bars',
  videoHint: '3 s intro, the race, 5 s final standings. Space plays, arrow keys jump 3 s.',
  researchMeta: 'Research: {model} · {searches} searches · {fetches} pages · {seconds} s',
  researchCost: ' · about ${cost}',
  title: 'Title',
  subtitle: 'Subtitle',
  series: 'Series',
  events: 'Events',
  sources: 'Sources',
  addEvent: '+ Event',
  newEvent: 'New event',
  colorOf: 'Color of {name}',
  iconOf: 'Icon of {name}',
  name: 'Name',
  eventTime: 'Point in time (year)',
  icon: 'Icon',
  headline: 'Headline',
  text: 'Text',
  removeEvent: 'Remove event',
  editJson: 'Edit JSON (all values)',
  apply: 'Apply',
  musicSource: 'Music source',
  srcComposition: 'AI composition',
  srcCompositionDesc:
    'The AI composed style, tempo, key, chords and a melody. Your browser plays it as a synthesizer that follows the intro, breakdown and finale. Free.',
  srcAi: 'AI music generator',
  srcAiDesc:
    'ElevenLabs Music turns the research’s music prompt into a fully produced instrumental track of exactly the video’s length. Needs a paid ElevenLabs plan.',
  srcUpload: 'Your own file',
  srcUploadDesc: 'MP3, WAV or M4A, for example from Suno or your library. Longer tracks fade out at the end.',
  srcNone: 'No music',
  srcNoneDesc: 'Sound effects only, or no sound at all.',
  style: 'Style',
  tempo: 'Tempo (BPM)',
  key: 'Key',
  scale: 'Scale',
  major: 'Major',
  minor: 'Minor',
  chordsHint: 'Chord degrees {chords} · melody {motif}',
  musicPrompt: 'Prompt for the music generator',
  generating: 'Composing the track …',
  generate: 'Generate track ({seconds} s)',
  elevenKey: 'ElevenLabs API key',
  elevenKeyHint: 'Goes straight from your browser to api.elevenlabs.io.',
  currentTrack: 'Current track: {name}',
  noTrack: 'No track generated yet.',
  audioFile: 'Audio file',
  current: 'Current: {name}',
  musicVolume: 'Music',
  sfx: 'Sound effects: impact at the start, whoosh per card, fanfare for a new number 1',
  sfxVolume: 'Effects',
  frameRate: 'Frame rate',
  exportInfo: 'MP4 · H.264 · {w}×{h} · {seconds} s · {audio}. Rendered frame by frame in your browser, independent of playback speed.',
  withAudio: 'with sound (AAC)',
  withoutAudio: 'without sound',
  exportMp4: 'Export MP4',
  waitAudio: 'Waiting for the soundtrack …',
  exportProgress: '{pct} % · frame {done} of {total}',
  exportEta: ' · about {seconds} s left',
  exportDone: '{mb} MB · rendered in {seconds} s',

  settings: 'Settings',
  settingsLead: 'Choose which AI does the research and add your API keys. Everything stays in this browser.',
  researchAi: 'Research AI',
  provAnthropicDesc: 'Researches with Anthropic’s web search and reads source pages directly. StatRace was built with it.',
  provOpenaiDesc: 'Researches through OpenAI’s Responses API with web search.',
  provClaudeCodeDesc:
    'Uses your Claude subscription through the local claude CLI. No API key needed; for your own use on your own machine.',
  perResearch: 'About {cost} per research run',
  provCodexDesc:
    'Uses your ChatGPT plan through the local codex CLI, with web search. No API key needed; for your own use on your own machine.',
  provLocalDesc:
    'Ollama, LM Studio or any other OpenAI-compatible server on your machine. Free and without a key; it researches open data (Our World in Data, Wikipedia).',
  localServer: 'Server address',
  localConnect: 'Connect',
  localModelLabel: 'Model',
  localChecking: 'Connecting …',
  localFound: '{n} models found. Models from about 14B parameters give usable data; a local research run takes a few minutes.',
  localNone: 'The server is running but has no model yet. For example in a terminal: ollama pull qwen3.8',
  localBlocked:
    'The server answers but does not allow this page. Ollama: run launchctl setenv OLLAMA_ORIGINS "{origin}" in a terminal and restart Ollama (Linux, Windows: set the OLLAMA_ORIGINS environment variable). LM Studio: turn on CORS in the server settings.',
  localOffline:
    'No server reachable. Start Ollama or the server in LM Studio. The first time, Chrome asks whether this page may access apps on your device: allow it.',
  localOfflineHosted:
    'No connection. Is Ollama or the LM Studio server running? For this page, also: Chrome asks once whether it may access apps on your device (allow it), and Ollama must allow it: run launchctl setenv OLLAMA_ORIGINS "{origin}" in a terminal and restart Ollama. LM Studio: turn on CORS in the server settings.',
  localNoModel: 'No model chosen',
  localNoTools: 'This model cannot use tools: the values come from its own knowledge.',
  keySaved: 'Key added',
  keyNone: 'No key yet',
  keyForget: 'Remove key',
  keyChange: 'Change',
  musicGenerator: 'Music generator',
  musicSettingsDesc:
    'Optional: ElevenLabs Music produces a track of exactly the video’s length. Without a key, the free AI composition plays.',
  privacy: 'Privacy',
  privacyText:
    'Keys go only straight to the respective API, never to a StatRace server. Without “remember” they live in this tab only. Projects are stored in your browser’s IndexedDB.',
  forgetAll: 'Remove all keys from this browser',
  keysForgotten: 'All keys removed.',

  errAuth: 'The API key was rejected (401). Please check it.',
  errPermission: 'Permission denied (403): {message} Are web search and this model enabled for your key?',
  errRateLimit: 'Limit reached (429): {message}',
  errBadRequest: 'Request rejected (400): {message}',
  errAborted: 'Research cancelled.',
  errConnection: 'Could not reach the {vendor} API: {message}',
  errNoAnswer:
    'The {vendor} API stopped without a readable answer. Common causes: no credit on the account, a network block, or an outage at the provider.',
  errModel: 'The model {model} is not available for your key (404).',
  errRefusal: '{name} declined this request. Try rephrasing the topic.',
  errTruncated: 'The dataset was cut off (token limit).',
  errNoDataset: '{name} did not deliver a dataset.',
  errLocalConnection: 'No connection to the local server at {url}. Is it running, and does it allow this page? See the settings for help.',
  errLocalModel: 'The model {model} is not installed on the local server.',

  lNavHow: 'How it works',
  lNavFaq: 'FAQ',
  lOpenStudio: 'Open the studio',
  lEyebrow: 'Free · open source · runs in your browser',
  lHeroTitle: 'Bar chart race videos from a single sentence.',
  lHeroLead:
    'Type a topic. An AI researches the numbers, events and sources on the web. StatRace turns them into an animated race with fun-fact cards and a soundtrack, and renders the MP4 right in your browser.',
  lCtaStart: 'Create your video',
  lCtaHow: 'See how it works',
  lCtaNote: 'No account. The examples play without a key. New topics are researched with your own Claude or OpenAI key, or for free by a local model.',
  lDemoBadge: 'Rendered live',
  lDemoCaption: 'Not a video file: this is the StatRace engine rendering right now in your browser.',
  lDemoOpen: 'Open in the studio',
  lDemoPick: 'Choose an example',
  lFact1: 'Research in 2–5 minutes',
  lFact2: '10–20 contenders, 10–16 events',
  lFact3: '16:9 and 9:16 in 1080p',
  lFact4: 'MP4 export right in the browser',
  lHowTitle: 'From topic to MP4 in four steps',
  lStep1Title: 'Type a topic',
  lStep1Text: 'Anything that competes over time: CO₂ by country, the most valuable companies, the biggest YouTube channels.',
  lStep2Title: 'The AI researches',
  lStep2Text:
    'Claude, GPT or a model on your own machine looks up yearly values, dated events and sources. Open data such as Our World in Data and the World Bank comes first.',
  lStep3Title: 'StatRace animates',
  lStep3Text:
    'Bars glide and overtake in a shower of sparks, the leader wears the crown, fun-fact cards pop up at the right moment, and a soundtrack composed for your topic follows the story.',
  lStep4Title: 'Export and post',
  lStep4Text: 'Adjust titles, colors and events, then your browser renders the MP4 frame by frame. No upload, no watermark.',
  lWhyTitle: 'Why StatRace?',
  lWhyLead:
    'Bar chart races are a YouTube classic. Making one usually means hours of hunting for numbers, cleaning spreadsheets, animating and picking music. StatRace does the busywork, so you can focus on the story.',
  lWhy1Title: 'Research with receipts',
  lWhy1Text:
    'Every dataset lists its sources and flags which values are estimates. You check the numbers in the Data tab before you publish.',
  lWhy2Title: 'Made to be watched',
  lWhy2Text:
    'Spring physics, overtakes with sparks, a crown for the leader, a year counter and event cards: the look of the channels you know, not of a spreadsheet.',
  lWhy3Title: 'Your keys stay yours',
  lWhy3Text:
    'No account, no StatRace server. API keys go straight from your browser to the provider, and projects stay on your device.',
  lWhy4Title: 'Open source',
  lWhy4Text: 'MIT licensed. Run it locally with your Claude subscription, host your own copy, or help build it on GitHub.',
  lExamplesTitle: 'Examples you can open right now',
  lAiTitle: 'Bring your own AI',
  lAiLead:
    'StatRace itself is free. Research with your own API key and pay the provider directly, usually less than a dollar per video. Or research for free with a model on your own machine.',
  lAiLocal: 'Running it locally? Then StatRace can also research through your Claude or ChatGPT subscription with Claude Code or Codex, no API key needed.',
  lLocalCard: 'For example Qwen 3.8 · researches open data',
  lFree: 'Free',
  lAiCta: 'Set up your AI',
  lMoinsenEyebrow: 'Built by moinsen',
  lMoinsenTitle: 'Ideas in, working software out.',
  lMoinsenText:
    'StatRace comes out of the moinsen workshop in Hamburg. Behind it is Ulrich Diedrichsen: 40 years of building software, now a one-person product studio that uses AI to build in days what used to take months.',
  lMoinsenOffer:
    'Need something like this for your company: an internal AI tool, a product of your own, or a rescue for a stuck software project? Let’s talk.',
  lMoinsenCta: 'Get in touch',
  lMoinsenKmu: 'Free AI analysis for businesses (DACH)',
  lFaqTitle: 'Questions',
  lFaq1Q: 'What does it cost?',
  lFaq1A:
    'StatRace is free and open source. Your AI provider bills the research on your key, usually $0.30–0.60 per video with Claude Sonnet 5 or GPT-6 Sol. A local model costs nothing, and neither do examples, editing and export.',
  lFaq7Q: 'Does it work without an API key?',
  lFaq7A:
    'Yes, with a local model through Ollama or LM Studio, for example Qwen 3.8. It researches open data from Our World in Data and Wikipedia; the app fills in Our World in Data values exactly. Installed locally, it also works through your Claude or ChatGPT subscription with Claude Code or Codex.',
  lFaq2Q: 'Are the numbers right?',
  lFaq2A:
    'The AI works from real sources and lists them, but many yearly values are estimates or interpolations. Check them in the Data tab and fix what’s off before you publish.',
  lFaq3Q: 'Can I publish the videos?',
  lFaq3A:
    'Yes. Credit the data sources (the video shows them along the bottom) and prefer openly licensed data such as Our World in Data or the World Bank (CC BY). The built-in soundtrack is synthesized in your browser; ElevenLabs tracks follow ElevenLabs’ terms.',
  lFaq4Q: 'Where do my API keys go?',
  lFaq4A:
    'Straight from your browser to the provider’s API, api.anthropic.com or api.openai.com. There is no StatRace server. Without “remember”, a key lives in the current tab only.',
  lFaq5Q: 'Which browsers work?',
  lFaq5A: 'A current Chrome or Edge on desktop works best. The MP4 export uses WebCodecs.',
  lFaq6Q: 'Can I run StatRace myself?',
  lFaq6A:
    'Yes: clone the repository, npm install, npm run dev. Locally, StatRace can research through your Claude subscription with Claude Code, no API key needed.',
  lFinalTitle: 'Which statistic races next?',
  lFooterMade: 'Built in Hamburg by',
  lImprint: 'Legal notice',

  tabGallery: 'Gallery',
  galleryTitle: 'Public gallery',
  galleryLead:
    'Submitted by the community. Before submitting, the submitter’s own AI reviews every entry against the gallery rules; moinsen does not review entries beforehand. Every video plays live from its data. AI-researched, no guarantee of accuracy; the datasets are licensed CC BY-SA 4.0.',
  galleryFrom:
    'From the public gallery: submitted by the community, AI-researched, no guarantee of accuracy.',
  galleryEmpty: 'No entries yet. Yours can be the first: submit it in the studio under “Gallery”.',
  galleryLabel: 'AI-researched · no guarantee',
  galleryReport: 'Report',
  reportTitle: 'Report this entry',
  reportLead:
    'What is wrong? For example wrong numbers, illegal or offensive content, or infringed rights. The entry is hidden at once until moinsen has reviewed the report.',
  reportReason: 'Reason',
  reportLocation: 'Location',
  reportName: 'Your name (optional)',
  reportEmail: 'Your email (optional, for the decision)',
  reportGoodFaith: 'I confirm in good faith that the information in this report is accurate and complete.',
  reportPending: 'Thanks. The entry is hidden until moinsen has decided.',
  reportMailed: 'You will get a confirmation and the decision by email.',
  reportQuestions: 'Questions? Write to',
  reportLimit: 'You have used today’s reports. Write to us directly at business@moinsen.dev.',
  reportSend: 'Send report',
  close: 'Close',
  publishLead:
    'Show your video in the public gallery. Only the dataset is submitted: title, numbers, events, sources and the music parameters. No audio files, no keys, no personal data. First your own AI reviews the entry against the gallery rules; if it passes, it is public at once.',
  publishRules: 'Gallery rules',
  publishRulesText:
    'Only content you may publish: nothing illegal, offensive or deliberately misleading, and no details about private individuals.\nNothing that demeans people for their origin, religion, gender, sexual orientation or disability, no glorified violence, no extremism, no sexual content, no election campaigning, no conspiracy theories.\nThe sources must allow publication. Open data such as Our World in Data or the World Bank fits; numbers behind paywalls such as Statista do not.\nYour AI (your key, your local model) reviews the entry against these rules before it is submitted. If it rejects the entry, nothing is submitted.\nmoinsen does not review entries beforehand. Reported entries are hidden at once; moinsen then decides and, if an entry is removed, tells you why here in the studio.\nThe entry appears with all its sources and a note that an AI researched it.\nYou can withdraw your entry at any time; it is then deleted.',
  publishLicense: 'Published datasets are licensed under',
  publishTerms: 'Full gallery rules, contact and reporting',
  publishPaywall: 'Cannot be submitted: sources behind a paywall ({sources}) may not be republished. Replace these numbers with open data in the Data tab.',
  publishAccept: 'I have read the rules and may publish this dataset.',
  publishSubmit: 'Submit for publication',
  publishResubmit: 'Submit the current version again',
  publishChecking: 'Your AI is reviewing …',
  publishApproved: 'Public in the gallery.',
  publishOpen: 'View',
  publishRejected: 'Your AI rejected the entry: {reason}',
  publishRemoved: 'Removed: {reason}',
  publishReported: 'Reported and hidden until moinsen has decided.',
  publishNeedsAi:
    'Your own AI reviews the entry before it is submitted. Set up a key or a local model first:',
  publishReviewer: 'Reviews before submitting: {ai}. Change in',
  publishReviewRefused: 'Your AI declined to review the entry, which points to a broken rule.',
  publishContact: 'Disagree? Write to',
  publishGone: 'The entry no longer exists.',
  publishWithdraw: 'Withdraw',
  publishLimit: 'You have used today’s submissions. Try again tomorrow.',
  noReason: 'no reason given',
  moderation: 'Moderation',
  modLead:
    'moinsen does not review entries beforehand: an entry appears once the submitter’s AI has approved it. Reported entries are hidden and wait here for your decision; notifiers who left an email get it automatically.',
  modToken: 'Admin token',
  modLoad: 'Load',
  modReports: 'Reports ({n} open)',
  modRecent: 'Latest entries ({n})',
  modReviewedBy: 'reviewed by {ai}',
  modApprove: 'Approve',
  modRemove: 'Remove',
  modView: 'View',
  modReasonPrompt: 'Reason (the submitter sees it in the studio, the notifier by email):',
  modKeepReason: 'The entry does not break the gallery rules.',
  modEmpty: 'Nothing to do.',
  modApproved: 'online',
  modRemoved: 'removed',
  modReported: 'reported, hidden',
  modOpen: 'open',
  modDone: 'done',
  modHasContact: 'notifier email on file',
};

const DICT: Record<Lang, Record<MessageKey, string>> = { de: DE, en: EN };

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(lang: Lang, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = DICT[lang][key];
  return vars ? template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : template;
}

export function useT(): Translate {
  const lang = useLang();
  return (key, vars) => translate(lang, key, vars);
}
