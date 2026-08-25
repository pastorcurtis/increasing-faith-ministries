#!/usr/bin/env node
/**
 * check-models.js - Preflight validation of every configured AI model.
 *
 * Why this exists
 * ---------------
 * Twice now a provider has retired a model out from under this repo and the
 * only symptom was silence:
 *
 *   2026-08-17  Groq deleted its whole Llama chat lineup. Both Groq legs died
 *               together, the daily post stopped for 8 days, and the website ad
 *               quietly served canned copy behind a green checkmark.
 *   2026-08-25  While fixing the above we found the OpenRouter leg pointed at
 *               meta-llama/llama-3.3-70b-instruct:free, which OpenRouter had
 *               ALSO retired. The designated "outage insurance" was itself dead
 *               and nobody could have known without calling the API.
 *
 * A model name in a config file is a claim about someone else's product
 * catalogue. It rots on their schedule, not ours, and it rots without warning.
 * The only way to know is to ask, so: ask, on a schedule, and shout early --
 * while the primary still works and there is no outage to fix under pressure.
 *
 * Usage
 *   node check-models.js           human-readable report
 *   node check-models.js --json    machine-readable, for diagnostics.yml
 *
 * Exit codes
 *   0  every checkable model exists (models that could not be checked are
 *      reported but do not fail the run -- a missing key is not a dead model)
 *   1  at least one configured model is missing from its provider
 */

const socialConfig = require('./config');

// Each entry is a model this repo will actually try to call in production.
function collectTargets() {
  const targets = (socialConfig.ai.providers || []).map((p) => ({
    where: `social-agent/config.js -> ${p.name}`,
    url: p.url,
    envVar: p.envVar,
    model: p.model,
  }));

  // newsletter-agent is a SEPARATE agent with its own single-provider caller
  // and no fallback chain. It had the same dead Groq model and would have
  // failed on 2026-09-01 unnoticed. Anything that calls a model belongs here.
  try {
    const nl = require('../newsletter-agent/config');
    targets.push({
      where: 'newsletter-agent/config.js',
      url: nl.ai.baseUrl,
      envVar: 'GROQ_API_KEY',
      model: nl.ai.model,
    });
  } catch (err) {
    console.warn(`  [warn] could not load newsletter-agent config: ${err.message}`);
  }
  return targets;
}

// Providers here are OpenAI-compatible, so the catalogue always sits at
// /models next to /chat/completions.
const modelsUrl = (chatUrl) => chatUrl.replace(/\/chat\/completions\/?$/, '/models');

async function fetchModelIds(url, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  // OpenRouter serves /models publicly; Groq needs the key. Send it if we have
  // it, and let a 401 tell us we needed one.
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`);
    const body = await res.json();
    return (body.data || []).map((m) => m.id);
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const asJson = process.argv.includes('--json');
  const targets = collectTargets();

  // One catalogue fetch per endpoint, not per model.
  const catalogues = new Map();
  for (const t of targets) {
    const url = modelsUrl(t.url);
    if (catalogues.has(url)) continue;
    const key = process.env[t.envVar];
    try {
      catalogues.set(url, { ids: await fetchModelIds(url, key) });
    } catch (err) {
      catalogues.set(url, { error: err.message, hadKey: Boolean(key) });
    }
  }

  const results = targets.map((t) => {
    const cat = catalogues.get(modelsUrl(t.url));
    if (cat.error) {
      return { ...t, status: 'unchecked', detail: cat.error };
    }
    return {
      ...t,
      status: cat.ids.includes(t.model) ? 'ok' : 'missing',
      detail: cat.ids.includes(t.model)
        ? ''
        : `not in provider catalogue (${cat.ids.length} models offered)`,
    };
  });

  const missing = results.filter((r) => r.status === 'missing');
  const unchecked = results.filter((r) => r.status === 'unchecked');

  if (asJson) {
    console.log(JSON.stringify({ missing: missing.length, unchecked: unchecked.length, results }, null, 2));
  } else {
    console.log('\nAI model preflight\n');
    for (const r of results) {
      const mark = r.status === 'ok' ? 'ok     ' : r.status === 'missing' ? 'MISSING' : 'skipped';
      console.log(`  ${mark}  ${r.model}`);
      console.log(`           ${r.where}`);
      if (r.detail) console.log(`           ${r.detail}`);
    }
    console.log('');
    if (missing.length) {
      console.log(`${missing.length} configured model(s) no longer exist. Calls using them will 404.`);
      console.log('List what the provider actually serves, then repoint config:');
      console.log('  curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models');
      console.log('  curl https://openrouter.ai/api/v1/models   # public, no key needed');
    } else {
      console.log('All checkable models exist.');
    }
    if (unchecked.length) {
      console.log(`\n${unchecked.length} endpoint(s) could not be checked (missing key or network).`);
      console.log('This is NOT a pass -- it means we do not know.');
    }
  }

  process.exit(missing.length ? 1 : 0);
}

main().catch((err) => {
  console.error(`check-models failed: ${err.message}`);
  process.exit(2);
});
