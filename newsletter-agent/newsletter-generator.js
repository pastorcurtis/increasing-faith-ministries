/**
 * newsletter-generator.js - AI-Powered Newsletter Content Generator
 *
 * Takes gathered content and generates a complete Kingdom-centered newsletter
 * using the Groq AI API (llama-3.1-8b-instant model).
 */

require('dotenv').config();
const fetch = require('node-fetch');
const { format } = require('date-fns');
const config = require('./config');

// ---------------------------------------------------------------------------
// Groq AI API Caller with retry logic
// ---------------------------------------------------------------------------

async function callGroqAI(systemPrompt, userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set. Check your .env file.');

  let lastError;
  for (let attempt = 1; attempt <= config.ai.maxRetries; attempt++) {
    try {
      const response = await fetch(config.ai.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
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

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error('Groq API ' + response.status + ': ' + errorBody);
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content.trim();
      }
      throw new Error('Unexpected API response structure');
    } catch (error) {
      lastError = error;
      console.log('  [RETRY ' + attempt + '/' + config.ai.maxRetries + '] ' + error.message);
      if (attempt < config.ai.maxRetries) {
        const delay = config.ai.retryDelayMs * attempt;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw new Error('Groq API failed after ' + config.ai.maxRetries + ' attempts: ' + lastError.message);
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
  const stories = content.topStories || [];
  if (stories.length > 0) {
    stories.forEach((story, i) => {
      newsContext += (i + 1) + '. ' + story.title + ' (' + story.source + ')\n';
      newsContext += '   ' + story.description + '\n\n';
    });
  } else {
    newsContext += '(No specific articles gathered - generate based on known global Kingdom developments)\n';
  }

  const prompt = [
    'Write the "Kingdom Intelligence" section for the ' + monthName + ' ' + year + ' newsletter.',
    '', newsContext,
    'Requirements:',
    '- Write exactly 3 news briefs about the Kingdom of God advancing globally',
    '- Each brief should be 80-120 words',
    '- Each brief needs: a bold headline, the story, and a "Kingdom Perspective" sentence',
    '- Cover diverse topics: missions, church growth, cultural influence, persecution/resilience, prayer movements',
    "- Frame every story through the lens of Jesus' lordship and Kingdom advancement",
    '',
    'Format each brief as:',
    '### [Headline]',
    '[Story text]',
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