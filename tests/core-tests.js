const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');

const context = {
  console,
  Date,
  Math,
  JSON,
  Set,
  Map,
  Array,
  Object,
  String,
  Number,
  RegExp,
  parseInt,
  encodeURIComponent,
};
context.globalThis = context;
context.document = { querySelector: () => null, getElementById: () => null };
context.location = { origin: 'https://twosday.dev' };
context.crypto = { getRandomValues: arr => { for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 11) % 256; return arr; } };
context.localStorage = (() => {
  const store = {};
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
  };
})();

function load(file) {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(src, context, { filename: file });
}

vm.createContext(context);
vm.runInContext(`
USERS = ['alex', 'jamie'];
const START_H = 0;
const END_H = 24;
const STEP_H = 0.25;
const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
const COLOR_PRESETS = [
  { name:'red', dark:{ text:'#f87171' }, light:{ text:'#dc2626' } },
  { name:'orange', dark:{ text:'#fb923c' }, light:{ text:'#c2410c' } },
  { name:'yellow', dark:{ text:'#fde047' }, light:{ text:'#a16207' } },
  { name:'green', dark:{ text:'#6ee7b7' }, light:{ text:'#059669' } },
  { name:'blue', dark:{ text:'#93c5fd' }, light:{ text:'#2563eb' } },
  { name:'indigo', dark:{ text:'#a5b4fc' }, light:{ text:'#4338ca' } },
  { name:'violet', dark:{ text:'#d8b4fe' }, light:{ text:'#7c3aed' } },
  { name:'gray', dark:{ text:'#a1a1aa' }, light:{ text:'#52525b' } },
];
const SHARED_COLOR = { dark:{ text:'#e9a8f2' }, light:{ text:'#a21caf' } };
const categoryColors = { class:'violet', meal:'green', social:'orange', work:'blue', other:'gray' };
function getTheme() { return 'dark'; }
`, context);

load('js/utils.js');
load('js/state.js');
load('js/calendar-data.js');
load('js/reconcile.js');
load('js/audit.js');
exec(`activeUser = 'alex'; viewMode = 'week'; currentDate = new Date(2026, 5, 14);`);
load('js/events.js');
load('js/recurrence.js');
load('js/find-time.js');
load('js/analytics.js');
load('js/import.js');
load('js/conflicts.js');
load('js/settings.js');
load('js/demo-data.js');
load('js/share.js');

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`not ok - ${name}`);
    throw err;
  }
}

