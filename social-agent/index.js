/**
 * IFM Social Media Agent — Content Generator
 * Generates daily themed content for all platforms using Groq AI
 *
 * Usage:
 *   node index.js              → Generate and save today's content
 *   node index.js --preview    → Generate and display without saving
 *   node index.js --day 3      → Force a specific day (0=Sun, 6=Sat)
 */

require('dotenv').config();
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const config = require('./config');

// ── Helpers ────────────────────────────────────────────

function getDayOfWeek(overrideDay) {
  if (overrideDay !== undefined) return parseInt(overrideDay, 10);
  return new Date().getDay();
}

function pickHashtags(theme, platform) {
  const count = config.platforms[platform]?.hashtagCount || 3;
  const pool = [
    ...config.hashtags.core,
    ...(config.hashtags[theme.type.includes('prayer') ? 'prayer' :
        theme.type.includes('marriage') ? 'marriage' :
        theme.type.includes('teaching') ? 'teaching' :
        theme.type.includes('scripture') ? 'faith' :
        theme.type.includes('engagement') ? 'engagement' : 'faith'] || []),
  ];
  // Shuffle and pick
  const shuffled = pool.sort(() => 0.5 - Math.random());
  return [...new Set(shuffled)].slice(0, count);
}

function buildCTA(theme, platform) {
  const linkStyle = config.platforms[platform]?.linkPlacement;
  if (linkStyle === 'bio_reference') {
    return `\n\n${theme.cta} → Link in bio`;
  }
  return `\n\n${theme.cta}\n${theme.page}`;
}

function todayDateString() {
  return new Date().toISOString().split('T')[0];
}

// ── AI Content Generation ──────────────────────────────

async function generateContent(theme, platform) {
  const platformConfig = config.platforms[platform];

  const systemPrompt = [
    `You are the social media voice for ${config.ministry.name}, led by ${config.ministry.pastor}.`,
    config.brandVoice,
    `\nPlatform: ${platform.toUpperCase()}`,
    `Style: ${platformConfig.style}`,
    `Maximum length: ${platformConfig.maxLength} characters (this is the CONTENT only, not including hashtags or links).`,
    `Write ONLY the post content. No hashtags, no links, no labels, no metadata.`,
    `Do not start with the day name or content type label.`,
  ].join('\n');

  const userPrompt = [
    `Today's content type: ${theme.label}`,
    `\nInstructions:\n${theme.prompt}`,
    `\nWrite one ${platform} post. Stay under ${platformConfig.maxLength} characters.`,
  ].join('\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(config.ai.baseUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ai.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Groq API ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();

    if (!content) throw new Error('Empty response from Groq API');

    // Enforce character limit (trim gracefully at last sentence)
    if (content.length > platformConfig.maxLength) {
      const trimmed = content.substring(0, platformConfig.maxLength);
      const lastPeriod = trimmed.lastIndexOf('.');
      const lastNewline = trimmed.lastIndexOf('\n');
      const cutPoint = Math.max(lastPeriod, lastNewline);
      content = cutPoint > platformConfig.maxLength * 0.5
        ? trimmed.substring(0, cutPoint + 1)
        : trimmed;
    }

    return content;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('Groq API request timed out after 30 seconds');
    }
    throw err;
  }
}

// ── Retry Wrapper ──────────────────────────────────────

async function generateWithRetry(theme, platform) {
  let lastError;
  for (let attempt = 1; attempt <= config.ai.maxRetries; attempt++) {
    try {
      return await generateContent(theme, platform);
    } catch (err) {
      lastError = err;
      console.error(`  [${platform}] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < config.ai.maxRetries) {
        await new Promise(r => setTimeout(r, config.ai.retryDelayMs));
      }
    }
  }
  throw lastError;
}

// ── Main Pipeline ──────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const preview = args.includes('--preview');
  const dayIndex = args.indexOf('--day');
  const forceDay = dayIndex !== -1 ? args[dayIndex + 1] : undefined;

  // Validate API key
  if (!process.env.GROQ_API_KEY) {
    console.error('ERROR: GROQ_API_KEY environment variable is required');
    process.exit(1);
  }

  const day = getDayOfWeek(forceDay);
  const theme = config.dailyThemes[day];

  if (!theme) {
    console.error(`ERROR: No theme configured for day ${day}`);
    process.exit(1);
  }

  console.log(`\n📅 ${todayDateString()} — ${theme.label} (Day ${day})`);
  console.log(`🔗 Target page: ${theme.page}\n`);

  const platforms = Object.keys(config.platforms);
  const results = {};

  for (const platform of platforms) {
    process.stdout.write(`  Generating ${platform}...`);
    try {
      const content = await generateWithRetry(theme, platform);
      const hashtags = pickHashtags(theme, platform);
      const cta = buildCTA(theme, platform);

      results[platform] = {
        content,
        hashtags,
        cta,
        fullPost: `${content}${cta}\n\n${hashtags.join(' ')}`,
      };
      console.log(` ✓ (${content.length} chars)`);
    } catch (err) {
      console.error(` ✗ FAILED: ${err.message}`);
      results[platform] = { error: err.message };
    }
  }

  // Display results
  console.log('\n' + '═'.repeat(60));
  for (const [platform, result] of Object.entries(results)) {
    console.log(`\n▸ ${platform.toUpperCase()}`);
    console.log('─'.repeat(40));
    if (result.error) {
      console.log(`  ERROR: ${result.error}`);
    } else {
      console.log(result.fullPost);
    }
  }
  console.log('\n' + '═'.repeat(60));

  // Save unless preview mode
  if (!preview) {
    const outputDir = path.join(__dirname, '..', 'content', 'social-posts');
    fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, `${todayDateString()}.json`);
    const output = {
      date: todayDateString(),
      day,
      theme: theme.label,
      themeType: theme.type,
      targetPage: theme.page,
      posts: results,
      generatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved to ${outputFile}`);
  } else {
    console.log('\n👁️  Preview mode — nothing saved');
  }

  // Return results for poster.js to consume
  return results;
}

// Allow both CLI and module usage
if (require.main === module) {
  main().catch(err => {
    console.error(`\nFATAL: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { main, generateContent, generateWithRetry };
