// Gera ícones e splash da PWA (DESIGN.md §10): monograma "N" geométrico em Volt
// sobre --bg-0, com arco de anel parcial (75%) em volta.
// Uso: node scripts/generate-icons.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const BG = "#05060A";
const VOLT = "#C8FF2E";
const LINE = "rgba(255,255,255,0.12)";
const out = path.resolve("public/icons");
fs.mkdirSync(out, { recursive: true });

/** Arte em viewBox 100×100. `safe` encolhe para a zona segura do maskable. */
function iconSvg({ safe = 1 } = {}) {
  const r = 38 * safe;
  const c = 2 * Math.PI * r;
  const sw = 4.5 * safe;
  // "N" geométrico: duas hastes + diagonal, traço reto.
  const s = safe;
  const x0 = 50 - 15 * s, x1 = 50 + 15 * s, y0 = 50 - 17 * s, y1 = 50 + 17 * s;
  const t = 6.5 * s;
  const n = `M${x0} ${y1} V${y0} H${x0 + t} L${x1 - t} ${y1 - 9 * s} V${y0} H${x1} V${y1} H${x1 - t} L${x0 + t} ${y0 + 9 * s} V${y1} Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="${BG}"/>
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="${LINE}" stroke-width="${sw}"/>
  <circle cx="50" cy="50" r="${r}" fill="none" stroke="${VOLT}" stroke-width="${sw}" stroke-linecap="round"
    stroke-dasharray="${(c * 0.75).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 50 50)"/>
  <path d="${n}" fill="${VOLT}"/>
</svg>`;
}

function splashSvg(w, h) {
  const size = Math.round(w * 0.28);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="${BG}"/>
  <svg x="${(w - size) / 2}" y="${(h - size) / 2}" width="${size}" height="${size}" viewBox="0 0 100 100">
    ${iconSvg().replace(/<\/?svg[^>]*>/g, "").replace(/<rect[^>]*\/>/, "")}
  </svg>
</svg>`;
}

const jobs = [
  ["icon-192.png", 192, iconSvg()],
  ["icon-512.png", 512, iconSvg()],
  ["icon-maskable-512.png", 512, iconSvg({ safe: 0.78 })],
  ["apple-touch-icon.png", 180, iconSvg()],
];
for (const [name, size, svg] of jobs) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(out, name));
}
fs.writeFileSync(path.join(out, "icon.svg"), iconSvg());

// Splash iPhone 11 Pro (1125×2436 @3x) — retrato.
await sharp(Buffer.from(splashSvg(1125, 2436))).png().toFile(path.join(out, "splash-1125x2436.png"));

console.log("Ícones gerados em", out);