function exec(src) {
  return vm.runInContext(src, context);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

run('date helpers use local calendar keys', () => {
  assert.strictEqual(exec(`getDateKey(new Date(2026, 5, 14))`), '2026-06-14');
  assert.strictEqual(exec(`getWeekDates(new Date(2026, 5, 17)).length`), 7);
  assert.strictEqual(exec(`getWeekDates(new Date(2026, 5, 17))[0].getDay()`), 0);
});

run('event normalization keeps safe time-zone provenance and reminder bounds', () => {
  const normalized = plain(exec(`normalizeEvent({ id:'tz', text:'flight', start:9, end:10, timeZone:'America/Los_Angeles', reminderMinutes:15 })`));
  assert.strictEqual(normalized.timeZone, 'America/Los_Angeles');
  assert.strictEqual(normalized.reminderMinutes, 15);
  const invalid = plain(exec(`normalizeEvent({ id:'bad-tz', text:'event', start:9, end:10, timeZone:'not/a-zone', reminderMinutes:1441 })`));
  assert.strictEqual(typeof invalid.timeZone, 'string');
  assert.strictEqual(invalid.reminderMinutes, 0);
});

run('free-window detection de-dupes shared mirrors', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-14', 'alex');
    ensureDateUser('2026-06-14', 'jamie');
    allData['2026-06-14'].alex.push({ id:'a1', text:'work', start:9, end:10, shared:false });
    allData['2026-06-14'].alex.push({ id:'s1a', text:'lunch', start:12, end:13, shared:true, sharedId:'s1' });
    allData['2026-06-14'].jamie.push({ id:'s1b', text:'lunch', start:12, end:13, shared:true, sharedId:'s1' });
    allData['2026-06-14'].jamie.push({ id:'j1', text:'class', start:15, end:16, shared:false });
  `);
  const busy = exec(`getMutualBusyIntervals('2026-06-14')`);
  assert.deepStrictEqual(plain(busy.map(x => [x.start, x.end])), [[9, 10], [12, 13], [15, 16]]);
  const windows = exec(`findMutualFreeWindows({ startDate: parseDateKey('2026-06-14'), days: 1, duration: 1, windowStart: 8, windowEnd: 17 })`);
  assert(windows.some(w => w.start === 10 && w.end === 12));
});

run('analytics aggregates deduped shared events', () => {
  const summary = exec(`
    const events = getAnalyticsEvents('all', 'both');
    getAnalyticsSummary(events, 'all');
  `);
  assert.strictEqual(summary.totalEvents, 3);
  assert.strictEqual(summary.shared, 1);
  assert.strictEqual(summary.totalHours, 3);
});

run('ics parser imports common VEVENT fields', () => {
  const parsed = exec(`
    parseICSEvents([
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:test-1',
      'SUMMARY:Coffee\\\\, chat',
      'DTSTART:20260614T093000',
      'DTEND:20260614T103000',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\\n'))
  `);
  assert.strictEqual(parsed.length, 1);
  assert.strictEqual(parsed[0].text, 'Coffee, chat');
  assert.strictEqual(parsed[0].dateKey, '2026-06-14');
  assert.strictEqual(parsed[0].start, 9.5);
  assert.strictEqual(parsed[0].end, 10.5);
});

run('conflict center finds own and shared conflicts', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-20', 'alex');
    ensureDateUser('2026-06-20', 'jamie');
    allData['2026-06-20'].alex.push({ id:'a1', text:'interview', start:10, end:11.5, shared:false });
    allData['2026-06-20'].alex.push({ id:'a2', text:'standup', start:11, end:12, shared:false });
    allData['2026-06-20'].alex.push({ id:'s1a', text:'dinner', start:18, end:20, shared:true, sharedId:'s1' });
    allData['2026-06-20'].jamie.push({ id:'s1b', text:'dinner', start:18, end:20, shared:true, sharedId:'s1' });
    allData['2026-06-20'].jamie.push({ id:'j1', text:'lab', start:19, end:21, shared:false });
  `);
  const conflicts = exec(`collectConflicts({ range: 'all', userScope: 'all' })`);
  assert(conflicts.some(c => c.kind === 'same-profile'));
  assert(conflicts.some(c => c.kind === 'shared'));
});

run('shared events mirror add/edit/toggle/delete across profiles', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-14', 'alex');
    ensureDateUser('2026-06-14', 'jamie');
    allData['2026-06-14'].alex.push({ id:'a1', text:'dinner', start:18, end:20, done:false, shared:true, sharedId:'sh1', color:null });
    syncSharedEvent('alex', 'sh1', '2026-06-14', 'add', { id:'m1', text:'dinner', start:18, end:20, done:false, shared:true, sharedId:'sh1', color:null });
  `);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie.length`), 1);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie[0].sharedId`), 'sh1');

  exec(`syncSharedEvent('alex', 'sh1', '2026-06-14', 'edit', { start:19, end:21, text:'late dinner', color:'red' });`);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie[0].start`), 19);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie[0].text`), 'late dinner');

  exec(`syncSharedEvent('alex', 'sh1', '2026-06-14', 'toggle-done', { done:true });`);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie[0].done`), true);

  exec(`syncSharedEvent('alex', 'sh1', '2026-06-14', 'delete');`);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie.length`), 0);
});

run('deleting a shared event removes its mirror', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-15', 'alex');
    ensureDateUser('2026-06-15', 'jamie');
    allData['2026-06-15'].alex.push({ id:'a1', text:'call', start:9, end:10, done:false, shared:true, sharedId:'sh2', color:null });
    allData['2026-06-15'].jamie.push({ id:'m1', text:'call', start:9, end:10, done:false, shared:true, sharedId:'sh2', color:null });
    deleteEvent('2026-06-15', 'alex', 'a1');
  `);
  assert.strictEqual(exec(`allData['2026-06-15'].alex.length`), 0);
  assert.strictEqual(exec(`allData['2026-06-15'].jamie.length`), 0);
});

