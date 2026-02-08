/**
 * IFM Newsletter Sender - Google Apps Script (Alternative to Resend)
 * Sends the monthly Kingdom Report to subscribers via Gmail
 *
 * SETUP:
 * 1. Create a Google Sheet named "IFM Newsletter Subscribers" with columns: Name | Email | Subscribed Date | Active
 * 2. Copy this script to a new Google Apps Script project
 * 3. Set the SPREADSHEET_ID in the CONFIG below
 * 4. Run sendNewsletter() manually or set a monthly trigger
 *
 * Increasing Faith Ministries
 * https://increasingfaith.net
 */

// ============================================
// CONFIGURATION
// ============================================

const NEWSLETTER_CONFIG = {
  // Google Sheet with subscriber list
  spreadsheetId: 'YOUR_SPREADSHEET_ID_HERE',
  sheetName: 'Subscribers',

  // Email settings
  fromName: 'Increasing Faith Ministries',
  replyTo: 'increasingfaithministry@gmail.com',

  // Newsletter content URL (fetched from your GitHub repo)
  contentUrl: 'https://raw.githubusercontent.com/pastorcurtis/increasing-faith-ministries/main/content/newsletters/latest.json',

  // Sending limits (Gmail: 500/day for Workspace, 100/day for free)
  maxPerRun: 50,
  delayBetweenEmails: 2000 // ms
};

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Send the newsletter to all active subscribers
 */
function sendNewsletter() {
  console.log('=== IFM Newsletter Sender ===');

  // Fetch newsletter content
  const content = fetchNewsletterContent();
  if (!content) {
    console.error('Failed to fetch newsletter content');
    return;
  }
  console.log(`Newsletter: ${content.month} - "${content.theme}"`);

  // Get subscribers
  const subscribers = getActiveSubscribers();
  console.log(`Active subscribers: ${subscribers.length}`);

  if (subscribers.length === 0) {
    console.log('No active subscribers found. Exiting.');
    return;
  }

  // Build email HTML
  const emailHtml = buildNewsletterEmail(content);
  const subject = `The Kingdom Report — ${content.month}`;

  // Send to each subscriber
  let sent = 0;
  let failed = 0;
  const limit = Math.min(subscribers.length, NEWSLETTER_CONFIG.maxPerRun);

  for (let i = 0; i < limit; i++) {
    const sub = subscribers[i];
    try {
      GmailApp.sendEmail(sub.email, subject, '', {
        htmlBody: emailHtml,
        name: NEWSLETTER_CONFIG.fromName,
        replyTo: NEWSLETTER_CONFIG.replyTo
      });
      sent++;
      console.log(`Sent to: ${sub.email}`);

      // Mark as sent in the sheet
      markAsSent(sub.row, content.month);
    } catch (error) {
      failed++;
      console.error(`Failed: ${sub.email} - ${error.message}`);
    }

    // Delay between emails
    if (i < limit - 1) {
      Utilities.sleep(NEWSLETTER_CONFIG.delayBetweenEmails);
    }
  }

  console.log(`\n=== Complete: Sent ${sent} | Failed ${failed} ===`);

  // If there are more subscribers than the limit, schedule another run
  if (subscribers.length > NEWSLETTER_CONFIG.maxPerRun) {
    console.log(`Note: ${subscribers.length - limit} subscribers remaining. Run again to continue.`);
  }
}

// ============================================
// SUBSCRIBER MANAGEMENT
// ============================================

/**
 * Get all active subscribers from the Google Sheet
 */
function getActiveSubscribers() {
  const sheet = SpreadsheetApp.openById(NEWSLETTER_CONFIG.spreadsheetId)
    .getSheetByName(NEWSLETTER_CONFIG.sheetName);

  if (!sheet) {
    console.error('Subscriber sheet not found');
    return [];
  }

  const data = sheet.getDataRange().getValues();
  const subscribers = [];

  // Skip header row (row 0)
  for (let i = 1; i < data.length; i++) {
    const name = data[i][0];
    const email = data[i][1];
    const active = data[i][3] !== false && data[i][3] !== 'FALSE' && data[i][3] !== 'No';

    if (email && active) {
      subscribers.push({
        name: name || 'Friend',
        email: email.trim(),
        row: i + 1 // 1-indexed for sheet operations
      });
    }
  }

  return subscribers;
}

/**
 * Mark a subscriber as having received the newsletter
 */
