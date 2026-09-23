/**
 * Placeholder detection, shared by every generator that publishes.
 *
 * Placeholder debris means a model handed back a template instead of finished
 * copy. Kept dependency-free on purpose: newsletter-agent requires this file
 * across packages, and anything it pulled from social-agent/node_modules would
 * not be installed in the newsletter workflow.
 */

const PLACEHOLDER_PATTERNS = [
  { re: /_{3,}/, label: 'fill-in-the-blank underscores' },
  { re: /\{\{[^}]*\}\}/, label: 'unrendered {{template}} token' },
  { re: /\[(?:INSERT|TODO|PLACEHOLDER|X{3,})\b[^\]]*\]/i, label: 'bracketed placeholder' },
  { re: /\blorem ipsum\b/i, label: 'lorem ipsum filler' },
];

function findPlaceholders(text) {
  return PLACEHOLDER_PATTERNS.filter(p => p.re.test(text)).map(p => p.label);
}

module.exports = { PLACEHOLDER_PATTERNS, findPlaceholders };
