#!/usr/bin/env node
/**
 * send-alert.js - Deliver an automation alert to a human, by email.
 *
 * Why this exists
 * ---------------
 * On 2026-08-17 Groq retired the models this repo generated content with. The
 * daily social post stopped for 8 days. Detection was never the problem: the
 * social agent opened a GitHub issue every single one of those days -- #55
 * through #62, all correct, all assigned to the pastor, all unread. The outage
 * ended when he happened to ask how the automation was doing.
 *
 * So the gap was delivery, not detection. Monitoring that reaches nobody is
 * indistinguishable from no monitoring, and it is worse than none, because it
 * feels like coverage. GitHub issues are a fine audit trail and a useless
 * notification channel for someone who does not read GitHub.
 *
 * Email is the channel he actually reads. Resend is already wired up and its
 * sending domain is already verified, because the monthly newsletter goes out
 * through it -- so this adds a delivery path without adding a dependency.
 *
 * Usage
 *   node send-alert.js --subject "..." --body-file path/to/body.md [--url ...]
 *
 * Environment
 *   RESEND_API_KEY  required
 *   ALERT_EMAIL_TO  optional, defaults to the address below
 *
 * Exit codes
 *   0  sent
 *   1  send failed (callers should use continue-on-error so a failure to
 *      deliver the alarm never masks the problem the alarm was about)
 *   2  misconfigured (missing key or arguments)
 */

const fs = require('fs');

// Same verified sender the newsletter uses -- see newsletter-agent/send-newsletter.js.
const FROM = 'IFM Automation <newsletter@increasingfaith.net>';
const DEFAULT_TO = 'curtisstephensjr@gmail.com';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('send-alert: RESEND_API_KEY is not set -- cannot deliver.');
    process.exit(2);
  }

  const subject = arg('subject');
  const bodyFile = arg('body-file');
  if (!subject || !bodyFile) {
    console.error('send-alert: --subject and --body-file are both required.');
    process.exit(2);
  }

  let body;
  try {
    body = fs.readFileSync(bodyFile, 'utf8');
  } catch (err) {
    console.error(`send-alert: could not read ${bodyFile}: ${err.message}`);
    process.exit(2);
  }

  const url = arg('url');
  const to = (process.env.ALERT_EMAIL_TO || DEFAULT_TO)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const text = url ? `${body}\n\nDetails: ${url}\n` : body;

  // Deliberately plain. This is an alarm, not a newsletter -- it should be
  // readable in a notification preview on a phone, at a glance, at 6am.
  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;',
    'font-size:15px;line-height:1.55;color:#111;max-width:640px">',
    `<pre style="white-space:pre-wrap;font-family:inherit;margin:0">${escapeHtml(body)}</pre>`,
    url ? `<p style="margin-top:20px"><a href="${url}">Open the run on GitHub</a></p>` : '',
    '<hr style="border:0;border-top:1px solid #ddd;margin:24px 0">',
    '<p style="color:#666;font-size:13px;margin:0">',
    'Automated alert from the increasingfaith.net automation. ',
    'You are getting this because a scheduled job needs attention.',
    '</p></div>',
  ].join('');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM, to, subject, text, html }),
  });

  if (!res.ok) {
    console.error(`send-alert: Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }

  const data = await res.json().catch(() => ({}));
  console.log(`send-alert: delivered to ${to.join(', ')}${data.id ? ` (id ${data.id})` : ''}`);
}

main().catch((err) => {
  console.error(`send-alert: ${err.message}`);
  process.exit(1);
});
