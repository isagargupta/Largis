// Renders the Largis mark (app/icon.svg on the website) into the PNGs Expo needs.
// Usage: npm i --no-save sharp && npm run icons
import { mkdir } from "node:fs/promises";
import sharp from "sharp";

const out = new URL("../assets/", import.meta.url).pathname;

/** The mark on a 32-unit grid, spanning 5–27. */
function mark({ ink = "#ffffff", accent = "#7b8ef0" } = {}) {
  return `<path d="M5 5h6v16h16v6H5z" fill="${ink}"/><rect x="17" y="5" width="10" height="10" fill="${accent}"/>`;
}

/** `scale` is the share of the canvas the 22-unit mark occupies. */
function svg({ size, scale, background, ink, accent }) {
  const view = 22 / scale;
  const offset = 16 - view / 2;
  const bg = background ? `<rect x="${offset}" y="${offset}" width="${view}" height="${view}" fill="${background}"/>` : "";
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${offset} ${offset} ${view} ${view}">${bg}${mark({ ink, accent })}</svg>`,
  );
}

const files = [
  ["icon.png", { size: 1024, scale: 0.56, background: "#0a1628" }],
  ["android-icon-foreground.png", { size: 1024, scale: 0.42 }],
  ["android-icon-monochrome.png", { size: 1024, scale: 0.42, accent: "#ffffff" }],
  ["splash-icon.png", { size: 512, scale: 0.9 }],
  ["notification-icon.png", { size: 96, scale: 0.7, accent: "#ffffff" }],
  ["favicon.png", { size: 48, scale: 0.7, background: "#0a1628" }],
];

await mkdir(out, { recursive: true });
for (const [name, opts] of files) {
  await sharp(svg(opts)).png().toFile(`${out}${name}`);
  console.log("wrote", name);
}
