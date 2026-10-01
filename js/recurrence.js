// ── Recurring events ──────────────────────────────────────────────────────────
// A recurrence is a rule stored on every materialized instance of a series,
// alongside a shared recurrenceId that links them. Instances are concrete events
// in allData, so rendering, sharing, conflicts, and undo/redo all work unchanged.
// Series operations (edit / delete) act on instances by recurrenceId and scope:
//   'this'   → a single instance (editing detaches it as an exception)
//   'future' → this instance and every later one
//   'all'    → every instance in the series
// Materialization is bounded by RECURRENCE_CAP so a rule can never run away.

const RECURRENCE_CAP = 200;

const RECURRENCE_OPTIONS = [
  { value: 'none',     label: 'does not repeat' },
  { value: 'daily',    label: 'every day' },
  { value: 'weekly',   label: 'every week' },
  { value: 'weekdays', label: 'every weekday (Mon–Fri)' },
  { value: 'monthly',  label: 'every month' },
];

// Expand a rule into the list of date keys its instances land on. Pure.
function expandRecurrence(rule, startDateKey) {
  if (!rule || rule.freq === 'none') return [startDateKey];
  const count = Math.max(1, Math.min(RECURRENCE_CAP, rule.count || 1));
  const cursor = parseDateKey(startDateKey);
  const dates = [];

  if (rule.freq === 'weekdays') {
    let guard = 0;
    while (dates.length < count && guard < RECURRENCE_CAP * 3) {
      const day = cursor.getDay(); // 0 Sun … 6 Sat
      if (day >= 1 && day <= 5) dates.push(getDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
      guard++;
    }
    return dates;
  }

  for (let i = 0; i < count; i++) {
    dates.push(getDateKey(cursor));
    if (rule.freq === 'daily')   cursor.setDate(cursor.getDate() + 1);
    else if (rule.freq === 'weekly')  cursor.setDate(cursor.getDate() + 7);
    else if (rule.freq === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else break;
  }
  return dates;
}

function recurrenceLabel(rule) {
  if (!rule || rule.freq === 'none') return '';
  const base = (RECURRENCE_OPTIONS.find(o => o.value === rule.freq) || {}).label || rule.freq;
  return rule.count ? `${base} · ${rule.count}×` : base;
}

// Every instance of a series for one profile, sorted by date. Pure read.
function collectSeries(recurrenceId, user) {
  const out = [];
  if (!recurrenceId) return out;
  Object.keys(allData).forEach(dateKey => {
    getEventsForDate(dateKey, user).forEach(ev => {
      if (ev.recurrenceId === recurrenceId) out.push({ dateKey, ev });
    });
  });
  out.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  return out;
}

function seriesCount(recurrenceId, user) {
  return collectSeries(recurrenceId, user).length;
}

function shouldOfferRecurrenceScope(ev) {
  return !!(ev && ev.recurrenceId);
}

function dateKeyOffset(fromDateKey, toDateKey) {
  const from = parseDateKey(fromDateKey);
  const to = parseDateKey(toDateKey);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toUtc - fromUtc) / 86400000);
}

function shiftDateKey(dateKey, offset) {
  if (!offset) return dateKey;
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + offset);
  return getDateKey(date);
}

// Delete a series. fromDateKey null = all; otherwise this-and-following.
function deleteRecurringSeries(recurrenceId, user, fromDateKey) {
  const series = collectSeries(recurrenceId, user);
  let removed = 0;
  let label = '';
  series.forEach(({ dateKey, ev }) => {
    if (fromDateKey && dateKey < fromDateKey) return;
    if (!removeEvent(dateKey, user, ev)) return;
    label = ev.text;
    if (ev.shared) syncSharedEvent(user, ev.sharedId, dateKey, 'delete');
    removed++;
  });
  if (removed && typeof logAudit === 'function') {
    logAudit('deleted', label, `recurring series · ${removed} occurrence${removed !== 1 ? 's' : ''}`);
  }
}

