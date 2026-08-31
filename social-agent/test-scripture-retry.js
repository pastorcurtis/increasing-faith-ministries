/**
 * Tests for scripture-mismatch regeneration.
 *
 * On 2026-08-27 a misattributed Psalm 23 blocked the morning post, the 19:00
 * catch-up regenerated into the same failure, and IFM published nothing that
 * day. The verifier was right to refuse -- the defect was that refusing was
 * the END of the story. These tests prove a bad citation now costs one
 * attempt instead of the whole day.
 *
 * Usage: node test-scripture-retry.js
 */

const { generateWithRetry } = require('./index');
const config = require('./config');

let passed = 0, failed = 0;

function check(name, cond, detail) {
  if (cond) { console.log(`  PASS  ${name}`); passed++; }
  else { console.log(`  FAIL  ${name}${detail ? ' -- ' + detail : ''}`); failed++; }
}

// The real Psalm 23 misattribution that cost 2026-08-27.
const BAD = 'Lord, we decree that every household walks in the peace of Psalm 23:1-3.';
const GOOD = 'Yahweh is my shepherd: I shall lack nothing. -- Psalm 23:1';

// Stub verifier: flags anything containing the decree wording, mirroring an
// overlap-0 verdict without touching the network.
const verify = async text => ({
  mismatches: text.includes('decree')
    ? [{ ref: 'Psalm 23:1-3', score: 0 }]
    : [],
});

async function run() {
  // Keep the suite fast; the delay itself is not what is under test.
  const realDelay = config.ai.scriptureRetryDelayMs;
  config.ai.scriptureRetryDelayMs = 0;

  // 1. A misattribution on the first attempt regenerates and recovers.
  let calls = 0;
  const flaky = async () => { calls++; return calls === 1 ? BAD : GOOD; };
  const out = await generateWithRetry({}, 'facebook', { generate: flaky, verify });
  check('bad citation regenerates', calls === 2, `generator called ${calls}x`);
  check('returns the clean copy', out === GOOD, `got: ${out}`);

  // 2. Clean copy must NOT burn a retry -- regeneration costs tokens against
  //    the per-minute budget that already constrains this agent.
  let cleanCalls = 0;
  const always = async () => { cleanCalls++; return GOOD; };
  await generateWithRetry({}, 'facebook', { generate: always, verify });
  check('clean citation generates once', cleanCalls === 1, `called ${cleanCalls}x`);

  // 3. A persistent misattribution still fails closed. Publishing a fabricated
  //    verse under the pastor's name is worse than missing a post.
  let stubborn = 0;
  const broken = async () => { stubborn++; return BAD; };
  let threw = null;
  try {
    await generateWithRetry({}, 'facebook', { generate: broken, verify });
  } catch (e) { threw = e; }
  check('persistent mismatch throws', threw !== null);
  check('error names the misattribution',
    threw && /misattributed scripture/.test(threw.message), threw && threw.message);
  check('exhausts every attempt', stubborn === config.ai.maxRetries,
    `called ${stubborn}x, maxRetries=${config.ai.maxRetries}`);

  // 4. 'unverifiable' must never block -- a dead lookup service must not cost
  //    a day. Matches poster.js's stance.
  let unver = 0;
  const noMismatch = async () => ({ mismatches: [] });
  const once = async () => { unver++; return 'Trust the Lord. -- Habakkuk 2:4'; };
  await generateWithRetry({}, 'facebook', { generate: once, verify: noMismatch });
  check('unverifiable does not retry', unver === 1, `called ${unver}x`);

  config.ai.scriptureRetryDelayMs = realDelay;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
