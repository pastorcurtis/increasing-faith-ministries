/**
 * IFM Social Media Agent — Auto-Poster
 * Reads generated content and posts to Facebook and X (Twitter)
 *
 * Usage:
 *   node poster.js             — Post today's generated content
 *   node poster.js --test      — Dry run (log what would be posted)
 *   node poster.js --file path — Post from a specific JSON file
 *
 * Required environment variables:
 *   FACEBOOK_PAGE_TOKEN  — Facebook Page Access Token (long-lived)
 *   FACEBOOK_PAGE_ID     — Facebook Page ID
 *   X_API_KEY            — X (Twitter) API Key
 *   X_API_SECRET         — X (Twitter) API Key Secret
 *   X_ACCESS_TOKEN       — X (Twitter) Access Token
 *   X_ACCESS_SECRET      — X (Twitter) Access Token Secret
 */

require('dotenv').config();
const fetch = require('node-fetch');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// -- OAuth 1.0a for X API ---

function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
  const sortedParams = Object.keys(params).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join('&');

  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

function buildOAuthHeader(method, url) {
  const oauthParams = {
    oauth_consumer_key: process.env.X_API_KEY,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: process.env.X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };

  const signature = generateOAuthSignature(
    method, url, oauthParams,
    process.env.X_API_SECRET, process.env.X_ACCESS_SECRET
  );
  oauthParams.oauth_signature = signature;

  const header = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${header}`;
}

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

async function postToX(content) {
  if (!process.env.X_API_KEY || !process.env.X_ACCESS_TOKEN) {
    return { success: false, error: 'Missing X API credentials' };
  }

  const url = 'https://api.twitter.com/2/tweets';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': buildOAuthHeader('POST', url),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content }),
    });

    clearTimeout(timeout);
    const data = await response.json();

    if (data.errors) {
      return { success: false, error: data.errors[0]?.detail || JSON.stringify(data.errors) };
    }
    return { success: true, tweetId: data.data?.id };
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

  // Post to X (Twitter)
  if (content.posts.x && !content.posts.x.error) {
    const xContent = content.posts.x.fullPost;
    console.log(`  X: ${xContent.length} chars`);
    if (testMode) {
      console.log('  -> [TEST] Would post to X');
      results.x = { success: true, test: true };
    } else {
      const result = await postToX(xContent);
      results.x = result;
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

module.exports = { postToFacebook, postToX };
