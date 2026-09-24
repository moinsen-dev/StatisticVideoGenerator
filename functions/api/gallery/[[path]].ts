import { handle } from 'hono/cloudflare-pages';
import { d1Sql, galleryApi, type D1Like } from '../../../server/gallery.ts';
import { consoleMailer, resendMailer } from '../../../server/mail.ts';
import { anthropicModerator } from '../../../server/moderation.ts';

// The gallery API on the hosted site: a Cloudflare Pages Function backed by the D1 binding "DB".
// Secrets: ANTHROPIC_API_KEY (automatic review; without it nothing gets published), RESEND_API_KEY
// (mails to notifiers; without it they only go to the log), ADMIN_TOKEN (oversight page), RATE_SALT.

type Bindings = { DB?: D1Like; ANTHROPIC_API_KEY?: string; RESEND_API_KEY?: string; ADMIN_TOKEN?: string; RATE_SALT?: string };

export const onRequest = handle(
  galleryApi((c) => {
    const env = c.env as Bindings;
    if (!env.DB) throw new Error('D1 binding "DB" is missing');
    return {
      sql: d1Sql(env.DB),
      moderate: env.ANTHROPIC_API_KEY ? anthropicModerator(env.ANTHROPIC_API_KEY) : null,
      mail: env.RESEND_API_KEY ? resendMailer(env.RESEND_API_KEY) : consoleMailer,
      adminToken: env.ADMIN_TOKEN,
      salt: env.RATE_SALT ?? 'statrace',
    };
  }),
);
