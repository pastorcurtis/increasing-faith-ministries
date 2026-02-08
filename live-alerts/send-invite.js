/**
 * Send Live Alert System invite email to all contacts
 * One-time use to onboard members to ntfy/Telegram
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'newsletter-agent', '.env') });

const fs = require('fs');
const path = require('path');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const emails = JSON.parse(fs.readFileSync(path.join(__dirname, 'invite-emails.json'), 'utf-8'));

const EMAIL_HTML = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#0d0d0d; font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#141414; border-radius:12px; overflow:hidden;">

        <tr><td style="background:linear-gradient(135deg,#0d0d0d,#1a1a1a); padding:48px 40px; text-align:center; border-bottom:2px solid #d4af37;">
          <p style="color:rgba(255,255,255,0.5); font-size:12px; letter-spacing:3px; text-transform:uppercase; margin:0 0 12px;">Increasing Faith Ministries</p>
          <h1 style="color:#d4af37; font-size:26px; margin:0; letter-spacing:2px;">NEVER MISS A LIVE BROADCAST</h1>
        </td></tr>

        <tr><td style="padding:40px;">
          <p style="color:#ffffff; font-size:16px; line-height:1.8; margin:0 0 24px;">IFM Family!</p>
          <p style="color:rgba(255,255,255,0.75); font-size:15px; line-height:1.8; margin:0 0 24px;">We just launched a <strong style="color:#d4af37;">FREE Live Alert System</strong> so you never miss a broadcast from Pastors Curtis &amp; Tammy Stephens. Get instant notifications the moment we go LIVE.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
            <tr><td style="background:#111; border-radius:10px; border-left:3px solid #d4af37; padding:20px;">
              <h3 style="color:#d4af37; font-size:16px; margin:0 0 10px;">&#128241; Option 1: Push Notifications (Recommended)</h3>
              <p style="color:rgba(255,255,255,0.7); font-size:14px; line-height:1.7; margin:0;">
                1. Download the FREE <strong>"ntfy"</strong> app<br>
                &nbsp;&nbsp;&nbsp;<a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" style="color:#d4af37;">Android</a> &nbsp;|&nbsp; <a href="https://apps.apple.com/us/app/ntfy/id1625396347" style="color:#d4af37;">iPhone</a><br>
                2. Open the app, tap <strong>+</strong><br>
                3. Subscribe to: <strong style="color:#d4af37;">ifm-live-alerts-2026</strong>
              </p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td style="background:#111; border-radius:10px; border-left:3px solid #d4af37; padding:20px;">
              <h3 style="color:#d4af37; font-size:16px; margin:0 0 10px;">&#9992;&#65039; Option 2: Telegram Channel</h3>
              <p style="color:rgba(255,255,255,0.7); font-size:14px; line-height:1.7; margin:0;">
                Join our official channel — tap the link below:<br>
                <a href="https://t.me/ifm_live" style="color:#d4af37; font-size:16px; font-weight:bold;">t.me/ifm_live</a>
              </p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
            <tr><td style="background:#111; border-radius:10px; border-left:3px solid #d4af37; padding:20px;">
              <h3 style="color:#d4af37; font-size:16px; margin:0 0 10px;">&#128218; Option 3: Facebook</h3>
              <p style="color:rgba(255,255,255,0.7); font-size:14px; line-height:1.7; margin:0;">
                Follow our page &amp; turn on Live notifications:<br>
                <a href="https://www.facebook.com/IFMinistry" style="color:#d4af37;">facebook.com/IFMinistry</a>
              </p>
            </td></tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0;">
            <tr>
              <td style="padding:8px 0; color:rgba(255,255,255,0.5); font-size:14px;">&#10004; No spam — live alerts only</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:rgba(255,255,255,0.5); font-size:14px;">&#10004; Completely free</td>
            </tr>
            <tr>
              <td style="padding:8px 0; color:rgba(255,255,255,0.5); font-size:14px;">&#10004; Leave anytime</td>
            </tr>
          </table>

          <p style="color:rgba(255,255,255,0.6); font-size:14px; line-height:1.7; margin:0;">With Kingdom love,<br><strong style="color:#fff;">Increasing Faith Ministries</strong></p>
        </td></tr>

        <tr><td style="padding:20px 40px; text-align:center; border-top:1px solid rgba(212,175,55,0.15);">
          <p style="color:rgba(255,255,255,0.3); font-size:11px; margin:0;">
            <a href="https://increasingfaith.net" style="color:#d4af37; text-decoration:none;">increasingfaith.net</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

async function main() {
  console.log('=== IFM Live Alert Invite Email ===');
  console.log('Sending to ' + emails.length + ' contacts...\n');

  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + RESEND_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Increasing Faith Ministries <newsletter@increasingfaith.net>',
          to: [email],
          reply_to: 'increasingfaithministry@gmail.com',
          subject: 'Never Miss a Live Broadcast — Join IFM Live Alerts (Free)',
          html: EMAIL_HTML,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error('Resend ' + response.status + ': ' + err);
      }
      sent++;
      console.log('  Sent: ' + email);
      // Respect Resend 2 req/sec limit
      await new Promise(r => setTimeout(r, 600));
    } catch (error) {
      failed++;
      console.error('  FAILED: ' + email + ' - ' + error.message);
      // If rate limited, wait longer and retry
      if (error.message.includes('429')) {
        console.log('  Rate limited, waiting 3s...');
        await new Promise(r => setTimeout(r, 3000));
      }
    }
  }

  console.log('\n=== Done ===');
  console.log('Sent: ' + sent + ' | Failed: ' + failed + ' | Total: ' + emails.length);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
