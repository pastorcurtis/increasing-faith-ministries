/**
 * Tests for scripture reference verification.
 *
 * Usage:
 *   node test-scripture.js          -- offline, uses the fixtures below
 *   node test-scripture.js --live   -- also hits bible-api.com once, to catch
 *                                      the API changing shape underneath us
 *
 * The offline fixtures are real World English Bible text, so a passing run
 * means the scoring separates genuine paraphrase from misattribution -- not
 * merely that the code runs.
 */

const {
  verifyScripture, parseReferences, clearVerseCache, MATCH_THRESHOLD,
} = require('./scripture');

const WEB = {
  'Matthew 6:33': 'But seek first God’s Kingdom, and his righteousness; and all these things will be given to you as well.',
  '1 Corinthians 4:20': 'For God’s Kingdom is not in word, but in power.',
  '1 Timothy 6:15': 'which in its own times he will show, who is the blessed and only Ruler, the King of kings, and Lord of lords;',
  'John 3:16': 'For God so loved the world, that he gave his one and only Son, that whoever believes in him should not perish, but have eternal life.',
  'Philippians 4:13': 'I can do all things through Christ, who strengthens me.',
  'Psalms 23:1': 'Yahweh is my shepherd: I shall lack nothing.',
  'Jeremiah 29:11': 'For I know the thoughts that I think toward you,” says Yahweh, “thoughts of peace, and not of evil, to give you hope and a future.',
  'Romans 8:28': 'We know that all things work together for good for those who love God, to those who are called according to his purpose.',
  'Isaiah 41:10': 'Don’t you be afraid, for I am with you. Don’t be dismayed, for I am your God. I will strengthen you. Yes, I will help you. Yes, I will uphold you with the right hand of my righteousness.',
};

const stubFetcher = async ref => WEB[ref] || null;
const deadFetcher = async () => null;

let failures = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log('PASS  ' + name);
  } else {
    failures++;
    console.log('FAIL  ' + name + (detail ? '\n        ' + detail : ''));
  }
}

async function verdictOf(text, fetcher = stubFetcher) {
  const r = await verifyScripture(text, { fetcher });
  return r.results[0] || null;
}