function markAsSent(row, month) {
  const sheet = SpreadsheetApp.openById(NEWSLETTER_CONFIG.spreadsheetId)
    .getSheetByName(NEWSLETTER_CONFIG.sheetName);

  // Column E = "Last Sent"
  sheet.getRange(row, 5).setValue(month);
  sheet.getRange(row, 6).setValue(new Date());
}

/**
 * Import subscribers from Netlify Forms submissions
 * Run this to sync Netlify form submissions to your Google Sheet
 */
function importFromNetlify() {
  const token = PropertiesService.getScriptProperties().getProperty('NETLIFY_ACCESS_TOKEN');
  const siteId = PropertiesService.getScriptProperties().getProperty('NETLIFY_SITE_ID');

  if (!token || !siteId) {
    console.error('Missing Netlify credentials in Script Properties');
    return;
  }

  // Get forms
  const formsUrl = `https://api.netlify.com/api/v1/sites/${siteId}/forms`;
  const formsResponse = UrlFetchApp.fetch(formsUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const forms = JSON.parse(formsResponse.getContentText());

  // Find the newsletter form
  const newsletterForm = forms.find(f => f.name === 'newsletter-subscribers');
  if (!newsletterForm) {
    console.log('Newsletter form not found on Netlify');
    return;
  }

  // Get submissions
  const subsUrl = `https://api.netlify.com/api/v1/forms/${newsletterForm.id}/submissions`;
  const subsResponse = UrlFetchApp.fetch(subsUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const submissions = JSON.parse(subsResponse.getContentText());

  console.log(`Found ${submissions.length} Netlify form submissions`);

  // Get existing emails from sheet
  const sheet = SpreadsheetApp.openById(NEWSLETTER_CONFIG.spreadsheetId)
    .getSheetByName(NEWSLETTER_CONFIG.sheetName);
  const existingData = sheet.getDataRange().getValues();
  const existingEmails = new Set(existingData.slice(1).map(row => row[1].toString().toLowerCase()));

  // Add new subscribers
  let added = 0;
  for (const sub of submissions) {
    const email = (sub.data.email || '').toLowerCase().trim();
    const name = sub.data.name || '';

    if (email && !existingEmails.has(email)) {
      sheet.appendRow([name, email, new Date(sub.created_at), true]);
      existingEmails.add(email);
      added++;
    }
  }

  console.log(`Added ${added} new subscribers to sheet`);
}

// ============================================
// NEWSLETTER CONTENT
// ============================================

/**
 * Fetch newsletter content from the repository
 */
function fetchNewsletterContent() {
  try {
    const response = UrlFetchApp.fetch(NEWSLETTER_CONFIG.contentUrl, {
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      console.error('Failed to fetch content:', response.getResponseCode());
      return null;
    }

    return JSON.parse(response.getContentText());
  } catch (error) {
    console.error('Error fetching content:', error.message);
    return null;
  }
}

/**
 * Build the newsletter email HTML from content
 */
function buildNewsletterEmail(content) {
  // Pastoral message
  const pastoral = content.pastoralMessage || {};
  const pastoralHtml = `<h2 style="color:#ffffff;font-size:22px;margin:0 0 15px;">${pastoral.title || ''}</h2>
    <p style="color:#cccccc;font-size:15px;line-height:1.8;white-space:pre-line;">${pastoral.content || ''}</p>`;

  // News items
  const newsHtml = (content.kingdomIntelligence || []).map(item =>
    `<div style="background:#111;border-radius:8px;border-left:3px solid #d4af37;padding:18px;margin-bottom:15px;">
      <h3 style="color:#fff;font-size:16px;margin:0 0 8px;">${item.headline}</h3>
      <p style="color:#aaa;font-size:14px;line-height:1.7;margin:0;">${item.summary}</p>
    </div>`
  ).join('');

  // Kingdom Living
  const living = content.kingdomLiving || {};
  const livingHtml = `<h3 style="color:#fff;font-size:18px;margin:0 0 12px;">${living.title || ''}</h3>
    <p style="color:#ccc;font-size:15px;line-height:1.8;white-space:pre-line;">${living.content || ''}</p>`;

  // Prayer points
  const prayerHtml = (content.prayerFocus || []).map(p =>
    `<p style="color:#ccc;font-size:14px;line-height:1.7;margin:0 0 10px;padding-left:12px;border-left:2px solid #d4af37;">${p}</p>`
  ).join('');

  // Scripture
  const scripture = content.scripture || {};

  // Events
  const eventsHtml = (content.events || []).map(e =>
    `<div style="background:#111;border-radius:8px;padding:15px;margin-bottom:12px;">
      <p style="color:#d4af37;font-size:15px;font-weight:bold;margin:0 0 4px;">${e.name}</p>
      <p style="color:#fff;font-size:13px;margin:0;">${e.date}</p>
    </div>`
  ).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#0d0d0d;font-family:Georgia,serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;padding:30px 15px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1a1a;border-radius:10px;border:1px solid #333;">
  <tr><td style="background:linear-gradient(135deg,#1a1a1a,#2d1b4e,#1a1a1a);padding:40px;text-align:center;border-bottom:2px solid #d4af37;">
    <img src="https://increasingfaith.net/ifm-logo-gold.png" width="80" height="80" alt="IFM" style="border-radius:50%;border:2px solid #d4af37;">
    <h1 style="color:#d4af37;font-size:28px;letter-spacing:3px;text-transform:uppercase;margin:20px 0 5px;">The Kingdom Report</h1>
    <p style="color:#999;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0;">Increasing Faith Ministries</p>
    <p style="color:#d4af37;font-size:15px;margin:12px 0 0;">${content.month}</p>
  </td></tr>
  <tr><td style="padding:35px;">
    <p style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;text-align:center;margin:0 0 20px;">From the Desk of Pastor Curtis</p>
    ${pastoralHtml}
  </td></tr>
  <tr><td style="padding:0 35px;"><hr style="border:none;border-top:1px solid #d4af37;"></td></tr>
  <tr><td style="padding:25px 35px;">
    <p style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;text-align:center;margin:0 0 20px;">Kingdom Intelligence</p>
    ${newsHtml}
  </td></tr>
  <tr><td style="padding:0 35px;"><hr style="border:none;border-top:1px solid #d4af37;"></td></tr>
  <tr><td style="padding:25px 35px;">
    <p style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;text-align:center;margin:0 0 20px;">Kingdom Living</p>
    ${livingHtml}
  </td></tr>
  <tr><td style="padding:0 35px;"><hr style="border:none;border-top:1px solid #d4af37;"></td></tr>
  <tr><td style="padding:25px 35px;">
    <p style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;text-align:center;margin:0 0 20px;">Prayer Focus</p>
    ${prayerHtml}
  </td></tr>
  <tr><td style="padding:0 35px;"><hr style="border:none;border-top:1px solid #d4af37;"></td></tr>
  <tr><td style="padding:25px 35px;text-align:center;">
    <p style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;margin:0 0 20px;">Scripture of the Month</p>
    <div style="background:#111;border-radius:10px;border:1px solid #333;padding:25px;">
      <p style="color:#fff;font-size:18px;font-style:italic;line-height:1.7;margin:0 0 10px;">${scripture.verse || ''}</p>
      <p style="color:#d4af37;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0;">${scripture.reference || ''}</p>
    </div>
  </td></tr>
  <tr><td style="padding:0 35px;"><hr style="border:none;border-top:1px solid #d4af37;"></td></tr>
  <tr><td style="padding:25px 35px;">
    <p style="color:#d4af37;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase;text-align:center;margin:0 0 20px;">Upcoming at IFM</p>
    ${eventsHtml}
  </td></tr>
  <tr><td style="padding:20px 35px 35px;text-align:center;">
    <a href="https://increasingfaith.net/newsletter.html" style="display:inline-block;background:#d4af37;color:#0d0d0d;padding:14px 35px;border-radius:50px;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;text-decoration:none;">Read Full Newsletter</a>
  </td></tr>
  <tr><td style="background:#111;padding:30px;text-align:center;border-top:2px solid #d4af37;">
    <p style="color:#d4af37;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 10px;">Advancing the Reign of God</p>
    <p style="color:#666;font-size:12px;margin:0;">Increasing Faith Ministries | 24301 Telegraph, Southfield, MI 48033</p>
    <p style="color:#666;font-size:12px;margin:5px 0;"><a href="https://increasingfaith.net" style="color:#d4af37;text-decoration:none;">increasingfaith.net</a></p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

// ============================================
// UTILITY: Send test email
// ============================================

function sendTestNewsletter() {
  const content = fetchNewsletterContent();
  if (!content) {
    console.error('No content found');
    return;
  }

  const html = buildNewsletterEmail(content);
  const testEmail = Session.getActiveUser().getEmail();

  GmailApp.sendEmail(testEmail, `[TEST] The Kingdom Report — ${content.month}`, '', {
    htmlBody: html,
    name: NEWSLETTER_CONFIG.fromName
  });

  console.log(`Test email sent to ${testEmail}`);
}
