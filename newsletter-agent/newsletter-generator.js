/**
 * newsletter-generator.js - AI-Powered Newsletter Content Generator
 *
 * Takes gathered content and generates a complete Kingdom-centered newsletter
 * using a provider chain (Groq -> OpenRouter) defined in config.ai.providers.
 *
 * Had ONE provider and no fallback until 2026-08-25, so a Groq outage on the
 * 1st of a month lost that month's newsletter outright.
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { format } = require('date-fns');
const config = require('./config');

// ---------------------------------------------------------------------------
// AI provider chain, with a retry wrapper
// ---------------------------------------------------------------------------

// Reasoning leaking in as PROSE, with no tags to strip. nemotron did exactly
// this on 2026-08-25 -- an answer that opened "We need to produce a Facebook
// post under 500 characters..." -- the model restating its own brief. Per-
// provider settings are the real fix, but they are a promise about someone
// else's defaults; this screens every provider the same way so a model swapped
// in later inherits the protection without anyone remembering to add it.
const REASONING_LEAK =
  /^\s*(we|i|the user|okay|alright|first|let me|sure)\b[^.!?]{0,200}?\b(post|caption|output|character|hashtag|prompt|instruction|word count|response|newsletter|section|brief|headline|sentence|paragraph)s?\b/i;

// Tries each provider in config.ai.providers in order, skipping any whose API
// key is unset. Throws only when every provider has failed.
async function callProviderChain(systemPrompt, userPrompt) {
  const providers = config.ai.providers || [];
  const errors = [];

  for (const provider of providers) {
    const apiKey = process.env[provider.envVar];
    if (!apiKey) {
      errors.push(provider.name + ": " + provider.envVar + " not set");
      continue;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(provider.url, {
        method: "POST",
        signal: controller.signal,
        headers: Object.assign({
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey,
        }, provider.extraHeaders || {}),
        body: JSON.stringify(Object.assign({
          model: provider.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: config.ai.maxTokens,
          temperature: config.ai.temperature,
        }, provider.extraBody || {})),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(provider.name + " " + response.status + ": " + errorBody.slice(0, 200));
      }

      const data = await response.json();
      const raw = (data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : "") || "";
      const content = raw
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<\/?think>/gi, "")
        .trim();

      if (!content) {
        throw new Error(raw.trim()
          ? provider.name + " returned only reasoning, no answer (raise maxTokens)"
          : provider.name + " returned empty content");
      }
      if (REASONING_LEAK.test(content)) {
        throw new Error(provider.name + " leaked reasoning into the reply instead of answering");
      }

      // Strip placeholder brackets the model copied out of the format
      // examples -- "**[Colossians 2:2-3] (ESV)**" survived a dry run even
      // after the system prompt was told not to emit them. An instruction is
      // a request; this is a guarantee. Markdown links are left intact by
      // requiring that the closing bracket NOT be followed by "(".
      const cleaned = content.replace(/\[([^\]\n]{1,120})\](?!\()/g, "$1");

      if (provider !== providers[0]) {
        console.log("  [ai] Fallback provider succeeded: " + provider.name);
      }
      return cleaned;
    } catch (error) {
      const reason = error.name === "AbortError" ? "timeout after 60000ms" : error.message;
      console.log("  [ai] " + provider.name + " failed: " + reason);
      errors.push(provider.name + ": " + reason);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("All AI providers failed." + String.fromCharCode(10) + "  - " + errors.join(String.fromCharCode(10) + "  - "));
}

// Retry wrapper. The chain above already fails over between providers, so a
// retry here is for transient conditions that outlast the whole chain -- most
// often every leg being rate-limited at once on the free tiers.
async function callGroqAI(systemPrompt, userPrompt) {
  let lastError;
  for (let attempt = 1; attempt <= config.ai.maxRetries; attempt++) {
    try {
      return await callProviderChain(systemPrompt, userPrompt);
    } catch (error) {
      lastError = error;
      console.log("  [RETRY " + attempt + "/" + config.ai.maxRetries + "] " + error.message);
      if (attempt < config.ai.maxRetries) {
        const isRateLimit = error.message.includes("429");
        const delay = isRateLimit ? 15000 : config.ai.retryDelayMs * attempt;
        console.log("  Waiting " + (delay / 1000) + "s before retry...");
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error("AI generation failed after " + config.ai.maxRetries + " attempts: " + lastError.message);
}

// ---------------------------------------------------------------------------
// System Prompt (shared theological context for all sections)
// ---------------------------------------------------------------------------

function buildSystemPrompt() {
  return [
    'You are a Kingdom-centered content writer for Increasing Faith Ministries (IFM).',
    '',
    'MINISTRY CONTEXT:',
    '- Name: ' + config.ministry.name,
    '- Senior Pastor: ' + config.ministry.pastor,
    '- Mission: ' + config.mission,
    '- Location: ' + config.ministry.location,
    '- Website: ' + config.ministry.website,
    '- In-Person Worship: ' + config.ministry.serviceTimes.inPerson,
    '- Online Teaching: ' + config.ministry.serviceTimes.online,
    '',
    'THEOLOGICAL FRAMEWORK (you MUST align all content with these):',
    ...config.theology.core.map((point) => '- ' + point),
    '',
    'WRITING GUIDELINES:',
    '- Write with authority, warmth, and Kingdom confidence.',
    '- Use language that is accessible yet theologically substantial.',
    '- Avoid cliches and generic Christian platitudes.',
    '- The Kingdom of God should be the lens through which everything is viewed.',
    '- Jesus is Lord over ALL things - not just "spiritual" matters.',
    '- Emphasize the present reality of the Kingdom, not only future hope.',
    "- The gospel is an announcement of Jesus' lordship, not just a ticket to heaven.",
    '- Write for mature disciples who want depth, not spiritual milk.',
    '- Be prophetic - speak truth to culture from a Kingdom perspective.',
    // The per-section prompts show their shape with placeholders like
    // "### [Headline]". Some models copy those brackets into the published
    // text -- nemotron emitted "**[Colossians 2:2-3] (ESV)**" on the fallback
    // path. Square brackets are format scaffolding, never content.
    '',
    'FORMATTING:',
    '- NEVER use square brackets in your output. Where a format example shows',
    '  something like [Headline] or [Story text], that is a placeholder telling',
    '  you what belongs there -- write the real text, with no brackets around it.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Section Generators
// ---------------------------------------------------------------------------

async function generatePastoralMessage(content, monthName, year) {
  console.log('  Generating: From the Desk of Pastor Curtis...');
  const theme = content.monthlyTheme || { theme: 'The Kingdom of God', focus: 'Living under the reign of Christ' };

  const prompt = [
    'Write a pastoral teaching message titled "From the Desk of Pastor Curtis" for the ' + monthName + ' ' + year + ' newsletter.',
    '',
    'Monthly Theme: ' + theme.theme,
    'Monthly Focus: ' + theme.focus,
    '',
    'Requirements:',
    '- 300-400 words',
    '- Open with a warm but authoritative greeting',
    '- Teach on the monthly theme through the lens of the Kingdom of God',
    '- Include at least 2 scripture references (use full verses)',
    '- Connect the teaching to practical Kingdom living',
    '- Close with an encouraging charge to the reader',
    '- Tone: pastoral, prophetic, warm, authoritative',
    '- Sign off as "Pastor Curtis"',
    '',
    'Do NOT use generic phrases like "in these uncertain times" or "more than ever."',
    'Write with the confidence of someone who knows the King personally.',
  ].join('\n');

  return await callGroqAI(buildSystemPrompt(), prompt);
}

async function generateKingdomIntelligence(content, monthName, year) {
  console.log('  Generating: Kingdom Intelligence...');
  let newsContext = 'GATHERED NEWS ARTICLES FOR CONTEXT:\n';
  // Take the highest-scoring story from each distinct source before taking a
  // second from any one of them. topStories is sorted purely by relevance and
  // one outlet routinely owns the whole top slice -- with the briefs now bound
  // to real articles, that would make the section three items from a single
  // masthead. The old prompt got its variety by inventing it; this gets the
  // same variety honestly.
  const ranked = content.topStories || [];
  const seenSources = new Set();
  const firstPerSource = ranked.filter((a) => {
    if (seenSources.has(a.source)) return false;
    seenSources.add(a.source);
    return true;
  });
  const stories = [...firstPerSource, ...ranked.filter((a) => !firstPerSource.includes(a))];
  if (stories.length > 0) {
    stories.forEach((story, i) => {
      newsContext += (i + 1) + '. ' + story.title + ' (' + story.source + ')\n';
      newsContext += '   ' + story.description + '\n\n';
    });
  } else {
    // Do NOT invite the model to invent news here. This section publishes as
    // "Kingdom Intelligence" to a real congregation; a brief with no source
    // behind it is a fabricated news report, however plausible it reads. If
    // the feeds gave us nothing, say nothing.
    newsContext += '(NO ARTICLES GATHERED)\n';
  }

  // The articles above are the SUBJECT of this section, not background colour.
  // Before this was explicit, the requirements asked for '3 news briefs about
  // the Kingdom advancing globally' plus a topic-diversity rule, while labelling
  // the real stories as mere context. The model reasonably obeyed the
  // requirements over the context and wrote generic composites matching no
  // gathered article -- August 2026 shipped exactly that. Reporting the
  // supplied stories, with attribution, is the whole job.
  const haveStories = stories.length > 0;

  const prompt = [
    'Write the "Kingdom Intelligence" section for the ' + monthName + ' ' + year + ' newsletter.',
    '', newsContext,
    'Requirements:',
    haveStories
      ? '- Write one brief for each of the first 3 articles listed above, in that order'
      : '- Output ONLY this line and nothing else: _No verified Kingdom news was gathered this month._',
    '- CRITICAL: report ONLY what the listed articles say. Do not invent events,',
    '  places, numbers, names, dates, or outcomes. If a detail is not in the',
    '  article above, it does not belong in the brief.',
    '- Every brief MUST end its story text with the source as (Source: [name])',
    '- Each brief should be 80-120 words',
    '- Each brief needs: a bold headline, the story, and a "Kingdom Perspective" sentence',
    "- Frame every story through the lens of Jesus' lordship and Kingdom advancement",
    '- The Kingdom Perspective is yours to write; the STORY is not.',
    '',
    'Format each brief as:',
    '### [Headline]',
    '[Story text] (Source: [name])',
    '**Kingdom Perspective:** [One sentence connecting this to the bigger Kingdom picture]',
  ].join('\n');

  return await callGroqAI(buildSystemPrompt(), prompt);
}

async function generateKingdomLiving(content, monthName, year) {
  console.log('  Generating: Kingdom Living...');
  const theme = content.monthlyTheme || { theme: 'Kingdom Influence', focus: 'Carrying Kingdom authority into daily life' };

  const prompt = [
    'Write the "Kingdom Living" section for the ' + monthName + ' ' + year + ' newsletter.',
    '', 'Monthly Theme: ' + theme.theme, '',
    'Requirements:',
    '- 200-250 words',
    '- Provide practical, actionable guidance for living as a Kingdom citizen',
    '- Include 3-5 specific, practical action steps (not vague platitudes)',
    '- Cover multiple spheres: home, work, community, relationships',
    '- Include 1 scripture reference that grounds the practical advice',
    '- Tone: encouraging, practical, empowering',
    '',
    'The reader should finish this section knowing exactly what to do differently this month.',
  ].join('\n');

  return await callGroqAI(buildSystemPrompt(), prompt);
}

async function generatePrayerFocus(content, monthName, year) {
  console.log('  Generating: Prayer Focus...');
  const theme = content.monthlyTheme || { theme: 'Kingdom Advancement', focus: 'Praying for Kingdom breakthrough' };

  const prompt = [
    'Write the "Prayer Focus" section for the ' + monthName + ' ' + year + ' newsletter.',
    '', 'Monthly Theme: ' + theme.theme, '',
    'Requirements:',
    '- Create 5 prayer points for the month',
    '- Each prayer point should have: a bold title, 1-2 sentences of context, and a short prayer',
    '- Categories: 1) IFM ministry/members, 2) Local community (Southfield/Detroit), 3) Persecuted church globally, 4) Kingdom advancement in a sphere of society, 5) Personal spiritual growth',
    '- Each prayer should be specific, not generic',
    '- Include scripture references that fuel each prayer point',
    "- Prayers should reflect Kingdom theology: praying for God's will on EARTH",
    '',
    'Format:',
    '**[Prayer Title]**',
    '[Context sentence(s)]',
    '*Prayer: [Short prayer text]* ([Scripture reference])',
  ].join('\n');

  return await callGroqAI(buildSystemPrompt(), prompt);
}

async function generateScriptureFocus(content, monthName, year) {
  console.log('  Generating: Scripture of the Month...');
  const theme = content.monthlyTheme || { theme: 'The Reign of Christ', focus: 'Living under Kingdom authority' };

  const prompt = [
    'Write the "Scripture of the Month" section for the ' + monthName + ' ' + year + ' newsletter.',
    '', 'Monthly Theme: ' + theme.theme, '',
    'Requirements:',
    '- Select ONE powerful scripture passage (2-4 verses) related to the Kingdom of God and the monthly theme',
    '- Write the full scripture text (ESV, NKJV, or NIV)',
    '- Write a 150-200 word commentary that explains the passage in context, reveals the Kingdom dimension, connects to the monthly theme, and applies to daily life',
    '- Close with a "Meditation" prompt: one question for reflection',
    '',
    'IMPORTANT: Choose passages that emphasize the KINGSHIP of Jesus and the PRESENT REALITY of His Kingdom.',
    'Avoid overly familiar passages (like John 3:16) - dig deeper into scripture.',
    '',
    'Format:',
    '**[Book Chapter:Verses] ([Translation])**',
    '*"[Full scripture text]"*',
    '',
    '[Commentary]',
    '',
    '**Meditation:** [Question for reflection]',
  ].join('\n');

  return await callGroqAI(buildSystemPrompt(), prompt);
}

async function generateUpcoming(content, monthName, year) {
  console.log('  Generating: Upcoming at IFM...');

  // Calculate the first Saturday of the target month
  const monthIndex = new Date(monthName + ' 1, ' + year).getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  let firstSaturday = new Date(firstDay);
  while (firstSaturday.getDay() !== 6) {
    firstSaturday.setDate(firstSaturday.getDate() + 1);
  }
  const saturdayFormatted = format(firstSaturday, 'MMMM d, yyyy');

  const prompt = [
    'Write the "Upcoming at IFM" section for the ' + monthName + ' ' + year + ' newsletter.',
    '',
    'KNOWN EVENTS (always include these):',
    '1. Monthly In-Person Gathering: ' + saturdayFormatted + ' at 12:00 Noon',
    '   Location: 24301 Telegraph, Southfield, MI 48033',
    '2. Hour of Power (Online Teaching): Monday-Friday at 8:15 AM on Facebook Live',
    '',
    'Requirements:',
    '- List the known events with warm, inviting descriptions (2-3 sentences each)',
    '- Add 1-2 suggested seasonal activities for Kingdom citizens this month',
    '- Keep the section to 150-200 words',
    '- Include the Givelify link for giving: ' + config.ministry.social.givelify,
    '- Tone: welcoming, community-oriented, activating',
    '',
    'Format each event as:',
    '**[Event Name]** - [Date/Time]',
    '[Description]',
  ].join('\n');

  return await callGroqAI(buildSystemPrompt(), prompt);
}

// ---------------------------------------------------------------------------
// Main Newsletter Generator
// ---------------------------------------------------------------------------

async function generateNewsletter(content, month, year) {
  const monthName = format(new Date(year, month - 1, 1), 'MMMM');
  const dateString = format(new Date(year, month - 1, 1), 'MMMM yyyy');

  console.log('\n--- Generating Newsletter: ' + dateString + ' ---');

  // Generate sections sequentially (respects API rate limits)
  const pastoralMessage = await generatePastoralMessage(content, monthName, year);
  const kingdomIntelligence = await generateKingdomIntelligence(content, monthName, year);
  const kingdomLiving = await generateKingdomLiving(content, monthName, year);
  const prayerFocus = await generatePrayerFocus(content, monthName, year);
  const scriptureFocus = await generateScriptureFocus(content, monthName, year);
  const upcoming = await generateUpcoming(content, monthName, year);

  const newsletter = {
    metadata: {
      title: config.newsletter.title,
      subtitle: config.newsletter.subtitle,
      month, year, monthName, dateString,
      generatedAt: new Date().toISOString(),
      ministry: config.ministry.name,
      pastor: config.ministry.pastor,
      contentSource: content.isFallback ? 'fallback' : 'web',
      theme: content.monthlyTheme || null,
    },
    sections: {
      pastoralMessage: { title: 'From the Desk of Pastor Curtis', content: pastoralMessage },
      kingdomIntelligence: { title: 'Kingdom Intelligence', content: kingdomIntelligence },
      kingdomLiving: { title: 'Kingdom Living', content: kingdomLiving },
      prayerFocus: { title: 'Prayer Focus', content: prayerFocus },
      scriptureFocus: { title: 'Scripture of the Month', content: scriptureFocus },
      upcoming: { title: 'Upcoming at IFM', content: upcoming },
    },
  };

  console.log('Newsletter generation complete.');
  return newsletter;
}

module.exports = { generateNewsletter };