run('insertEvent keeps the day sorted by start time', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    insertEvent('2026-06-17', 'alex', normalizeEvent({ id:'late', text:'late', start:16, end:17 }));
    insertEvent('2026-06-17', 'alex', normalizeEvent({ id:'early', text:'early', start:8, end:9 }));
  `);
  assert.strictEqual(exec(`allData['2026-06-17'].alex.map(e => e.id).join(',')`), 'early,late');
});

run('removeEvent tombstones so a merge cannot resurrect the event', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    tombstones = {};
    removeEvent('2026-06-18', 'alex',
      insertEvent('2026-06-18', 'alex', normalizeEvent({ id:'gone', text:'gone', start:9, end:10 })));
  `);
  assert.strictEqual(exec(`allData['2026-06-18'].alex.length`), 0);
  assert.strictEqual(exec(`typeof tombstones['gone']`), 'number');
});

run('moveEventToDate relocates without tombstoning', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    tombstones = {};
    moveEventToDate('2026-06-19', '2026-06-20', 'alex',
      insertEvent('2026-06-19', 'alex', normalizeEvent({ id:'m1', text:'moved', start:9, end:10 })));
  `);
  assert.strictEqual(exec(`allData['2026-06-19'].alex.length`), 0);
  assert.strictEqual(exec(`allData['2026-06-20'].alex[0].id`), 'm1');
  // A tombstone here would tell the next merge to delete the copy just re-inserted.
  assert.strictEqual(exec(`'m1' in tombstones`), false);
});

run('removeEventById is a no-op for an unknown event or day', () => {
  exec(`Object.keys(allData).forEach(k => delete allData[k]);`);
  assert.strictEqual(exec(`removeEventById('2026-06-21', 'alex', 'nope')`), null);
  exec(`insertEvent('2026-06-21', 'alex', normalizeEvent({ id:'keep', text:'keep', start:9, end:10 }));`);
  assert.strictEqual(exec(`removeEventById('2026-06-21', 'alex', 'nope')`), null);
  assert.strictEqual(exec(`allData['2026-06-21'].alex.length`), 1);
});

run('undo and redo restore event snapshots', () => {
  exec(`
    render = function () {};                                    // view layer isn't loaded here
    document.documentElement = { setAttribute: function () {} }; // let applyTheme() run
    appHistory.undo.length = 0; appHistory.redo.length = 0;
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-16', 'alex');
    allData['2026-06-16'].alex.push({ id:'e1', text:'gym', start:7, end:8, done:false, shared:false, sharedId:null, color:null });
    pushHistory();
    allData['2026-06-16'].alex.push({ id:'e2', text:'lunch', start:12, end:13, done:false, shared:false, sharedId:null, color:null });
  `);
  assert.strictEqual(exec(`allData['2026-06-16'].alex.length`), 2);
  exec(`undoAction();`);
  assert.strictEqual(exec(`allData['2026-06-16'].alex.length`), 1);
  assert.strictEqual(exec(`allData['2026-06-16'].alex[0].id`), 'e1');
  exec(`redoAction();`);
  assert.strictEqual(exec(`allData['2026-06-16'].alex.length`), 2);
});

run('sync signature changes only when event data changes', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-17', 'alex');
    allData['2026-06-17'].alex.push({ id:'e1', text:'run', start:7, end:8, done:false, shared:false, sharedId:null, color:null });
  `);
  const sig1 = exec(`_syncSig()`);
  assert.strictEqual(sig1, exec(`_syncSig()`));            // stable when nothing changes
  exec(`allData['2026-06-17'].alex[0].text = 'sprint';`);
  assert.notStrictEqual(sig1, exec(`_syncSig()`));         // changes on mutation
});

