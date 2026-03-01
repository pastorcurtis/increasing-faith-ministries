/**
 * IFM Social Media Agent — Configuration
 * Content strategy, brand voice, and platform settings
 */

module.exports = {
  ministry: {
    name: 'Increasing Faith Ministries',
    pastor: 'Pastor Curtis Stephens Jr.',
    website: 'https://increasingfaith.net',
    location: 'Southfield, MI',
    tagline: 'Advancing the Reign of God',
  },

  // Rotating daily content themes — each drives to a specific page
  dailyThemes: {
    0: { // Sunday
      type: 'pastoral_word',
      label: 'Pastoral Word',
      page: 'https://increasingfaith.net/about.html',
      cta: 'Learn more about our mission',
      prompt: 'Write a short, powerful pastoral encouragement from Pastor Curtis. Tone: warm, authoritative, fatherly. Should feel like a personal word from the pastor to the reader. End with a charge or declaration.',
    },
    1: { // Monday
      type: 'kingdom_teaching',
      label: 'Kingdom Teaching',
      page: 'https://increasingfaith.net/teachings.html',
      cta: 'Watch the full teaching',
      prompt: 'Write a concise Kingdom teaching moment. Pick a specific topic (marriage, finances, identity, authority, purpose, work, parenting, spiritual warfare, prayer, discipleship). Teach one sharp insight that shifts perspective. Include 1 scripture. Make the reader feel like they just got a revelation.',
    },
    2: { // Tuesday
      type: 'scripture_reflection',
      label: 'Scripture of the Day',
      page: 'https://increasingfaith.net/journey.html',
      cta: 'Start your Kingdom journey',
      prompt: 'Select a powerful scripture about the Kingdom of God, Jesus\' lordship, or spiritual authority. Write the verse, then a 2-3 sentence reflection that makes it feel urgent and relevant today. Avoid cliche interpretations — find the Kingdom dimension.',
    },
    3: { // Wednesday
      type: 'engagement_question',
      label: 'Kingdom Question',
      page: 'https://increasingfaith.net/community.html',
      cta: 'Join our community',
      prompt: 'Write a thought-provoking question about faith, Kingdom living, marriage, purpose, or spiritual growth. The question should challenge assumptions and spark real conversation. Follow with 1-2 sentences of context that frame why this question matters. Make people want to comment.',
    },
    4: { // Thursday
      type: 'prayer_focus',
      label: 'Prayer Focus',
      page: 'https://increasingfaith.net/prayer.html',
      cta: 'Submit your prayer request',
      prompt: 'Write a focused prayer point for the day. Include: the topic (family, city, nation, church, workplace, health, purpose), a brief context sentence, and a short written prayer. The prayer should be specific, declarative, and Kingdom-minded — not passive or begging.',
    },
    5: { // Friday
      type: 'newsletter_teaser',
      label: 'Kingdom Intelligence',
      page: 'https://increasingfaith.net/newsletter.html',
      cta: 'Read the full Kingdom Report',
      prompt: 'Write a teaser for The Kingdom Report newsletter. Share one compelling insight, news item, or teaching preview that makes people want to read the full newsletter. Create urgency without clickbait. Tone: insider knowledge, exclusive intelligence.',
    },
    6: { // Saturday
      type: 'event_reminder',
      label: 'Worship Reminder',
      page: 'https://increasingfaith.net/visit.html',
      cta: 'Join us for worship',
      prompt: 'Write an inviting, warm reminder about IFM worship gatherings. Monthly in-person: First Saturday at 12 Noon, 24301 Telegraph, Southfield MI. Daily online: Hour of Power, Mon-Fri 8:15 AM on Facebook Live. Make it feel like a personal invitation, not an announcement.',
    },
  },

  // Platform-specific formatting rules
  platforms: {
    facebook: {
      maxLength: 500,
      style: 'Longer, conversational. Use line breaks for readability. Can be more detailed.',
      hashtagCount: 3,
      linkPlacement: 'end',
    },
    instagram: {
      maxLength: 400,
      style: 'Visual language, punchy lines. Use line breaks and spacing. Hashtags in a separate block at the end.',
      hashtagCount: 10,
      linkPlacement: 'bio_reference', // "Link in bio"
    },
    x: {
      maxLength: 270, // Leave room for link
      style: 'Sharp, direct, quotable. One strong statement. No fluff.',
      hashtagCount: 2,
      linkPlacement: 'end',
    },
    tiktok: {
      maxLength: 300,
      style: 'Casual but authoritative. Speak directly. Pattern-interrupt opening.',
      hashtagCount: 5,
      linkPlacement: 'bio_reference',
    },
  },

  // Brand voice guidelines injected into every AI prompt
  brandVoice: [
    'Tone: Calm but commanding. Direct but not emotional. Strong but not theatrical.',
    'Language: Intelligent, scripture-backed, masculine clarity.',
    'NEVER use: "smash the like button", generic church cliches, emotional hype, influencer language.',
    'NEVER use: "in these uncertain times", "more than ever", "I just want to encourage you".',
    'DO use: Declarative statements, Kingdom authority, prophetic confidence.',
    'Write as a spiritually grounded, biblically literate, direct-speaking leader.',
    'Every post should position Pastor Curtis and IFM as THE authority on Kingdom living.',
  ].join('\n'),

  // Hashtag banks by category
  hashtags: {
    core: ['#KingdomOfGod', '#IncreasingFaith', '#IFM', '#KingdomLiving'],
    teaching: ['#BibleTeaching', '#KingdomTeaching', '#SpiritualGrowth', '#Discipleship'],
    marriage: ['#ChristianMarriage', '#KingdomMarriage', '#MarriageAdvice'],
    prayer: ['#Prayer', '#KingdomPrayer', '#PrayerFocus', '#Intercession'],
    faith: ['#Faith', '#Jesus', '#JesusIsLord', '#KingdomCitizen'],
    community: ['#ChurchFamily', '#KingdomCommunity', '#Southfield', '#Detroit'],
  },

  ai: {
    model: 'llama-3.1-8b-instant',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    maxTokens: 1024,
    temperature: 0.8, // Slightly higher for creative social content
    maxRetries: 3,
    retryDelayMs: 3000,
  },
};
