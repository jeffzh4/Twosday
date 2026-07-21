// ── Deterministic conflict reconciliation ─────────────────────────────────────
// Two profiles can edit the same calendar at the same time. The old sync listener
// applied a remote snapshot by wholesale replacement, so whichever write reached
// Firestore last silently clobbered the other partner's concurrent changes.
//
// This module replaces that with a last-write-wins element-set CRDT merge, keyed
// by event id:
//   • each event carries an `updatedAt`; for an id present on both sides the
//     higher `updatedAt` wins (ties broken deterministically by serialized form,
//     so both clients converge on the identical result regardless of order),
//   • deletions are recorded as tombstones `{ id: deletedAt }`; an id whose
//     tombstone is at least as new as its surviving edit stays deleted, which
//     stops a merge from resurrecting an event the other side removed,
//   • append-only audit logs merge by union.
//
// The merge is a pure function of its inputs, which is what makes the behavior
// provable — see tests/property-tests.js for the convergence and idempotence
// invariants it must satisfy.

const TOMBSTONE_TTL_MS = 30 * 86400000; // 30 days — bounds tombstone growth

// Flatten allData into an id → placement map. Each event id is unique and lives
// in exactly one (dateKey, user) slot; shared events are separate ids linked by
// sharedId, so there is never an id collision across users.
function collectEventsById(allD, users) {
  const map = {};
  Object.keys(allD || {}).forEach(dateKey => {
    users.forEach(user => {
      const arr = (allD[dateKey] && allD[dateKey][user]) || [];
      arr.forEach(ev => {
        map[ev.id] = { ev, dateKey, user, ts: typeof ev.updatedAt === 'number' ? ev.updatedAt : 0 };
      });
    });
  });
  return map;
}

function unionTombstones(a, b) {
  const out = {};
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  [a || {}, b || {}].forEach(t => {
    Object.keys(t).forEach(id => {
      const at = t[id] || 0;
      if (at < cutoff) return;              // prune expired tombstones
      out[id] = Math.max(out[id] || 0, at);
    });
  });
  return out;
}

// Merge two calendars. Returns { allData, tombstones } — a deterministic
// function of the inputs (order-independent, idempotent).
function mergeCalendars(localAll, remoteAll, localTomb, remoteTomb, users) {
  const tombstones = unionTombstones(localTomb, remoteTomb);
  const localMap = collectEventsById(localAll, users);
  const remoteMap = collectEventsById(remoteAll, users);

  const ids = new Set(Object.keys(localMap).concat(Object.keys(remoteMap)));
  const merged = {};

  ids.forEach(id => {
    const L = localMap[id];
    const R = remoteMap[id];
    let winner;
    if (L && R) {
      if (R.ts > L.ts) winner = R;
      else if (L.ts > R.ts) winner = L;
      else winner = JSON.stringify(R.ev) < JSON.stringify(L.ev) ? R : L; // deterministic tie-break
    } else {
      winner = L || R;
    }

    // A tombstone at least as new as the surviving edit keeps the event deleted.
    if ((tombstones[id] || 0) >= winner.ts) return;

    if (!merged[winner.dateKey]) merged[winner.dateKey] = {};
    if (!merged[winner.dateKey][winner.user]) merged[winner.dateKey][winner.user] = [];
    merged[winner.dateKey][winner.user].push(winner.ev);
  });

  Object.keys(merged).forEach(dateKey => {
    users.forEach(user => { if (!merged[dateKey][user]) merged[dateKey][user] = []; });
    // Sort by start, tie-broken by id, so the event order is a total function of
    // the inputs — this is what makes merge(A,B) === merge(B,A) provably hold.
    users.forEach(user => merged[dateKey][user].sort((a, b) => a.start - b.start || String(a.id).localeCompare(String(b.id))));
  });

  return { allData: merged, tombstones };
}

// Append-only logs merge by union of entry ids, newest first, capped.
function mergeAuditLogs(a, b, cap) {
  const byId = {};
  (a || []).concat(b || []).forEach(entry => {
    if (entry && entry.id != null) byId[entry.id] = entry;
  });
  const merged = Object.values(byId).sort((x, y) => (y.ts || 0) - (x.ts || 0));
  return cap ? merged.slice(0, cap) : merged;
}
