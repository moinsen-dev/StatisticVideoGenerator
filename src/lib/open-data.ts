import type OpenAISDK from 'openai';

// Open data that a local model researches with, straight from the browser: Our World in Data
// and Wikipedia allow cross-origin requests, are openly licensed (CC BY, CC BY-SA) and need no key.
// Every result is compact plain text, so it fits the context window of a local model.

export type Source = { title: string; url: string };
/** An Our World in Data chart kept in the browser: entity → year → value, every year. */
export type DataTable = { id: string; rows: Map<string, Map<number, number>> };
export type ToolResult = { text: string; source?: Source; table?: DataTable };

const OWID = 'https://ourworldindata.org';
const WIKI = 'https://en.wikipedia.org';
const OWID_QUERY = '?v=1&csvType=full&useColumnShortNames=true';
const MAX_CHARS = 8_000;
// Wikipedia tables are mostly digits, and a local model reads every digit as a token.
const WIKI_CHARS = 6_000;
const TOP_ENTITIES = 20;

export const OPEN_DATA_TOOLS: OpenAISDK.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search',
      description: 'Search Our World in Data charts and English Wikipedia articles. Returns chart slugs and article titles to read next.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'a few English keywords, e.g. "co2 emissions" or "largest companies by market capitalization"' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'owid_chart',
      description:
        'Read an Our World in Data chart: unit, source and an overview of the leading countries and the world total. The dataset can reference its exact yearly values instead of copying numbers.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'chart slug from search, e.g. "co-emissions-per-capita"' },
          from_year: { type: 'integer', description: 'first year to include; default: 40 years before the latest year' },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wikipedia_tables',
      description: 'The data tables of an English Wikipedia article as text.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'article title from search' } },
        required: ['title'],
      },
    },
  },
];

