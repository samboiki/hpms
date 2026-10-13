// Draws every OneHealth icon and splash screen (white ring on deep teal) as PNG files. No dependencies.
//
//   node scripts/make-app-icons.js        (npm run cap:icons)
//
// Writes the web app icons (public/icons) and, when the native projects exist, the Android launcher icons and
// splash screens (android/app/src/main/res) and the iOS app icon and splash screen (ios/App/App/Assets.xcassets).
// Run it again after changing the design here, or after `npx cap add` has recreated a native project.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEAL = [15, 118, 110]; // #0f766e, the app's theme colour
const WHITE = [255, 255, 255];

// The ring as drawn on the web icons: radii as a fraction of the icon's side
const ICON_RING = { outer: 0.3, inner: 0.19 };
// Android adaptive icons are cut from the middle 72dp of a 108dp layer: this keeps the ring the same size as above
const ADAPTIVE_RING = { outer: 0.2, inner: 0.2 * (ICON_RING.inner / ICON_RING.outer) };
// Splash screens are cropped to fill the screen: a ring about 100dp/pt across on a phone
const ANDROID_SPLASH_RING = { outer: 0.1, inner: 0.1 * (ICON_RING.inner / ICON_RING.outer) };
const IOS_SPLASH_RING = { outer: 0.06, inner: 0.06 * (ICON_RING.inner / ICON_RING.outer) };

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
// channels 4 = RGBA (colour type 6); 3 = RGB without an alpha channel (colour type 2), which the App Store requires
const encodePng = (width, height, pixels, channels) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = channels === 4 ? 6 : 2;
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
};

/**
 * shape: 'full' = opaque teal rectangle, 'rounded' = rounded square with transparent corners,
 *        'circle' = teal disc with transparent corners, 'none' = only the white ring on transparent (adaptive layer)
 * ring:  { outer, inner } radii as a fraction of the shorter side
 * rgb:   write a 'full' image without an alpha channel (the App Store rejects icons that have one)
 */
const draw = (width, height, shape, ring, { rgb = false } = {}) => {
  const size = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const outer = size * ring.outer;
  const inner = size * ring.inner;
  const radius = size * 0.22; // corner radius of the rounded square
  const opaque = rgb && shape === 'full';
  const channels = opaque ? 3 : 4;
  const pixels = Buffer.alloc(width * height * channels);
  const SS = 4; // 4x4 supersampling for smooth edges
  const total = SS * SS;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let bg = 0;
      let onRing = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          let inside = true;
          if (shape === 'rounded') {
            const dx = Math.max(radius - px, 0, px - (width - radius));
            const dy = Math.max(radius - py, 0, py - (height - radius));
            inside = dx * dx + dy * dy <= radius * radius;
          } else if (shape === 'circle') {
            inside = Math.hypot(px - cx, py - cy) <= size / 2;
          }
          if (!inside) continue;
          bg++;
          const d = Math.hypot(px - cx, py - cy);
          if (d <= outer && d >= inner) onRing++;
        }
      }
      const i = (y * width + x) * channels;
      if (shape === 'none') {
        WHITE.forEach((v, k) => (pixels[i + k] = v));
        pixels[i + 3] = Math.round((onRing / total) * 255);
        continue;
      }
      const t = bg ? onRing / bg : 0;
      for (let k = 0; k < 3; k++) pixels[i + k] = Math.round(TEAL[k] + (WHITE[k] - TEAL[k]) * t);
      if (!opaque) pixels[i + 3] = Math.round((bg / total) * 255);
    }
  }
  return encodePng(width, height, pixels, channels);
};

const write = (relPath, png) => {
  const file = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
  console.log(`${relPath}  ${Math.round(png.length / 102.4) / 10} KB`);
};

// Web app (PWA): manifest icons, iPhone home-screen icon and favicon
write('public/icons/pwa-192x192.png', draw(192, 192, 'rounded', ICON_RING));
write('public/icons/pwa-512x512.png', draw(512, 512, 'rounded', ICON_RING));
write('public/icons/maskable-512x512.png', draw(512, 512, 'full', ICON_RING));
write('public/icons/apple-touch-icon.png', draw(180, 180, 'full', ICON_RING));
write('public/icons/favicon-48x48.png', draw(48, 48, 'rounded', ICON_RING));

// Android: launcher icons for every screen density. Android 8+ builds the icon from the ring layer
// (ic_launcher_foreground) on the teal colour in res/values/ic_launcher_background.xml; older versions use the PNGs.
const ANDROID_RES = 'android/app/src/main/res';
if (fs.existsSync(path.join(ROOT, ANDROID_RES))) {
  const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [density, scale] of Object.entries(densities)) {
    const icon = 48 * scale;
    const layer = 108 * scale;
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher.png`, draw(icon, icon, 'rounded', ICON_RING));
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher_round.png`, draw(icon, icon, 'circle', ICON_RING));
    write(`${ANDROID_RES}/mipmap-${density}/ic_launcher_foreground.png`, draw(layer, layer, 'none', ADAPTIVE_RING));
  }
  // Splash screen images (the sizes of Capacitor's template). Android 12+ shows the launcher icon on the teal
  // windowSplashScreenBackground instead (res/values/styles.xml), which looks the same.
  const splashes = {
    drawable: [480, 320],
    'drawable-land-mdpi': [480, 320],
    'drawable-land-hdpi': [800, 480],
    'drawable-land-xhdpi': [1280, 720],
    'drawable-land-xxhdpi': [1600, 960],
    'drawable-land-xxxhdpi': [1920, 1280],
    'drawable-port-mdpi': [320, 480],
    'drawable-port-hdpi': [480, 800],
    'drawable-port-xhdpi': [720, 1280],
    'drawable-port-xxhdpi': [960, 1600],
    'drawable-port-xxxhdpi': [1280, 1920]
  };
  for (const [folder, [width, height]] of Object.entries(splashes)) {
    write(`${ANDROID_RES}/${folder}/splash.png`, draw(width, height, 'full', ANDROID_SPLASH_RING, { rgb: true }));
  }
} else {
  console.log('android/ not found: skipped the Android icons (run `npx cap add android` first)');
}

// iOS: one 1024px App Store icon (iOS rounds the corners itself) and the launch screen image
const IOS_ASSETS = 'ios/App/App/Assets.xcassets';
if (fs.existsSync(path.join(ROOT, IOS_ASSETS))) {
  write(`${IOS_ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`, draw(1024, 1024, 'full', ICON_RING, { rgb: true }));
  const splash = draw(2732, 2732, 'full', IOS_SPLASH_RING, { rgb: true });
  for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
    write(`${IOS_ASSETS}/Splash.imageset/${name}`, splash);
  }
} else {
  console.log('ios/ not found: skipped the iOS icons (run `npx cap add ios` first)');
}
