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
      prompt: 'Write a short, powerful pastoral encouragement from Pastor Curtis. Tone: warm, authoritative, fatherly. Should feel like a personal word from the pastor to the reader. End with a charge or declaration, then close with a direct question that invites the reader to share their experience or respond in the comments.',
    },
    1: { // Monday
      type: 'kingdom_teaching',
      label: 'Kingdom Teaching',
      page: 'https://increasingfaith.net/teachings.html',
      cta: 'Watch the full teaching',
      prompt: 'Write a concise Kingdom teaching moment. Pick a specific topic (marriage, finances, identity, authority, purpose, work, parenting, spiritual warfare, prayer, discipleship). Teach one sharp insight that shifts perspective. Include 1 scripture. Make the reader feel like they just got a revelation. End with a thought-provoking question that challenges the reader to apply this teaching to their own life — something that makes them want to comment their answer.',
    },
    2: { // Tuesday
      type: 'scripture_reflection',
      label: 'Scripture of the Day',
      page: 'https://increasingfaith.net/journey.html',
      cta: 'Start your Kingdom journey',
      prompt: 'Select a powerful scripture about the Kingdom of God, Jesus\' lordship, or spiritual authority. Write the verse, then a 2-3 sentence reflection that makes it feel urgent and relevant today. Avoid cliche interpretations — find the Kingdom dimension. End with a "fill in the blank" or direct question that invites people to share what this scripture means to them personally.',
    },
    3: { // Wednesday
      type: 'engagement_question',
      label: 'Kingdom Conversation',
      page: 'https://increasingfaith.net/community.html',
      cta: 'Join our community',
      prompt: 'Write an interactive community post. Pick ONE of these formats randomly:\n- "This or That": Give two Kingdom perspectives and ask which one resonates more (e.g., "Faith is built in the storm vs. Faith is built in the stillness — which has been true for you?")\n- "Finish this sentence": Start a powerful statement and let the audience complete it (e.g., "The moment I stopped playing church and started living Kingdom was when ______")\n- "Unpopular opinion": Share a bold Kingdom perspective and ask if people agree or disagree\n- "Real talk": Ask a vulnerable, real-life question about faith struggles people actually face\nThe post should be short (2-4 sentences max) to keep the focus on the QUESTION, not the content. Make it impossible to scroll past without wanting to respond.',
    },
    4: { // Thursday
      type: 'prayer_focus',
      label: 'Prayer Focus',
      page: 'https://increasingfaith.net/prayer.html',
      cta: 'Submit your prayer request',
      prompt: 'Write a focused prayer point for the day. Include: the topic (family, city, nation, church, workplace, health, purpose), a brief context sentence, and a short written prayer. The prayer should be specific, declarative, and Kingdom-minded — not passive or begging. After the prayer, invite the community to participate: ask them to drop a prayer emoji if they are standing in agreement, or to share their own prayer request in the comments.',
    },
    5: { // Friday
      type: 'newsletter_teaser',
      label: 'Kingdom Intelligence',
      page: 'https://increasingfaith.net/newsletter.html',
      cta: 'Read the full Kingdom Report',
      prompt: 'Write a teaser for The Kingdom Report newsletter. Share one compelling insight, news item, or teaching preview that makes people want to read the full newsletter. Create urgency without clickbait. Tone: insider knowledge, exclusive intelligence. End by asking the audience a question related to the teaser topic — draw them into discussion before they even click the link.',
    },
    6: { // Saturday
      type: 'event_reminder',
      label: 'Worship Reminder',
      page: 'https://increasingfaith.net/visit.html',
      cta: 'Join us for worship',
      prompt: 'Write an inviting, warm reminder about IFM worship gatherings. Monthly in-person: First Saturday at 12 Noon, 24301 Telegraph, Southfield MI. Daily online: Hour of Power, Mon-Fri 8:15 AM on Facebook Live. Make it feel like a personal invitation, not an announcement. End with a question like "Who\'s joining us?" or "Tag someone who needs this word" to drive comments and shares.',
    },
  },

  // Platform-specific formatting rules
  platforms: {
    facebook: {
      maxLength: 500,
      style: 'Longer, conversational. Use line breaks for readability. Can be more detailed. End every post with a clear invitation for the reader to comment, share, or engage.',
      hashtagCount: 3,
      linkPlacement: 'end',
    },
    instagram: {
      maxLength: 400,
      style: 'Visual language, punchy lines. Use line breaks and spacing. Hashtags in a separate block at the end. End with an engagement prompt — a question or "double tap if..."',
      hashtagCount: 10,
      linkPlacement: 'bio_reference', // "Link in bio"
    },
    tiktok: {
      maxLength: 300,
      style: 'Casual but authoritative. Speak directly. Pattern-interrupt opening. End with a hook question or "comment below" prompt.',
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
    'NEVER use: "let me know in the comments" — instead use natural conversation starters.',
    'DO use: Declarative statements, Kingdom authority, prophetic confidence.',
    'DO use: Direct questions that challenge the reader to reflect and respond.',
    'Write as a spiritually grounded, biblically literate, direct-speaking leader.',
    'Every post should position Pastor Curtis and IFM as THE authority on Kingdom living.',
    'Every post should feel like a CONVERSATION, not a broadcast. Invite the reader into dialogue.',
  ].join('\n'),

  // Engagement hooks — randomly appended to clip posts for variety
  clipCaptions: [
    'This word right here. Who needed to hear this today?',
    'Watch this and tell me it did not shift something in you.',
    'If this spoke to your spirit, share it with someone who needs it.',
    'Real Kingdom teaching. Drop an AMEN if you receive this.',
    'This is the word for somebody today. Tag them below.',
    'Stop scrolling. This is for you. What stood out?',
    'Most people will scroll past this. Kingdom citizens will not.',
    'How many of you have been believing the wrong thing about this?',
    'Listen to this twice. Then tell me what the Spirit revealed to you.',
    'This changes everything once you understand it. Agree or disagree?',
    'Somebody in your circle needs this word today. Share it.',
    'This is not church as usual. This is Kingdom.',
    'Play this for someone who thinks they know the Bible.',
    'The truth cuts deep, but it sets you free. Who felt that?',
    'I challenge you to listen to this and not be changed.',
  ],

  // Hashtag banks by category
  hashtags: {
    core: ['#KingdomOfGod', '#IncreasingFaith', '#IFM', '#KingdomLiving'],
    teaching: ['#BibleTeaching', '#KingdomTeaching', '#SpiritualGrowth', '#Discipleship'],
    marriage: ['#ChristianMarriage', '#KingdomMarriage', '#MarriageAdvice'],
    prayer: ['#Prayer', '#KingdomPrayer', '#PrayerFocus', '#Intercession'],
    faith: ['#Faith', '#Jesus', '#JesusIsLord', '#KingdomCitizen'],
    community: ['#ChurchFamily', '#KingdomCommunity', '#Southfield', '#Detroit'],
    engagement: ['#KingdomConversation', '#RealTalk', '#FaithTalk', '#KingdomMindset'],
  },

  ai: {
    model: 'llama-3.1-8b-instant',
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    maxTokens: 1024,
    temperature: 0.85, // Slightly higher for more creative, varied content
    maxRetries: 3,
    retryDelayMs: 3000,
  },
};
