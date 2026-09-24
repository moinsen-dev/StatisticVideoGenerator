import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { parseDataset, type Dataset } from '../shared/dataset.ts';

// Public gallery. Visitors submit a project (the dataset JSON only: no audio, no keys, no accounts);
// moinsen reviews every submission before it appears, and anyone can report a published entry.
// One Hono app for both runtimes: the local Node server (SQLite) and a Cloudflare Pages Function (D1).

export type Row = Record<string, unknown>;

/** The three SQL calls the gallery needs; implemented for node:sqlite and for D1. */
export interface Sql {
  all(sql: string, ...params: unknown[]): Promise<Row[]>;
  first(sql: string, ...params: unknown[]): Promise<Row | null>;
  run(sql: string, ...params: unknown[]): Promise<void>;
}

export type GalleryConfig = { sql: Sql; adminToken: string | undefined; salt: string };

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, status TEXT NOT NULL, reason TEXT,
    title TEXT NOT NULL, subtitle TEXT NOT NULL, language TEXT NOT NULL, topic TEXT NOT NULL,
    bars INTEGER NOT NULL, icons TEXT NOT NULL, model TEXT, dataset TEXT NOT NULL,
    created_at INTEGER NOT NULL, reviewed_at INTEGER)`,
  `CREATE INDEX IF NOT EXISTS submissions_status ON submissions (status, reviewed_at)`,
  `CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT, submission_id TEXT NOT NULL, reason TEXT NOT NULL,
    name TEXT, contact TEXT, created_at INTEGER NOT NULL, handled INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS rate (key TEXT PRIMARY KEY, day TEXT NOT NULL, count INTEGER NOT NULL)`,
];

const LIMITS = { submissions: 5, reports: 20 } as const;
const MAX_BODY = 256_000;
const KEEP_MS = 30 * 24 * 3600_000; // rejected/removed entries and handled reports stay 30 days, then go

const SubmitSchema = z.object({
  dataset: z.unknown(),
  topic: z.string().trim().min(3).max(600),
  bars: z.number().int().min(3).max(15),
  model: z.string().max(80).nullable().optional(),
  accept: z.literal(true),
});
// Notice and action, DSA Art. 16(2): reasons, location (the entry), name and email of the notifier
// (not required for child sexual abuse material) and a statement of good faith.
const ReportSchema = z
  .object({
    reason: z.string().trim().min(10).max(2000),
    name: z.string().trim().max(200).optional(),
    email: z.email().max(200).optional().or(z.literal('')),
    childAbuse: z.boolean().optional(),
    goodFaith: z.literal(true),
  })
  .refine((r) => r.childAbuse || (r.name && r.email), { message: 'name and email required' });
const DecisionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'removed']),
  reason: z.string().trim().max(1000).optional(),
});

const cut = (s: string, n: number) => s.trim().slice(0, n);
const httpUrl = (u: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(u).protocol);
  } catch {
    return false;
  }
};

/** Normalised dataset with bounded text, and only http(s) links: it will be shown to strangers. */
function publishable(json: unknown): Dataset {
  const ds = parseDataset(json);
  return {
    ...ds,
    title: cut(ds.title, 80),
    subtitle: cut(ds.subtitle, 120),
    unitLabel: cut(ds.unitLabel, 60),
    notes: cut(ds.notes, 2000),
    events: ds.events.slice(0, 24).map((e) => ({ ...e, title: cut(e.title, 80), text: cut(e.text, 240) })),
    sources: ds.sources
      .filter((s) => httpUrl(s.url))
      .slice(0, 30)
      .map((s) => ({ title: cut(s.title, 160), url: cut(s.url, 500) })),
    music: { ...ds.music, prompt: cut(ds.music.prompt, 1000) },
  };
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256 = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
const randomId = (bytes: number) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer as ArrayBuffer);

/** Constant-time comparison for the admin token. */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Env = { Variables: { gallery: GalleryConfig } };

export function galleryApi(configure: (c: Context) => GalleryConfig) {
  const ready = new WeakMap<Sql, Promise<void>>();
  const app = new Hono<Env>().basePath('/api/gallery');

  app.use(async (c, next) => {
    const config = configure(c);
    if (!ready.has(config.sql)) {
      ready.set(config.sql, (async () => {
        for (const statement of SCHEMA) await config.sql.run(statement);
      })());
    }
    await ready.get(config.sql);
    c.set('gallery', config);
    await next();
  });

  /** Counts an action per visitor and day; the IP is only kept as a salted hash that changes daily. */
  const allowed = async (c: Context<Env>, action: keyof typeof LIMITS) => {
    const { sql, salt } = c.get('gallery');
    const day = new Date().toISOString().slice(0, 10);
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
    const key = `${action}:${await sha256(`${salt}:${day}:${ip}`)}`;
    await sql.run('DELETE FROM rate WHERE day <> ?', day);
    const row = await sql.first('SELECT count FROM rate WHERE key = ?', key);
    const count = Number(row?.count ?? 0);
    if (count >= LIMITS[action]) return false;
    await sql.run('INSERT INTO rate (key, day, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1', key, day);
    return true;
  };

  const owner = async (c: Context<Env>, id: string) => {
    const token = c.req.header('x-owner-token') ?? '';
    const row = await c.get('gallery').sql.first('SELECT status, reason, token_hash FROM submissions WHERE id = ?', id);
    return row && token && row.token_hash === (await sha256(token)) ? row : null;
  };

  const admin = (c: Context<Env>) => {
    const expected = c.get('gallery').adminToken;
    const given = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
    return Boolean(expected && given && sameSecret(given, expected));
  };

  app.get('/', async (c) => {
    // Rate-limit hashes only live for their day (usually deletes nothing, so it writes nothing).
    await c.get('gallery').sql.run('DELETE FROM rate WHERE day <> ?', new Date().toISOString().slice(0, 10));
    const rows = await c
      .get('gallery')
      .sql.all(
        "SELECT id, title, subtitle, language, icons, model, reviewed_at FROM submissions WHERE status = 'approved' ORDER BY reviewed_at DESC LIMIT 60",
      );
    return c.json(rows.map((r) => ({ ...r, icons: JSON.parse(String(r.icons)) })));
  });

  app.post('/', async (c) => {
    const raw = await c.req.text();
    if (raw.length > MAX_BODY) return c.json({ message: 'too large' }, 413);
    let body: unknown = null;
    try {
      body = JSON.parse(raw);
    } catch {
      // handled below as an invalid submission
    }
    const parsed = SubmitSchema.safeParse(body);
    if (!parsed.success) return c.json({ message: parsed.error.issues[0]?.message ?? 'invalid' }, 400);
    let dataset: Dataset;
    try {
      dataset = publishable(parsed.data.dataset);
    } catch (err) {
      return c.json({ message: (err as Error).message }, 400);
    }
    if (!(await allowed(c, 'submissions'))) return c.json({ message: 'limit' }, 429);
    const id = randomId(6);
    const token = randomId(18);
    const icons = dataset.series.slice(0, 3).map((s) => s.icon);
    await c
      .get('gallery')
      .sql.run(
        `INSERT INTO submissions (id, token_hash, status, title, subtitle, language, topic, bars, icons, model, dataset, created_at)
         VALUES (?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        await sha256(token),
        dataset.title,
        dataset.subtitle,
        dataset.language,
        cut(parsed.data.topic, 300),
        parsed.data.bars,
        JSON.stringify(icons),
        parsed.data.model ?? null,
        JSON.stringify(dataset),
        Date.now(),
      );
    return c.json({ id, token }, 201);
  });

  app.get('/admin/queue', async (c) => {
    if (!admin(c)) return c.json({ message: 'forbidden' }, 403);
    const { sql } = c.get('gallery');
    await sql.run("DELETE FROM submissions WHERE status IN ('rejected', 'removed') AND reviewed_at < ?", Date.now() - KEEP_MS);
    await sql.run('DELETE FROM reports WHERE handled = 1 AND created_at < ?', Date.now() - KEEP_MS);
    const pending = await sql.all(
      "SELECT id, title, subtitle, language, topic, bars, model, dataset, created_at FROM submissions WHERE status = 'pending' ORDER BY created_at",
    );
    const reports = await sql.all(
      `SELECT r.id, r.submission_id, r.reason, r.name, r.contact, r.created_at, s.title, s.status
       FROM reports r JOIN submissions s ON s.id = r.submission_id WHERE r.handled = 0 ORDER BY r.created_at`,
    );
    return c.json({ pending: pending.map((r) => ({ ...r, dataset: JSON.parse(String(r.dataset)) })), reports });
  });

  app.post('/admin/:id', async (c) => {
    if (!admin(c)) return c.json({ message: 'forbidden' }, 403);
    const parsed = DecisionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ message: 'invalid' }, 400);
    const { sql } = c.get('gallery');
    const id = c.req.param('id');
    await sql.run(
      'UPDATE submissions SET status = ?, reason = ?, reviewed_at = ? WHERE id = ?',
      parsed.data.status,
      parsed.data.reason ?? null,
      Date.now(),
      id,
    );
    // The notifier has been told the decision (moderation page); their name and email go now.
    await sql.run('UPDATE reports SET handled = 1, name = NULL, contact = NULL WHERE submission_id = ?', id);
    return c.body(null, 204);
  });

  app.get('/:id', async (c) => {
    const row = await c
      .get('gallery')
      .sql.first(
        "SELECT id, title, topic, bars, model, dataset, reviewed_at FROM submissions WHERE id = ? AND status = 'approved'",
        c.req.param('id'),
      );
    if (!row) return c.json({ message: 'not found' }, 404);
    return c.json({ ...row, dataset: JSON.parse(String(row.dataset)) });
  });

  // For the one who submitted: review state and, after a rejection or removal, the reason.
  app.get('/:id/status', async (c) => {
    const row = await owner(c, c.req.param('id'));
    if (!row) return c.json({ message: 'not found' }, 404);
    return c.json({ status: row.status, reason: row.reason ?? null });
  });

  // Withdrawing deletes the entry and its reports for good.
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    if (!(await owner(c, id))) return c.json({ message: 'not found' }, 404);
    const { sql } = c.get('gallery');
    await sql.run('DELETE FROM reports WHERE submission_id = ?', id);
    await sql.run('DELETE FROM submissions WHERE id = ?', id);
    return c.body(null, 204);
  });

  app.post('/:id/report', async (c) => {
    const parsed = ReportSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ message: 'invalid' }, 400);
    const { sql } = c.get('gallery');
    const id = c.req.param('id');
    if (!(await sql.first("SELECT 1 AS ok FROM submissions WHERE id = ? AND status = 'approved'", id))) {
      return c.json({ message: 'not found' }, 404);
    }
    if (!(await allowed(c, 'reports'))) return c.json({ message: 'limit' }, 429);
    await sql.run(
      'INSERT INTO reports (submission_id, reason, name, contact, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      parsed.data.reason,
      parsed.data.name || null,
      parsed.data.email || null,
      Date.now(),
    );
    return c.body(null, 204);
  });

  return app;
}

/** D1 as the gallery's SQL (Cloudflare Pages Function binding). */
export type D1Like = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all(): Promise<{ results: Row[] }>;
      first(): Promise<Row | null>;
      run(): Promise<unknown>;
    };
  };
};

// One adapter per binding, so the schema check above runs once per isolate, not per request.
const d1Adapters = new WeakMap<D1Like, Sql>();

export function d1Sql(db: D1Like): Sql {
  let sql = d1Adapters.get(db);
  if (!sql) {
    sql = {
      all: async (query, ...params) => (await db.prepare(query).bind(...params).all()).results,
      first: (query, ...params) => db.prepare(query).bind(...params).first(),
      run: async (query, ...params) => {
        await db.prepare(query).bind(...params).run();
      },
    };
    d1Adapters.set(db, sql);
  }
  return sql;
}
