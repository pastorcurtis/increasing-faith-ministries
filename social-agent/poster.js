/**
 * IFM Social Media Agent — Auto-Poster
 * Reads generated content and posts to Facebook
 *
 * Usage:
 *   node poster.js             — Post today's generated content
 *   node poster.js --test      — Dry run (log what would be posted)
 *   node poster.js --file path — Post from a specific JSON file
 *
 * Required environment variables:
 *   FACEBOOK_PAGE_TOKEN  — Facebook Page Access Token (long-lived)
 *   FACEBOOK_PAGE_ID     — Facebook Page ID
 */

require('dotenv').config();
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { verifyScripture } = require('./scripture');

// -- Feed Sanitization ---
//
// The model writes in markdown (**bold**) because that is how it was trained
// to emphasize. The Graph API takes plain text and renders none of it, so the
// asterisks publish literally. Every generator that reaches the Page goes
// through postToFacebook() -- the social agent and ad.js both -- so cleaning
// here means a future model swap inherits the protection for free.
//
// Distinct from sanitizeForGraphic() in index.js: that one flattens text to a
// single line for image rendering. Feed posts must keep their line breaks.

// Placeholder debris means the generator produced a template, not a post.
// Publishing a fill-in-the-blank to the Page is worse than missing a day, so
// these abort the post and let the workflow's failure alert reach a human.
const PLACEHOLDER_PATTERNS = [
  { re: /_{3,}/, label: 'fill-in-the-blank underscores' },
  { re: /\{\{[^}]*\}\}/, label: 'unrendered {{template}} token' },
  { re: /\[(?:INSERT|TODO|PLACEHOLDER|X{3,})\b[^\]]*\]/i, label: 'bracketed placeholder' },
  { re: /\blorem ipsum\b/i, label: 'lorem ipsum filler' },
];

function findPlaceholders(text) {
  return PLACEHOLDER_PATTERNS.filter(p => p.re.test(text)).map(p => p.label);
}

function sanitizeForFeed(text) {
  return text
    // Invisible characters the model emits: zero-width space/non-joiner/joiner,
    // word joiner, BOM. They survive copy/paste and quietly break hashtag
    // matching and search.
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, '')
    // Typographic spaces (no-break, narrow no-break, thin) -> plain space
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    // Non-breaking hyphen -> plain hyphen
    .replace(/\u2011/g, '-')
    // Markdown emphasis: keep the words, drop the markers
    .replace(/\*\*\*([\s\S]+?)\*\*\*/g, '$1')
    .replace(/\*\*([\s\S]+?)\*\*/g, '$1')
    .replace(/(^|[\s(])\*(\S(?:[\s\S]*?\S)?)\*(?=[\s).,!?;:]|$)/g, '$1$2')
    .replace(/(^|[\s(])_(\S(?:[\s\S]*?\S)?)_(?=[\s).,!?;:]|$)/g, '$1$2')
    // Markdown headings and blockquote markers at line starts. Hashtags are
    // safe: "#IFM" has no space after the #, so it never matches.
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '')
    .replace(/^[ \t]*>[ \t]?/gm, '')
    // Trailing spaces left by markdown's two-space line-break convention
    .replace(/[ \t]+$/gm, '')
    // At most one blank line between paragraphs
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// -- Platform Posting Functions ---

async function postToFacebookText(content) {
  const url = `https://graph.facebook.com/v21.0/${process.env.FACEBOOK_PAGE_ID}/feed`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: content,
        access_token: process.env.FACEBOOK_PAGE_TOKEN,
      }),
    });

    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, postId: data.id, mode: 'text' };
  } catch (err) {
    clearTimeout(timeout);
    return { success: false, error: err.message };
  }
}

async function postToFacebookPhoto(imagePath, caption) {
  const url = `https://graph.facebook.com/v21.0/${process.env.FACEBOOK_PAGE_ID}/photos`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const form = new FormData();
    form.append('source', fs.createReadStream(imagePath));
    form.append('caption', caption);
    form.append('access_token', process.env.FACEBOOK_PAGE_TOKEN);

    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      body: form,
      headers: form.getHeaders(),
    });

    clearTimeout(timeout);
    const data = await response.json();
    if (data.error) return { success: false, error: data.error.message };
    return { success: true, postId: data.post_id || data.id, mode: 'photo' };
  } catch (err) {
    clearTimeout(timeout);
    return { success: false, error: err.message };
  }
}

// Everything that must be true of copy before it reaches the Page. Returns the
// cleaned text on success. Shared by the live path and --test, so a dry run
// exercises exactly the same gates the real post does.
async function validateCopy(content) {
  const notes = [];

  // Placeholder debris means the generator handed us a template. Fail loudly
  // instead of publishing it -- a missed day is recoverable, a
  // fill-in-the-blank on the Page is not.
  const placeholders = findPlaceholders(content);
  if (placeholders.length > 0) {
    return { ok: false, notes, error: `copy still contains ${placeholders.join(', ')}` };
  }

  const clean = sanitizeForFeed(content);
  if (!clean) return { ok: false, notes, error: 'copy is empty after sanitizing' };
  if (clean !== content) notes.push(`sanitized: ${content.length} -> ${clean.length} chars`);

  // Verify any scripture citation against the real verse. Only a confirmed
  // mismatch blocks -- an unverifiable reference is reported and allowed,
  // because a dead lookup service must never take the Page offline.
  const scripture = await verifyScripture(clean);
  for (const u of scripture.unverifiable) {
    notes.push(`could not verify ${u.ref} (${u.reason})`);
  }
  for (const r of scripture.results) {
    if (r.verdict === 'ok') notes.push(`scripture OK: ${r.ref} (overlap ${r.score})`);
  }
  if (scripture.mismatches.length > 0) {
    const detail = scripture.mismatches
      .map(m => `${m.ref} (overlap ${m.score}) -- quoted "${m.quote}" but ${m.canonical} reads "${m.verse}"`)
      .join('; ');
    return { ok: false, notes, error: `misattributed scripture: ${detail}` };
  }

  return { ok: true, clean, notes };
}

