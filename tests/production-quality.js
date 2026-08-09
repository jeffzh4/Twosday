const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const mustContain = (source, value, message) => assert(source.includes(value), message);

function pngDimensions(file) {
  const image = fs.readFileSync(path.join(root, file));
  assert(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), `${file} must be a PNG`);
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

function checkPublicDocument(file, { noindex = false } = {}) {
  const html = read(file);
  mustContain(html, '<html lang="en"', `${file} must declare its document language`);
  mustContain(html, '<meta name="viewport"', `${file} must declare a mobile viewport`);
  assert(/<title>[^<]+<\/title>/.test(html), `${file} must have a descriptive title`);
  assert(/<meta name="description" content="[^"]+">/.test(html), `${file} must have a meta description`);
  mustContain(html, 'favicon.svg', `${file} must include the SVG favicon`);
  if (noindex) mustContain(html, 'name="robots" content="noindex"', `${file} must not be indexed`);
}

const app = read('index.html');
checkPublicDocument('index.html');
checkPublicDocument('privacy.html');
checkPublicDocument('share.html', { noindex: true });
checkPublicDocument('404.html', { noindex: true });

mustContain(app, 'rel="canonical" href="https://twosday.dev/"', 'app must declare canonical production URL');
for (const field of ['og:title', 'og:description', 'og:image', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']) {
  mustContain(app, field, `app must include ${field} sharing metadata`);
}

const poster = pngDimensions('assets/twosday-demo-poster.png');
assert(poster.width >= 600 && poster.height >= 315, 'social preview image must be large enough for rich previews');
assert(fs.statSync(path.join(root, 'assets/twosday-demo-poster.png')).size < 500 * 1024, 'social preview image must stay below 500 KB');

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.strictEqual(manifest.name, 'Twosday', 'manifest needs the production app name');
assert(manifest.icons.some(icon => icon.sizes === '192x192'), 'manifest needs a 192px icon');
assert(manifest.icons.some(icon => icon.sizes === '512x512'), 'manifest needs a 512px icon');

const vercel = read('vercel.json');
for (const header of ['Content-Security-Policy', 'Strict-Transport-Security', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options']) {
  mustContain(vercel, header, `Vercel must send ${header}`);
}

const config = read('js/config.js');
mustContain(config, "'twosday.dev'", 'production host allowlist must include twosday.dev');
mustContain(config, 'ReCaptchaEnterpriseProvider', 'production config must activate App Check');
mustContain(config, 'TWOSDAY_PRODUCTION_HOSTS.has(location.hostname)', 'App Check must be limited to production hosts');

const rules = read('firestore.rules');
mustContain(rules, 'allow read, write: if false;', 'Firestore rules must deny unmatched paths');
mustContain(rules, 'resource.data.ownerUid == request.auth.uid', 'Firestore reads must remain owner-scoped');

const trackedFiles = [
  'index.html', 'privacy.html', 'share.html', '404.html', 'vercel.json', 'firebase.json', 'firestore.rules',
  ...fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => `js/${file}`),
];
const forbidden = [/BEGIN (?:RSA |EC )?PRIVATE KEY/, /sk_(?:live|test)_[A-Za-z0-9]/, /ghp_[A-Za-z0-9]{20,}/];
for (const file of trackedFiles) {
  const source = read(file);
  for (const pattern of forbidden) assert(!pattern.test(source), `${file} appears to include a private credential`);
}

const shellBytes = ['index.html', 'css/style.css', ...fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => `js/${file}`)]
  .reduce((total, file) => total + fs.statSync(path.join(root, file)).size, 0);
assert(shellBytes < 550 * 1024, 'app shell exceeds the 550 KB uncompressed quality budget');

console.log('production quality guards passed');