async function get(url: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${new URL(url).hostname} answered ${res.status}`);
  return res;
}

const plain = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? '';
const tidy = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const cap = (s: string) => (s.length > MAX_CHARS ? `${s.slice(0, MAX_CHARS)}\n… (cut)` : s);

async function search(query: string, signal: AbortSignal): Promise<ToolResult> {
  type OwidHit = { type: string; slug: string; title: string };
  type WikiHit = { title: string; snippet: string };
  const [owid, wiki] = await Promise.all([
    get(`${OWID}/api/search?q=${encodeURIComponent(query)}`, signal)
      .then((r) => r.json() as Promise<{ results?: OwidHit[] }>)
      .catch(() => null),
    get(`${WIKI}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=6&format=json&origin=*`, signal)
      .then((r) => r.json() as Promise<{ query?: { search?: WikiHit[] } }>)
      .catch(() => null),
  ]);
  const charts = (owid?.results ?? []).filter((hit) => hit.type === 'chart').slice(0, 6);
  const articles = wiki?.query?.search ?? [];
  return {
    text: [
      'Our World in Data charts (read one with owid_chart):',
      ...(charts.length ? charts.map((c) => `- ${c.slug}: ${c.title}`) : ['- nothing found']),
      '',
      'Wikipedia articles (read one with wikipedia_tables):',
      ...(articles.length ? articles.map((a) => `- ${a.title}: ${tidy(plain(a.snippet))}`) : ['- nothing found']),
    ].join('\n'),
  };
}

/** Minimal CSV parser: quoted fields with commas and doubled quotes, as OWID writes them. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

// Three significant digits are plenty for a race and keep the tables small for local models.
const short = (v: number) => String(Number(v.toPrecision(3)));
const csvName = (name: string) => (name.includes(',') ? `"${name}"` : name);

async function owidChart(slug: string, fromYear: number | undefined, signal: AbortSignal): Promise<ToolResult> {
  type Meta = {
    chart?: { title?: string; subtitle?: string | null; citation?: string };
    columns?: Record<string, { titleShort?: string; unit?: string; citationShort?: string }>;
  };
  const path = `${OWID}/grapher/${encodeURIComponent(slug)}`;
  const [csv, meta] = await Promise.all([
    get(`${path}.csv${OWID_QUERY}`, signal).then((r) => r.text()),
    get(`${path}.metadata.json${OWID_QUERY}`, signal)
      .then((r) => r.json() as Promise<Meta>)
      .catch(() => null),
  ]);
  const [header, ...rows] = parseCsv(csv);
  if (!header || header.length < 4) return { text: `Our World in Data: no data for "${slug}".` };
  const column = header[3];

  // entity → year → value, first indicator column only
  const series = new Map<string, { code: string; values: Map<number, number> }>();
  for (const [entity, code, year, raw] of rows) {
    const value = Number(raw);
    if (raw === '' || raw === undefined || !Number.isFinite(value)) continue;
    const entry = series.get(entity) ?? { code, values: new Map() };
    entry.values.set(Number(year), value);
    series.set(entity, entry);
  }
  const countries = [...series].filter(([, s]) => /^[A-Z]{3}$/.test(s.code));
  if (!countries.length) return { text: `Our World in Data: no country values in "${slug}".` };
  let latest = -Infinity;
  let first = Infinity;
  for (const [, s] of countries) {
    for (const year of s.values.keys()) {
      latest = Math.max(latest, year);
      first = Math.min(first, year);
    }
  }
  const from = Math.max(first, fromYear ?? latest - 40);
  const years = Array.from({ length: latest - from + 1 }, (_, i) => from + i);
  const peak = (values: Map<number, number>) => Math.max(...years.map((y) => values.get(y) ?? -Infinity));
  const world = [...series].find(([, s]) => s.code === 'OWID_WRL');
  const top = [...countries].sort((a, b) => peak(b[1].values) - peak(a[1].values)).slice(0, TOP_ENTITIES);

  // Only an overview: the app fills exact yearly values from the full table (research-local.ts), and
  // every digit costs a local model a token, so every fifth year is enough to pick the competitors.
  const shown = years.filter((y) => (y - from) % 5 === 0 || y === latest);
  const overview = [
    `entity,${shown.join(',')}`,
    ...[...top, ...(world ? [world] : [])].map(
      ([name, s]) => `${csvName(name)},${shown.map((y) => (s.values.has(y) ? short(s.values.get(y)!) : '')).join(',')}`,
    ),
  ].join('\n');
  const table: DataTable = {
    id: slug,
    rows: new Map([...countries, ...(world ? [world] : [])].map(([name, s]) => [name, s.values])),
  };

  const col = meta?.columns?.[column];
  const title = meta?.chart?.title ?? col?.titleShort ?? slug;
  const url = path;
  return {
    text: cap(
      [
        `Our World in Data: ${title}${meta?.chart?.subtitle ? ` — ${meta.chart.subtitle}` : ''}`,
        `Unit: ${col?.unit ?? 'see title'}. Source: ${col?.citationShort ?? meta?.chart?.citation ?? 'Our World in Data'}. URL: ${url}`,
        `Data: ${countries.length} countries${world ? ' and the World total' : ''}, ${first}–${latest}. Overview of the leading countries, every 5th year, 3 significant digits:`,
        overview,
        `To use this data, do not copy numbers: give a series "data": {"table": "${slug}", "entity": "<entity name as in this table>"} and leave its "values" empty; the app fills every year exactly.${world ? ' The same works for "total" with the entity "World".' : ''}`,
      ].join('\n'),
    ),
    source: { title: `Our World in Data: ${title}`, url },
    table,
  };
}

async function wikipediaTables(title: string, signal: AbortSignal): Promise<ToolResult> {
  const res = await get(
    `${WIKI}/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&redirects=1&format=json&formatversion=2&origin=*`,
    signal,
  );
  const body = (await res.json()) as { parse?: { title: string; text: string }; error?: { info?: string } };
  if (!body.parse) return { text: `Wikipedia: ${body.error?.info ?? 'article not found'}` };

  const doc = new DOMParser().parseFromString(body.parse.text, 'text/html');
  doc.querySelectorAll('sup, style, .mw-editsection, .reference, .sortkey').forEach((node) => node.remove());
  const parts: string[] = [];
  let size = 0;
  for (const table of doc.querySelectorAll('table.wikitable')) {
    const caption = tidy(table.querySelector('caption')?.textContent);
    const lines = [...table.querySelectorAll('tr')]
      .map((tr) => [...tr.querySelectorAll('th, td')].map((cell) => tidy(cell.textContent)).join(' | '))
      .filter((line) => line.replace(/[|\s]/g, ''));
    const part = `Table${caption ? `: ${caption}` : ''}\n${lines.join('\n')}`;
    parts.push(part);
    size += part.length;
    if (size > WIKI_CHARS) break;
  }
  const url = `${WIKI}/wiki/${encodeURIComponent(body.parse.title.replace(/ /g, '_'))}`;
  if (!parts.length) return { text: `Wikipedia: ${body.parse.title} has no data tables.` };
  return {
    text: `Wikipedia: ${body.parse.title} (${url})\n\n${parts.join('\n\n')}`.slice(0, WIKI_CHARS),
    source: { title: `Wikipedia: ${body.parse.title}`, url },
  };
}

export async function runOpenDataTool(name: string, args: Record<string, unknown>, signal: AbortSignal): Promise<ToolResult> {
  if (name === 'search') return search(String(args.query ?? ''), signal);
  if (name === 'owid_chart') {
    const from = Number(args.from_year);
    return owidChart(String(args.slug ?? ''), Number.isFinite(from) && from > 0 ? from : undefined, signal);
  }
  if (name === 'wikipedia_tables') return wikipediaTables(String(args.title ?? ''), signal);
  return { text: `Unknown tool "${name}". Use search, owid_chart or wikipedia_tables.` };
}
