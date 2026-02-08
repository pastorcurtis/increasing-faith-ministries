/**
 * content-gatherer.js - Content Gathering Module
 *
 * Gathers Kingdom-related news and content from web sources (RSS feeds).
 * Falls back to curated content if web sources are unavailable.
 * Returns structured content objects for the newsletter generator.
 */

const fetch = require('node-fetch');
const cheerio = require('cheerio');
const config = require('./config');

/**
 * Fetches and parses a single RSS feed into structured articles.
 * @param {object} feedSource - { name, url } feed configuration
 * @returns {Promise<Array>} Array of article objects
 */
async function fetchRSSFeed(feedSource) {
  try {
    const response = await fetch(feedSource.url, {
      headers: { 'User-Agent': 'IFM-Newsletter-Agent/1.0' },
      timeout: 10000,
    });

    if (!response.ok) {
      console.log('  [WARN] Feed ' + feedSource.name + ' returned ' + response.status);
      return [];
    }

    const xml = await response.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const articles = [];

    // Parse RSS <item> elements
    $('item').each((i, el) => {
      if (i >= 5) return false;
      const title = $(el).find('title').first().text().trim();
      const link = $(el).find('link').first().text().trim();
      const description = $(el).find('description').first().text().trim();
      const pubDate = $(el).find('pubDate').first().text().trim();
      const category = $(el).find('category').first().text().trim();
      const cleanDescription = description.replace(/<[^>]*>/g, '').substring(0, 300);

      if (title) {
        articles.push({ title, link, description: cleanDescription, pubDate, category: category || 'General', source: feedSource.name });
      }
    });

    // Also try Atom <entry> format
    if (articles.length === 0) {
      $('entry').each((i, el) => {
        if (i >= 5) return false;
        const title = $(el).find('title').first().text().trim();
        const link = $(el).find('link').first().attr('href') || '';
        const summary = $(el).find('summary, content').first().text().trim();
        const published = $(el).find('published, updated').first().text().trim();
        const cleanSummary = summary.replace(/<[^>]*>/g, '').substring(0, 300);

        if (title) {
          articles.push({ title, link, description: cleanSummary, pubDate: published, category: 'General', source: feedSource.name });
        }
      });
    }

    console.log('  [OK] ' + feedSource.name + ': ' + articles.length + ' articles');
    return articles;
  } catch (error) {
    console.log('  [WARN] Feed ' + feedSource.name + ' failed: ' + error.message);
    return [];
  }
}

/**
 * Fetches content from all configured RSS feeds in parallel.
 */
async function gatherWebContent() {
  console.log('\n--- Gathering Web Content ---');
  const feedPromises = config.sources.rssFeeds.map((feed) => fetchRSSFeed(feed));
  const results = await Promise.allSettled(feedPromises);
  const allArticles = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.length > 0) {
      allArticles.push(...result.value);
    }
  }
  console.log('  Total articles gathered: ' + allArticles.length);
  return allArticles;
}

/**
 * Filters articles for Kingdom-relevance using keyword matching.
 */
function categorizeContent(articles) {
  const relevanceKeywords = [
    'kingdom', 'church', 'gospel', 'mission', 'revival', 'disciple',
    'persecution', 'faith', 'prayer', 'worship', 'christian', 'jesus',
    'lord', 'spirit', 'god', 'bible', 'scripture', 'ministry',
    'plant', 'evangel', 'believer', 'salvation', 'bapti', 'pastor',
    'community', 'transform', 'redemp', 'grace', 'mercy', 'hope',
  ];

  const scored = articles.map((article) => {
    const text = (article.title + ' ' + article.description).toLowerCase();
    let score = 0;
    for (const keyword of relevanceKeywords) {
      if (text.includes(keyword)) score += 1;
    }
    return { ...article, relevanceScore: score };
  });

  const relevant = scored.filter((a) => a.relevanceScore > 0).sort((a, b) => b.relevanceScore - a.relevanceScore);

  return {
    topStories: relevant.slice(0, 6),
    missionNews: relevant.filter((a) => /mission|plant|evangel|unreached/i.test(a.title + ' ' + a.description)).slice(0, 3),
    persecutionUpdates: relevant.filter((a) => /persecut|martyr|imprison|underground/i.test(a.title + ' ' + a.description)).slice(0, 3),
    revivalReports: relevant.filter((a) => /revival|awaken|movement|growth|bapti/i.test(a.title + ' ' + a.description)).slice(0, 3),
    cultureInfluence: relevant.filter((a) => /culture|societ|education|government|business|art|media|transform/i.test(a.title + ' ' + a.description)).slice(0, 3),
  };
}

