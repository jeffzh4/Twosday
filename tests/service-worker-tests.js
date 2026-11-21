const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const origin = 'https://twosday.test';
const handlers = {};
const stores = new Map();
const key = request => new URL(typeof request === 'string' ? request : request.url, origin).href;
const cacheFor = name => {
  if (!stores.has(name)) stores.set(name, new Map());
  const entries = stores.get(name);
  return {
    match: async request => entries.get(key(request))?.clone(),
    put: async (request, response) => entries.set(key(request), response.clone()),
  };
};
let offline = false;
let fetchCount = 0;
const context = {
  URL, Request, Response, Promise,
  self: {
    location: { origin },
    addEventListener: (type, handler) => { handlers[type] = handler; },
    clients: { claim: async () => {} },
  },
  caches: {
    open: async name => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
    match: async request => {
      for (const name of stores.keys()) {
        const hit = await cacheFor(name).match(request);
        if (hit) return hit;
      }
    },
  },
  fetch: async request => {
    fetchCount++;
    if (offline) throw new Error('offline');
    const url = new URL(request.url);
    return new Response(url.pathname, { status: url.pathname.includes('missing') ? 404 : 200 });
  },
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), context);
const cacheName = vm.runInNewContext('SHELL_CACHE', context);
const dispatch = async (path, mode = 'navigate') => {
  let result;
  handlers.fetch({
    request: { method: 'GET', url: origin + path, mode },
    respondWith: promise => { result = promise; },
  });
  return result;
};

(async () => {
  const cache = cacheFor(cacheName);
  await cache.put('/index.html', new Response('calendar'));
  await cache.put('/404.html', new Response('not found'));
  await dispatch('/privacy.html');
  await dispatch('/share.html?token=private');
  assert.strictEqual(await (await cache.match('/index.html')).text(), 'calendar', 'public pages must not overwrite the calendar shell');
  assert.strictEqual(await cache.match('/share.html?token=private'), undefined, 'share tokens must not become cache keys');
  await dispatch('/missing/page');
  offline = true;
  assert.strictEqual(await (await dispatch('/')).text(), 'calendar');
  assert.strictEqual(await (await dispatch('/privacy.html')).text(), '/privacy.html');
  assert.strictEqual(await (await dispatch('/share.html?token=other')).text(), '/share.html');
  const missing = await dispatch('/missing/page');
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(await missing.text(), 'not found');

  await cache.put('/js/app.js', new Response('old'));
  offline = false;
  const before = fetchCount;
  assert.strictEqual(await (await dispatch('/js/app.js?v=new', 'cors')).text(), '/js/app.js');
  assert.strictEqual(fetchCount, before + 1, 'new versions must not use stale unversioned code');
  await dispatch('/js/app.js?v=new', 'cors');
  assert.strictEqual(fetchCount, before + 1, 'exact cached versions may be reused');
  offline = true;
  assert.strictEqual(await (await dispatch('/js/app.js?v=offline', 'cors')).text(), 'old');

  stores.set('another-app-cache', new Map());
  stores.set('twosday-v1-shell', new Map());
  let activation;
  handlers.activate({ waitUntil: promise => { activation = promise; } });
  await activation;
  assert(stores.has('another-app-cache'), 'activation must not delete unrelated caches');
  assert(!stores.has('twosday-v1-shell'));
  assert(stores.has(cacheName));
  console.log('service worker tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
