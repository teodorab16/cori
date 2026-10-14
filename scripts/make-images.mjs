// Draws the link-preview image (public/og.jpg) and the icons from code, so they stay on-brand
// and never show one design over another. Text is turned into outlines with opentype.js, then
// sharp renders the SVG. Run with: npm run images
import { readFileSync, writeFileSync } from 'node:fs';
import opentypeModule from 'opentype.js';
import sharp from 'sharp';

const opentype = opentypeModule.default ?? opentypeModule;
const root = new URL('..', import.meta.url);

const PAPER = '#F5F3EE';
const CARD = '#FBFAF7';
const INK = '#161514';
const INK_3 = '#5E5A54';
const HEART = 'M12 20.5c-.4 0-.8-.1-1.1-.4C6.6 16.6 2.5 13.2 2.5 9 2.5 6.2 4.6 4 7.3 4c1.9 0 3.6 1 4.7 2.6C13.1 5 14.8 4 16.7 4c2.7 0 4.8 2.2 4.8 5 0 4.2-4.1 7.6-8.4 11.1-.3.3-.7.4-1.1.4z';
// The collection's colours (src/data/designs.ts), shown equally as hearts.
const COLLECTION = ['#EDD7BF', '#A9B98A', '#F3B7C2', '#232120', '#F6D55C', '#26315F'];