// Patch every selected instance while preserving per-occurrence IDs and shared mirrors.
// A future-only edit starts a new series at the cutoff occurrence.
function editRecurringSeries(recurrenceId, user, fromDateKey, patch) {
  const series = collectSeries(recurrenceId, user);
  const previous = fromDateKey ? series.filter(item => item.dateKey < fromDateKey) : [];
  const targets = series.filter(item => !fromDateKey || item.dateKey >= fromDateKey);
  if (!targets.length) return;

  // A future-only edit creates a separate series so a later all-series edit
  // cannot unexpectedly include the untouched earlier occurrences.
  const splitId = fromDateKey && previous.length ? uid() : recurrenceId;
  if (splitId !== recurrenceId) {
    previous.forEach(({ dateKey, ev }) => {
      if (ev.recurrence) ev.recurrence = { ...ev.recurrence, count: previous.length };
      markEventUpdated(ev, user);
      if (ev.shared) {
        syncSharedEvent(user, ev.sharedId, dateKey, 'edit', {
          recurrence: ev.recurrence ? clone(ev.recurrence) : null,
          updatedAt: ev.updatedAt, updatedBy: ev.updatedBy,
        });
      }
    });
    targets.forEach(({ ev }) => {
      if (ev.recurrence) ev.recurrence = { ...ev.recurrence, count: targets.length };
    });
  }

  let edited = 0;
  let label = '';
  targets.forEach(({ dateKey, ev }) => {
    const nextDateKey = shiftDateKey(dateKey, Number(patch.dateOffsetDays) || 0);
    const wasShared = !!ev.shared;
    const oldSharedId = ev.sharedId;
    if (nextDateKey !== dateKey) moveEventToDate(dateKey, nextDateKey, user, ev);
    if (patch.text != null)  ev.text = patch.text;
    if (patch.start != null) ev.start = patch.start;
    if (patch.end != null)   ev.end = patch.end;
    if (patch.color !== undefined) ev.color = patch.color;
    if (patch.location !== undefined) ev.location = patch.location;
    if (patch.description !== undefined) ev.description = patch.description;
    if (patch.reminderMinutes !== undefined) ev.reminderMinutes = patch.reminderMinutes;
    if (patch.timeZone !== undefined) ev.timeZone = patch.timeZone;
    ev.recurrenceId = splitId;
    if (patch.shared === false && wasShared) {
      syncSharedEvent(user, oldSharedId, dateKey, 'delete');
      ev.shared = false;
      ev.sharedId = null;
    } else if (patch.shared === true && !wasShared) {
      ev.shared = true;
      ev.sharedId = uid();
    }
    markEventUpdated(ev, user);
    sortDateUser(nextDateKey, user);
    label = ev.text;
    edited++;
    if (ev.shared) {
      const updates = {
        text: ev.text, start: ev.start, end: ev.end, color: ev.color,
        location: ev.location, description: ev.description,
        reminderMinutes: ev.reminderMinutes, timeZone: ev.timeZone,
        recurrenceId: ev.recurrenceId,
        recurrence: ev.recurrence ? clone(ev.recurrence) : null,
        updatedAt: ev.updatedAt, updatedBy: ev.updatedBy,
      };
      if (!wasShared || nextDateKey !== dateKey) {
        if (wasShared) syncSharedEvent(user, oldSharedId, dateKey, 'delete');
        syncSharedEvent(user, ev.sharedId, nextDateKey, 'add', {
          ...clone(ev), id: uid(), shared: true, sharedId: ev.sharedId,
        });
      } else {
        syncSharedEvent(user, ev.sharedId, nextDateKey, 'edit', updates);
      }
    }
  });
  if (edited && typeof logAudit === 'function') {
    logAudit('edited', label, `recurring series · ${edited} occurrence${edited !== 1 ? 's' : ''}`);
  }
}

// Small chooser shown before a scoped edit/delete of a recurring event.
function openRecurrenceScopeModal({ verb, onChoose }) {
  if (document.querySelector('.modal-bg')) return;
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal scope-modal">
      <h3>${escHtml(verb)} recurring event</h3>
      <p class="scope-copy">this event repeats. apply the ${escHtml(verb)} to:</p>
      <div class="scope-options">
        <button class="mbtn scope-btn" data-scope="this">this event only</button>
        <button class="mbtn scope-btn" data-scope="future">this and following events</button>
        <button class="mbtn scope-btn" data-scope="all">all events in the series</button>
      </div>
      <div class="modal-btns">
        <button class="mbtn mbtn-cancel" data-scope="cancel">cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '.scope-btn' });
  bg.addEventListener('click', e => {
    if (e.target === bg) { bg.remove(); return; }
    const btn = e.target.closest('[data-scope]');
    if (!btn) return;
    const scope = btn.dataset.scope;
    bg.remove();
    if (scope && scope !== 'cancel') onChoose(scope);
  });
}
