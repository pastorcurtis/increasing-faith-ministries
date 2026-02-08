/**
 * publish.js - Newsletter Publisher
 *
 * Saves generated newsletter content as JSON and HTML files.
 * Manages the archive index and latest newsletter reference.
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { format } = require('date-fns');
const config = require('./config');

/**
 * Resolves output paths relative to this agent directory.
 */
function resolvePath(relativePath) {
  return path.resolve(__dirname, relativePath);
}

/**
 * Ensures the newsletters content directory exists.
 */
function ensureDirectories() {
  const dir = resolvePath(config.paths.contentDir);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('  Created directory: ' + dir);
  }
}

/**
 * Builds a premium HTML email template from the newsletter JSON.
 * Uses IFM brand colors: Black (#0d0d0d), Gold (#d4af37), White (#ffffff).
 */
function buildHTML(newsletter) {
  const meta = newsletter.metadata;
  const s = newsletter.sections;

  // Convert markdown content to HTML for each section
  const pastoralHTML = marked(s.pastoralMessage.content || '');
  const intelligenceHTML = marked(s.kingdomIntelligence.content || '');
  const livingHTML = marked(s.kingdomLiving.content || '');
  const prayerHTML = marked(s.prayerFocus.content || '');
  const scriptureHTML = marked(s.scriptureFocus.content || '');
  const upcomingHTML = marked(s.upcoming.content || '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${meta.title} - ${meta.dateString}</title>
  <style>
    /* IFM Brand: Black + Gold + White */
    body {
      margin: 0; padding: 0;
      background-color: #0d0d0d;
      color: #ffffff;
      font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
      line-height: 1.7;
    }
    .container {
      max-width: 680px;
      margin: 0 auto;
      background-color: #141414;
    }
    .header {
      background: linear-gradient(135deg, #0d0d0d 0%, #1a1a1a 100%);
      padding: 48px 40px;
      text-align: center;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
    }
    .header h1 {
      font-family: 'Cinzel', 'Times New Roman', serif;
      font-size: 28px;
      font-weight: 700;
      background: linear-gradient(135deg, #d4af37 0%, #f5d76e 50%, #d4af37 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin: 0 0 8px 0;
      letter-spacing: 3px;
      text-transform: uppercase;
    }
    .header .subtitle {
      font-size: 13px;
      color: rgba(255,255,255,0.5);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin: 0 0 4px 0;
    }
    .header .date {
      font-size: 14px;
      color: #d4af37;
      margin-top: 16px;
      letter-spacing: 1px;
    }
    .section {
      padding: 40px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.08);
    }
    .section-title {
      font-family: 'Cinzel', 'Times New Roman', serif;
      font-size: 20px;
      color: #d4af37;
      margin: 0 0 24px 0;
      letter-spacing: 2px;
      text-transform: uppercase;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
    }
    .section p { margin: 0 0 16px 0; font-size: 15px; color: rgba(255,255,255,0.85); }
    .section h3 { color: #d4af37; font-size: 17px; margin: 24px 0 12px 0; }
    .section strong { color: #d4af37; }
    .section em { color: rgba(255,255,255,0.7); }
    .section ul, .section ol { padding-left: 20px; color: rgba(255,255,255,0.85); }
    .section li { margin-bottom: 8px; font-size: 15px; }
    .section blockquote {
      border-left: 3px solid #d4af37;
      margin: 20px 0;
      padding: 12px 20px;
      background: rgba(212, 175, 55, 0.05);
      font-style: italic;
      color: rgba(255,255,255,0.7);
    }
    .footer {
      padding: 40px;
      text-align: center;
      background: #0d0d0d;
      border-top: 1px solid rgba(212, 175, 55, 0.15);
    }
    .footer .ministry-name {
      font-family: 'Cinzel', 'Times New Roman', serif;
      font-size: 16px;
      color: #d4af37;
      letter-spacing: 2px;
      margin: 0 0 8px 0;
    }
    .footer p {
      font-size: 12px;
      color: rgba(255,255,255,0.4);
      margin: 4px 0;
      line-height: 1.6;
    }
    .footer a { color: #d4af37; text-decoration: none; }
    .footer a:hover { text-decoration: underline; }
    .gold-rule {
      width: 60px;
      height: 1px;
      background: linear-gradient(90deg, transparent, #d4af37, transparent);
      margin: 0 auto 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${meta.title}</h1>
      <p class="subtitle">${meta.subtitle}</p>
      <p class="date">${meta.dateString}</p>
    </div>

    <div class="section">
      <h2 class="section-title">${s.pastoralMessage.title}</h2>
      ${pastoralHTML}
    </div>

    <div class="section">
      <h2 class="section-title">${s.kingdomIntelligence.title}</h2>
      ${intelligenceHTML}
    </div>

    <div class="section">
      <h2 class="section-title">${s.kingdomLiving.title}</h2>
      ${livingHTML}
    </div>

    <div class="section">
      <h2 class="section-title">${s.prayerFocus.title}</h2>
      ${prayerHTML}
    </div>

    <div class="section">
      <h2 class="section-title">${s.scriptureFocus.title}</h2>
      ${scriptureHTML}
    </div>

    <div class="section">
      <h2 class="section-title">${s.upcoming.title}</h2>
      ${upcomingHTML}
    </div>

    <div class="footer">
      <div class="gold-rule"></div>
      <p class="ministry-name">${config.ministry.name}</p>
      <p>${config.ministry.tagline}</p>
      <p>${config.ministry.location}</p>
      <p>
        <a href="${config.ministry.website}">${config.ministry.website}</a> |
        <a href="mailto:${config.ministry.email}">${config.ministry.email}</a>
      </p>
      <p style="margin-top: 16px;">
        <a href="${config.ministry.social.facebook}">Facebook</a> |
        <a href="${config.ministry.social.instagram}">Instagram</a> |
        <a href="${config.ministry.social.youtube}">YouTube</a> |
        <a href="${config.ministry.social.tiktok}">TikTok</a>
      </p>
      <p style="margin-top: 16px;">
        <a href="${config.ministry.social.givelify}">Give to IFM</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Publishes the newsletter: saves JSON, HTML, and updates archive index.
 * @param {object} newsletter - The generated newsletter object
 * @returns {object} Summary of what was published
 */
async function publishNewsletter(newsletter) {
  const { month, year } = newsletter.metadata;
  const dateKey = format(new Date(year, month - 1, 1), 'yyyy-MM');

  console.log('\n--- Publishing Newsletter: ' + dateKey + ' ---');
  ensureDirectories();

  const contentDir = resolvePath(config.paths.contentDir);

  // 1. Save dated JSON (archive copy)
  const jsonPath = path.join(contentDir, dateKey + '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(newsletter, null, 2), 'utf8');
  console.log('  Saved JSON: ' + jsonPath);

  // 2. Save as latest.json
  const latestPath = resolvePath(config.paths.latestJson);
  fs.writeFileSync(latestPath, JSON.stringify(newsletter, null, 2), 'utf8');
  console.log('  Saved latest: ' + latestPath);

  // 3. Generate and save HTML email version
  const htmlContent = buildHTML(newsletter);
  const htmlPath = path.join(contentDir, dateKey + '.html');
  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('  Saved HTML: ' + htmlPath);

  // 4. Update archive index
  const archivePath = resolvePath(config.paths.archiveIndex);
  let archive = [];
  if (fs.existsSync(archivePath)) {
    try {
      archive = JSON.parse(fs.readFileSync(archivePath, 'utf8'));
    } catch (e) {
      console.log('  [WARN] Could not parse existing archive.json, starting fresh');
      archive = [];
    }
  }

  // Remove existing entry for this month (if re-generating)
  archive = archive.filter((entry) => entry.dateKey !== dateKey);

  // Add new entry at the beginning (newest first)
  archive.unshift({
    dateKey,
    title: newsletter.metadata.title,
    dateString: newsletter.metadata.dateString,
    theme: newsletter.metadata.theme ? newsletter.metadata.theme.theme : null,
    generatedAt: newsletter.metadata.generatedAt,
    jsonFile: dateKey + '.json',
    htmlFile: dateKey + '.html',
  });

  fs.writeFileSync(archivePath, JSON.stringify(archive, null, 2), 'utf8');
  console.log('  Updated archive: ' + archivePath + ' (' + archive.length + ' entries)');

  console.log('Publishing complete.');
  return {
    jsonPath,
    htmlPath,
    latestPath,
    archivePath,
    dateKey,
    archiveEntries: archive.length,
  };
}

module.exports = { publishNewsletter, buildHTML };