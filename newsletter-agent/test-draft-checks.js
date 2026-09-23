/**
 * Tests for newsletter draft checks.
 *
 * The newsletter had no content guard at all. Worse, its bracket stripper
 * would have turned an echoed "[Headline]" into the bare word "Headline" and
 * mailed it to every subscriber. These tests prove a template reply is
 * regenerated, a persistent one fails the run instead of sending, and the
 * legitimate bracket cleanup still works.
 *
 * Usage: node test-draft-checks.js
 */

const { callGroqAI, findDraftDefects, stripBrackets } = require('./newsletter-generator');
const config = require('./config');

let passed = 0, failed = 0;

function check(name, cond, detail) {
  if (cond) { console.log(`  PASS  ${name}`); passed++; }
  else { console.log(`  FAIL  ${name}${detail ? ' -- ' + detail : ''}`); failed++; }
}

// A real section prompt shape (Scripture of the Month).
const PROMPT = [
  'Format:',
  '**[Book Chapter:Verses] ([Translation])**',
  '*"[Full scripture text]"*',
  '',
  '[Commentary]',
].join('\n');

const GOOD = '**Colossians 1:13 (ESV)**\n*"He has delivered us from the domain of darkness."*\n\nThe Kingdom is present now.';
const ECHOED = '**Colossians 1:13 (ESV)**\n*"[Full scripture text]"*\n\nThe Kingdom is present now.';
const BLANK = 'This month, remember that the King is ____ and His reign is now.';

async function run() {
  // 1. Clean copy has no defects.
  check('clean draft passes', findDraftDefects(GOOD, PROMPT).length === 0);

  // 2. An echoed scaffold token is caught on the RAW reply.
  const d = findDraftDefects(ECHOED, PROMPT);
  check('echoed [Full scripture text] caught', d.some(x => x.includes('[Full scripture text]')), d.join('; '));

  // 3. Shared placeholder patterns apply here too.
  check('underscores caught', findDraftDefects(BLANK, PROMPT).some(x => /fill-in-the-blank/.test(x)));

  // 4. Brackets the model added around REAL content are not a defect; they
  //    are stripped. This is the nemotron "[Colossians 2:2-3]" case.
  const own = '**[Colossians 2:2-3] (ESV)**';
  check('model-added brackets are not a defect', findDraftDefects(own, PROMPT).length === 0);
  check('stripper removes them', stripBrackets(own) === '**Colossians 2:2-3 (ESV)**', stripBrackets(own));
  check('stripper keeps markdown links', stripBrackets('[Give](https://x.org)') === '[Give](https://x.org)');

  // 5. A template on attempt 1 regenerates and returns clean, stripped copy.
  let calls = 0;
  const flaky = async () => { calls++; return calls === 1 ? ECHOED : GOOD; };
  const out = await callGroqAI('sys', PROMPT, { chain: flaky, delayMs: 0 });
  check('template regenerates', calls === 2, `chain called ${calls}x`);
  check('returns the clean draft', out === GOOD);

  // 6. Clean on the first try costs exactly one call.
  let once = 0;
  await callGroqAI('sys', PROMPT, { chain: async () => { once++; return GOOD; }, delayMs: 0 });
  check('clean draft generates once', once === 1, `called ${once}x`);

  // 7. A persistent template throws, so the run fails before commit and send.
  let stubborn = 0, err = null;
  try {
    await callGroqAI('sys', PROMPT, { chain: async () => { stubborn++; return ECHOED; }, delayMs: 0 });
  } catch (e) { err = e; }
  check('persistent template throws', err && /unfilled format placeholder/.test(err.message), err && err.message);
  check('uses every attempt', stubborn === config.ai.maxRetries, `called ${stubborn}x`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('SUITE ERROR:', e); process.exit(1); });
