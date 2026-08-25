/**
 * IFM Social Media Agent -- Scripture Reference Verification
 *
 * On 2026-08-25 the generator published "His kingdom is not a matter of talk
 * but of power" attributed to 1 Timothy 6:15. That text is 1 Corinthians 4:20,
 * and TikTok cited it correctly in the same run -- so this is model variance,
 * not a prompt bug. No amount of text sanitizing catches it. The only way to
 * know is to look the verse up.
 *
 * Approach: pull every "Book chapter:verse" reference out of the copy, find the
 * quoted text it is attached to, fetch the real verse, and compare significant
 * word overlap. A paraphrase across translations still shares most of its
 * content words; a misattribution shares almost none.
 *
 * Verdicts are deliberately three-valued:
 *   ok           -- overlap is good, or there was nothing to check
 *   mismatch     -- we HAVE the verse and the quote does not resemble it. Blocks.
 *   unverifiable -- lookup failed, ambiguous book, quote too short to judge.
 *                   Warns and allows. Not knowing is not evidence of a defect,
 *                   and a dead lookup service must never take the Page offline.
 */

// node-fetch, not global fetch: the workflows pin Node 20 and the rest of the
// agent already depends on this, so there is no reason to rely on a different
// HTTP stack here than the one the posting path is tested against.
const fetch = require('node-fetch');

// Canonical names bible-api.com accepts, plus the abbreviations the model
// actually emits. Longest alias wins so "Corinthians" is not eaten by "Cor".
const BOOK_ALIASES = {
  'Genesis': ['Genesis', 'Gen'], 'Exodus': ['Exodus', 'Exod', 'Ex'],
  'Leviticus': ['Leviticus', 'Lev'], 'Numbers': ['Numbers', 'Num'],
  'Deuteronomy': ['Deuteronomy', 'Deut'], 'Joshua': ['Joshua', 'Josh'],
  'Judges': ['Judges', 'Judg'], 'Ruth': ['Ruth'],
  '1 Samuel': ['1 Samuel', '1 Sam'], '2 Samuel': ['2 Samuel', '2 Sam'],
  '1 Kings': ['1 Kings', '1 Kgs'], '2 Kings': ['2 Kings', '2 Kgs'],
  '1 Chronicles': ['1 Chronicles', '1 Chron', '1 Chr'],
  '2 Chronicles': ['2 Chronicles', '2 Chron', '2 Chr'],
  'Ezra': ['Ezra'], 'Nehemiah': ['Nehemiah', 'Neh'], 'Esther': ['Esther', 'Esth'],
  'Job': ['Job'], 'Psalms': ['Psalms', 'Psalm', 'Ps'],
  'Proverbs': ['Proverbs', 'Prov'], 'Ecclesiastes': ['Ecclesiastes', 'Eccl'],
  'Song of Solomon': ['Song of Solomon', 'Song of Songs', 'Song'],
  'Isaiah': ['Isaiah', 'Isa'], 'Jeremiah': ['Jeremiah', 'Jer'],
  'Lamentations': ['Lamentations', 'Lam'], 'Ezekiel': ['Ezekiel', 'Ezek'],
  'Daniel': ['Daniel', 'Dan'], 'Hosea': ['Hosea', 'Hos'], 'Joel': ['Joel'],
  'Amos': ['Amos'], 'Obadiah': ['Obadiah', 'Obad'], 'Jonah': ['Jonah'],
  'Micah': ['Micah', 'Mic'], 'Nahum': ['Nahum', 'Nah'],
  'Habakkuk': ['Habakkuk', 'Hab'], 'Zephaniah': ['Zephaniah', 'Zeph'],
  'Haggai': ['Haggai', 'Hag'], 'Zechariah': ['Zechariah', 'Zech'],
  'Malachi': ['Malachi', 'Mal'], 'Matthew': ['Matthew', 'Matt'],
  'Mark': ['Mark'], 'Luke': ['Luke'], 'John': ['John'], 'Acts': ['Acts'],
  'Romans': ['Romans', 'Rom'],
  '1 Corinthians': ['1 Corinthians', '1 Cor'],
  '2 Corinthians': ['2 Corinthians', '2 Cor'],
  'Galatians': ['Galatians', 'Gal'], 'Ephesians': ['Ephesians', 'Eph'],
  'Philippians': ['Philippians', 'Phil'], 'Colossians': ['Colossians', 'Col'],
  '1 Thessalonians': ['1 Thessalonians', '1 Thess'],
  '2 Thessalonians': ['2 Thessalonians', '2 Thess'],
  '1 Timothy': ['1 Timothy', '1 Tim'], '2 Timothy': ['2 Timothy', '2 Tim'],
  'Titus': ['Titus'], 'Philemon': ['Philemon', 'Philem'],
  'Hebrews': ['Hebrews', 'Heb'], 'James': ['James', 'Jas'],
  '1 Peter': ['1 Peter', '1 Pet'], '2 Peter': ['2 Peter', '2 Pet'],
  '1 John': ['1 John'], '2 John': ['2 John'], '3 John': ['3 John'],
  'Jude': ['Jude'], 'Revelation': ['Revelation', 'Rev'],
};

