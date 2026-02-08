/**
 * index.js - IFM Newsletter Agent Entry Point
 *
 * Orchestrates the full newsletter generation pipeline:
 *   1. Gather content from web sources
 *   2. Generate newsletter sections via Groq AI
 *   3. Publish JSON, HTML, and update archive
 *
 * Usage:
 *   node index.js                          # Generate for current month
 *   node index.js --month 3 --year 2026    # Generate for specific month
 *   node index.js --dry-run                # Generate but do not save files
 */

require('dotenv').config();
const { gatherContent } = require('./content-gatherer');
const { generateNewsletter } = require('./newsletter-generator');
const { publishNewsletter } = require('./publish');

// ---------------------------------------------------------------------------
// Parse Command Line Arguments
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--month':
        options.month = parseInt(args[++i], 10);
        if (isNaN(options.month) || options.month < 1 || options.month > 12) {
          console.error('Invalid month. Must be 1-12.');
          process.exit(1);
        }
        break;
      case '--year':
        options.year = parseInt(args[++i], 10);
        if (isNaN(options.year) || options.year < 2020) {
          console.error('Invalid year.');
          process.exit(1);
        }
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      default:
        console.log('Unknown option: ' + args[i]);
        console.log('Usage: node index.js [--month N] [--year N] [--dry-run]');
        process.exit(1);
    }
  }

  return options;
}

// ---------------------------------------------------------------------------
// Main Pipeline
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  const options = parseArgs();

  console.log('======================================================');
  console.log('  IFM NEWSLETTER AGENT - The Kingdom Report');
  console.log('======================================================');
  console.log('  Target: ' + options.month + '/' + options.year);
  console.log('  Mode:   ' + (options.dryRun ? 'DRY RUN (no files saved)' : 'LIVE'));
  console.log('  API:    Groq (llama-3.1-8b-instant)');
  console.log('======================================================');

  // Verify API key is available
  if (!process.env.GROQ_API_KEY) {
    console.error('\nERROR: GROQ_API_KEY not found in environment.');
    console.error('Create a .env file with your Groq API key.');
    console.error('See .env.example for the template.');
    process.exit(1);
  }

  try {
    // Step 1: Gather Content
    console.log('\n[Step 1/3] Gathering content...');
    const content = await gatherContent(options.month, options.year);

    // Step 2: Generate Newsletter via AI
    console.log('\n[Step 2/3] Generating newsletter with AI...');
    const newsletter = await generateNewsletter(content, options.month, options.year);

    // Step 3: Publish (unless dry run)
    if (options.dryRun) {
      console.log('\n[Step 3/3] DRY RUN - Skipping publish.');
      console.log('\n--- Generated Newsletter Preview ---');
      console.log(JSON.stringify(newsletter.metadata, null, 2));
      console.log('\nSections generated:');
      for (const [key, section] of Object.entries(newsletter.sections)) {
        const preview = section.content.substring(0, 100) + '...';
        console.log('  ' + section.title + ': ' + preview);
      }
    } else {
      console.log('\n[Step 3/3] Publishing newsletter...');
      const result = await publishNewsletter(newsletter);
      console.log('\n--- Published Files ---');
      console.log('  JSON:    ' + result.jsonPath);
      console.log('  HTML:    ' + result.htmlPath);
      console.log('  Latest:  ' + result.latestPath);
      console.log('  Archive: ' + result.archivePath + ' (' + result.archiveEntries + ' entries)');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n======================================================');
    console.log('  COMPLETE - ' + elapsed + 's elapsed');
    console.log('======================================================');
  } catch (error) {
    console.error('\nFATAL ERROR: ' + error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();