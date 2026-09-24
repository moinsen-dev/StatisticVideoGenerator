import { handle } from 'hono/cloudflare-pages';
import { d1Sql, galleryApi, type D1Like } from '../../../server/gallery.ts';

// The gallery API on the hosted site: a Cloudflare Pages Function backed by the D1 binding "DB".
// Secrets: ADMIN_TOKEN (moderation), RATE_SALT (hashing IPs for the daily submission limit).

type Bindings = { DB?: D1Like; ADMIN_TOKEN?: string; RATE_SALT?: string };

export const onRequest = handle(
  galleryApi((c) => {
    const env = c.env as Bindings;
    if (!env.DB) throw new Error('D1 binding "DB" is missing');
    return { sql: d1Sql(env.DB), adminToken: env.ADMIN_TOKEN, salt: env.RATE_SALT ?? 'statrace' };
  }),
);
