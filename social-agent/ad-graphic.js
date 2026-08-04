/**
 * IFM Website Ad Agent — Ad Graphic Renderer
 *
 * Renders a 1080x1080 branded ad card. Deliberately a DIFFERENT layout from
 * graphic.js (the quote card): headline + subhead + a call-to-action button,
 * built to read as an invitation rather than a quotable line.
 *
 * Brand colors match increasingfaith.net: black, purple-dark (#2d1b4e),
 * gold (#ffd700). The header lockup is intentionally identical to the quote
 * card so both post types still read as the same ministry.
 */

const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, 'assets');

GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'PlayfairDisplay-Bold.ttf'), 'Playfair Display');
GlobalFonts.registerFromPath(path.join(ASSETS, 'fonts', 'Montserrat-Regular.ttf'), 'Montserrat');

const SIZE = 1080;

const COLORS = {
  black: '#0a0a0a',
  purpleMid: '#150a26',
  purpleDark: '#2d1b4e',
  gold: '#ffd700',
  white: '#ffffff',
  whiteSoft: 'rgba(255, 255, 255, 0.72)',
};

// Fixed layout anchors. Every element below sits at a constant Y so that a
// long headline can never push the button or logo off the card — the same
// lesson the quote card learned the hard way.
const LAYOUT = {
  labelY: 95,
  labelRuleY: 130,
  headlineTop: 250,
  headlineBottom: 640,
  subheadTop: 670,
  // Two lines is the hard ceiling: a third line at 42px leading would run
  // under the button, which sits at a fixed Y.
  subheadMaxLines: 2,
  buttonCenterY: 812,
  buttonHeight: 78,
  logoTop: 884,
  logoHeight: 74,
  urlTop: 978,
};

// Rotating glow position keeps the daily feed from looking rubber-stamped
// while every other brand element stays fixed. Indexed by day of week.
const GLOW_POSITIONS = [
  [0.78, 0.22], [0.22, 0.20], [0.80, 0.72], [0.50, 0.15],
  [0.20, 0.75], [0.85, 0.45], [0.15, 0.42],
];

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitFontSize(ctx, text, fontFamily, maxWidth, maxHeight, startSize, minSize) {
  let size = startSize;
  while (size >= minSize) {
    ctx.font = `bold ${size}px "${fontFamily}"`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = size * 1.18;
    if (lines.length * lineHeight <= maxHeight) return { size, lines, lineHeight };
    size -= 4;
  }
  ctx.font = `bold ${minSize}px "${fontFamily}"`;
  return { size: minSize, lines: wrapText(ctx, text, maxWidth), lineHeight: minSize * 1.18 };
}

// Hand-rolled rather than ctx.roundRect() so the renderer does not depend on
// a specific @napi-rs/canvas version exposing that method.
function roundedRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

async function renderAdGraphic({ headline, subhead, button, day = 0, outputPath }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // -- Background gradient: black -> purple-dark --
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, COLORS.black);
  bg.addColorStop(0.6, COLORS.purpleMid);
  bg.addColorStop(1, COLORS.purpleDark);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // -- Gold radial glow, position rotates by weekday --
  const [gx, gy] = GLOW_POSITIONS[day % GLOW_POSITIONS.length];
  const glow = ctx.createRadialGradient(SIZE * gx, SIZE * gy, 0, SIZE * gx, SIZE * gy, SIZE * 0.6);
  glow.addColorStop(0, 'rgba(255, 215, 0, 0.20)');
  glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // -- Gold border frame --
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, SIZE - 80, SIZE - 80);

  // -- Header lockup (matches the quote card for brand continuity) --
  ctx.fillStyle = COLORS.gold;
  ctx.font = '500 22px "Montserrat"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const label = 'INCREASING FAITH MINISTRIES';
  ctx.fillText(label, SIZE / 2, LAYOUT.labelY);

  const labelWidth = ctx.measureText(label).width;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIZE / 2 - labelWidth / 2 - 20, LAYOUT.labelRuleY);
  ctx.lineTo(SIZE / 2 + labelWidth / 2 + 20, LAYOUT.labelRuleY);
  ctx.stroke();

  // -- Headline: vertically centered inside its fixed zone --
  const headlineZoneHeight = LAYOUT.headlineBottom - LAYOUT.headlineTop;
  const maxHeadlineWidth = SIZE - 200;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const { size: hSize, lines: hLines, lineHeight: hLineHeight } =
    fitFontSize(ctx, headline, 'Playfair Display', maxHeadlineWidth, headlineZoneHeight, 92, 44);

  ctx.font = `bold ${hSize}px "Playfair Display"`;
  ctx.fillStyle = COLORS.white;
  const headlineCenter = (LAYOUT.headlineTop + LAYOUT.headlineBottom) / 2;
  const headlineStartY = headlineCenter - (hLines.length * hLineHeight) / 2 + hLineHeight / 2;
  hLines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, headlineStartY + i * hLineHeight);
  });

  // -- Subhead: fixed top, clipped to a maximum line count --
  if (subhead) {
    ctx.font = '400 30px "Montserrat"';
    ctx.fillStyle = COLORS.whiteSoft;
    ctx.textBaseline = 'top';
    const subLines = wrapText(ctx, subhead, SIZE - 260).slice(0, LAYOUT.subheadMaxLines);
    subLines.forEach((line, i) => {
      ctx.fillText(line, SIZE / 2, LAYOUT.subheadTop + i * 42);
    });
  }

  // -- Call-to-action button: gold pill, dark label --
  if (button) {
    ctx.font = '600 28px "Montserrat"';
    const textWidth = ctx.measureText(button).width;
    const btnW = Math.min(textWidth + 96, SIZE - 200);
    const btnH = LAYOUT.buttonHeight;
    const btnX = (SIZE - btnW) / 2;
    const btnY = LAYOUT.buttonCenterY - btnH / 2;

    roundedRectPath(ctx, btnX, btnY, btnW, btnH, btnH / 2);
    ctx.fillStyle = COLORS.gold;
    ctx.fill();

    ctx.fillStyle = COLORS.black;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(button, SIZE / 2, LAYOUT.buttonCenterY + 1);
  }

  // -- Logo --
  try {
    const logo = await loadImage(path.join(ASSETS, 'ifm-logo-gold.png'));
    const logoH = LAYOUT.logoHeight;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (SIZE - logoW) / 2, LAYOUT.logoTop, logoW, logoH);
  } catch (err) {
    // Logo missing — skip silently, the URL below still carries the brand.
  }

  // -- URL --
  ctx.fillStyle = COLORS.gold;
  ctx.font = '600 26px "Montserrat"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('increasingfaith.net', SIZE / 2, LAYOUT.urlTop);

  fs.writeFileSync(outputPath, canvas.toBuffer('image/png'));
  return outputPath;
}

module.exports = { renderAdGraphic };
