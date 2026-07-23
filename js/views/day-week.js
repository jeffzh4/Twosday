// ── Column layout for overlapping events ──────────────────────────────────────
// Returns a map of eventId → { col, total } so overlapping events are split
// into side-by-side columns instead of stacking on top of each other.
function computeLayout(events) {
  if (!events.length) return {};

  const sorted = [...events].sort((a, b) => a.start - b.start);
  const layout = {};

  // Build overlap clusters (transitive: A-B and B-C → one cluster even if A∩C=∅)
  const clusters = [];
  for (const ev of sorted) {
    const idx = clusters.findIndex(c =>
      c.some(other => overlaps(ev.start, ev.end, other.start, other.end))
    );
    if (idx >= 0) clusters[idx].push(ev);
    else clusters.push([ev]);
  }

  // Assign columns greedily within each cluster
  for (const cluster of clusters) {
    const colEnds = [];   // end time of last event in each column
    const cols    = {};   // eventId → column index
    for (const ev of cluster) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (ev.start >= colEnds[c]) { cols[ev.id] = c; colEnds[c] = ev.end; placed = true; break; }
      }
      if (!placed) { cols[ev.id] = colEnds.length; colEnds.push(ev.end); }
    }
    const total = colEnds.length;
    cluster.forEach(ev => { layout[ev.id] = { col: cols[ev.id], total }; });
  }

  return layout;
}

// Renders the day or week time-grid into #main-content
function renderGrid() {
  const content = document.getElementById('main-content');

  // Preserve scroll position across re-renders (add/edit/delete/toggle).
  // If there is no existing grid-wrap (first load or switching from month/year),
  // savedScroll stays null and we fall through to scroll-to-now below.
  const oldWrap = document.getElementById('grid-wrap');
  const savedScroll = oldWrap ? oldWrap.scrollTop : null;

  content.innerHTML = '';

  const dates = viewMode === 'week' ? getWeekDates(currentDate) : [new Date(currentDate)];
  const totalH = END_H - START_H; // 24

  const wrap = document.createElement('div');
  wrap.className = 'grid-wrap';
  wrap.id = 'grid-wrap';

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = `52px repeat(${dates.length}, minmax(0, 1fr))`;
  grid.style.minHeight = (totalH * PX_PER_HOUR + 32) + 'px';

  // Hour labels column
  const hoursDiv = document.createElement('div');
  hoursDiv.className = 'hours';
  hoursDiv.style.paddingTop = '32px';
  for (let h = START_H; h < END_H; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'hour-label';
    lbl.textContent = fmt(h);
    hoursDiv.appendChild(lbl);
  }
  grid.appendChild(hoursDiv);

  dates.forEach(date => grid.appendChild(renderDayColumn(date)));

  wrap.appendChild(grid);
  content.appendChild(wrap);

  positionNowLine();

  if (savedScroll !== null) {
    wrap.scrollTop = savedScroll;
  } else {
    // Fresh view: scroll so current time (or 6 am) is near the top
    const now = new Date();
    const targetH = Math.max(6, now.getHours() - 1);
    wrap.scrollTop = (targetH - START_H) * PX_PER_HOUR - 30;
  }
}

