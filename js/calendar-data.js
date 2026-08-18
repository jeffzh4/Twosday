// ── Calendar data access ──────────────────────────────────────────────────────
// The write door for allData. Every insertion, removal and cross-day move of an
// event goes through here so the two invariants of the allData[dateKey][user]
// arrays — days stay sorted by start time, and a real delete always leaves a
// tombstone — are enforced in one place instead of being re-remembered at each
// call site. Reads still go through getEventsForDate / allData directly.

// Add an event to a day, keeping that day sorted.
function insertEvent(dateKey, user, ev) {
  ensureDateUser(dateKey, user);
  allData[dateKey][user].push(ev);
  sortDateUser(dateKey, user);
  return ev;
}

// Pull an event out of a day without tombstoning it — the event is going
// somewhere else, not away. Only moveEventToDate should need this.
function detachEvent(dateKey, user, ev) {
  const arr = allData[dateKey] && allData[dateKey][user];
  if (!arr) return null;
  const idx = arr.indexOf(ev);
  if (idx < 0) return null;
  arr.splice(idx, 1);
  return ev;
}

// Delete an event for good. The tombstone is what stops a concurrent remote
// merge from resurrecting it.
function removeEvent(dateKey, user, ev) {
  if (!detachEvent(dateKey, user, ev)) return null;
  tombstone(ev.id);
  return ev;
}

function removeEventById(dateKey, user, evId) {
  const arr = allData[dateKey] && allData[dateKey][user];
  const ev = arr && arr.find(e => e.id === evId);
  return ev ? removeEvent(dateKey, user, ev) : null;
}

// Remove every event before an exclusive YYYY-MM-DD cutoff. This is a narrow
// account-cleanup operation: profile/account metadata stays untouched, and
// both sides of a shared mirror are tombstoned so sync cannot resurrect them.
function removeEventsBefore(cutoffDateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoffDateKey)) return { removed: 0, shared: 0 };

  const removedIds = new Set();
  let shared = 0;
  Object.keys(allData).forEach(dateKey => {
    if (dateKey >= cutoffDateKey) return;
    USERS.forEach(user => {
      const events = [...getEventsForDate(dateKey, user)];
      events.forEach(ev => {
        if (removedIds.has(ev.id)) return;
        if (ev.shared) shared++;
        removeEvent(dateKey, user, ev);
        removedIds.add(ev.id);
      });
    });
  });

  return { removed: removedIds.size, shared };
}

// Move an event to another day. Deliberately not a delete + insert: a tombstone
// here would tell the next merge to delete the copy we just re-inserted.
function moveEventToDate(fromDateKey, toDateKey, user, ev) {
  if (!detachEvent(fromDateKey, user, ev)) return null;
  return insertEvent(toDateKey, user, ev);
}