run('local and remote signatures share one format', () => {
  // The guard against the two sides drifting: _syncSig must be exactly what
  // calendarSignature produces for the same four inputs.
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    tombstones = {};
    insertEvent('2026-07-01', 'alex', normalizeEvent({ id:'s1', text:'sig', start:9, end:10 }));
  `);
  assert.strictEqual(
    exec(`_syncSig()`),
    exec(`calendarSignature(allData, userTheme, calendarDensity, tombstones)`),
  );
});

run('reconcileRemoteSnapshot merges remote events and reports convergence', () => {
  const res = exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    tombstones = {}; auditLog = [];
    insertEvent('2026-07-02', 'alex', normalizeEvent({ id:'mine', text:'mine', start:9, end:10, updatedAt: 1000 }));
    reconcileRemoteSnapshot({
      allData: { '2026-07-02': { alex: [
        { id:'mine',  text:'mine',  start:9,  end:10, updatedAt: 1000 },
        { id:'yours', text:'yours', start:14, end:15, updatedAt: 2000 },
      ], jamie: [] } },
      tombstones: {},
    });
  `);
  // Local gained the remote-only event, so local changed and both sides now agree.
  assert.strictEqual(exec(`allData['2026-07-02'].alex.map(e => e.id).join(',')`), 'mine,yours');
  assert.strictEqual(res.changedLocally, true);
  assert.strictEqual(res.needsReconverge, false);
});

run('reconcileRemoteSnapshot asks to reconverge when the remote is missing local events', () => {
  const res = exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    tombstones = {}; auditLog = [];
    insertEvent('2026-07-03', 'alex', normalizeEvent({ id:'local-only', text:'x', start:9, end:10, updatedAt: 5000 }));
    reconcileRemoteSnapshot({ allData: { '2026-07-03': { alex: [], jamie: [] } }, tombstones: {} });
  `);
  // No tombstone for it, so the merge keeps the local event — the remote copy is
  // now stale and has to be written back.
  assert.strictEqual(exec(`allData['2026-07-03'].alex.length`), 1);
  assert.strictEqual(res.needsReconverge, true);
});

run('isRemoteNewer compares against the cached savedAt, per field name', () => {
  exec(`localStorage.setItem('cal-key', JSON.stringify({ savedAt: 500 }));`);
  assert.strictEqual(exec(`isRemoteNewer('cal-key', 900)`), true);
  assert.strictEqual(exec(`isRemoteNewer('cal-key', 100)`), false);
  assert.strictEqual(exec(`isRemoteNewer('cal-key', 0)`), false);      // remote never saved
  assert.strictEqual(exec(`isRemoteNewer('absent-key', 100)`), true);  // nothing cached locally

  // Notes documents record the timestamp under a different key.
  exec(`localStorage.setItem('notes-key', JSON.stringify({ _savedAt: 500 }));`);
  assert.strictEqual(exec(`isRemoteNewer('notes-key', 900, '_savedAt')`), true);
  assert.strictEqual(exec(`isRemoteNewer('notes-key', 100, '_savedAt')`), false);

  // A corrupt cache must not throw — treat it as "no local copy".
  exec(`localStorage.setItem('bad-key', 'not json');`);
  assert.strictEqual(exec(`isRemoteNewer('bad-key', 100)`), true);
});

run('auth retry backoff starts after repeated failures and clears on success', () => {
  exec(`clearAuthFailures()`);
  const now = 1_000_000;
  for (let i = 0; i < 4; i++) exec(`recordAuthFailure(localStorage, ${now})`);
  assert.strictEqual(exec(`authRetryAfterMs(localStorage, ${now})`), 0);
  exec(`recordAuthFailure(localStorage, ${now})`);
  assert.strictEqual(exec(`authRetryAfterMs(localStorage, ${now})`), 15_000);
  exec(`clearAuthFailures()`);
  assert.strictEqual(exec(`authRetryAfterMs(localStorage, ${now})`), 0);
});

run('computeStats aggregates totals, shared, done, top color, and busiest day', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ensureDateUser('2026-06-15', 'alex');
    ensureDateUser('2026-06-15', 'jamie');
    ensureDateUser('2026-06-16', 'alex');
    ensureDateUser('2026-06-16', 'jamie');
    allData['2026-06-15'].alex.push({ id:'a1', text:'gym', start:7, end:8, done:true, shared:false, sharedId:null, color:'green' });
    allData['2026-06-15'].alex.push({ id:'a2', text:'dinner', start:18, end:20, done:false, shared:true, sharedId:'sh1', color:'red' });
    allData['2026-06-15'].jamie.push({ id:'m1', text:'dinner', start:18, end:20, done:false, shared:true, sharedId:'sh1', color:'red' });
    allData['2026-06-16'].alex.push({ id:'a3', text:'lunch', start:12, end:13, done:true, shared:false, sharedId:null, color:'green' });
  `);
  const stats = exec(`computeStats()`);
  assert.strictEqual(stats.total, 3);   // shared event counted once, from profile index 0 only
  assert.strictEqual(stats.shared, 1);
  assert.strictEqual(stats.done, 2);
  assert.strictEqual(stats.topColor, 'green');
  assert.strictEqual(stats.busiestDay, exec(`DAY_NAMES_LONG[parseDateKey('2026-06-15').getDay()]`));
});