function renderDayColumn(date) {
  const dateKey = getDateKey(date);
  const todayKey = getDateKey(new Date());
  const isToday = dateKey === todayKey;
  const dayName = DAYS[date.getDay()];

  const col = document.createElement('div');
  col.className = 'col';

  // Sticky column header — click to zoom into day view
  const head = document.createElement('div');
  head.className = 'col-head';
  head.innerHTML = `<span style="${isToday ? 'color:var(--accent);font-weight:600' : ''}">${dayName} <small style="opacity:0.6">${date.getDate()}</small></span>`;
  if (viewMode === 'week') {
    head.style.cursor = 'pointer';
    head.title = 'Switch to day view';
    head.tabIndex = 0;
    head.setAttribute('role', 'button');
    head.setAttribute('aria-label', `Open ${DAY_NAMES_LONG[date.getDay()]}, ${date.toLocaleDateString()}`);
    head.addEventListener('click', () => {
      currentDate = new Date(date);
      viewMode = 'day';
      render();
    });
    onKeyboardActivate(head, () => head.click());
  }
  col.appendChild(head);

  // Body
  const body = document.createElement('div');
  body.className = 'col-body';
  body.dataset.datekey = dateKey;
  body.style.height = ((END_H - START_H) * PX_PER_HOUR) + 'px';
  body.tabIndex = 0;
  body.setAttribute('role', 'button');
  body.setAttribute('aria-label', `Add an event on ${date.toLocaleDateString()}`);
  onKeyboardActivate(body, e => {
    if (e.target !== body) return;
    const now = new Date();
    const suggested = dateKey === getDateKey(now)
      ? clampTime(Math.ceil((now.getHours() + now.getMinutes() / 60) / STEP_H) * STEP_H)
      : 9;
    openModal({ dateKey, startH: suggested });
  });

  // Hour, half-hour, and quarter-hour grid lines
  for (let h = START_H; h < END_H; h++) {
    const line = document.createElement('div');
    line.className = 'hour-line';
    line.style.top = ((h - START_H) * PX_PER_HOUR) + 'px';
    body.appendChild(line);

    const q1 = document.createElement('div');
    q1.className = 'hour-line quarter';
    q1.style.top = ((h - START_H + 0.25) * PX_PER_HOUR) + 'px';
    body.appendChild(q1);

    const half = document.createElement('div');
    half.className = 'hour-line half';
    half.style.top = ((h - START_H + 0.5) * PX_PER_HOUR) + 'px';
    body.appendChild(half);

    const q3 = document.createElement('div');
    q3.className = 'hour-line quarter';
    q3.style.top = ((h - START_H + 0.75) * PX_PER_HOUR) + 'px';
    body.appendChild(q3);
  }

  // Now line
  const nowLine = document.createElement('div');
  nowLine.className = 'now-line';
  nowLine.dataset.datekey = dateKey;
  body.appendChild(nowLine);

  // Mousedown on empty space → drag-to-create
  body.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.closest('.ev') || e.target.closest('.resize-handle')) return;
    e.preventDefault();
    const y = e.clientY - body.getBoundingClientRect().top;
    const startH = clampTime(Math.round((y / PX_PER_HOUR + START_H) / STEP_H) * STEP_H);
    const ghost = document.createElement('div');
    ghost.className = 'ev-create-ghost';
    ghost.style.top    = ((startH - START_H) * PX_PER_HOUR) + 'px';
    ghost.style.height = (STEP_H * PX_PER_HOUR) + 'px';
    body.appendChild(ghost);
    createDrag = { dateKey, startH, endH: startH + STEP_H, ghostEl: ghost, bodyEl: body };
  });

  // Double-click to add event — snaps to STEP_H (15 min)
  body.addEventListener('dblclick', e => {
    if (e.target.closest('.ev')) return;
    const y = e.clientY - body.getBoundingClientRect().top;
    const startAt = clampTime(Math.round((y / PX_PER_HOUR + START_H) / STEP_H) * STEP_H);
    openModal({ dateKey, startH: startAt });
  });

  const events = getEventsForDate(dateKey, activeUser);
  const layout = computeLayout(events);

  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (viewMode === 'day') {
      empty.innerHTML = 'no events yet<span>click and drag to create, or use + button</span>';
    } else {
      empty.innerHTML = '<span>empty</span>';
    }
    body.appendChild(empty);
  }

  events.forEach(ev => {
    body.appendChild(buildEventEl(ev, dateKey, layout[ev.id] || { col: 0, total: 1 }));
  });

  col.appendChild(body);
  return col;
}

