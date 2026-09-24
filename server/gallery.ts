import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { parseDataset, type Dataset } from '../shared/dataset.ts';
import { GALLERY_LICENSE, paywalledSources } from '../shared/gallery.ts';
import { OPERATOR, type Mailer } from './mail.ts';
import type { Moderator, Verdict } from './moderation.ts';

// Public gallery. Visitors submit a project (the dataset JSON only: no audio, no keys, no accounts).
// Nobody at moinsen reviews by hand: fixed checks and an AI review decide at once, and a reported entry
// is hidden and reviewed again right away (DSA Art. 16). Every decision says that it was automated.
// One Hono app for both runtimes: the local Node server (SQLite) and a Cloudflare Pages Function (D1).

export type Row = Record<string, unknown>;

/** The three SQL calls the gallery needs; implemented for node:sqlite and for D1. */
export interface Sql {
  all(sql: string, ...params: unknown[]): Promise<Row[]>;
  first(sql: string, ...params: unknown[]): Promise<Row | null>;
  run(sql: string, ...params: unknown[]): Promise<void>;
}

export type GalleryConfig = {
  sql: Sql;
  /** null: no reviewer configured, so nothing gets published */
  moderate: Moderator | null;
  mail: Mailer;
  adminToken: string | undefined;
  salt: string;
};

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

/** Per visitor and day; `reviews` counts all AI reviews of a day together and caps their cost. */
const LIMITS = { submissions: 5, reports: 20, reviews: 300 } as const;
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
// (offered, not required: they only serve to send the decision) and a statement of good faith.
const ReportSchema = z.object({
  reason: z.string().trim().min(10).max(2000),
  name: z.string().trim().max(200).optional(),
  email: z.email().max(200).optional().or(z.literal('')),
  goodFaith: z.literal(true),
});
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
const today = () => new Date().toISOString().slice(0, 10);