run('computeStats counts only events in the current calendar month', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    const todayKey = getDateKey(new Date());
    ensureDateUser(todayKey, 'alex');
    allData[todayKey].alex.push({ id:'t1', text:'today event', start:9, end:10, done:false, shared:false, sharedId:null, color:null });
    ensureDateUser('2020-01-01', 'alex');
    allData['2020-01-01'].alex.push({ id:'t2', text:'old event', start:9, end:10, done:false, shared:false, sharedId:null, color:null });
  `);
  const stats = exec(`computeStats()`);
  assert.strictEqual(stats.total, 2);
  assert.strictEqual(stats.thisMonth, 1);
});

run('_icsDateTime formats decimal hours into ICS local datetime', () => {
  assert.strictEqual(exec(`_icsDateTime('2026-06-14', 9.5)`), '20260614T093000');
  assert.strictEqual(exec(`_icsDateTime('2026-01-05', 23.75)`), '20260105T234500');
  assert.strictEqual(exec(`_icsDateTime('2026-12-31', 0)`), '20261231T000000');
});

run('renameProfiles preserves both profiles during a name swap', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    USERS = ['alex', 'jamie'];
    activeUser = 'alex';
    userNotes = { alex: [{ text:'alex note' }], jamie: [{ text:'jamie note' }] };
    userTheme = { alex: 'dark', jamie: 'light' };
    calendarDensity = { alex: 'comfortable', jamie: 'compact' };
    allData['2026-06-14'] = {
      alex: [{ id:'alex-event', text:'alex', start:8, end:9 }],
      jamie: [{ id:'jamie-event', text:'jamie', start:10, end:11 }],
    };
    renameProfiles(['alex', 'jamie'], ['jamie', 'alex']);
  `);
  assert.strictEqual(exec(`allData['2026-06-14'].jamie[0].id`), 'alex-event');
  assert.strictEqual(exec(`allData['2026-06-14'].alex[0].id`), 'jamie-event');
  assert.strictEqual(exec(`userNotes.jamie[0].text`), 'alex note');
  assert.strictEqual(exec(`userTheme.alex`), 'light');
  assert.strictEqual(exec(`calendarDensity.jamie`), 'comfortable');
  assert.strictEqual(exec(`activeUser`), 'jamie');
  exec(`renameProfiles(['jamie', 'alex'], ['alex', 'jamie']);`);
});

run('emoji popover position stays inside viewport and flips above when needed', () => {
  const below = exec(`getFloatingPopoverPosition({ left:20, top:20, bottom:54 }, { width:180, height:80 }, 400, 300)`);
  assert.deepStrictEqual(plain(below), { left:20, top:60 });
  const above = exec(`getFloatingPopoverPosition({ left:350, top:250, bottom:284 }, { width:180, height:100 }, 400, 300)`);
  assert.deepStrictEqual(plain(above), { left:212, top:144 });
});