/**
 * Returns curated fallback content so the newsletter can always generate.
 */
function getFallbackContent(month) {
  console.log('  [INFO] Using fallback content');
  const monthlyThemes = {
    1:  { theme: 'New Kingdom Beginnings', focus: 'Starting the year under Kingdom authority' },
    2:  { theme: 'Kingdom Love', focus: 'The radical, sacrificial love of King Jesus' },
    3:  { theme: 'Kingdom Advancement', focus: 'Pressing forward into new territory for the King' },
    4:  { theme: 'Resurrection Power', focus: 'Living in the power of the risen Christ' },
    5:  { theme: 'Kingdom Mothers', focus: 'Raising the next generation of Kingdom citizens' },
    6:  { theme: 'Kingdom Fathers', focus: 'Fatherhood as Kingdom leadership' },
    7:  { theme: 'Kingdom Freedom', focus: 'True freedom under the reign of Christ' },
    8:  { theme: 'Kingdom Education', focus: 'Developing a Kingdom worldview' },
    9:  { theme: 'Kingdom Harvest', focus: 'The harvest is plentiful - laboring for the Kingdom' },
    10: { theme: 'Kingdom Authority', focus: 'Walking in the authority Christ delegated to His Church' },
    11: { theme: 'Kingdom Gratitude', focus: 'Thanksgiving as a Kingdom discipline' },
    12: { theme: 'The King Has Come', focus: 'Advent - celebrating the arrival of the King' },
  };
  const current = monthlyThemes[month] || monthlyThemes[1];

  const fallbackStories = [
    { title: 'Underground Church Growth Continues in Restricted Nations', description: 'Despite increasing persecution, the underground church continues to grow in nations where Christianity is restricted. Reports indicate that house churches are multiplying as believers share the gospel with boldness.', source: 'Kingdom Intelligence Report', category: 'Persecution & Growth' },
    { title: 'Church Planting Movements Accelerate Across Global South', description: 'Church planting movements in Africa, Asia, and Latin America continue to accelerate, with thousands of new congregations forming as the gospel penetrates unreached communities.', source: 'Kingdom Intelligence Report', category: 'Missions' },
    { title: 'Christians Making Impact in Business and Marketplace', description: 'Kingdom-minded entrepreneurs and business leaders are increasingly using their platforms to advance Kingdom values, create jobs, and demonstrate the lordship of Christ in the marketplace.', source: 'Kingdom Intelligence Report', category: 'Kingdom Influence' },
    { title: 'Global Prayer Movement Intensifies', description: 'Prayer movements around the world are growing in intensity and unity, with millions joining in coordinated intercession for revival, persecuted believers, and Kingdom breakthrough.', source: 'Kingdom Intelligence Report', category: 'Prayer' },
    { title: 'Youth Revival Sweeping College Campuses', description: 'A fresh wave of spiritual awakening is being reported on college campuses, with students committing to radical discipleship and Kingdom living in the face of cultural pressure.', source: 'Kingdom Intelligence Report', category: 'Revival' },
    { title: 'Christian Education Initiatives Transforming Communities', description: 'Kingdom-centered education initiatives are transforming communities by equipping students with both academic excellence and a biblical worldview rooted in the lordship of Christ.', source: 'Kingdom Intelligence Report', category: 'Education' },
  ];

  return {
    topStories: fallbackStories,
    missionNews: [fallbackStories[1]],
    persecutionUpdates: [fallbackStories[0]],
    revivalReports: [fallbackStories[4]],
    cultureInfluence: [fallbackStories[2], fallbackStories[5]],
    monthlyTheme: current,
    isFallback: true,
  };
}

/**
 * Main entry point: gathers content from web, falls back to curated content.
 */
async function gatherContent(month, year) {
  console.log('\nGathering content for ' + month + '/' + year + '...');
  let articles = [];
  try {
    articles = await gatherWebContent();
  } catch (error) {
    console.log('  [WARN] Web content gathering failed: ' + error.message);
  }

  let content;
  if (articles.length > 0) {
    content = categorizeContent(articles);
    content.isFallback = false;
  } else {
    content = getFallbackContent(month);
  }

  if (!content.monthlyTheme) {
    content.monthlyTheme = getFallbackContent(month).monthlyTheme;
  }

  content.metadata = {
    month, year,
    gatheredAt: new Date().toISOString(),
    articleCount: articles.length,
    usedFallback: content.isFallback,
  };

  console.log('Content gathering complete. Articles: ' + articles.length + ', Fallback: ' + content.isFallback);
  return content;
}

module.exports = { gatherContent, gatherWebContent, categorizeContent, getFallbackContent };