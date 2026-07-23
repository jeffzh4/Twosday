const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const context = { console, Promise, setTimeout, clearTimeout };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js/calendar-store.js'), 'utf8'), context, { filename: 'js/calendar-store.js' });

function makeHarness() {
  const calls = { cacheLoad: 0, cacheSave: 0, writes: 0, statuses: [], errors: 0 };
  let signature = 'one';
  let loading = false;
  let listener = null;
  let scheduled = null;
  let clock = 10000;

  const store = context.createCalendarStore({
    cache: {
      load: () => { calls.cacheLoad++; return { loaded: true }; },
      save: () => { calls.cacheSave++; },
    },
    remote: {
      isLoading: () => loading,
      isOffline: () => false,
      signature: () => signature,
      setStatus: status => calls.statuses.push(status),
      write: () => { calls.writes++; return Promise.resolve(); },
      onWriteError: () => { calls.errors++; },
      listen: controls => { listener = controls; return 'unsubscribe'; },
    },
    now: () => clock,
    setTimeoutFn: fn => { scheduled = fn; return 1; },
    clearTimeoutFn: () => { scheduled = null; },
  });

  return {
    store, calls,
    setSignature: value => { signature = value; },
    setLoading: value => { loading = value; },
    flush: async () => { const fn = scheduled; scheduled = null; if (fn) await fn(); },
    listener: () => listener,
    advance: ms => { clock += ms; },
  };
}

async function run(name, fn) {
  try { await fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

(async () => {
  await run('loads and saves through the cache adapter', async () => {
    const h = makeHarness();
    assert.deepStrictEqual(h.store.load(), { loaded: true });
    h.store.save();
    assert.strictEqual(h.calls.cacheLoad, 1);
    assert.strictEqual(h.calls.cacheSave, 1);
    await h.flush();
    assert.strictEqual(h.calls.writes, 1);
    assert.deepStrictEqual(h.calls.statuses, ['pending', 'synced']);
  });

  await run('skips duplicate remote writes and loading snapshots', async () => {
    const h = makeHarness();
    await h.store.saveRemote();
    await h.store.saveRemote();
    assert.strictEqual(h.calls.writes, 1);
    h.setSignature('two');
    h.setLoading(true);
    h.store.save();
    await h.flush();
    assert.strictEqual(h.calls.writes, 1);
  });

  await run('ignores completion from a write started before reset', async () => {
    let finishWrite;
    const statuses = [];
    const store = context.createCalendarStore({
      cache: { load: () => false, save: () => {} },
      remote: {
        isLoading: () => false, isOffline: () => false, signature: () => 'one',
        setStatus: status => statuses.push(status),
        write: () => new Promise(resolve => { finishWrite = resolve; }),
        onWriteError: () => {}, listen: () => () => {},
      },
    });
    const pending = store.saveRemote();
    store.reset();
    finishWrite();
    assert.strictEqual(await pending, false);
    assert.deepStrictEqual(statuses, ['pending']);
  });

  await run('exposes controlled reconvergence timing to the remote adapter', async () => {
    const h = makeHarness();
    assert.strictEqual(h.store.listen(), 'unsubscribe');
    assert.strictEqual(h.listener().canReconverge(), true);
    h.listener().markReconverged();
    assert.strictEqual(h.listener().canReconverge(), false);
    h.advance(3001);
    assert.strictEqual(h.listener().canReconverge(), true);
  });

  await run('resets a previous listener before an account can be reactivated', async () => {
    let unsubscribed = 0;
    const store = context.createCalendarStore({
      cache: { load: () => false, save: () => {} },
      remote: {
        isLoading: () => false, isOffline: () => false, signature: () => 'one', setStatus: () => {},
        write: () => Promise.resolve(), onWriteError: () => {},
        listen: () => () => { unsubscribed++; },
      },
    });
    store.listen();
    store.reset();
    assert.strictEqual(unsubscribed, 1);
  });

  await run('local storage adapter serializes and restores through its interface', async () => {
    const data = {};
    let applied = null;
    const cache = context.createLocalStorageCalendarAdapter({
      storage: { getItem: key => data[key] || null, setItem: (key, value) => { data[key] = value; } },
      getKey: () => 'calendar',
      buildPayload: () => ({ version: 1 }),
      applyPayload: payload => { applied = payload; },
    });
    assert.strictEqual(cache.save(), true);
    assert.strictEqual(cache.load(), true);
    assert.strictEqual(JSON.stringify(applied), JSON.stringify({ version: 1 }));
  });

  await run('Firestore adapter routes a merged snapshot through reconvergence controls', async () => {
    let snapshotHandler = null;
    const loading = [];
    const statuses = [];
    const controls = {
      canReconverge: () => true,
      markReconverged: () => { controls.marked = true; },
      setLastSyncedSignature: () => {},
      saveRemote: () => { controls.saved = true; },
    };
    const adapter = context.createFirestoreCalendarAdapter({
      getDocument: () => ({ onSnapshot: fn => { snapshotHandler = fn; return () => {}; }, set: () => Promise.resolve() }),
      clientId: 'local', isLoading: () => false, setLoading: value => loading.push(value),
      isOffline: () => false, signature: () => 'one', buildPayload: () => ({}),
      setStatus: status => statuses.push(status), onWriteError: () => {},
      mergeSnapshot: () => ({ signature: 'merged', needsReconverge: true }),
      applyFallbackSnapshot: () => { throw new Error('unexpected fallback'); }, onListenerError: () => {},
    });
    adapter.listen(controls);
    snapshotHandler({ exists: true, data: () => ({ clientId: 'other' }) });
    assert.deepStrictEqual(loading, [true, false]);
    assert.strictEqual(controls.marked, true);
    assert.strictEqual(controls.saved, true);
    assert.deepStrictEqual(statuses, []);
  });

  await run('Firestore fallback releases the loading guard and refreshes the signature', async () => {
    let snapshotHandler = null;
    const loading = [];
    let syncedSignature = null;
    const adapter = context.createFirestoreCalendarAdapter({
      getDocument: () => ({ onSnapshot: fn => { snapshotHandler = fn; return () => {}; }, set: () => Promise.resolve() }),
      clientId: 'local', isLoading: () => false, setLoading: value => loading.push(value),
      isOffline: () => false, signature: () => 'fallback-signature', buildPayload: () => ({}),
      setStatus: () => {}, onWriteError: () => {}, mergeSnapshot: () => { throw new Error('merge failed'); },
      applyFallbackSnapshot: () => {}, onListenerError: () => {},
    });
    adapter.listen({ canReconverge: () => false, markReconverged: () => {}, saveRemote: () => {}, setLastSyncedSignature: value => { syncedSignature = value; } });
    snapshotHandler({ exists: true, data: () => ({ clientId: 'other' }) });
    assert.deepStrictEqual(loading, [true, false]);
    assert.strictEqual(syncedSignature, 'fallback-signature');
  });

  console.log('all calendar store tests passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