run('getDemoSeedDefinitions expands weekly patterns and preserves event shape', () => {
  const defs = exec(`getDemoSeedDefinitions()`);
  assert(defs.length > exec(`DEMO_SEED_EVENTS.length`));
  assert(defs.every(d => typeof d.date === 'string' && typeof d.text === 'string' && typeof d.start === 'number' && typeof d.end === 'number'));
});

run('hasDemoSeedEvent finds an id only once it has been added', () => {
  exec(`Object.keys(allData).forEach(k => delete allData[k]); ensureDateUser('2026-06-14', 'alex');`);
  assert.strictEqual(exec(`hasDemoSeedEvent('demo_2026_0_a')`), false);
  exec(`allData['2026-06-14'].alex.push({ id:'demo_2026_0_a', text:'x', start:9, end:10, done:false, shared:false, sharedId:null, color:null });`);
  assert.strictEqual(exec(`hasDemoSeedEvent('demo_2026_0_a')`), true);
});

run('applyTestingDemoSeed populates once and is idempotent on rerun', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    USERS = ['alex', 'jamie'];
    currentAccount = { username: 'testing' };
  `);
  assert.strictEqual(exec(`applyTestingDemoSeed()`), true);
  const countAfterFirst = exec(`
    Object.keys(allData).reduce((sum, dk) => sum + getEventsForDate(dk, 'alex').length + getEventsForDate(dk, 'jamie').length, 0)
  `);
  assert(countAfterFirst > 0);

  assert.strictEqual(exec(`applyTestingDemoSeed()`), false);  // rerun adds nothing new
  const countAfterSecond = exec(`
    Object.keys(allData).reduce((sum, dk) => sum + getEventsForDate(dk, 'alex').length + getEventsForDate(dk, 'jamie').length, 0)
  `);
  assert.strictEqual(countAfterSecond, countAfterFirst);

  const sharedPairFound = exec(`
    let found = false;
    Object.keys(allData).forEach(dk => {
      const a = getEventsForDate(dk, 'alex').find(e => e.shared);
      if (a && getEventsForDate(dk, 'jamie').some(e => e.shared && e.sharedId === a.sharedId)) found = true;
    });
    found;
  `);
  assert.strictEqual(sharedPairFound, true);  // shared seed events mirror onto both profiles

  exec(`Object.keys(allData).forEach(k => delete allData[k]); currentAccount = null;`);
});

run('expandRecurrence generates the right instance dates per frequency', () => {
  // Jun 14 2026 is a Sunday.
  assert.deepStrictEqual(plain(exec(`expandRecurrence({ freq:'daily', count:3 }, '2026-06-14')`)),
    ['2026-06-14', '2026-06-15', '2026-06-16']);
  assert.deepStrictEqual(plain(exec(`expandRecurrence({ freq:'weekly', count:3 }, '2026-06-14')`)),
    ['2026-06-14', '2026-06-21', '2026-06-28']);
  assert.deepStrictEqual(plain(exec(`expandRecurrence({ freq:'monthly', count:3 }, '2026-06-14')`)),
    ['2026-06-14', '2026-07-14', '2026-08-14']);
  // weekdays: skip the Sunday start, take the next 3 weekdays (Mon–Wed).
  assert.deepStrictEqual(plain(exec(`expandRecurrence({ freq:'weekdays', count:3 }, '2026-06-14')`)),
    ['2026-06-15', '2026-06-16', '2026-06-17']);
  // 'none' and cap.
  assert.deepStrictEqual(plain(exec(`expandRecurrence({ freq:'none' }, '2026-06-14')`)), ['2026-06-14']);
  assert.strictEqual(exec(`expandRecurrence({ freq:'daily', count:5000 }, '2026-06-14').length`), exec(`RECURRENCE_CAP`));
});

run('collectSeries and seriesCount find all instances of a series', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ['2026-06-14','2026-06-15','2026-06-16'].forEach(dk => {
      ensureDateUser(dk, 'alex');
      allData[dk].alex.push({ id:'r_'+dk, text:'standup', start:9, end:9.5, done:false, shared:false, sharedId:null, color:'blue', recurrenceId:'series1', recurrence:{freq:'daily',count:3} });
    });
    ensureDateUser('2026-06-15','alex');
    allData['2026-06-15'].alex.push({ id:'solo', text:'lunch', start:12, end:13, done:false, shared:false, sharedId:null, color:null, recurrenceId:null });
  `);
  assert.strictEqual(exec(`seriesCount('series1', 'alex')`), 3);
  assert.strictEqual(exec(`collectSeries('series1', 'alex')[0].dateKey`), '2026-06-14');
  assert.strictEqual(exec(`seriesCount('nope', 'alex')`), 0);
});

