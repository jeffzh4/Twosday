// Property-based tests (fast-check).
//
// The example-based suites in core-tests.js pin down specific scenarios. These
// assert invariants that must hold for *any* input — the testing philosophy used
// for financial correctness (position/P&L reconciliation), where the interesting
// failures live in the inputs you didn't think to write a case for. Every
// function under test here is pure, so the properties are cheap to check across
// thousands of generated inputs.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const fc = require('fast-check');

const root = path.join(__dirname, '..');

// Minimal browser-like context to load the pure modules into (mirrors core-tests).
const context = { console, Date, Math, JSON, Set, Map, Array, Object, String, Number, RegExp, parseInt, isNaN };
context.globalThis = context;
context.document = { querySelector: () => null, getElementById: () => null };
vm.createContext(context);
vm.runInContext(`
  USERS = ['alex', 'jamie'];
  const START_H = 0;
  const END_H = 24;
  const STEP_H = 0.25;
  const DAYS = ['sun','mon','tue','wed','thu','fri','sat'];
  activeUser = 'alex';
`, context);

function load(file) { vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file }); }
load('js/utils.js');
load('js/state.js');
load('js/reconcile.js');
load('js/recurrence.js');

// Call a function inside the vm realm with plain-JSON args, returning a plain host
// value. Safe because everything under test takes and returns JSON-serializable data.
function call(expr, ...args) {
  const argStr = args.map(a => JSON.stringify(a)).join(', ');
  return JSON.parse(JSON.stringify(vm.runInContext(`(${expr})(${argStr})`, context)));
}

// Recursively sort object keys so two structurally-equal trees compare equal
// regardless of key insertion order.
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === 'object') {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canonical(v[k]); return o; }, {});
  }
  return v;
}
const canon = v => JSON.stringify(canonical(v));

function run(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (err) { console.error(`not ok - ${name}`); throw err; }
}

// ── Arbitraries ────────────────────────────────────────────────────────────────
const arbTime = fc.integer({ min: 0, max: 96 }).map(q => q / 4); // 0..24 in 15-min steps

const arbRawEvent = fc.record({
  id: fc.string({ minLength: 1, maxLength: 6 }),
  text: fc.string({ maxLength: 12 }),
  start: arbTime,
  end: arbTime,
  done: fc.boolean(),
});

// A calendar keyed by a small pool of dates and the two users, with event ids
// drawn from a small pool so the two sides genuinely collide on shared ids.
const DATE_POOL = ['2026-06-14', '2026-06-15', '2026-06-16'];
const ID_POOL = ['a', 'b', 'c', 'd', 'e'];

const arbEvent = fc.record({
  id: fc.constantFrom(...ID_POOL),
  text: fc.string({ maxLength: 10 }),
  start: arbTime,
  end: arbTime,
  updatedAt: fc.integer({ min: 1, max: 1000 }),
});

const arbCalendar = fc.array(
  fc.record({ date: fc.constantFrom(...DATE_POOL), user: fc.constantFrom('alex', 'jamie'), ev: arbEvent }),
  { maxLength: 12 },
).map(items => {
  const all = {};
  const seen = new Set();
  items.forEach(({ date, user, ev }) => {
    if (seen.has(ev.id)) return;   // each id lives in one slot
    seen.add(ev.id);
    if (!all[date]) all[date] = { alex: [], jamie: [] };
    all[date][user].push(ev);
  });
  return all;
});

// ── Properties ──────────────────────────────────────────────────────────────────

run('normalizeEvent always yields a positive-duration event within [0,24]', () => {
  fc.assert(fc.property(arbRawEvent, raw => {
    const ev = call('normalizeEvent', raw);
    assert.ok(ev.end > ev.start, `end (${ev.end}) must exceed start (${ev.start})`);
    assert.ok(ev.start >= 0 && ev.end <= 24, `times out of range: ${ev.start}..${ev.end}`);
    assert.ok(typeof ev.id === 'string' && ev.id.length > 0);
  }), { numRuns: 500 });
});

run('mergeCalendars is order-independent: merge(A,B) === merge(B,A)', () => {
  fc.assert(fc.property(arbCalendar, arbCalendar, (A, B) => {
    const ab = call('mergeCalendars', A, B, {}, {}, ['alex', 'jamie']);
    const ba = call('mergeCalendars', B, A, {}, {}, ['alex', 'jamie']);
    assert.strictEqual(canon(ab.allData), canon(ba.allData));
  }), { numRuns: 400 });
});

run('mergeCalendars is idempotent: merge(m,m) === m', () => {
  fc.assert(fc.property(arbCalendar, arbCalendar, (A, B) => {
    const m = call('mergeCalendars', A, B, {}, {}, ['alex', 'jamie']);
    const mm = call('mergeCalendars', m.allData, m.allData, m.tombstones, m.tombstones, ['alex', 'jamie']);
    assert.strictEqual(canon(m.allData), canon(mm.allData));
  }), { numRuns: 400 });
});

run('mergeCalendars never keeps two copies of the same event id', () => {
  fc.assert(fc.property(arbCalendar, arbCalendar, (A, B) => {
    const m = call('mergeCalendars', A, B, {}, {}, ['alex', 'jamie']);
    const ids = [];
    Object.keys(m.allData).forEach(dk => ['alex', 'jamie'].forEach(u => (m.allData[dk][u] || []).forEach(e => ids.push(e.id))));
    assert.strictEqual(ids.length, new Set(ids).size, 'duplicate event id after merge');
  }), { numRuns: 400 });
});

run('expandRecurrence is bounded, monotonic, and produces valid date keys', () => {
  const arbRule = fc.record({
    freq: fc.constantFrom('none', 'daily', 'weekly', 'weekdays', 'monthly'),
    count: fc.integer({ min: 1, max: 400 }),
  });
  fc.assert(fc.property(arbRule, fc.constantFrom(...DATE_POOL), (rule, startKey) => {
    const dates = call('expandRecurrence', rule, startKey);
    const cap = vm.runInContext('RECURRENCE_CAP', context);
    assert.ok(dates.length >= 1 && dates.length <= cap, `count ${dates.length} out of bounds`);
    dates.forEach(d => assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d), `bad date key ${d}`));
    for (let i = 1; i < dates.length; i++) {
      assert.ok(dates[i] >= dates[i - 1], 'dates must be non-decreasing');
    }
  }), { numRuns: 300 });
});

console.log('all property tests passed');
