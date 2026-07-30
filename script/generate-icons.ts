/**
 * Makes the app icons (the pictures Android and the browser show for the app)
 * out of the school logo.
 *
 * The finished icons are committed to the repo, so you only need to run this
 * again if the logo changes. It needs the `sharp` image library, which is not a
 * normal dependency of this project because it is only used here:
 *
 *   npm install --no-save sharp
 *   npx tsx script/generate-icons.ts
 *
 * Why two sets of icons?
 *   * "any"      -> shown as-is (browser tabs, install prompts).
 *   * "maskable" -> Android crops the icon into whatever shape the phone uses
 *                   (circle, squircle, rounded square). Anything outside the
 *                   middle can be cut off, so the logo is drawn smaller with
 *                   plenty of white space around it.
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

const SOURCE_LOGO = path.resolve(import.meta.dirname, "..", "logo.png.jpeg");
const ICON_DIR = path.resolve(import.meta.dirname, "..", "client", "public", "icons");
const PUBLIC_DIR = path.resolve(import.meta.dirname, "..", "client", "public");

// The logo is navy and red on white, so white is the right backdrop.
const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };

/** How much of the icon width the logo is allowed to fill, per icon kind. */
const FILL = {
  any: 0.92, // nearly edge to edge
  apple: 0.86, // iOS rounds the corners, so leave a little room
  maskable: 0.62, // must survive an aggressive circular crop
};

/** The logo with the surrounding white border cut off. */
async function trimmedLogo(): Promise<Buffer> {
  return sharp(SOURCE_LOGO)
    .trim({ threshold: 20 }) // drop the plain white margin
    .toBuffer();
}

/** Draws the logo centred on a square white canvas of the given size. */
async function square(logo: Buffer, size: number, fill: number, outFile: string) {
  const box = Math.round(size * fill);

  const scaledLogo = await sharp(logo)
    .resize(box, box, { fit: "inside", withoutEnlargement: false })
    .toBuffer();

  await sharp({
    create: { width: size, height: size, channels: 4, background: WHITE },
  })
    .composite([{ input: scaledLogo, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);

  console.log(`  ${path.basename(outFile)} (${size}x${size})`);
}

async function main() {
  await mkdir(ICON_DIR, { recursive: true });
  const logo = await trimmedLogo();

  console.log("standard icons:");
  for (const size of [48, 72, 96, 144, 192, 256, 384, 512]) {
    await square(logo, size, FILL.any, path.join(ICON_DIR, `icon-${size}.png`));
  }

  console.log("maskable icons (extra padding for Android's icon shapes):");
  for (const size of [192, 512]) {
    await square(logo, size, FILL.maskable, path.join(ICON_DIR, `maskable-${size}.png`));
  }

  console.log("iOS home-screen icon:");
  await square(logo, 180, FILL.apple, path.join(ICON_DIR, "apple-touch-icon.png"));

  console.log("browser tab icon:");
  await square(logo, 128, FILL.any, path.join(PUBLIC_DIR, "favicon.png"));

  console.log("\nDone. Icons written to client/public/icons/.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
