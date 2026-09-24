import { handle } from 'hono/cloudflare-pages';
import { d1Sql, galleryApi, type D1Like } from '../../../server/gallery.ts';
import { consoleMailer, resendMailer } from '../../../server/mail.ts';

// The gallery API on the hosted site: a Cloudflare Pages Function backed by the D1 binding "DB".
// No AI here: submitters review their entries with their own AI in the browser.
// Secrets: RESEND_API_KEY (mails about reports; without it they only go to the log),
// ADMIN_TOKEN (oversight page), RATE_SALT (hashing IPs for the daily limits).

type Bindings = { DB?: D1Like; RESEND_API_KEY?: string; ADMIN_TOKEN?: string; RATE_SALT?: string };

export const onRequest = handle(
  galleryApi((c) => {
    const env = c.env as Bindings;
    if (!env.DB) throw new Error('D1 binding "DB" is missing');
    return {
      sql: d1Sql(env.DB),
      mail: env.RESEND_API_KEY ? resendMailer(env.RESEND_API_KEY) : consoleMailer,
      adminToken: env.ADMIN_TOKEN,
      salt: env.RATE_SALT ?? 'statrace',
    };
  }),
);
