/**
 * IFM Website Ad Agent — Configuration
 *
 * Drives a single daily Facebook post whose ONLY job is to send people to
 * increasingfaith.net. This is deliberately separate from the daily teaching
 * post in config.js: that one is content-first with a link at the bottom,
 * this one is invitation-first.
 *
 * Rotation is keyed by JS getDay() (0 = Sunday). Each day targets a different
 * page so the ad never repeats itself and every part of the site gets traffic.
 */

const brand = require('./config');

// Angle notes are written FOR the model, not for the reader. They describe the
// emotional job of the ad, not the words to use — the brand voice rules in
// config.js supply the tone.
const dailyAds = {
  0: { // Sunday
    label: 'Start Here',
    page: 'https://increasingfaith.net/',
    button: 'START HERE',
    hashtagSet: 'faith',
    angle:
      'Speak to someone who has been circling faith from a distance and has never had a clear front door. ' +
      'The site is that front door. Do not summarize the ministry — give one reason to walk in today.',
    fallback: {
      headline: 'You do not have to have it figured out to begin.',
      subhead: 'Everything we teach, pray, and build starts in one place.',
      hook: 'Some of you have been circling faith for years without a front door.',
      body: 'This is the door. Teaching, prayer, community, and a clear path forward — all in one place, all open to you right now. You do not need credentials. You need a starting point.',
    },
  },
  1: { // Monday
    label: 'Teachings',
    page: 'https://increasingfaith.net/teachings.html',
    button: 'WATCH THE TEACHING',
    hashtagSet: 'teaching',
    angle:
      'Speak to someone starting a hard work week spiritually underfed. The teaching library is already there, ' +
      'already free, already waiting. Make the gap between what they need and what they can have feel one click wide.',
    fallback: {
      headline: 'You went into this week empty. That was avoidable.',
      subhead: 'The teaching library is free, and it is already waiting on you.',
      hook: 'Monday exposes what you did not build on Sunday.',
      body: 'Every teaching we have is sitting on the site right now — no cost, no login, no schedule to keep. The word you needed this morning was already there. Go get it before Tuesday looks the same.',
    },
  },
  2: { // Tuesday
    label: 'Prayer',
    page: 'https://increasingfaith.net/prayer.html',
    button: 'SEND YOUR REQUEST',
    hashtagSet: 'prayer',
    angle:
      'Speak to someone carrying something they have not said out loud to anyone. Emphasize that a real request ' +
      'goes to real people who pray over it — no appointment, no membership, no performance required.',
    fallback: {
      headline: 'Your prayer request does not need an appointment.',
      subhead: 'Send it now. Real people will pray over it by name.',
      hook: 'Some of you are carrying something you have not said out loud to anyone.',
      body: 'You do not have to be a member. You do not have to word it right. You do not have to explain why you waited this long. Send the request — we pray over every single one.',
    },
  },
  3: { // Wednesday
    label: 'Visit',
    page: 'https://increasingfaith.net/visit.html',
    button: 'PLAN YOUR VISIT',
    hashtagSet: 'community',
    angle:
      'Speak to someone who has thought about coming but never made the move. Concrete details lower the fear: ' +
      'in-person First Saturday 12 Noon at 24301 Telegraph, Southfield MI; online Hour of Power weekdays 8:15 AM. ' +
      'Make showing up feel simple, not scary.',
    fallback: {
      headline: 'You have thought about coming. Here is how.',
      subhead: 'First Saturday, 12 Noon — 24301 Telegraph, Southfield MI.',
      hook: 'The hardest part of showing up is not knowing what showing up looks like.',
      body: 'In person: First Saturday at 12 Noon, 24301 Telegraph, Southfield MI. Online: Hour of Power, weekday mornings at 8:15. That is it. No dress code to decode, no ritual to learn first. Come as you are and see.',
    },
  },
  4: { // Thursday
    label: 'Community',
    page: 'https://increasingfaith.net/community.html',
    button: 'FIND YOUR PEOPLE',
    hashtagSet: 'community',
    angle:
      'Speak to someone who is spiritually alone — believes, but has no one around them who does. ' +
      'Name the loneliness honestly, then point to the discipleship community as the answer.',
    fallback: {
      headline: 'Believing alone is not the same as believing wrong.',
      subhead: 'But it is harder than it has to be. Find your people.',
      hook: 'Some of you believe deeply and have absolutely no one around you who does.',
      body: 'That is not a character flaw. That is isolation, and isolation makes strong faith feel fragile. We build discipleship community for exactly this. You were never meant to carry it by yourself.',
    },
  },
  5: { // Friday
    label: 'Kingdom Report',
    page: 'https://increasingfaith.net/newsletter.html',
    button: 'GET THE REPORT',
    hashtagSet: 'teaching',
    angle:
      'Speak to someone who wants substance instead of another feed full of noise. The Kingdom Report is ' +
      'monthly intelligence delivered to their inbox. Frame it as signal, not newsletter spam.',
    fallback: {
      headline: 'Your feed is loud. Very little of it is signal.',
      subhead: 'The Kingdom Report: monthly substance, straight to your inbox.',
      hook: 'You do not need more content. You need something worth keeping.',
      body: 'The Kingdom Report goes out monthly — teaching, insight, and what is actually happening in this ministry. No filler, no daily noise, nothing sold to you. Subscribe once and read something that holds up.',
    },
  },
  6: { // Saturday
    label: 'Give',
    page: 'https://increasingfaith.net/give.html',
    button: 'SOW INTO THE WORK',
    hashtagSet: 'core',
    angle:
      'Speak to a partner, not a donor. Giving here funds discipleship and Kingdom influence. ' +
      'Be dignified and direct — never guilt, never begging, never urgency theater.',
    fallback: {
      headline: 'Partners build this. Not audiences.',
      subhead: 'Your giving funds discipleship, teaching, and Kingdom reach.',
      hook: 'There is a difference between watching a work and carrying one.',
      body: 'Every teaching posted, every prayer answered by this house, every person discipled — partners make it possible. If this ministry has fed you, consider standing behind it. Give as one who owns the mission.',
    },
  },
};

module.exports = {
  ministry: brand.ministry,
  brandVoice: brand.brandVoice,
  hashtags: brand.hashtags,
  ai: brand.ai,

  dailyAds,

  copy: {
    // The bold line rendered large on the graphic. Short enough to stay huge.
    headlineMaxChars: 62,
    // The supporting line under the headline on the graphic. Kept short
    // enough to wrap to at most two lines at the rendered size.
    subheadMaxChars: 96,
    // The Facebook caption body (excludes hook, link line, and hashtags).
    bodyMaxChars: 320,
    hashtagCount: 3,
    // Higher than the teaching post's retry count because the register guard
    // in ad.js rejects on tone, not just on malformed output. A rejection is
    // an ordinary event here, not an error.
    maxAttempts: 5,
  },
};