// Roman numerals and ordinals the model uses in place of digits.
const NUMERAL_PREFIX = { i: '1', ii: '2', iii: '3', first: '1', second: '2', third: '3' };

function normalizeAlias(s) {
  return s.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
}

// Aliases are stored WITHOUT their leading numeral ("1 Cor" -> "cor" under key
// "1 cor"), so both the numbered and bare forms resolve through one map.
const ALIAS_TO_CANONICAL = new Map();
const BARE_ALIASES = new Set();
for (const [canonical, aliases] of Object.entries(BOOK_ALIASES)) {
  for (const a of aliases) {
    ALIAS_TO_CANONICAL.set(normalizeAlias(a), canonical);
    BARE_ALIASES.add(normalizeAlias(a).replace(/^[123]\s+/, ''));
  }
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Match the book name without its numeral; the numeral is captured separately
// so "1 Cor", "I Cor", and "First Corinthians" all collapse to one canonical.
const ALIAS_PATTERN = [...BARE_ALIASES]
  .sort((a, b) => b.length - a.length)
  .map(a => escapeRegex(a).replace(/ /g, '\\.?\\s*'))
  .join('|');

const REFERENCE_REGEX = new RegExp(
  '\\b(?:([123]|i{1,3}|first|second|third)\\.?\\s+)?' +
  '(' + ALIAS_PATTERN + ')' +
  '\\.?\\s*(\\d{1,3}):(\\d{1,3})(?:\\s*[-–]\\s*\\d{1,3})?',
  'gi'
);

function parseReferences(text) {
  const out = [];
  for (const m of text.matchAll(REFERENCE_REGEX)) {
    const [raw, numeral, bookRaw, chapter, verse] = m;
    const bare = normalizeAlias(bookRaw);
    let key = bare;
    if (numeral) {
      const digit = NUMERAL_PREFIX[numeral.toLowerCase().replace(/\./g, '')] || numeral;
      key = digit + ' ' + bare;
    }
    const canonical = ALIAS_TO_CANONICAL.get(key);
    // A numeral-less "Corinthians 4:20" is genuinely ambiguous (1st or 2nd?),
    // so it is reported unresolved rather than guessed at.
    if (!canonical) {
      out.push({ raw: raw.trim(), canonical: null, index: m.index });
      continue;
    }
    out.push({
      raw: raw.trim(),
      canonical: canonical + ' ' + chapter + ':' + verse,
      index: m.index,
    });
  }
  return out;
}

// -- Quote extraction ---

// Matched quotation spans: curly double, straight double, curly single. Each
// style is scanned in its OWN pass. A single alternating regex cannot work
// here: the outer “...” match consumes the nested ‘...’ verse quote, so
// matchAll resumes past it and the inner span is never seen.
const QUOTE_SPAN_REGEXES = [/“([^“”]+)”/g, /"([^"]+)"/g, /‘([^‘’]+)’/g];

// The reference may sit inside the quote, immediately before it, or trail it
// after a dash. Take the nearest quoted span; if the copy uses no quote marks
// at all, fall back to the sentence the reference sits in.
function extractQuoteFor(text, ref) {
  const spans = [];
  for (const re of QUOTE_SPAN_REGEXES) {
    for (const m of text.matchAll(re)) {
      const body = m[1];
      if (body && body.trim().length > 0) {
        spans.push({ body, start: m.index, end: m.index + m[0].length });
      }
    }
  }

  const scored = spans.map(s => {
    const inside = ref.index >= s.start && ref.index < s.end;
    const distance = inside
      ? 0
      : Math.min(Math.abs(ref.index - s.end), Math.abs(s.start - ref.index));
    return { ...s, distance };
  });

  scored.sort((a, b) => a.distance - b.distance || a.body.length - b.body.length);
  let best = scored[0];

  // These posts routinely wrap the whole body in one quote and nest the actual
  // verse inside it: “Matthew 6:33 - ‘But seek first...’ <commentary>”. The
  // reference sits in the outer span but labels the inner one, so descend into
  // the nested quote nearest the reference. Scoring the outer span mixes the
  // commentary into the denominator -- that is what made a correctly cited
  // Matthew 6:33 score 0.26 and read as a misattribution.
  if (best) {
    const nested = scored
      .filter(s => s.start > best.start && s.end <= best.end)
      .sort((a, b) => Math.abs(a.start - ref.index) - Math.abs(b.start - ref.index));
    if (nested.length > 0) best = nested[0];
  }

  // Beyond ~80 characters the reference is not plausibly labelling that quote.
  if (best && best.distance <= 80) return best.body;

  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  let offset = 0;
  for (const s of sentences) {
    const end = offset + s.length;
    if (ref.index >= offset && ref.index <= end) return s;
    offset = end + 1;
  }
  return null;
}

