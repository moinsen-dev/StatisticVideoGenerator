// Mails from the gallery (DSA Art. 16(4)/(5): confirmation and decision for whoever reported an entry).
// Hosted: Resend with the one verified moinsen sender. Locally without a key: printed to the console.

export type Mail = { to: string; bcc?: string; subject: string; text: string };
export type Mailer = (mail: Mail) => Promise<void>;

export const SENDER = 'StatRace <business@moinsen.dev>';
export const OPERATOR = 'business@moinsen.dev';

export function resendMailer(apiKey: string): Mailer {
  return async (mail) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: SENDER, to: [mail.to], bcc: mail.bcc ? [mail.bcc] : undefined, subject: mail.subject, text: mail.text }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  };
}

export const consoleMailer: Mailer = async (mail) => {
  console.log(`[gallery mail] to ${mail.to}${mail.bcc ? ` (bcc ${mail.bcc})` : ''}: ${mail.subject}\n${mail.text}`);
};
