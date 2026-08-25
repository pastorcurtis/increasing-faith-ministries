/**
 * config.js - Newsletter Agent Configuration
 * 
 * Central configuration for Increasing Faith Ministries newsletter generation.
 * All ministry details, content categories, and API settings live here.
 */

const config = {
  // ---------------------------------------------------------------------------
  // Ministry Details
  // ---------------------------------------------------------------------------
  ministry: {
    name: 'Increasing Faith Ministries',
    abbreviation: 'IFM',
    tagline: 'Advancing the Reign of God',
    pastor: 'Curtis Stephens Jr.',
    email: 'increasingfaithministry@gmail.com',
    website: 'https://increasingfaith.net',
    location: '24301 Telegraph, Southfield, MI 48033',
    social: {
      facebook: 'https://www.facebook.com/IFMinistry',
      instagram: 'https://www.instagram.com/hourofpowerextra',
      youtube: 'https://www.youtube.com/@thehourofpowerextra2883/shorts',
      tiktok: 'https://www.tiktok.com/@hourofpower4',
      givelify: 'https://giv.li/129ina',
    },
    serviceTimes: {
      inPerson: 'First Saturday of each month at 12:00 Noon',
      online: 'Monday-Friday at 8:15 AM on Facebook Live',
    },
  },

  // ---------------------------------------------------------------------------
  // Mission & Theology (fed to AI for content alignment)
  // ---------------------------------------------------------------------------
  mission: 'Making mature disciples who proclaim the Kingdom, form counter-cultural community, and carry Kingdom influence into every sphere of society.',

  theology: {
    core: [
      'Jesus is Lord over all creation - every sphere, every domain, every nation.',
      'The Kingdom of God is a present reality breaking into the world now, not only a future hope.',
      'The gospel is the announcement of Jesus\u0027 lordship over all things, not merely personal salvation.',
      'Discipleship means forming mature Kingdom citizens who think, live, and influence like Jesus.',
      'The Church is called to be a counter-cultural community - an embassy of the Kingdom on earth.',
      'Kingdom influence must penetrate every sphere of society: education, government, business, arts, family, media, and religion.',
      'The Holy Spirit empowers believers to live as agents of Kingdom transformation.',
    ],
    emphases: [
      'Kingdom of God as central message',
      'Lordship of Jesus Christ',
      'Making mature disciples (not just converts)',
      'Counter-cultural community',
      'Kingdom influence in every sphere',
      'Present reality of the Kingdom',
      'Holistic gospel (not sacred/secular divide)',
    ],
  },

  // ---------------------------------------------------------------------------
  // Newsletter Content Categories
  // ---------------------------------------------------------------------------
  categories: {
    kingdomTeaching: {
      name: 'Kingdom Teaching',
      description: 'Deep theological instruction on the Kingdom of God',
      section: 'From the Desk of Pastor Curtis',
    },
    globalKingdomNews: {
      name: 'Global Kingdom News',
      description: 'Reports of the Kingdom advancing worldwide',
      section: 'Kingdom Intelligence',
      topics: [
        'missions and church planting',
        'church growth and revival reports',
        'persecution updates and the persecuted church',
        'Kingdom influence in culture and society',
        'Christian impact in education, government, business, and arts',
        'global prayer movements',
      ],
    },
    kingdomLiving: {
      name: 'Kingdom Living',
      description: 'Practical application of Kingdom principles for daily life',
      section: 'Kingdom Living',
    },
    prayerFocus: {
      name: 'Prayer Focus',
      description: 'Monthly prayer points and intercession themes',
      section: 'Prayer Focus',
    },
    scriptureFocus: {
      name: 'Scripture Focus',
      description: 'Featured scripture with Kingdom-centered commentary',
      section: 'Scripture of the Month',
    },
  },

  // ---------------------------------------------------------------------------
  // Groq AI API Settings
  // ---------------------------------------------------------------------------
  ai: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    // Groq retired the Llama chat lineup on 2026-08-17 (404 model_not_found).
    // gpt-oss-120b is the current Groq-served replacement.
    model: 'openai/gpt-oss-120b',
    // gpt-oss is a reasoning model; 'low' keeps thinking tokens off the bill
    // without touching the quality of the visible newsletter copy.
    reasoningEffort: 'low',
    maxTokens: 4096,
    temperature: 0.7,
    // Retry settings for API calls
    maxRetries: 5,
    retryDelayMs: 2000,

    // Provider chain -- tried in order, skipping any whose env var is unset.
    // Mirrors social-agent/config.js. Kept as its own copy rather than imported
    // because newsletter-agent is a separate package with its own node_modules;
    // a cross-package require would couple their installs together.
    //
    // Until 2026-08-25 this agent had ONE provider and no fallback, so a Groq
    // outage on the 1st of a month lost that month's newsletter outright -- and
    // it carried the same retired Llama model that took the social agent down
    // for 8 days, which nothing would have revealed until Sept 1.
    //
    // Four legs, THREE failure domains. Two Groq entries share a key and a
    // vendor, so they cover a bad model or a busy bucket but NOT a Groq-wide
    // outage; the OpenRouter legs are what actually survive that, and they are
    // split across different upstreams so they do not share a rate-limit pool.
    providers: [
      {
        name: 'Groq (gpt-oss-120b)',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        envVar: 'GROQ_API_KEY',
        model: 'openai/gpt-oss-120b',
        extraHeaders: {},
        // Reasoning models bill hidden thinking against max_tokens.
        extraBody: { reasoning_effort: 'low' },
      },
      {
        name: 'Groq (gpt-oss-20b)',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        envVar: 'GROQ_API_KEY',
        model: 'openai/gpt-oss-20b',
        extraHeaders: {},
        extraBody: { reasoning_effort: 'low' },
      },
      {
        // Google AI Studio upstream. Instruction-tuned, so it cannot leak
        // reasoning into the copy -- which is why it is ordered ahead of
        // nemotron despite being the one rate-limited during testing.
        name: 'OpenRouter (gemma)',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        envVar: 'OPENROUTER_API_KEY',
        model: 'google/gemma-4-31b-it:free',
        extraHeaders: {
          'HTTP-Referer': 'https://increasingfaith.net',
          'X-Title': 'IFM Newsletter Agent',
        },
      },
      {
        // NVIDIA upstream -- a different rate-limit pool from the gemma leg.
        //
        // CAUTION: by default this model writes its deliberation as the answer
        // itself ("We need to produce..."), in plain prose with no <think> tags
        // to strip. Of the four documented suppressions, ONLY
        // reasoning:{enabled:false} works -- include_reasoning:false,
        // reasoning:{exclude:true} and reasoning_effort:'low' all still leak.
        // Do not "simplify" this. newsletter-generator.js screens every reply
        // as a backstop.
        name: 'OpenRouter (nemotron)',
        url: 'https://openrouter.ai/api/v1/chat/completions',
        envVar: 'OPENROUTER_API_KEY',
        model: 'nvidia/nemotron-3-super-120b-a12b:free',
        extraHeaders: {
          'HTTP-Referer': 'https://increasingfaith.net',
          'X-Title': 'IFM Newsletter Agent',
        },
        extraBody: { reasoning: { enabled: false } },
      },
    ],
  },

  // ---------------------------------------------------------------------------
  // Newsletter Metadata
  // ---------------------------------------------------------------------------
  newsletter: {
    title: 'The Kingdom Report',
    subtitle: 'Monthly Intelligence from Increasing Faith Ministries',
    sections: [
      'From the Desk of Pastor Curtis',
      'Kingdom Intelligence',
      'Kingdom Living',
      'Prayer Focus',
      'Scripture of the Month',
      'Upcoming at IFM',
    ],
  },

  // ---------------------------------------------------------------------------
  // File Output Paths (relative to this agent directory)
  // ---------------------------------------------------------------------------
  paths: {
    contentDir: '../content/newsletters',
    latestJson: '../content/newsletters/latest.json',
    archiveIndex: '../content/newsletters/archive.json',
  },

  // ---------------------------------------------------------------------------
  // Web Sources for Content Gathering
  // ---------------------------------------------------------------------------
  sources: {
    rssFeeds: [
      { name: 'Christianity Today', url: 'https://www.christianitytoday.com/feed/' },
      // desiringgod.org serves 403 to this fetcher on every direct feed path
      // (/feeds/all, /feeds/all.rss, /blog.rss all refuse). The FeedBurner
      // mirror is the same content and answers 200. Dead since at least
      // 2026-08 — it was 1 of 5 sources failing in silence.
      { name: 'Desiring God', url: 'https://feeds.feedburner.com/DesiringGodBlog' },
      { name: 'The Gospel Coalition', url: 'https://www.thegospelcoalition.org/feed/' },
      { name: 'Mission Network News', url: 'https://www.mnnonline.org/feed/' },
      { name: 'International Christian Concern', url: 'https://www.persecution.org/feed/' },
    ],
    searchTerms: [
      'Kingdom of God global news',
      'church growth revival report',
      'Christian missions update',
      'persecuted church news',
      'Kingdom influence society culture',
      'church planting movement',
    ],
  },
};

module.exports = config;