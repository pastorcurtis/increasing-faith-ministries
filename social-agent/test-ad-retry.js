/**
 * Tests for ad-copy draft checks.
 *
 * postToFacebook() refuses placeholder copy and misquoted scripture, but for
 * the ad that refusal came after the retry loop and the static fallback, so a
 * bad draft meant a lost ad. The teaching post lost days to the same defect
 * on 2026-08-27 and 2026-09-23. These tests prove a bad ad draft now costs
 * one attempt, and that headline/subhead text (printed on the image, never
 * seen by the caption check) is covered too.
 *
 * Usage: node test-ad-retry.js
 */

const { checkDraft, generateWithRetry } = require('./ad');

let passed = 0, failed = 0;

function check(name, cond, detail) {
  if (cond) { console.log(`  PASS  ${name}`); passed++; }
  else { console.log(`  FAIL  ${name}${detail ? ' -- ' + detail : ''}`); failed++; }
}

const GOOD = {
  headline: 'You can pray every day and still feel far away.',
  subhead: 'Distance is not the same as absence.',
  hook: 'Most people stop praying right before the answer.',
  body: 'Read this week\'s teaching on the prayers page.',
};
const BLANK_HEADLINE = { ...GOOD, headline: 'God is ____ and He is near.' };

// Stub verifiers so the suite never touches the network.
const noMismatch = async () => ({ mismatches: [] });
const flagsDecree = async text => ({
  mismatches: text.includes('decree') ? [{ ref: 'Psalm 23:1-3', score: 0 }] : [],
});

async function expectThrow(fn) {
  try { await fn(); return null; } catch (e) { return e; }
}

async function run() {
  // 1. Clean copy passes.
  check('clean draft passes', (await expectThrow(() => checkDraft(GOOD, noMismatch))) === null);

  // 2. Underscores in the HEADLINE are caught. The caption check never sees
  //    the headline, so this is the gap that was fully unguarded.
  const e1 = await expectThrow(() => checkDraft(BLANK_HEADLINE, noMismatch));
  check('placeholder in headline rejected', e1 && /fill-in-the-blank/.test(e1.message), e1 && e1.message);

  // 3. A misquoted verse in the subhead is caught.
  const e2 = await expectThrow(() => checkDraft({ ...GOOD, subhead: 'We decree peace -- Psalm 23:1-3' }, flagsDecree));
  check('misquoted scripture rejected', e2 && /Misattributed scripture/.test(e2.message), e2 && e2.message);

  // 4. The retry loop recovers from a bad first draft.
  let calls = 0;
  const flaky = async () => {
    calls++;
    const draft = calls === 1 ? BLANK_HEADLINE : GOOD;
    await checkDraft(draft, noMismatch);
    return draft;
  };
  const out = await generateWithRetry({}, 5, { generate: flaky, delayMs: 0 });
  check('bad draft regenerates', calls === 2, `generator called ${calls}x`);
  check('returns the clean draft', out === GOOD);

  // 5. A draft that never comes clean throws, so main() ships static fallback.
  let stubborn = 0;
  const e3 = await expectThrow(() => generateWithRetry({}, 5, {
    generate: async () => { stubborn++; await checkDraft(BLANK_HEADLINE, noMismatch); },
    delayMs: 0,
  }));
  check('persistent bad draft throws', e3 !== null);
  check('uses every attempt', stubborn === 5, `called ${stubborn}x`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