function loadFont(path) {
  const buf = readFileSync(new URL(`node_modules/${path}`, root));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

const bold = loadFont('@fontsource/familjen-grotesk/files/familjen-grotesk-latin-700-normal.woff');
// DM Mono's slashed zero trips up the SVG renderer, so the small caps line uses the sans.
const medium = loadFont('@fontsource/familjen-grotesk/files/familjen-grotesk-latin-500-normal.woff');

// Text as an SVG path, with tracking (em) and kerning. Returns the path data and its width.
function text(font, str, x, y, size, tracking = 0) {
  const scale = size / font.unitsPerEm;
  const glyphs = Array.from(str).map((c) => font.charToGlyph(c)); // no shaping needed for plain Latin
  let d = '';
  let cx = x;
  glyphs.forEach((g, i) => {
    d += g.getPath(cx, y, size).toPathData(2);
    cx += g.advanceWidth * scale + tracking * size;
    if (i < glyphs.length - 1) cx += (font.getKerningValue(g, glyphs[i + 1]) || 0) * scale;
  });
  return { d, width: cx - x };
}

// An "i" with its dot removed: keep every contour except the topmost one.
function dotlessI(x, y, size) {
  const glyph = bold.charToGlyph('i');
  const contours = [];
  for (const c of glyph.getPath(x, y, size).commands) {
    if (c.type === 'M') contours.push([]);
    contours.at(-1).push(c);
  }
  const top = (cs) => Math.min(...cs.filter((c) => 'y' in c).map((c) => c.y));
  const dot = contours.reduce((a, b) => (top(a) < top(b) ? a : b));
  const n = (v) => +v.toFixed(2);
  const d = contours
    .filter((cs) => cs !== dot)
    .flat()
    .map((c) => {
      if (c.type === 'M' || c.type === 'L') return `${c.type}${n(c.x)} ${n(c.y)}`;
      if (c.type === 'C') return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      if (c.type === 'Q') return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      return 'Z';
    })
    .join('');
  return { d, width: glyph.advanceWidth * (size / bold.unitsPerEm) };
}

// The wordmark: "cor" + a dotless i whose dot is the heart.
function wordmark(x, baseline, size, heartFill) {
  const tracking = -0.055;
  const stem = text(bold, 'cor', x, baseline, size, tracking);
  const i = dotlessI(x + stem.width, baseline, size);
  const xHeight = (bold.tables.os2.sxHeight || 0.53 * bold.unitsPerEm) / bold.unitsPerEm;
  const heartSize = 0.31 * size;
  const iCentre = x + stem.width + i.width / 2;
  const heartTop = baseline - xHeight * size - 0.03 * size - heartSize;
  const heart = `<path d="${HEART}" fill="${heartFill}" transform="translate(${iCentre} ${heartTop + heartSize / 2}) rotate(-8) scale(${heartSize / 24}) translate(-12 -12)"/>`;
  return `<path d="${stem.d}${i.d}" fill="${INK}"/>${heart}`;
}

function heart(cx, cy, size, fill, rotate = 0, stroke = false) {
  const s = size / 24;
  const outline = stroke ? ` stroke="${INK}" stroke-width="${1.6 / s}"` : '';
  return `<path d="${HEART}" fill="${fill}"${outline} transform="translate(${cx} ${cy}) rotate(${rotate}) scale(${s}) translate(-12 -12)"/>`;
}

// A neutral line drawing of a vest: same geometry as the "Pack it" illustration.
function vest(x, y, scale) {
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${INK}" stroke-linecap="round" stroke-linejoin="round">
    <path d="M96 22 Q150 74 204 22 L214 298 Q150 314 86 298 Z" fill="#E7E3DB" stroke="none"/>
    <circle cx="150" cy="44" r="6" stroke-width="2.5"/>
    <path d="M90 18 L124 18 C126 70 134 102 142 124 L144 294 Q102 304 58 278 L56 144 C80 130 90 82 90 18 Z" fill="#FFFFFF" stroke-width="3"/>
    <path d="M210 18 L176 18 C174 70 166 102 158 124 L156 294 Q198 304 242 278 L244 144 C220 130 210 82 210 18 Z" fill="#FFFFFF" stroke-width="3"/>
    <path d="M70 150 C92 140 116 138 136 142 M230 150 C208 140 184 138 164 142" stroke-width="2.5"/>
    <path d="M62 182 C88 176 112 174 138 176 L139 262 C112 272 86 268 62 256 M238 182 C212 176 188 174 162 176 L161 262 C188 272 214 268 238 256" stroke-width="2.5"/>
    <path d="M146 200 L154 240 M154 200 L146 240" stroke-width="3"/>
    <g fill="${INK}" stroke="none"><rect x="134" y="196" width="11" height="8" rx="2"/><rect x="155" y="196" width="11" height="8" rx="2"/><rect x="134" y="236" width="11" height="8" rx="2"/><rect x="155" y="236" width="11" height="8" rx="2"/></g>
  </g>`;
}

async function og() {
  const W = 1200;
  const H = 630;
  const line1 = text(bold, 'Running vests that', 80, 330, 66, -0.045);
  const line2 = text(bold, 'go to brunch.', 80, 400, 66, -0.045);
  const meta1 = text(medium, 'COLLECTION 00 · HELP US CHOOSE', 82, 484, 21, 0.1);
  const meta2 = text(medium, '£45 LAUNCH PRICE · NOTHING TO PAY', 82, 518, 21, 0.1);
  const hearts = [
    [770, 120, 46, -14],
    [1118, 150, 40, 12],
    [748, 300, 36, 8],
    [1140, 340, 44, -10],
    [790, 520, 40, 14],
    [1102, 528, 46, -6],
  ]
    .map(([cx, cy, size, rot], i) => heart(cx, cy, size, COLLECTION[i], rot, COLLECTION[i] === '#EDD7BF' || COLLECTION[i] === '#F6D55C'))
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    ${wordmark(76, 218, 196, INK)}
    <path d="${line1.d}${line2.d}" fill="${INK}"/>
    <path d="${meta1.d}${meta2.d}" fill="${INK_3}"/>
    <rect x="772" y="86" width="350" height="458" rx="40" fill="${CARD}" stroke="rgba(22,21,20,0.12)" stroke-width="2"/>
    ${vest(800, 140, 0.98)}
    ${hearts}
  </svg>`;
  await sharp(Buffer.from(svg)).jpeg({ quality: 88, mozjpeg: true }).toFile(new URL('public/og.jpg', root).pathname);
}

function iconSvg(size, radius) {
  const h = size * 0.56;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${INK}"/>
    ${heart(size / 2, size / 2 + size * 0.02, h, PAPER, -8)}
  </svg>`;
}

async function icons() {
  writeFileSync(new URL('public/favicon.svg', root), iconSvg(32, 8).replace(/\n\s*/g, ''));
  await sharp(Buffer.from(iconSvg(180, 0))).png().toFile(new URL('public/apple-touch-icon.png', root).pathname);
  await sharp(Buffer.from(iconSvg(512, 112))).png().toFile(new URL('public/icon-512.png', root).pathname);
}

await og();
await icons();
console.log('Wrote public/og.jpg, favicon.svg, apple-touch-icon.png, icon-512.png');
