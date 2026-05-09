/**
 * IFM Social Media Agent — Quote Graphic Renderer
 * Generates a 1080x1080 branded image with the post's "money line" + scripture
 * Uses brand colors from increasingfaith.net: black, purple-dark (#2d1b4e), gold (#ffd700)
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
  purpleDark: '#2d1b4e',
  gold: '#ffd700',
  goldSoft: 'rgba(255, 215, 0, 0.15)',
  white: '#ffffff',
  whiteSoft: 'rgba(255, 255, 255, 0.7)',
};

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

function fitFontSize(ctx, text, fontFamily, maxWidth, maxHeight, startSize, minSize = 36) {
  let size = startSize;
  while (size >= minSize) {
    ctx.font = `bold ${size}px "${fontFamily}"`;
    const lines = wrapText(ctx, text, maxWidth);
    const lineHeight = size * 1.25;
    const totalHeight = lines.length * lineHeight;
    if (totalHeight <= maxHeight) return { size, lines, lineHeight };
    size -= 4;
  }
  ctx.font = `bold ${minSize}px "${fontFamily}"`;
  return { size: minSize, lines: wrapText(ctx, text, maxWidth), lineHeight: minSize * 1.25 };
}

async function renderQuoteGraphic({ quote, attribution, outputPath }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');

  // -- Background gradient: black → purple-dark (top-left to bottom-right) --
  const bgGradient = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bgGradient.addColorStop(0, COLORS.black);
  bgGradient.addColorStop(0.6, '#150a26');
  bgGradient.addColorStop(1, COLORS.purpleDark);
  ctx.fillStyle = bgGradient;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // -- Subtle gold radial glow (top-right) --
  const glow = ctx.createRadialGradient(SIZE * 0.78, SIZE * 0.22, 0, SIZE * 0.78, SIZE * 0.22, SIZE * 0.55);
  glow.addColorStop(0, 'rgba(255, 215, 0, 0.18)');
  glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // -- Thin gold border frame --
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, SIZE - 80, SIZE - 80);

  // -- Top label: "INCREASING FAITH MINISTRIES" small caps --
  ctx.fillStyle = COLORS.gold;
  ctx.font = '500 22px "Montserrat"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const label = 'INCREASING FAITH MINISTRIES';
  ctx.fillText(label, SIZE / 2, 95);

  // -- Decorative line under label --
  const labelWidth = ctx.measureText(label).width;
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIZE / 2 - labelWidth / 2 - 20, 130);
  ctx.lineTo(SIZE / 2 + labelWidth / 2 + 20, 130);
  ctx.stroke();

  // -- Fixed layout anchors (independent of quote length) --
  const QUOTE_AREA_TOP = 180;
  const ATTRIBUTION_Y = SIZE - 290;          // fixed: ~50px above logo
  const QUOTE_AREA_BOTTOM = ATTRIBUTION_Y - 40;
  const QUOTE_AREA_CENTER = (QUOTE_AREA_TOP + QUOTE_AREA_BOTTOM) / 2;
  const QUOTE_AREA_HEIGHT = QUOTE_AREA_BOTTOM - QUOTE_AREA_TOP;

  // -- The quote (centered in its zone, auto-fit Playfair Display) --
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const maxQuoteWidth = SIZE - 240;
  const { size: quoteSize, lines: quoteLines, lineHeight } =
    fitFontSize(ctx, `“${quote}”`, 'Playfair Display', maxQuoteWidth, QUOTE_AREA_HEIGHT, 72, 38);

  ctx.font = `bold ${quoteSize}px "Playfair Display"`;
  const totalQuoteHeight = quoteLines.length * lineHeight;
  const quoteStartY = QUOTE_AREA_CENTER - (totalQuoteHeight / 2) + (lineHeight / 2);
  quoteLines.forEach((line, i) => {
    ctx.fillText(line, SIZE / 2, quoteStartY + i * lineHeight);
  });

  // -- Attribution at FIXED position (immune to quote length) --
  if (attribution) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'italic 30px "Montserrat"';
    ctx.textBaseline = 'middle';
    ctx.fillText(`— ${attribution}`, SIZE / 2, ATTRIBUTION_Y);
  }

  // -- Bottom: IFM logo + URL --
  try {
    const logo = await loadImage(path.join(ASSETS, 'ifm-logo-gold.png'));
    const logoH = 110;
    const logoW = (logo.width / logo.height) * logoH;
    ctx.drawImage(logo, (SIZE - logoW) / 2, SIZE - 215, logoW, logoH);
  } catch (err) {
    // logo missing — skip silently, URL still renders
  }

  ctx.fillStyle = COLORS.whiteSoft;
  ctx.font = '500 22px "Montserrat"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('increasingfaith.net', SIZE / 2, SIZE - 80);

  // -- Save --
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

module.exports = { renderQuoteGraphic };