/** Normalised dataset with bounded text and only http(s) links; throws on refusals and paywalled sources. */
function publishable(json: unknown): Dataset {
  const ds = parseDataset(json);
  const paywalled = paywalledSources(ds);
  if (paywalled.length) throw new Error(`paywalled source: ${new URL(paywalled[0].url).hostname}`);
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

type Case = { name?: string | null; title: string; url: string; terms: string };

/** Confirmation and decision for the notifier in one mail (DSA Art. 16(4)–(6)), German and English. */
function decisionMail(n: Case, removed: boolean, reason: string, automated: boolean) {
  const hello = n.name ? ` ${n.name}` : '';
  return {
    subject: 'StatRace: Entscheidung zu Ihrer Meldung / Decision on your report',
    text: `Guten Tag${hello},

Ihre Meldung zum Galerie-Eintrag „${n.title}“ (${n.url}) ist eingegangen und wurde geprüft.

Entscheidung: ${removed ? 'Der Eintrag wurde entfernt.' : 'Der Eintrag verstößt nicht gegen die Galerie-Regeln und bleibt online.'}
Begründung: ${reason || '–'}

${automated ? 'Die Prüfung hat ein automatisches System (KI) nach den Galerie-Regeln vorgenommen.' : 'Diese Entscheidung hat ein Mensch getroffen.'} Wenn Sie nicht einverstanden sind, antworten Sie auf diese E-Mail. Der Rechtsweg bleibt Ihnen unbenommen.
Galerie-Regeln: ${n.terms}

---

Hello${hello},

your report about the gallery entry “${n.title}” (${n.url}) has been received and reviewed.

Decision: ${removed ? 'The entry has been removed.' : 'The entry does not break the gallery rules and stays online.'}
Reason: ${reason || '–'}

${automated ? 'An automated system (AI) reviewed the entry under the gallery rules.' : 'A person made this decision.'} If you disagree, reply to this email. You may also seek judicial redress.
Gallery rules: ${n.terms}

moinsen · StatRace`,
  };
}

/** Confirmation of receipt when the automatic review could not run (DSA Art. 16(4)). */
function receiptMail(n: Case) {
  const hello = n.name ? ` ${n.name}` : '';
  return {
    subject: 'StatRace: Ihre Meldung ist eingegangen / Your report was received',
    text: `Guten Tag${hello},

Ihre Meldung zum Galerie-Eintrag „${n.title}“ (${n.url}) ist eingegangen. Der Eintrag ist ausgeblendet, bis er geprüft ist; die Entscheidung schicken wir Ihnen per E-Mail.

---

Hello${hello},

your report about the gallery entry “${n.title}” (${n.url}) has been received. The entry is hidden until it has been reviewed; we will email you the decision.

moinsen · StatRace`,
  };
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

  /** Counts an action per day; per visitor the IP is only kept as a salted hash that changes daily. */
  const allowed = async (c: Context<Env>, action: keyof typeof LIMITS) => {
    const { sql, salt } = c.get('gallery');
    const day = today();
    const ip = c.req.header('cf-connecting-ip') ?? c.req.header('x-forwarded-for') ?? 'local';
    const key = action === 'reviews' ? `reviews:${day}` : `${action}:${await sha256(`${salt}:${day}:${ip}`)}`;
    await sql.run('DELETE FROM rate WHERE day <> ?', day);
    const row = await sql.first('SELECT count FROM rate WHERE key = ?', key);
    if (Number(row?.count ?? 0) >= LIMITS[action]) return false;
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

  const links = (c: Context<Env>, id: string) => {
    const origin = new URL(c.req.url).origin;
    return { url: `${origin}/app#g=${id}`, terms: `${origin}/gallery-terms.html`, moderation: `${origin}/app#moderate` };
  };

  app.get('/', async (c) => {
    const { sql } = c.get('gallery');
    // Housekeeping without a cron: rate hashes live for their day, rejected entries and handled
    // reports for 30 days (these deletes usually match nothing, so they write nothing).
    await sql.run('DELETE FROM rate WHERE day <> ?', today());
    await sql.run("DELETE FROM submissions WHERE status IN ('rejected', 'removed') AND reviewed_at < ?", Date.now() - KEEP_MS);
    await sql.run('DELETE FROM reports WHERE handled = 1 AND created_at < ?', Date.now() - KEEP_MS);
    const rows = await sql.all(
      "SELECT id, title, subtitle, language, icons, model, reviewed_at FROM submissions WHERE status = 'approved' ORDER BY reviewed_at DESC LIMIT 60",
    );
    return c.json(rows.map((r) => ({ ...r, icons: JSON.parse(String(r.icons)) })));
  });

  app.post('/', async (c) => {
    const { sql, moderate } = c.get('gallery');
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
    if (!moderate) return c.json({ message: 'review unavailable' }, 503);
    if (!(await allowed(c, 'submissions')) || !(await allowed(c, 'reviews'))) return c.json({ message: 'limit' }, 429);

    let verdict: Verdict;
    try {
      verdict = await moderate({ dataset, topic: parsed.data.topic });
    } catch (err) {
      console.error('gallery review failed', err);
      return c.json({ message: 'review unavailable' }, 503);
    }
    const id = randomId(6);
    const token = randomId(18);
    const status = verdict.allowed ? 'approved' : 'rejected';
    const now = Date.now();
    await sql.run(
      `INSERT INTO submissions (id, token_hash, status, reason, title, subtitle, language, topic, bars, icons, model, dataset, created_at, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      await sha256(token),
      status,
      verdict.reason,
      dataset.title,
      dataset.subtitle,
      dataset.language,
      cut(parsed.data.topic, 300),
      parsed.data.bars,
      JSON.stringify(dataset.series.slice(0, 3).map((s) => s.icon)),
      parsed.data.model ?? null,
      JSON.stringify(dataset),
      now,
      now,
    );
    return c.json({ id, token, status, reason: verdict.reason }, 201);
  });

  // Oversight for the operator, not needed day to day: the latest automatic decisions (to spot-check
  // and override) and the latest reports, including those whose automatic review failed.
  app.get('/admin/queue', async (c) => {
    if (!admin(c)) return c.json({ message: 'forbidden' }, 403);
    const { sql } = c.get('gallery');
    const recent = await sql.all(
      'SELECT id, status, reason, title, subtitle, language, topic, bars, model, dataset, created_at FROM submissions ORDER BY created_at DESC LIMIT 50',
    );
    const reports = await sql.all(
      `SELECT r.id, r.submission_id, r.reason, r.handled, r.created_at, r.contact IS NOT NULL AS has_contact,
              s.title, s.status, s.reason AS decision
       FROM reports r JOIN submissions s ON s.id = r.submission_id ORDER BY r.handled, r.created_at DESC LIMIT 50`,
    );
    return c.json({ recent: recent.map((r) => ({ ...r, dataset: JSON.parse(String(r.dataset)) })), reports });
  });

  // A human override. Notifiers still waiting (their automatic review failed) get the decision now.
  app.post('/admin/:id', async (c) => {
    if (!admin(c)) return c.json({ message: 'forbidden' }, 403);
    const parsed = DecisionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ message: 'invalid' }, 400);
    const { sql, mail } = c.get('gallery');
    const id = c.req.param('id');
    const { status, reason = '' } = parsed.data;
    const entry = await sql.first('SELECT title FROM submissions WHERE id = ?', id);
    if (!entry) return c.json({ message: 'not found' }, 404);
    await sql.run('UPDATE submissions SET status = ?, reason = ?, reviewed_at = ? WHERE id = ?', status, reason || null, Date.now(), id);
    const waiting = await sql.all('SELECT name, contact FROM reports WHERE submission_id = ? AND handled = 0 AND contact IS NOT NULL', id);
    for (const r of waiting) {
      const notice = decisionMail({ name: r.name as string | null, title: String(entry.title), ...links(c, id) }, status !== 'approved', reason, false);
      await mail({ to: String(r.contact), ...notice }).catch((err) => console.error('gallery mail failed', err));
    }
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
    return c.json({ ...row, dataset: JSON.parse(String(row.dataset)), license: GALLERY_LICENSE.name });
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

  // A report hides the entry at once and triggers a fresh review with the report attached. The notifier
  // (if they left an email) gets confirmation and decision in one mail, the operator a note without
  // their name or email; then name and email are deleted.
  app.post('/:id/report', async (c) => {
    const parsed = ReportSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ message: 'invalid' }, 400);
    const { sql, moderate, mail } = c.get('gallery');
    const id = c.req.param('id');
    const entry = await sql.first("SELECT title, topic, dataset FROM submissions WHERE id = ? AND status = 'approved'", id);
    if (!entry) return c.json({ message: 'not found' }, 404);
    if (!(await allowed(c, 'reports'))) return c.json({ message: 'limit' }, 429);

    const report = parsed.data;
    await sql.run("UPDATE submissions SET status = 'reported' WHERE id = ?", id);
    await sql.run(
      'INSERT INTO reports (submission_id, reason, name, contact, created_at) VALUES (?, ?, ?, ?, ?)',
      id,
      report.reason,
      report.name || null,
      report.email || null,
      Date.now(),
    );

    let verdict: Verdict | null = null;
    if (moderate && (await allowed(c, 'reviews'))) {
      try {
        verdict = await moderate({ dataset: JSON.parse(String(entry.dataset)) as Dataset, topic: String(entry.topic), report: report.reason });
      } catch (err) {
        console.error('gallery re-review failed', err);
      }
    }
    const title = String(entry.title);
    const where = links(c, id);
    const quiet = (err: unknown) => console.error('gallery mail failed', err);

    if (!verdict) {
      // No automatic decision: the entry stays hidden until the operator decides on the moderation page.
      if (report.email) await mail({ to: report.email, ...receiptMail({ name: report.name, title, ...where }) }).catch(quiet);
      await mail({
        to: OPERATOR,
        subject: `StatRace: Meldung ohne automatische Prüfung – ${title}`,
        text: `Die automatische Prüfung ist ausgefallen. Der Eintrag ist ausgeblendet, bis du ihn freigibst oder entfernst: ${where.moderation}\n\nEintrag: ${where.url}\nMeldung: ${report.reason}`,
      }).catch(quiet);
      return c.json({ status: 'reported', reason: null }, 202);
    }

    const removed = !verdict.allowed;
    await sql.run('UPDATE submissions SET status = ?, reason = ?, reviewed_at = ? WHERE id = ?', removed ? 'removed' : 'approved', verdict.reason, Date.now(), id);
    if (report.email) await mail({ to: report.email, ...decisionMail({ name: report.name, title, ...where }, removed, verdict.reason, true) }).catch(quiet);
    await mail({
      to: OPERATOR,
      subject: `StatRace: Meldung – ${title} – ${removed ? 'entfernt' : 'bleibt online'}`,
      text: `Automatische Entscheidung: ${removed ? 'entfernt' : 'bleibt online'}\nBegründung: ${verdict.reason}\n\nEintrag: ${where.url}\nMeldung: ${report.reason}\n\nÜberstimmen: ${where.moderation}`,
    }).catch(quiet);
    await sql.run('UPDATE reports SET handled = 1, name = NULL, contact = NULL WHERE submission_id = ? AND handled = 0', id);
    return c.json({ status: removed ? 'removed' : 'approved', reason: verdict.reason });
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
