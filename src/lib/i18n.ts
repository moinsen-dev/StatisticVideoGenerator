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
    'Claude recherchiert Zahlen, Ereignisse und Quellen. Daraus entsteht ein animiertes Balkenrennen mit Fun-Facts und Soundtrack, fertig als MP4.',
  topicLabel: 'Thema',
  topicPlaceholder: 'z. B. Smartphone-Nutzer nach Ländern, 2000 bis heute',
  videoLanguage: 'Videosprache',
  bars: 'Balken',
  depth: 'Recherche',
  depthFast: 'Schnell · Sonnet',
  depthThorough: 'Gründlich · Opus',
  start: 'Recherchieren & Video bauen',
  via: 'Recherche über',
  viaCli: 'Dein Claude-Abo (lokale claude CLI)',
  viaApi: 'Eigener Anthropic-API-Key',
  cliReady: 'Claude CLI angemeldet ({subscription}, {version})',
  cliMissing: 'Claude CLI nicht angemeldet: im Terminal `claude` starten und einloggen',
  keyLabel: 'Anthropic-API-Key',
  keyRemember: 'In diesem Browser merken',
  keyHint:
    'Der Key geht direkt von deinem Browser an api.anthropic.com, nie an einen Server von StatRace. Eine Recherche kostet etwa 0,30–0,60 $ (Opus mehr).',
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
  researching: 'Claude recherchiert',
  researchFailed: 'Recherche fehlgeschlagen',
  researchStats: '{time} · {searches} Suchen · {fetches} Seiten gelesen',
  researchUsual: ' · meist 2–5 Minuten',
  cancel: 'Abbrechen',
  back: 'Zurück',
  retry: 'Nochmal versuchen',
  pStart: 'Claude ({model}) startet die Recherche …',
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
    'Claude hat Stil, Tempo, Tonart, Akkorde und eine Melodie komponiert. Der Browser spielt sie als Synthesizer, passend zu Intro, Breakdown und Finale. Kostenlos.',
  srcAi: 'AI-Musikgenerator',
  srcAiDesc:
    'ElevenLabs Music erzeugt aus Claudes Prompt einen voll produzierten Instrumental-Track in exakt der Videolänge. Braucht einen bezahlten ElevenLabs-Plan.',
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
} as const;

export type MessageKey = keyof typeof DE;

const EN: Record<MessageKey, string> = {
  tagline: 'AI statistics videos',
  heroTitle: 'Which statistic should become a video?',
  heroLead:
    'Claude researches numbers, events and sources. StatRace turns them into an animated bar chart race with fun facts and a soundtrack, ready as MP4.',
  topicLabel: 'Topic',
  topicPlaceholder: 'e.g. Smartphone users by country, 2000 to today',
  videoLanguage: 'Video language',
  bars: 'Bars',
  depth: 'Research',
  depthFast: 'Fast · Sonnet',
  depthThorough: 'Thorough · Opus',
  start: 'Research & build video',
  via: 'Research via',
  viaCli: 'Your Claude subscription (local claude CLI)',
  viaApi: 'Your own Anthropic API key',
  cliReady: 'Claude CLI signed in ({subscription}, {version})',
  cliMissing: 'Claude CLI not signed in: run `claude` in a terminal and log in',
  keyLabel: 'Anthropic API key',
  keyRemember: 'Remember in this browser',
  keyHint:
    'Your key goes straight from your browser to api.anthropic.com, never to a StatRace server. One research run costs about $0.30–0.60 (more with Opus).',
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
  researching: 'Claude is researching',
  researchFailed: 'Research failed',
  researchStats: '{time} · {searches} searches · {fetches} pages read',
  researchUsual: ' · usually 2–5 minutes',
  cancel: 'Cancel',
  back: 'Back',
  retry: 'Try again',
  pStart: 'Claude ({model}) starts researching …',
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
    'Claude composed style, tempo, key, chords and a melody. Your browser plays it as a synthesizer that follows the intro, breakdown and finale. Free.',
  srcAi: 'AI music generator',
  srcAiDesc:
    'ElevenLabs Music turns Claude’s prompt into a fully produced instrumental track of exactly the video’s length. Needs a paid ElevenLabs plan.',
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
