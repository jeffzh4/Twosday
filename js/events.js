// ── Event CRUD ────────────────────────────────────────────────────────────────
function deleteEvent(dateKey, user, evId) {
  ensureDateUser(dateKey, user);
  const arr = allData[dateKey][user];
  const idx = arr.findIndex(e => e.id === evId);
  if (idx < 0) return;
  const ev = arr[idx];
  if (ev.shared) syncSharedEvent(user, ev.sharedId, dateKey, 'delete');
  arr.splice(idx, 1);
}

function toggleDone(dateKey, user, evId) {
  const arr = getEventsForDate(dateKey, user);
  const ev = arr.find(e => e.id === evId);
  if (!ev) return;
  ev.done = !ev.done;
  markEventUpdated(ev, user);
  if (ev.shared) {
    syncSharedEvent(user, ev.sharedId, dateKey, 'toggle-done', {
      done: ev.done, updatedAt: ev.updatedAt, updatedBy: ev.updatedBy,
    });
  }
}

// ── Shared event sync ─────────────────────────────────────────────────────────
function syncSharedEvent(user, sharedId, dateKey, action, updates) {
  const other = getOtherUser(user);
  ensureDateUser(dateKey, other);
  const arr = allData[dateKey][other];
  const idx = arr.findIndex(e => e.sharedId === sharedId);

  if (action === 'add' && idx === -1) {
    arr.push(clone(updates));
    sortDateUser(dateKey, other);
  } else if (action === 'delete' && idx !== -1) {
    arr.splice(idx, 1);
  } else if (action === 'toggle-done' && idx !== -1) {
    arr[idx].done = updates.done;
    arr[idx].updatedAt = updates.updatedAt || Date.now();
    arr[idx].updatedBy = updates.updatedBy || user;
  } else if (action === 'edit' && idx !== -1) {
    Object.assign(arr[idx], updates);
    sortDateUser(dateKey, other);
  }
}

// ── Conflict detection ────────────────────────────────────────────────────────
function detectConflicts({ user, dateKey, start, end, excludeId, excludeSharedId, shared }) {
  const own = getEventsForDate(dateKey, user)
    .filter(ev => ev.id !== excludeId && overlaps(start, end, ev.start, ev.end));
  const other = shared
    ? getEventsForDate(dateKey, getOtherUser(user))
        // Exclude the mirrored copy of this very event (same sharedId, different id).
        .filter(ev => (!excludeSharedId || ev.sharedId !== excludeSharedId) && overlaps(start, end, ev.start, ev.end))
    : [];
  return { own, other, hasConflict: own.length > 0 || other.length > 0 };
}

function hasConflict(user, dateKey, ev) {
  return detectConflicts({
    user, dateKey, start: ev.start, end: ev.end,
    excludeId: ev.id, excludeSharedId: ev.sharedId || null, shared: ev.shared,
  }).hasConflict;
}

// ── Drag & resize ─────────────────────────────────────────────────────────────
function startDrag(e, mode, dateKey, evId) {
  if (e.button !== 0) return;
  e.preventDefault();
  const arr = getEventsForDate(dateKey, activeUser);
  const ev = arr.find(x => x.id === evId);
  if (!ev) return;
  dragState = {
    mode, dateKey, evId,
    startY: e.clientY,
    startX: e.clientX,
    moved: false,
    historyPushed: false,
    origin: { start: ev.start, end: ev.end, dateKey },
  };
}

function onDragMove(e) {
  if (createDrag) {
    const rect = createDrag.bodyEl.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const hAtMouse = clampTime(Math.round((y / PX_PER_HOUR + START_H) / STEP_H) * STEP_H);
    const endH = Math.max(hAtMouse, createDrag.startH + STEP_H);
    createDrag.endH = endH;
    const topPx = (createDrag.startH - START_H) * PX_PER_HOUR;
    createDrag.ghostEl.style.top    = topPx + 'px';
    createDrag.ghostEl.style.height = Math.max((endH - createDrag.startH) * PX_PER_HOUR, 15) + 'px';
    createDrag.ghostEl.textContent  = fmtFull(createDrag.startH) + ' – ' + fmtFull(endH);
    return;
  }
  if (!dragState) return;
  let { dateKey, evId } = dragState;
  let arr = getEventsForDate(dateKey, activeUser);
  let ev = arr.find(x => x.id === evId);
  if (!ev) return;

  if (!dragState.historyPushed && Math.abs(e.clientY - dragState.startY) > 4) {
    pushHistory();
    dragState.historyPushed = true;
    arr = getEventsForDate(dateKey, activeUser);
    ev = arr.find(x => x.id === evId);
  }
  if (!dragState.historyPushed) return;
  dragState.moved = true;

  const deltaH = Math.round(((e.clientY - dragState.startY) / (PX_PER_HOUR * STEP_H))) * STEP_H;
  let crossedDay = false;

  if (dragState.mode === 'move') {
    const len = dragState.origin.end - dragState.origin.start;
    let nextStart = clampTime(dragState.origin.start + deltaH);
    if (nextStart + len > END_H) nextStart = END_H - len;
    ev.start = nextStart;
    ev.end = nextStart + len;

    // Cross-day move in week view
    if (viewMode === 'week') {
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const body = target && target.closest('.col-body');
      if (body && body.dataset.datekey && body.dataset.datekey !== dateKey) {
        const newDk = body.dataset.datekey;
        arr.splice(arr.indexOf(ev), 1);
        if (ev.shared) syncSharedEvent(activeUser, ev.sharedId, dateKey, 'delete');
        ensureDateUser(newDk, activeUser);
        allData[newDk][activeUser].push(ev);
        sortDateUser(newDk, activeUser);
        if (ev.shared) {
          syncSharedEvent(activeUser, ev.sharedId, newDk, 'add', {
            ...clone(ev), id: uid(), shared: true, sharedId: ev.sharedId,
          });
        }
        dragState.dateKey = newDk;
        dateKey = newDk;
        crossedDay = true;
      }
    }
  } else if (dragState.mode === 'resize-start') {
    ev.start = Math.min(ev.end - STEP_H, clampTime(dragState.origin.start + deltaH));
  } else if (dragState.mode === 'resize-end') {
    ev.end = Math.max(ev.start + STEP_H, clampTime(dragState.origin.end + deltaH));
  }

  markEventUpdated(ev, activeUser);
  sortDateUser(dragState.dateKey, activeUser);

  if (ev.shared) {
    syncSharedEvent(activeUser, ev.sharedId, dragState.dateKey, 'edit', {
      start: ev.start, end: ev.end, text: ev.text, color: ev.color,
      updatedAt: ev.updatedAt, updatedBy: ev.updatedBy,
    });
  }

  // Cross-day moves change the DOM structure (event switches columns) — full
  // rebuild. Same-day drags only reposition one block, so patch it in place;
  // fall back to a full render if the element can't be located.
  if (crossedDay || !refreshDraggedEl(ev, dragState.dateKey)) renderGrid();
}

function onDragEnd() {
  if (createDrag) {
    const { dateKey, startH, endH, ghostEl } = createDrag;
    ghostEl.remove();
    createDrag = null;
    if (endH > startH) openModal({ dateKey, startH, endH });
    return;
  }
  if (!dragState) return;
  dragState = null;
  render();
}