async function run() {
  console.log('-- correctly cited, must PASS (translation differs from WEB) --');

  // NIV wording against WEB text: different translation, same verse.
  let v = await verdictOf('“For God so loved the world that he gave his one and only Son.” — John 3:16');
  check('John 3:16 (NIV wording)', v && v.verdict === 'ok', v && `verdict=${v.verdict} score=${v.score}`);

  v = await verdictOf('“I can do all things through Christ who strengthens me.” — Philippians 4:13');
  check('Philippians 4:13 (KJV wording)', v && v.verdict === 'ok', v && `verdict=${v.verdict} score=${v.score}`);

  v = await verdictOf('“And we know that in all things God works for the good of those who love him.” — Rom 8:28');
  check('Romans 8:28 (abbreviated book)', v && v.verdict === 'ok', v && `verdict=${v.verdict} score=${v.score}`);

  // The real structure that first produced a false positive: the reference and
  // the verse sit inside an outer quote that also wraps the commentary.
  const nested = '“Matthew 6:33 – ‘But seek first the kingdom of God and his righteousness, ' +
    'and all these things will be added to you.’\nThe world hustles for security, yet the ' +
    'Kingdom demands priority now. When you place God’s reign above every agenda, ' +
    'provision follows automatically.”';
  v = await verdictOf(nested);
  check('Matthew 6:33 nested in outer quote', v && v.verdict === 'ok', v && `verdict=${v.verdict} score=${v.score}`);

  console.log('\n-- misattributed, must BLOCK --');

  // The actual 2026-08-25 defect.
  v = await verdictOf('“His kingdom is not a matter of talk but of power—1 Timothy 6:15.”');
  check('1 Timothy 6:15 (real defect)', v && v.verdict === 'mismatch', v && `verdict=${v.verdict} score=${v.score}`);

  v = await verdictOf('“I can do all things through Christ who strengthens me.” — Psalm 23:1');
  check('Phil 4:13 text cited as Psalm 23:1', v && v.verdict === 'mismatch', v && `verdict=${v.verdict} score=${v.score}`);

  v = await verdictOf('“For I know the plans I have for you, plans to prosper you and not to ' +
    'harm you, plans to give you hope and a future.” — Isaiah 41:10');
  check('Jer 29:11 text cited as Isaiah 41:10', v && v.verdict === 'mismatch', v && `verdict=${v.verdict} score=${v.score}`);

  console.log('\n-- cannot judge, must ALLOW (warn only) --');

  // Cleared first: John 3:16 was already resolved above, and a cache hit would
  // silently bypass the dead fetcher this case exists to exercise.
  clearVerseCache();
  v = await verdictOf('“For God so loved the world that he gave his one and only Son, that ' +
    'whoever believes in him shall not perish.” — John 3:16', deadFetcher);
  check('lookup failure is unverifiable', v && v.verdict === 'unverifiable' && v.reason === 'verse lookup failed',
    v && `verdict=${v.verdict} reason=${v.reason}`);

  // Documented limitation, not a bug. "The LORD is my shepherd; I shall not
  // want" carries only three content words, and against WEB ("Yahweh is my
  // shepherd: I shall lack nothing") it scores 0.33 -- barely over threshold.
  // Judging quotes that short would false-block correct copy on ordinary
  // translation differences, so short quotes are left alone by design.
  v = await verdictOf('“The LORD is my shepherd; I shall not want.” — Psalm 23:1');
  check('short famous verse is left unjudged, not blocked',
    v && v.verdict === 'unverifiable' && v.reason === 'quote too short to judge',
    v && `verdict=${v.verdict} reason=${v.reason} score=${v.score}`);

  v = await verdictOf('“God is not in word but in power.” — Corinthians 4:20');
  check('ambiguous book is unverifiable', v && v.verdict === 'unverifiable' && v.reason === 'ambiguous book name',
    v && `verdict=${v.verdict} reason=${v.reason}`);

  v = await verdictOf('“His power.” — 1 Corinthians 4:20');
  check('too-short quote is unverifiable', v && v.verdict === 'unverifiable' && v.reason === 'quote too short to judge',
    v && `verdict=${v.verdict} reason=${v.reason}`);

  const none = await verifyScripture('Trust God today. #IFM #IncreasingFaith', { fetcher: stubFetcher });
  check('no reference means nothing to block', none.results.length === 0 && none.mismatches.length === 0);

  console.log('\n-- reference parsing --');
  const forms = {
    'Matthew 6:33': 'Matthew 6:33', '1 Cor 4:20': '1 Corinthians 4:20',
    'I Corinthians 13:4': '1 Corinthians 13:4', 'Ps 23:1': 'Psalms 23:1',
    '1 John 4:8': '1 John 4:8', 'Song of Solomon 2:1': 'Song of Solomon 2:1',
    'Rev 21:4': 'Revelation 21:4',
  };
  for (const [input, expected] of Object.entries(forms)) {
    const got = parseReferences(input)[0];
    check('parses "' + input + '"', got && got.canonical === expected,
      got ? 'got ' + got.canonical : 'no match');
  }

  if (process.argv.includes('--live')) {
    console.log('\n-- live API --');
    const live = await verdictOf('“For God’s Kingdom is not in word, but in power.” — 1 Cor 4:20', undefined);
    check('live lookup returns a usable verdict', live && live.verdict !== 'unverifiable',
      live && `verdict=${live.verdict} reason=${live.reason || ''}`);
  }

  console.log('\nthreshold = ' + MATCH_THRESHOLD);
  console.log(failures === 0 ? 'ALL PASS' : failures + ' FAILED');
  process.exit(failures ? 1 : 0);
}

run().catch(err => { console.error('FATAL: ' + err.message); process.exit(1); });
