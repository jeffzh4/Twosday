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

run('isHashed recognizes sha-256 digests, rejects plaintext', () => {
  assert.strictEqual(exec(`isHashed('${'a'.repeat(64)}')`), true);
  assert.strictEqual(exec(`isHashed('hunter2')`), false);
  assert.strictEqual(exec(`isHashed('${'a'.repeat(63)}')`), false);  // too short
  assert.strictEqual(exec(`isHashed('${'g'.repeat(64)}')`), false);  // non-hex
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

run('renameProfile migrates allData, notes, and theme keys', () => {
  exec(`
    Object.keys(allData).forEach(k => delete allData[k]);
    USERS = ['alex', 'jamie'];
    activeUser = 'alex';
    userNotes = { alex: [{ text:'note', time: 1 }], jamie: [] };
    userTheme = { alex: 'dark', jamie: 'light' };
    ensureDateUser('2026-06-14', 'alex');
    allData['2026-06-14'].alex.push({ id:'e1', text:'gym', start:7, end:8, done:false, shared:false, sharedId:null, color:null });
    renameProfile('alex', 'sam');
  `);
  assert.deepStrictEqual(plain(exec(`USERS`)), ['sam', 'jamie']);
  assert.strictEqual(exec(`activeUser`), 'sam');
  assert.strictEqual(exec(`allData['2026-06-14'].sam.length`), 1);
  assert.strictEqual(exec(`allData['2026-06-14'].alex`), undefined);
  assert.strictEqual(exec(`userNotes.sam.length`), 1);
  assert.strictEqual(exec(`userTheme.sam`), 'dark');
  exec(`renameProfile('sam', 'alex');`);  // restore for any tests that follow
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

console.log('all core tests passed');
