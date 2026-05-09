/**
 * Local visual test for the quote graphic renderer.
 * Generates 3 sample graphics so we can review the design before going live.
 */

const path = require('path');
const fs = require('fs');
const { renderQuoteGraphic } = require('./graphic');

const samples = [
  {
    name: 'sample-1-short.png',
    quote: 'Faith is built in the storm, not the stillness.',
    attribution: 'Matthew 6:33',
  },
  {
    name: 'sample-2-medium.png',
    quote: 'You were not called to survive your generation. You were called to shift it.',
    attribution: 'Pastoral Word',
  },
  {
    name: 'sample-3-long.png',
    quote: 'The Kingdom does not advance through comfort. It advances through conviction, through prayer, and through people who refuse to bow.',
    attribution: 'Kingdom Teaching',
  },
];

(async () => {
  const outDir = path.join(__dirname, 'test-output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const s of samples) {
    const outPath = path.join(outDir, s.name);
    await renderQuoteGraphic({ quote: s.quote, attribution: s.attribution, outputPath: outPath });
    console.log(`Generated: ${outPath}`);
  }

  console.log(`\nDone. Open the folder to review:\n  ${outDir}`);
})();
