/**
 * Transactional email via the Resend HTTP API (plain fetch, no SDK).
 *
 * Degraded-mode idiom (same as payment providers): when RESEND_API_KEY /
 * EMAIL_FROM are missing, the mailer logs and returns instead of
 * throwing, so dev/test environments work without an email account.
 * `sendMail` never rejects — callers can fire-and-forget safely; a
 * delivery failure must never fail the request that triggered it.
 */

import { log } from './logger';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export interface MailContent {
  subject: string;
  html: string;
}

function getMailerConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

/** True when email can actually be delivered (used for dev fallbacks). */
export function mailerConfigured(): boolean {
  return getMailerConfig() !== null;
}

export async function sendMail(to: string | null | undefined, content: MailContent): Promise<void> {
  if (!to) {
    log.info('mailer.skipped', { reason: 'no recipient', subject: content.subject });
    return;
  }
  const config = getMailerConfig();
  if (!config) {
    log.info('mailer.skipped', { reason: 'not configured', to, subject: content.subject });
    return;
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: config.from, to, subject: content.subject, html: content.html }),
    });
    if (!res.ok) {
      log.error('mailer.send_failed', { to, subject: content.subject, status: res.status });
      return;
    }
    log.info('mailer.sent', { to, subject: content.subject });
  } catch (err) {
    log.error('mailer.send_failed', { to, subject: content.subject, error: String(err) });
  }
}

function layout(title: string, bodyHtml: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
  <h2 style="margin:24px 0 16px">${title}</h2>
  ${bodyHtml}
  <p style="margin-top:32px;font-size:12px;color:#777">Cryptech Ltd &middot; Tali Office Road, Hazaribagh, Dhaka-1209</p>
</div>`;
}

export function verificationEmail(code: string, verifyUrl: string): MailContent {
  return {
    subject: 'Verify your Cryptech account',
    html: layout(
      'Verify your email',
      `<p>Welcome to Cryptech! Enter this code on the verification page to activate your account:</p>
<p style="margin:24px 0;font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p>
<p>Or click the button below to verify instantly:</p>
<p style="margin:24px 0"><a href="${verifyUrl}" style="background:#111;color:#fff;padding:10px 18px;text-decoration:none;border-radius:6px">Verify my email</a></p>
<p>This code and link expire in 30 minutes. If you didn't create an account, you can safely ignore this email.</p>`,
    ),
  };
}
