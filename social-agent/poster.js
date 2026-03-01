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
const fs = require('fs');
const path = require('path');

// -- Platform Posting Functions ---

async function postToFacebook(content) {
  if (!process.env.FACEBOOK_PAGE_TOKEN || !process.env.FACEBOOK_PAGE_ID) {
    return { success: false, error: 'Missing FACEBOOK_PAGE_TOKEN or FACEBOOK_PAGE_ID' };
  }

  const url = `https://graph.facebook.com/v19.0/${process.env.FACEBOOK_PAGE_ID}/feed`;

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

    if (data.error) {
      return { success: false, error: data.error.message };
    }
    return { success: true, postId: data.id };
  } catch (err) {
    clearTimeout(timeout);
    return { success: false, error: err.message };
  }
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
    console.log(`  Facebook: ${fbContent.length} chars`);
    if (testMode) {
      console.log('  -> [TEST] Would post to Facebook');
      results.facebook = { success: true, test: true };
    } else {
      const result = await postToFacebook(fbContent);
      results.facebook = result;
      console.log(`  -> ${result.success ? 'Posted' : 'FAILED: ' + result.error}`);
    }
  }

  // Instagram & TikTok -- log for manual posting
  // (These platforms require Business API or Creator tools for automated posting)
  for (const platform of ['instagram', 'tiktok']) {
    if (content.posts[platform] && !content.posts[platform].error) {
      console.log(`\n  ${platform.toUpperCase()} (copy-ready):`);
      console.log('  ' + '-'.repeat(40));
      console.log(`  ${content.posts[platform].fullPost}`);
      results[platform] = { success: true, method: 'manual_copy' };
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

module.exports = { postToFacebook };