async function postToFacebook(content, imagePath) {
  if (!process.env.FACEBOOK_PAGE_TOKEN || !process.env.FACEBOOK_PAGE_ID) {
    return { success: false, error: 'Missing FACEBOOK_PAGE_TOKEN or FACEBOOK_PAGE_ID' };
  }

  const check = await validateCopy(content);
  check.notes.forEach(n => console.log(`  ${n}`));
  if (!check.ok) return { success: false, error: `Refusing to post -- ${check.error}` };

  if (imagePath && fs.existsSync(imagePath)) {
    return postToFacebookPhoto(imagePath, check.clean);
  }
  return postToFacebookText(check.clean);
}

// -- Main Pipeline ---

async function main() {
  const args = process.argv.slice(2);
  const testMode = args.includes('--test');
  const fileIndex = args.indexOf('--file');

  // Find today's content file
  const today = new Date().toISOString().split('T')[0];
  const defaultFile = path.join(__dirname, '..', 'content', 'social-posts', `${today}.json`);
  const contentFile = fileIndex !== -1 ? args[fileIndex + 1] : defaultFile;

  if (!fs.existsSync(contentFile)) {
    console.error(`ERROR: Content file not found: ${contentFile}`);
    console.error('Run "node index.js" first to generate content.');
    process.exit(1);
  }

  const content = JSON.parse(fs.readFileSync(contentFile, 'utf-8'));
  console.log(`\nPosting content for ${content.date} -- ${content.theme}`);

  if (testMode) {
    console.log('\nTEST MODE -- No actual posts will be made\n');
  }

  const results = {};

  // Post to Facebook
  if (content.posts.facebook && !content.posts.facebook.error) {
    const fbContent = content.posts.facebook.fullPost;
    const graphicPath = content.posts.facebook.graphicPath;
    const hasGraphic = graphicPath && fs.existsSync(graphicPath);
    const mode = hasGraphic ? 'PHOTO' : 'TEXT';
    console.log(`  Facebook (${mode}): ${fbContent.length} chars${hasGraphic ? ` + ${path.basename(graphicPath)}` : ''}`);
    if (testMode) {
      // A dry run that skipped validation would report a post as fine and then
      // fail for real hours later, which is the whole failure pattern here.
      const check = await validateCopy(fbContent);
      check.notes.forEach(n => console.log(`  ${n}`));
      if (check.ok) {
        console.log(`  -> [TEST] Would post to Facebook as ${mode}`);
        results.facebook = { success: true, test: true, mode };
      } else {
        console.error(`  -> [TEST] WOULD BLOCK: ${check.error}`);
        results.facebook = { success: false, test: true, error: check.error };
      }
    } else {
      const result = await postToFacebook(fbContent, hasGraphic ? graphicPath : null);
      results.facebook = result;
      console.log(`  -> ${result.success ? `Posted (${result.mode})` : 'FAILED: ' + result.error}`);
    }
  }

  // Instagram & TikTok -- log for manual posting
  // (These platforms require Business API or Creator tools for automated posting)
  for (const platform of ['instagram', 'tiktok']) {
    if (content.posts[platform] && !content.posts[platform].error) {
      const manualText = sanitizeForFeed(content.posts[platform].fullPost);
      const manualPlaceholders = findPlaceholders(content.posts[platform].fullPost);
      console.log(`\n  ${platform.toUpperCase()} (copy-ready):`);
      console.log('  ' + '-'.repeat(40));
      console.log(`  ${manualText}`);
      if (manualPlaceholders.length > 0) {
        console.warn(`  WARNING: contains ${manualPlaceholders.join(', ')} -- edit before posting`);
      }
      // Pasted by hand, so a wrong verse here is just as public as on the Page.
      // Warn rather than block: there is nothing to stop, only someone to tell.
      const manualScripture = await verifyScripture(manualText);
      for (const m of manualScripture.mismatches) {
        console.warn(`  WARNING: ${m.ref} looks misattributed (overlap ${m.score}) -- ${m.canonical} reads "${m.verse}"`);
      }
      // `success` here only means the text was generated and printed. These
      // platforms need Business/Creator API access, so nothing is published;
      // `posted: false` keeps the archive honest about that.
      results[platform] = { success: true, posted: false, method: 'manual_copy' };
    }
  }

  // Save posting results
  const archiveDir = path.join(__dirname, '..', 'content', 'social-archive');
  fs.mkdirSync(archiveDir, { recursive: true });

  const archiveFile = path.join(archiveDir, `${content.date}.json`);
  const archive = {
    ...content,
    postingResults: results,
    postedAt: new Date().toISOString(),
    testMode,
  };
  fs.writeFileSync(archiveFile, JSON.stringify(archive, null, 2));
  console.log(`\nArchive saved to ${archiveFile}`);

  // Check for failures
  const failures = Object.entries(results)
    .filter(([_, r]) => !r.success)
    .map(([p]) => p);

  if (failures.length > 0) {
    console.error(`\nFailed platforms: ${failures.join(', ')}`);
    process.exit(1);
  }

  console.log('\nAll posts completed successfully');
}

if (require.main === module) {
  main().catch(err => {
    console.error(`\nFATAL: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { postToFacebook, validateCopy, sanitizeForFeed, findPlaceholders };