function buildEventEl(ev, dateKey, layout = { col: 0, total: 1 }) {
  const top    = (ev.start - START_H) * PX_PER_HOUR;
  const height = Math.max((ev.end - ev.start) * PX_PER_HOUR, 24);
  const p      = palette(ev);
  const conflict = hasConflict(activeUser, dateKey, ev);

  const div = document.createElement('div');
  div.className = 'ev' + (ev.done ? ' done' : '') + (conflict ? ' conflict' : '');
  div.tabIndex = 0;
  div.setAttribute('role', 'button');
  div.setAttribute('aria-label', `${ev.text}, ${fmtFull(ev.start)} to ${fmtFull(ev.end)}${ev.shared ? ', shared' : ''}${ev.done ? ', completed' : ''}`);
  div.title = `${fmtFull(ev.start)} – ${fmtFull(ev.end)} (${fmtDuration(ev.start, ev.end)})`;
  if (ev.location) div.title += `\nlocation: ${ev.location}`;
  if (ev.description) div.title += `\n${ev.description}`;
  if (ev.updatedAt) div.title += `\nupdated ${fmtRelativeTime(ev.updatedAt)} by ${ev.updatedBy || activeUser}`;

  let posStyle = `top:${top}px;height:${height}px;background:${p.bg};`;
  if (layout.total > 1) {
    const pct = 100 / layout.total;
    posStyle += `left:calc(${layout.col * pct}% + 2px);width:calc(${pct}% - 4px);right:auto;`;
  }
  div.style.cssText = posStyle;
  div.dataset.id = ev.id;

  const badge = ev.shared ? `<span class="ev-shared">shared</span>` : '';
  div.innerHTML =
    '<div class="resize-handle top" data-r="top"></div>' +
    '<div class="resize-handle bottom" data-r="bottom"></div>' +
    `<div class="ev-title" style="color:${p.text}">${escHtml(ev.text)}${badge}</div>` +
    (height >= 40
      ? `<div class="ev-time" style="color:${p.text}">${fmtFull(ev.start)} – ${fmtFull(ev.end)} · ${fmtDuration(ev.start, ev.end)}</div>`
      : height >= 28
        ? `<div class="ev-time" style="color:${p.text}">${fmtDuration(ev.start, ev.end)}</div>`
        : '') +
    (height >= 58 && ev.updatedAt
      ? `<div class="ev-meta" style="color:${p.text}">updated ${escHtml(fmtRelativeTime(ev.updatedAt))}</div>`
      : '') +
    `<div class="ev-actions">` +
      `<button class="ev-act" data-a="dup"  style="color:${p.text}" title="Repeat event" aria-label="Repeat ${escHtml(ev.text)}">&#10697;</button>` +
      `<button class="ev-act" data-a="share" style="color:${p.text}" title="Share link" aria-label="Share ${escHtml(ev.text)}">&#8599;</button>` +
      `<button class="ev-act" data-a="edit" style="color:${p.text}" title="Edit" aria-label="Edit ${escHtml(ev.text)}">&#9998;</button>` +
      `<button class="ev-act" data-a="done" style="color:${p.text}" aria-label="${ev.done ? 'Mark incomplete' : 'Mark complete'}: ${escHtml(ev.text)}">${ev.done ? '&#8617;' : '&#10003;'}</button>` +
      `<button class="ev-act" data-a="del"  style="color:${p.text}" aria-label="Delete ${escHtml(ev.text)}">&#215;</button>` +
    `</div>`;

  div.addEventListener('mousedown', mE => {
    if (mE.target.closest('.ev-act')) return;
    const handle = mE.target.closest('.resize-handle');
    if (handle) {
      startDrag(mE, handle.dataset.r === 'top' ? 'resize-start' : 'resize-end', dateKey, ev.id);
      return;
    }
    startDrag(mE, 'move', dateKey, ev.id);
  });

  div.addEventListener('click', cE => {
    if (cE.target.closest('.ev-act') || cE.target.closest('.resize-handle')) return;
    if (dragState && dragState.moved) return;
    openModal({ dateKey, editEvId: ev.id });
  });
  onKeyboardActivate(div, e => {
    if (e.target === div) openModal({ dateKey, editEvId: ev.id });
  });

  div.querySelectorAll('.ev-act').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.a;
      if (action === 'edit') { openModal({ dateKey, editEvId: ev.id }); return; }
      if (action === 'dup')  { openRepeatModal(dateKey, ev); return; }
      if (action === 'share') { openShareModal(ev, dateKey); return; }
      if (action === 'del') {
        // Recurring instance → ask which occurrences to remove.
        if (ev.recurrenceId && seriesCount(ev.recurrenceId, activeUser) > 1) {
          openRecurrenceScopeModal({ verb: 'delete', onChoose: scope => {
            pushHistory();
            if (scope === 'this') deleteEvent(dateKey, activeUser, ev.id);
            else deleteRecurringSeries(ev.recurrenceId, activeUser, scope === 'future' ? dateKey : null);
            render();
          }});
          return;
        }
        pushHistory();
        deleteEvent(dateKey, activeUser, ev.id);
        render();
        return;
      }
      if (action === 'done') {
        pushHistory();
        toggleDone(dateKey, activeUser, ev.id);
        const updated = getEventsForDate(dateKey, activeUser).find(item => item.id === ev.id);
        if (!updated || !refreshDraggedEl(updated, dateKey)) renderGrid();
        saveToLocalStorage();
      }
    });
  });

  return div;
}

// Rebuild just the one dragged event in place instead of re-rendering the whole
// grid on every mousemove. Reuses buildEventEl so rendering logic never drifts;
// recomputes the day's layout so the dragged block's overlap column stays correct.
// Returns false if the element wasn't found (caller should fall back to renderGrid).
function refreshDraggedEl(ev, dateKey) {
  const old = document.querySelector(`.ev[data-id="${ev.id}"]`);
  if (!old) return false;
  const layout = computeLayout(getEventsForDate(dateKey, activeUser));
  old.replaceWith(buildEventEl(ev, dateKey, layout[ev.id] || { col: 0, total: 1 }));
  return true;
}

function positionNowLine() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  const todayKey = getDateKey(now);

  document.querySelectorAll('.now-line').forEach(line => {
    const dk = line.dataset.datekey;
    if (dk !== todayKey || h < START_H || h > END_H) {
      line.style.display = 'none';
      return;
    }
    line.style.display = 'block';
    line.style.top = ((h - START_H) * PX_PER_HOUR) + 'px';
  });
}
