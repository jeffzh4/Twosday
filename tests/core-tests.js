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
exec(`activeUser = 'alex'; viewMode = 'week'; currentDate = new Date(2026, 5, 14);`);
load('js/events.js');
load('js/find-time.js');
load('js/analytics.js');
load('js/import.js');
load('js/conflicts.js');

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

console.log('all core tests passed');
