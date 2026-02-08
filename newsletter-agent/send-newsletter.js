/**
 * IFM Newsletter Sender
 * Sends the monthly Kingdom Report to all subscribers via Resend API
 *
 * Usage:
 *   node send-newsletter.js                    # Send to all subscribers
 *   node send-newsletter.js --test email@test  # Send to test email only
 *   node send-newsletter.js --preview          # Generate HTML without sending
 *
 * Required env vars:
 *   RESEND_API_KEY - Resend API key
 *   NETLIFY_ACCESS_TOKEN - Netlify personal access token
 *   NETLIFY_SITE_ID - Netlify site ID for increasingfaith.net
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getSubscribers } = require('./subscribers');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  from: 'Increasing Faith Ministries <newsletter@increasingfaith.net>',
  replyTo: 'increasingfaithministry@gmail.com',
  batchSize: 10,        // Emails per batch
  batchDelay: 2000,     // ms between batches
  resendApiUrl: 'https://api.resend.com/emails',
  templatePath: path.join(__dirname, 'templates', 'email-template.html'),
  contentPath: path.join(__dirname, '..', 'content', 'newsletters', 'latest.json')
};

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const isPreview = args.includes('--preview');
  const testIndex = args.indexOf('--test');
  const testEmail = testIndex !== -1 ? args[testIndex + 1] : null;

  console.log('=== IFM Newsletter Sender ===');
  console.log(`Mode: ${isPreview ? 'PREVIEW' : testEmail ? `TEST (${testEmail})` : 'SEND TO ALL'}`);

  // Load newsletter content
  console.log('\nLoading newsletter content...');
  const content = loadContent();
  if (!content) {
    console.error('ERROR: No newsletter content found at', CONFIG.contentPath);
    process.exit(1);
  }
  console.log(`Newsletter: ${content.metadata?.dateString || 'Unknown'} - "${content.metadata?.theme?.theme || 'No theme'}"`);;

  // Load email template
  console.log('Loading email template...');
  const template = loadTemplate();
  if (!template) {
    console.error('ERROR: Email template not found at', CONFIG.templatePath);
    process.exit(1);
  }

  // Build the email HTML
  console.log('Building email HTML...');
  const emailHtml = buildEmailHtml(template, content);

  // Preview mode - save HTML and exit
  if (isPreview) {
    const previewPath = path.join(__dirname, 'preview.html');
    fs.writeFileSync(previewPath, emailHtml, 'utf-8');
    console.log(`\nPreview saved to: ${previewPath}`);
    console.log('Open this file in a browser to review the newsletter.');
    return;
  }

  // Verify Resend API key
  if (!process.env.RESEND_API_KEY) {
    console.error('ERROR: RESEND_API_KEY environment variable not set');
    process.exit(1);
  }

  // Get subscriber list
  let subscribers;
  if (testEmail) {
    subscribers = [{ name: 'Test Subscriber', email: testEmail }];
  } else {
    console.log('\nFetching subscribers from Netlify...');
    subscribers = await getSubscribers();
    if (!subscribers || subscribers.length === 0) {
      console.log('No subscribers found. Exiting.');
      return;
    }
  }

  console.log(`\nSending to ${subscribers.length} subscriber(s)...`);

  // Send in batches
  const subject = `The Kingdom Report — ${content.month}`;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i += CONFIG.batchSize) {
    const batch = subscribers.slice(i, i + CONFIG.batchSize);
    console.log(`\nBatch ${Math.floor(i / CONFIG.batchSize) + 1}: Sending to ${batch.length} subscriber(s)...`);

    for (const subscriber of batch) {
      try {
        await sendEmail(subscriber.email, subject, emailHtml);
        sent++;
        console.log(`  Sent: ${subscriber.email}`);
      } catch (error) {
        failed++;
        console.error(`  FAILED: ${subscriber.email} - ${error.message}`);
      }
    }

    // Delay between batches (except last batch)
    if (i + CONFIG.batchSize < subscribers.length) {
      console.log(`  Waiting ${CONFIG.batchDelay / 1000}s before next batch...`);
      await sleep(CONFIG.batchDelay);
    }
  }

  console.log('\n=== Delivery Complete ===');
  console.log(`Sent: ${sent} | Failed: ${failed} | Total: ${subscribers.length}`);
}

// ============================================
// CONTENT LOADING
// ============================================

function loadContent() {
  try {
    const raw = fs.readFileSync(CONFIG.contentPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function loadTemplate() {
  try {
    return fs.readFileSync(CONFIG.templatePath, 'utf-8');
  } catch (error) {
    return null;
  }
}

// ============================================
// EMAIL BUILDING
// ============================================

function buildEmailHtml(template, content) {
  // The generator outputs: { metadata: {...}, sections: { pastoralMessage, kingdomIntelligence, ... } }
  // Each section has { title, content } where content is markdown text
  const meta = content.metadata || {};
  const sections = content.sections || {};

  let html = template;

  // Month/Year
  html = html.replace(/\{\{month_year\}\}/g, meta.dateString || 'Monthly Newsletter');

  // Pastoral Message
  const pastoral = sections.pastoralMessage || {};
  const pastoralHtml = pastoral.content
    ? `<h2 style="color:#ffffff; font-size:22px; margin:0 0 15px;">${pastoral.title || 'From the Desk of Pastor Curtis'}</h2>
       <p style="color:#cccccc; font-size:15px; line-height:1.8; white-space:pre-line;">${pastoral.content}</p>`
    : '';
  html = html.replace('{{pastoral_message}}', pastoralHtml);

  // Kingdom Intelligence (content is a single markdown string with ### headings)
  const intelligence = sections.kingdomIntelligence || {};
  const newsHtml = intelligence.content
    ? `<div style="color:#cccccc; font-size:15px; line-height:1.8; white-space:pre-line;">${intelligence.content.replace(/### /g, '<h3 style="color:#d4af37; font-size:17px; margin:24px 0 8px 0;">').replace(/\n\n/g, '</h3>\n<p style="color:#cccccc; font-size:14px; line-height:1.7;">') + '</p>'}</div>`
    : '';
  html = html.replace('{{news_items}}', newsHtml);

  // Kingdom Living
  const living = sections.kingdomLiving || {};
  const livingHtml = living.content
    ? `<h3 style="color:#ffffff; font-size:20px; margin:0 0 15px;">${living.title || 'Kingdom Living'}</h3>
       <p style="color:#cccccc; font-size:15px; line-height:1.8; white-space:pre-line;">${living.content}</p>`
    : '';
  html = html.replace('{{kingdom_living}}', livingHtml);

  // Prayer Focus
  const prayer = sections.prayerFocus || {};
  const prayerHtml = prayer.content
    ? `<p style="color:#cccccc; font-size:15px; line-height:1.7; white-space:pre-line;">${prayer.content}</p>`
    : '';
  html = html.replace('{{prayer_focus}}', prayerHtml);

  // Scripture
  const scripture = sections.scriptureFocus || {};
  html = html.replace('{{scripture}}', scripture.content || '');
  html = html.replace('{{scripture_reference}}', scripture.title || 'Scripture of the Month');

  // Events/Upcoming
  const upcoming = sections.upcoming || {};
  const eventsHtml = upcoming.content
    ? `<p style="color:#cccccc; font-size:15px; line-height:1.8; white-space:pre-line;">${upcoming.content}</p>`
    : '';
  html = html.replace('{{events}}', eventsHtml);

  // Unsubscribe URL
  html = html.replace('{{unsubscribe_url}}', 'mailto:increasingfaithministry@gmail.com?subject=Unsubscribe%20from%20Kingdom%20Report');

  return html;
}

// ============================================
// EMAIL SENDING
// ============================================

async function sendEmail(to, subject, html) {
  const response = await fetch(CONFIG.resendApiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: CONFIG.from,
      to: [to],
      reply_to: CONFIG.replyTo,
      subject: subject,
      html: html
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

// ============================================
// UTILITIES
// ============================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
