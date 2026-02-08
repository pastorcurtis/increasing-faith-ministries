/**
 * IFM Live-Stream Alert Sender
 *
 * Sends "We're LIVE!" notifications to all platforms simultaneously:
 *   1. ntfy.sh   — push notification to all subscribed phones
 *   2. Telegram   — broadcast to channel subscribers
 *   3. Email      — blast to newsletter subscribers via Resend
 *
 * Usage:
 *   node send-alert.js                          # Send live alert to all platforms
 *   node send-alert.js --message "Custom msg"   # Custom message
 *   node send-alert.js --test                   # Test mode (ntfy only)
 *   node send-alert.js --platform ntfy          # Send to specific platform only
 *   node send-alert.js --platform telegram
 *   node send-alert.js --platform email
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'newsletter-agent', '.env') });

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  // Ministry info
  ministry: 'Increasing Faith Ministries',
  pastors: 'Pastors Curtis & Tammy Stephens',
  facebookUrl: 'https://www.facebook.com/IFMinistry',
  youtubeUrl: 'https://www.youtube.com/@thehourofpowerextra2883/shorts',

  // ntfy.sh (completely free push notifications)
  ntfy: {
    topic: 'ifm-live-alerts-2026',
    server: 'https://ntfy.sh',
  },

  // Telegram Bot (free broadcast channel)
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    channelId: process.env.TELEGRAM_CHANNEL_ID || '',
    apiBase: 'https://api.telegram.org',
  },

  // Email via Resend (already configured)
  email: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: 'Increasing Faith Ministries <newsletter@increasingfaith.net>',
    replyTo: 'increasingfaithministry@gmail.com',
    // Hardcoded subscriber list (members who opted in via Breeze)
    subscribers: [
      'curtisstephensjr@gmail.com',
      'deborahliadi@gmail.com',
      'andrewstaneatia@gmail.com',
      'hawkins.lynette@yahoo.com',
      'tammystephens66@yahoo.com',
      'cdubdub23@gmail.com',
    ],
  },
};

// ============================================
// DEFAULT MESSAGES
// ============================================

const DEFAULT_MESSAGE = `${CONFIG.pastors} are LIVE now! Tap to watch Kingdom truth, faith, and discipleship.`;

const EMAIL_HTML = (message) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#0d0d0d; font-family:'Montserrat',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#141414; border-radius:12px; overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d0d0d,#1a1a1a); padding:40px; text-align:center; border-bottom:2px solid #d4af37;">
          <h1 style="color:#d4af37; font-size:28px; margin:0; letter-spacing:3px;">WE'RE LIVE!</h1>
          <p style="color:rgba(255,255,255,0.6); font-size:13px; margin:10px 0 0; letter-spacing:2px;">INCREASING FAITH MINISTRIES</p>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:40px; text-align:center;">
          <p style="color:#ffffff; font-size:18px; line-height:1.7; margin:0 0 30px;">${message}</p>
          <a href="${CONFIG.facebookUrl}" style="display:inline-block; background:linear-gradient(135deg,#d4af37,#f5d76e); color:#0d0d0d; text-decoration:none; padding:16px 40px; border-radius:50px; font-weight:700; font-size:16px; letter-spacing:1px;">WATCH NOW</a>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:20px 40px; text-align:center; border-top:1px solid rgba(212,175,55,0.15);">
          <p style="color:rgba(255,255,255,0.4); font-size:12px; margin:0;">Increasing Faith Ministries | increasingfaith.net</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ============================================
// SENDERS
// ============================================

async function sendNtfy(message) {
  console.log('\n--- ntfy.sh ---');
  try {
    const response = await fetch(`${CONFIG.ntfy.server}/${CONFIG.ntfy.topic}`, {
      method: 'POST',
      headers: {
        'Title': 'IFM is LIVE!',
        'Tags': 'rotating_light,video_camera',
        'Click': CONFIG.facebookUrl,
        'Priority': '5',
        'Actions': `view, Watch on Facebook, ${CONFIG.facebookUrl}; view, Watch on YouTube, ${CONFIG.youtubeUrl}`,
      },
      body: message,
    });

    if (!response.ok) throw new Error(`ntfy error: ${response.status}`);
    const data = await response.json();
    console.log(`  Sent! Topic: ${data.topic} | ID: ${data.id}`);
    return true;
  } catch (error) {
    console.error(`  FAILED: ${error.message}`);
    return false;
  }
}

async function sendTelegram(message) {
  console.log('\n--- Telegram ---');
  if (!CONFIG.telegram.botToken || !CONFIG.telegram.channelId) {
    console.log('  SKIPPED: Telegram not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID in .env)');
    return false;
  }

  try {
    const url = `${CONFIG.telegram.apiBase}/bot${CONFIG.telegram.botToken}/sendMessage`;
    const text = `🔴 *WE'RE LIVE!*\n\n${message}\n\n[Watch on Facebook](${CONFIG.facebookUrl}) | [Watch on YouTube](${CONFIG.youtubeUrl})`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.telegram.channelId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Telegram API ${response.status}: ${err}`);
    }

    const data = await response.json();
    console.log(`  Sent! Message ID: ${data.result.message_id}`);
    return true;
  } catch (error) {
    console.error(`  FAILED: ${error.message}`);
    return false;
  }
}

async function sendEmail(message) {
  console.log('\n--- Email (Resend) ---');
  if (!CONFIG.email.apiKey) {
    console.log('  SKIPPED: RESEND_API_KEY not set');
    return false;
  }

  const subscribers = CONFIG.email.subscribers;
  if (subscribers.length === 0) {
    console.log('  SKIPPED: No email subscribers');
    return false;
  }

  let sent = 0;
  let failed = 0;

  for (const email of subscribers) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.email.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: CONFIG.email.from,
          to: [email],
          reply_to: CONFIG.email.replyTo,
          subject: '🔴 IFM is LIVE — Watch Now!',
          html: EMAIL_HTML(message),
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Resend ${response.status}: ${err}`);
      }
      sent++;
      console.log(`  Sent: ${email}`);
      // Respect Resend's 2 req/sec rate limit
      await new Promise(r => setTimeout(r, 600));
    } catch (error) {
      failed++;
      console.error(`  FAILED: ${email} - ${error.message}`);
    }
  }

  console.log(`  Done: ${sent} sent, ${failed} failed`);
  return sent > 0;
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const msgIndex = args.indexOf('--message');
  const message = msgIndex !== -1 ? args[msgIndex + 1] : DEFAULT_MESSAGE;
  const platIndex = args.indexOf('--platform');
  const platform = platIndex !== -1 ? args[platIndex + 1] : 'all';

  console.log('======================================================');
  console.log('  IFM LIVE-STREAM ALERT SYSTEM');
  console.log('======================================================');
  console.log(`  Mode:     ${isTest ? 'TEST (ntfy only)' : 'LIVE'}`);
  console.log(`  Platform: ${platform}`);
  console.log(`  Message:  ${message}`);
  console.log('======================================================');

  const results = {};

  if (isTest || platform === 'all' || platform === 'ntfy') {
    results.ntfy = await sendNtfy(message);
  }

  if (!isTest && (platform === 'all' || platform === 'telegram')) {
    results.telegram = await sendTelegram(message);
  }

  if (!isTest && (platform === 'all' || platform === 'email')) {
    results.email = await sendEmail(message);
  }

  console.log('\n======================================================');
  console.log('  RESULTS');
  console.log('======================================================');
  for (const [plat, success] of Object.entries(results)) {
    console.log(`  ${plat}: ${success ? 'SENT' : 'FAILED/SKIPPED'}`);
  }
  console.log('======================================================');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