// -- Similarity ---

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those',
  'for', 'with', 'as', 'by', 'on', 'at', 'from', 'not', 'no', 'you', 'your',
  'yours', 'we', 'our', 'us', 'me', 'my', 'he', 'him', 'his', 'she', 'her',
  'they', 'them', 'their', 'who', 'whom', 'which', 'what', 'when', 'where',
  'how', 'all', 'any', 'shall', 'will', 'would', 'may', 'might', 'can',
  'could', 'do', 'does', 'did', 'have', 'has', 'had', 'so', 'then', 'than',
  'there', 'here', 'unto', 'thee', 'thou', 'thy', 'into', 'upon', 'out', 'up',
  'down', 'over', 'under', 'if', 'because', 'also', 'own', 'yet', 'now',
]);

// Light suffix stripping only. Deliberately does NOT reduce "kingdom" to
// "king" -- that collapse would make 1 Timothy 6:15 ("King of kings") look
// like a match for a verse about the Kingdom, which is the exact error here.
function stem(word) {
  return word
    .replace(/’s$|'s$/, '')
    .replace(/(\w{4,})ing$/, '$1')
    .replace(/(\w{4,})ed$/, '$1')
    .replace(/(\w{3,})es$/, '$1')
    .replace(/(\w{3,})s$/, '$1');
}

function contentWords(text) {
  const cleaned = text
    .replace(REFERENCE_REGEX, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\s']/gu, ' ');
  const words = cleaned.split(/\s+/).filter(Boolean);
  return new Set(words.filter(w => w.length > 2 && !STOPWORDS.has(w)).map(stem));
}

// Fraction of the quote's content words that appear in the real verse.
// Asymmetric on purpose: the model often quotes a fragment of a longer verse,
// and that fragment should still score high.
function overlapScore(quote, verse) {
  const q = contentWords(quote);
  const v = contentWords(verse);
  if (q.size === 0) return { score: 0, quoteWords: 0, shared: [] };
  const shared = [...q].filter(w => v.has(w));
  return { score: shared.length / q.size, quoteWords: q.size, shared };
}

// -- Verse lookup ---

const VERSE_CACHE = new Map();

async function fetchVerseFromApi(canonicalRef, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = 'https://bible-api.com/' + encodeURIComponent(canonicalRef) + '?translation=web';
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const text = (data && data.text) ? String(data.text).trim() : '';
    return text.length > 0 ? text : null;
  } catch {
    // Any lookup failure yields null, which becomes an 'unverifiable' verdict.
    // It must never throw: the Page staying live outweighs the check.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function lookupVerse(canonicalRef, fetcher = fetchVerseFromApi) {
  if (VERSE_CACHE.has(canonicalRef)) return VERSE_CACHE.get(canonicalRef);
  const text = await fetcher(canonicalRef);
  // Only successful lookups are cached. Caching a null would turn one transient
  // network blip into "unverifiable" for every later reference to that verse in
  // the same run, including the retry that would have succeeded.
  if (text) VERSE_CACHE.set(canonicalRef, text);
  return text;
}

function clearVerseCache() {
  VERSE_CACHE.clear();
}

// -- Public API ---

// Below this share of matching content words the citation is treated as wrong.
// Calibrated on real output: correct citations score 0.50-0.86 across
// translations, while the 1 Timothy misattribution scores 0.00.
const MATCH_THRESHOLD = 0.30;

// Short fragments cannot be judged -- "His power" overlaps almost anything.
const MIN_CONTENT_WORDS = 4;

async function verifyScripture(text, options = {}) {
  const { fetcher = fetchVerseFromApi } = options;
  const results = [];

  for (const ref of parseReferences(text)) {
    if (!ref.canonical) {
      results.push({ ref: ref.raw, verdict: 'unverifiable', reason: 'ambiguous book name' });
      continue;
    }
    const quote = extractQuoteFor(text, ref);
    if (!quote) {
      results.push({ ref: ref.raw, verdict: 'unverifiable', reason: 'no quoted text found' });
      continue;
    }
    const { quoteWords } = overlapScore(quote, '');
    if (quoteWords < MIN_CONTENT_WORDS) {
      results.push({ ref: ref.raw, verdict: 'unverifiable', reason: 'quote too short to judge' });
      continue;
    }
    const verse = await lookupVerse(ref.canonical, fetcher);
    if (!verse) {
      results.push({ ref: ref.raw, verdict: 'unverifiable', reason: 'verse lookup failed' });
      continue;
    }
    const { score, shared } = overlapScore(quote, verse);
    results.push({
      ref: ref.raw,
      canonical: ref.canonical,
      verdict: score >= MATCH_THRESHOLD ? 'ok' : 'mismatch',
      score: Number(score.toFixed(2)),
      shared,
      verse,
      quote: quote.trim(),
    });
  }

  return {
    results,
    mismatches: results.filter(r => r.verdict === 'mismatch'),
    unverifiable: results.filter(r => r.verdict === 'unverifiable'),
  };
}

module.exports = {
  verifyScripture, parseReferences, extractQuoteFor, overlapScore,
  lookupVerse, clearVerseCache, MATCH_THRESHOLD, MIN_CONTENT_WORDS,
};
