/**
 * IFM Website Ad Agent — Daily Website Ad
 *
 * Generates and posts one Facebook ad per day whose only job is driving
 * traffic to increasingfaith.net. Separate from index.js/poster.js (the daily
 * teaching post) by design: that post is content-first, this one is
 * invitation-first.
 *
 * Usage:
 *   node ad.js                 — Generate, render, post
 *   node ad.js --preview       — Generate + render only, nothing saved or posted
 *   node ad.js --test          — Generate + render + archive, but do not post
 *   node ad.js --day 2         — Force a weekday (0=Sun … 6=Sat)
 *   node ad.js --fallback      — Skip the AI entirely, use static copy
 *
 * Required environment variables:
 *   GROQ_API_KEY          — primary copy generator
 *   OPENROUTER_API_KEY    — optional fallback provider
 *   FACEBOOK_PAGE_TOKEN   — Page Access Token (long-lived)
 *   FACEBOOK_PAGE_ID      — Page ID
 *
 * Note on post format: Facebook will not render a custom image AND a link
 * preview card in the same post, and every page on the site currently shares a
 * single 250x250 og:image (too small for a large link card). So this posts as
 * a photo with the destination URL on the second line of the caption, where
 * Facebook auto-linkifies it and it stays above the "See more" fold.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const adConfig = require('./ad-config');
const { renderAdGraphic } = require('./ad-graphic');
const { callChatAPI, sanitizeForGraphic } = require('./index');
const { postToFacebook } = require('./poster');

// ── Helpers ────────────────────────────────────────────

function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

function pickHashtags(ad) {
  const pool = [...new Set([
    ...adConfig.hashtags.core,
    ...(adConfig.hashtags[ad.hashtagSet] || []),
  ])];
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return shuffled.slice(0, adConfig.copy.hashtagCount);
}

// Trim to a length without cutting mid-word.
function clamp(text, maxChars) {
  const clean = (text || '').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[,;:\-—]$/, '') + '.';
}

// Small models routinely wrap JSON in prose or markdown fences. Pull out the
// outermost object rather than trusting the response to be clean.
function extractJSON(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in model response');
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

// ── Copy Generation ────────────────────────────────────

// The prompt asks the model to avoid consumer-marketing register; this is the
// enforcement. A hit here throws, which generateWithRetry turns into another
// attempt, and a total failure falls through to the day's static copy. Rules in
// a prompt are a request — this is the guarantee.
const BANNED_TERMS = [
  'unleash', 'kickstart', 'kick-start', 'supercharge', 'ignite', 'elevate',
  'empower', 'transform', 'life-changing', 'life changing', 'game-chang',
  'instant access', 'dive in', 'level up', 'next level', 'unlock',
  'fuel your', 'start strong', "don't miss", 'do not miss', 'act now',
  'tap into', 'incredible', 'amazing', 'powerful',
];

function findBannedTerms(copy) {
  const haystack = [copy.headline, copy.subhead, copy.hook, copy.body]
    .join(' ')
    .toLowerCase();
  return BANNED_TERMS.filter(term => haystack.includes(term));
}

// Title Case reads as advertising; sentence case reads as speech. Flag a
// headline where most words are capitalized.
function looksTitleCased(headline) {
  const words = headline.split(/\s+/).filter(w => /^[A-Za-z]/.test(w));
  if (words.length < 4) return false;
  const capped = words.filter(w => /^[A-Z]/.test(w)).length;
  return capped / words.length > 0.7;
}

async function generateAdCopy(ad) {
  const { headlineMaxChars, subheadMaxChars, bodyMaxChars } = adConfig.copy;

  const systemPrompt = [
    `You write advertising copy for ${adConfig.ministry.name}, led by ${adConfig.ministry.pastor}.`,
    adConfig.brandVoice,
    '',
    'This is an ADVERTISEMENT, not a teaching post. Its single job is to make one specific person',
    'click through to the website today. Do not teach a full lesson. Do not open with a greeting.',
    'Do not mention the day of the week. Do not write hashtags, links, emoji, or labels.',
    '',
    'REGISTER — this is the part models get wrong. You are NOT writing consumer marketing.',
    'You are writing the way a pastor speaks from the pulpit: plain, declarative, unhurried, and',
    'willing to name something uncomfortable. Short words. Concrete nouns. No sales energy.',
    '',
    'BANNED — do not use these words or any close variant:',
    '  unleash, kickstart, supercharge, ignite, elevate, empower, empowering, transform,',
    '  life-changing, game-changing, instant access, dive in, level up, unlock, discover,',
    '  journey, fuel your, start strong, don\'t miss, act now, tap into, take it to the next level.',
    'BANNED — do not use hype punctuation or ALL CAPS for emphasis. No exclamation marks.',
    'BANNED — do not describe the ministry\'s own material with praise words ("powerful",',
    '  "incredible", "amazing", "life-giving"). Let the reader judge it. State what it IS.',
    '',
    'Write the headline in sentence case, not Title Case. It should be a complete sentence',
    'or a pair of short sentences — something a person would actually say out loud.',
    '',
    'WEAK (never write like this):',
    '  headline: "Fuel Your Week with Kingdom Authority"',
    '  subhead:  "Unleash faith and momentum in just minutes a day"',
    'Why it fails: title case, two banned words, promises a feeling instead of naming a real thing.',
    '',
    'STRONG (match this register):',
    '  headline: "You went into this week empty. That was avoidable."',
    '  subhead:  "The teaching library is free, and it is already waiting on you."',
    '  hook:     "Monday exposes what you did not build on Sunday."',
    'Why it works: names a real condition, no hype, and the offer is a fact rather than a promise.',
    '',
    'Return ONLY a JSON object with exactly these four string keys:',
    '  "headline" — the bold line on the ad image. A complete, arresting statement.',
    `              Maximum ${headlineMaxChars} characters. No quotation marks.`,
    '  "subhead"  — one supporting line under the headline on the image.',
    `              Maximum ${subheadMaxChars} characters.`,
    '  "hook"     — the first line of the Facebook caption. One sentence that stops the scroll.',
    '  "body"     — the caption body beneath the link. 2-4 short sentences.',
    `              Maximum ${bodyMaxChars} characters.`,
    '',
    'No text outside the JSON object.',
  ].join('\n');

  const userPrompt = [
    `Destination page: ${ad.page}`,
    `Page purpose: ${ad.label}`,
    `Button text already on the image: ${ad.button}`,
    '',
    `The angle for this ad:\n${ad.angle}`,
    '',
    'Write the JSON now.',
  ].join('\n');

  const raw = await callChatAPI({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    maxTokens: 700,
    // Lower than the teaching post's 0.85 — ad copy needs register discipline
    // more than it needs novelty, and high temperature is what let the
    // marketing-speak in.
    temperature: 0.7,
    timeoutMs: 30000,
  });

  const parsed = extractJSON(raw);
  for (const key of ['headline', 'subhead', 'hook', 'body']) {
    if (typeof parsed[key] !== 'string' || !parsed[key].trim()) {
      throw new Error(`Model response missing "${key}"`);
    }
  }

  const banned = findBannedTerms(parsed);
  if (banned.length) {
    throw new Error(`Marketing register rejected — banned terms: ${banned.join(', ')}`);
  }
  if (looksTitleCased(parsed.headline)) {
    throw new Error(`Headline is Title Cased: "${parsed.headline}"`);
  }

  return {
    // Graphic fonts have no emoji coverage, so image text gets sanitized.
    headline: clamp(sanitizeForGraphic(parsed.headline), headlineMaxChars),
    subhead: clamp(sanitizeForGraphic(parsed.subhead), subheadMaxChars),
    hook: parsed.hook.trim(),
    body: clamp(parsed.body, bodyMaxChars),
  };
}

async function generateWithRetry(ad, attempts) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await generateAdCopy(ad);
    } catch (err) {
      lastError = err;
      console.error(`  Attempt ${attempt}/${attempts} failed: ${err.message}`);
      if (attempt < attempts) {
        await new Promise(r => setTimeout(r, adConfig.ai.retryDelayMs));
      }
    }
  }
  throw lastError;
}

// ── Caption Assembly ───────────────────────────────────
// Order is deliberate: the link sits on line 2 so it stays above Facebook's
// "See more" truncation. A link buried under the body is a link nobody taps.

function buildCaption({ copy, ad, hashtags }) {
  return [
    copy.hook,
    '',
    `→ ${ad.page}`,
    '',
    copy.body,
    '',
    hashtags.join(' '),
  ].join('\n');
}

// ── Main Pipeline ──────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const preview = args.includes('--preview');
  const testMode = args.includes('--test');
  const forceFallback = args.includes('--fallback');
  const dayIndex = args.indexOf('--day');

  const day = dayIndex !== -1 ? parseInt(args[dayIndex + 1], 10) : new Date().getDay();
  const ad = adConfig.dailyAds[day];
  if (!ad) {
    console.error(`ERROR: No ad configured for day ${day}`);
    process.exit(1);
  }

  const date = todayDateString();
  console.log(`\nIFM Website Ad — ${date}`);
  console.log(`  Day ${day}: ${ad.label}`);
  console.log(`  Destination: ${ad.page}\n`);

  // -- Copy: AI first, static fallback if every provider fails --
  let copy;
  let usedFallback = false;

  if (forceFallback) {
    copy = { ...ad.fallback };
    usedFallback = true;
    console.log('  Using static fallback copy (--fallback)');
  } else {
    try {
      process.stdout.write('  Generating ad copy...');
      copy = await generateWithRetry(ad, adConfig.copy.maxAttempts);
      console.log(' ok');
    } catch (err) {
      // A failed generator must not mean a silent no-post day. Static copy is
      // always shippable, so the ad still goes out and the log says why.
      console.error(`\n  All copy generation failed: ${err.message}`);
      console.error('  Falling back to static copy for this day.\n');
      copy = { ...ad.fallback };
      usedFallback = true;
    }
  }

  // -- Graphic --
  const outDir = path.join(__dirname, 'output');
  fs.mkdirSync(outDir, { recursive: true });
  const graphicPath = path.join(outDir, `ad-${date}.png`);

  process.stdout.write('  Rendering ad graphic...');
  await renderAdGraphic({
    headline: copy.headline,
    subhead: copy.subhead,
    button: ad.button,
    day,
    outputPath: graphicPath,
  });
  console.log(` ok -> ${graphicPath}`);

  // -- Caption --
  const hashtags = pickHashtags(ad);
  const caption = buildCaption({ copy, ad, hashtags });

  console.log('\n' + '='.repeat(60));
  console.log(`HEADLINE: ${copy.headline}`);
  console.log(`SUBHEAD:  ${copy.subhead}`);
  console.log(`BUTTON:   ${ad.button}`);
  console.log('-'.repeat(60));
  console.log(caption);
  console.log('='.repeat(60) + `\n  Caption length: ${caption.length} chars\n`);

  if (preview) {
    console.log('Preview mode — nothing posted, nothing archived.');
    return;
  }

  // -- Post --
  let result;
  if (testMode) {
    console.log('Test mode — skipping the Facebook post.');
    result = { success: true, test: true };
  } else {
    process.stdout.write('  Posting to Facebook...');
    result = await postToFacebook(caption, graphicPath);
    console.log(result.success ? ` ok (post ${result.postId})` : ` FAILED: ${result.error}`);
  }

  // -- Archive (written even on failure, so a bad day is still traceable) --
  const archiveDir = path.join(__dirname, '..', 'content', 'ad-archive');
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.writeFileSync(
    path.join(archiveDir, `${date}.json`),
    JSON.stringify({
      date,
      day,
      label: ad.label,
      destination: ad.page,
      button: ad.button,
      copy,
      caption,
      hashtags,
      usedFallback,
      graphic: path.basename(graphicPath),
      postingResult: result,
      postedAt: new Date().toISOString(),
      testMode,
    }, null, 2),
  );
  console.log(`  Archived to content/ad-archive/${date}.json`);

  if (!result.success) process.exit(1);
  console.log('\nDone.');
}

if (require.main === module) {
  main().catch(err => {
    console.error(`\nFATAL: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main, generateAdCopy, buildCaption, findBannedTerms, looksTitleCased };