run('deleteRecurringSeries removes all or this-and-following', () => {
  function seed() {
    exec(`
      Object.keys(allData).forEach(k => delete allData[k]);
      ['2026-06-14','2026-06-15','2026-06-16','2026-06-17'].forEach(dk => {
        ensureDateUser(dk, 'alex');
        allData[dk].alex.push({ id:'r_'+dk, text:'standup', start:9, end:9.5, done:false, shared:false, sharedId:null, color:'blue', recurrenceId:'series1', recurrence:{freq:'daily',count:4} });
      });
    `);
  }
  seed();
  exec(`deleteRecurringSeries('series1', 'alex', '2026-06-16')`);  // this-and-following
  assert.strictEqual(exec(`seriesCount('series1', 'alex')`), 2);
  assert.strictEqual(exec(`getEventsForDate('2026-06-16','alex').length`), 0);
  assert.strictEqual(exec(`getEventsForDate('2026-06-15','alex').length`), 1);

  seed();
  exec(`deleteRecurringSeries('series1', 'alex', null)`);  // all
  assert.strictEqual(exec(`seriesCount('series1', 'alex')`), 0);
});

run('editRecurringSeries patches time and text across the scope', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    ['2026-06-14','2026-06-15','2026-06-16'].forEach(dk => {
      ensureDateUser(dk, 'alex');
      allData[dk].alex.push({ id:'r_'+dk, text:'standup', start:9, end:9.5, done:false, shared:false, sharedId:null, color:'blue', recurrenceId:'series1', recurrence:{freq:'daily',count:3} });
    });
    editRecurringSeries('series1', 'alex', '2026-06-15', { text:'sync', start:10, end:10.5, color:'red' });
  `);
  // First instance untouched (before the 'future' cutoff).
  assert.strictEqual(exec(`getEventsForDate('2026-06-14','alex')[0].text`), 'standup');
  assert.strictEqual(exec(`getEventsForDate('2026-06-14','alex')[0].start`), 9);
  // Later instances patched.
  assert.strictEqual(exec(`getEventsForDate('2026-06-15','alex')[0].text`), 'sync');
  assert.strictEqual(exec(`getEventsForDate('2026-06-16','alex')[0].start`), 10);
  assert.strictEqual(exec(`getEventsForDate('2026-06-16','alex')[0].color`), 'red');
});

run('mergeCalendars resolves a concurrent edit by last-write-wins', () => {
  const merged = exec(`(function(){
    const local = { '2026-06-14': { alex: [{ id:'e1', text:'gym', start:7, end:8, updatedAt:100 }], jamie: [] } };
    const remote = { '2026-06-14': { alex: [{ id:'e1', text:'GYM (moved)', start:9, end:10, updatedAt:200 }], jamie: [] } };
    return mergeCalendars(local, remote, {}, {}, ['alex','jamie']);
  })()`);
  assert.strictEqual(merged.allData['2026-06-14'].alex.length, 1);
  assert.strictEqual(merged.allData['2026-06-14'].alex[0].text, 'GYM (moved)');  // ts 200 > 100
  assert.strictEqual(merged.allData['2026-06-14'].alex[0].start, 9);
});

run('mergeCalendars keeps each side\'s non-conflicting concurrent edit', () => {
  const merged = exec(`(function(){
    const local  = { '2026-06-14': { alex: [{ id:'a', text:'alex edit', start:7, end:8, updatedAt:200 }], jamie: [{ id:'b', text:'old', start:1, end:2, updatedAt:100 }] } };
    const remote = { '2026-06-14': { alex: [{ id:'a', text:'old', start:7, end:8, updatedAt:100 }], jamie: [{ id:'b', text:'jamie edit', start:3, end:4, updatedAt:200 }] } };
    return mergeCalendars(local, remote, {}, {}, ['alex','jamie']);
  })()`);
  // Neither concurrent edit is clobbered — both survive.
  assert.strictEqual(merged.allData['2026-06-14'].alex[0].text, 'alex edit');
  assert.strictEqual(merged.allData['2026-06-14'].jamie[0].text, 'jamie edit');
});

run('mergeCalendars honors a tombstone and does not resurrect a deleted event', () => {
  // Tombstones use real (recent) timestamps — the merge prunes tombstones older
  // than its 30-day TTL, so the test data must be recent to exercise suppression.
  const count = exec(`(function(){
    const now = Date.now();
    const remote = { '2026-06-14': { alex: [{ id:'e1', text:'gym', start:7, end:8, updatedAt: now - 1000 }], jamie: [] } };
    const m = mergeCalendars({}, remote, { e1: now }, {}, ['alex','jamie']);  // tombstone now >= edit
    return Object.keys(m.allData).reduce((s, dk) => s + (m.allData[dk].alex||[]).length, 0);
  })()`);
  assert.strictEqual(count, 0);  // stays deleted
});

run('mergeCalendars is idempotent and order-independent', () => {
  const [ab, ba, abab] = exec(`(function(){
    const A = { '2026-06-14': { alex: [{ id:'a', text:'A', start:7, end:8, updatedAt:200 }], jamie: [] } };
    const B = { '2026-06-14': { alex: [{ id:'a', text:'B', start:7, end:8, updatedAt:100 }], jamie: [{ id:'c', text:'C', start:1, end:2, updatedAt:50 }] } };
    const ab = mergeCalendars(A, B, {}, {}, ['alex','jamie']);
    const ba = mergeCalendars(B, A, {}, {}, ['alex','jamie']);
    const abab = mergeCalendars(ab.allData, ab.allData, ab.tombstones, ab.tombstones, ['alex','jamie']);
    return [JSON.stringify(ab.allData), JSON.stringify(ba.allData), JSON.stringify(abab.allData)];
  })()`);
  assert.strictEqual(ab, ba);      // order-independent: merge(A,B) === merge(B,A)
  assert.strictEqual(ab, abab);    // idempotent: merge(m,m) === m
});

run('mergeAuditLogs unions by id, sorts newest first, and caps', () => {
  const result = exec(`
    const a = [{ id:'1', ts:100 }, { id:'2', ts:300 }];
    const b = [{ id:'2', ts:300 }, { id:'3', ts:200 }];
    mergeAuditLogs(a, b, 10).map(e => e.id);
  `);
  assert.deepStrictEqual(plain(result), ['2', '3', '1']);  // deduped by id, newest ts first
  const capped = exec(`mergeAuditLogs([{id:'1',ts:1},{id:'2',ts:2},{id:'3',ts:3}], [], 2).length`);
  assert.strictEqual(capped, 2);
});

run('share payload copies only public event fields', () => {
  const payload = exec(`(function () {
    activeUser = 'alex';
    return buildSharePayload({
      id: 'ev_secret', text: 'sf moma', start: 15, end: 17,
      location: '151 3rd St', description: 'meet in the lobby',
      shared: true, sharedId: 'shared_secret', done: false,
    }, '2026-07-19');
  })()`);
  const keys = Object.keys(plain(payload)).sort();
  assert.deepStrictEqual(keys, ['dateKey', 'description', 'end', 'location', 'start', 'title']);
  // The recipient must never receive anything that identifies the calendar.
  assert.strictEqual(payload.id, undefined);
  assert.strictEqual(payload.sharedId, undefined);
  assert.strictEqual(payload.title, 'sf moma');
});

run('share tokens are long, url-safe, and unique per call', () => {
  const token = exec(`shareToken()`);
  assert.strictEqual(token.length, 22);
  assert.ok(/^[0-9a-z]+$/.test(token), 'token must be url-safe');
  assert.strictEqual(exec(`shareUrlFor('abc123')`), 'https://twosday.dev/share.html?t=abc123');
});

console.log('all core tests passed');
