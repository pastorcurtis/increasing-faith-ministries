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
    model: 'llama-3.1-8b-instant',
    maxTokens: 4096,
    temperature: 0.7,
    // Retry settings for API calls
    maxRetries: 3,
    retryDelayMs: 2000,
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
    contentDir: '../../content/newsletters',
    latestJson: '../../content/newsletters/latest.json',
    archiveIndex: '../../content/newsletters/archive.json',
  },

  // ---------------------------------------------------------------------------
  // Web Sources for Content Gathering
  // ---------------------------------------------------------------------------
  sources: {
    rssFeeds: [
      { name: 'Christianity Today', url: 'https://www.christianitytoday.com/feed/' },
      { name: 'Desiring God', url: 'https://www.desiringgod.org/feeds/all' },
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