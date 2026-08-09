const assert = require('assert');

const origin = (process.env.TWOSDAY_ORIGIN || 'https://twosday.dev').replace(/\/$/, '');

async function fetchPage(path) {
  const response = await fetch(origin + path, { redirect: 'follow' });
  const body = await response.text();
  return { response, body };
}

function header(response, name) {
  return response.headers.get(name) || '';
}

(async () => {
  const home = await fetchPage('/');
  assert.strictEqual(home.response.status, 200, 'production home page must return 200');
  for (const name of ['content-security-policy', 'strict-transport-security', 'x-content-type-options', 'referrer-policy', 'permissions-policy']) {
    assert(header(home.response, name), `production response is missing ${name}`);
  }
  for (const value of ['<html lang="en"', 'og:title', 'og:description', 'og:image', 'twitter:card', 'manifest.webmanifest']) {
    assert(home.body.includes(value), `production home page is missing ${value}`);
  }

  const privacy = await fetchPage('/privacy.html');
  assert.strictEqual(privacy.response.status, 200, 'privacy page must return 200');
  assert(privacy.body.includes('<h1>Privacy Policy</h1>'), 'privacy page must render its heading');

  const missing = await fetchPage('/twosday-production-audit-missing');
  assert.strictEqual(missing.response.status, 404, 'unknown production route must return 404');
  assert(missing.body.includes('That page is not available.'), 'production 404 must render the custom recovery page');

  console.log(`production audit passed for ${origin}`);
})().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
