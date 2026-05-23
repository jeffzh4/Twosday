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
    head.addEventListener('click', () => {
      currentDate = new Date(date);
      viewMode = 'day';
      render();
    });
  }
  col.appendChild(head);

  // Body
  const body = document.createElement('div');
  body.className = 'col-body';
  body.dataset.datekey = dateKey;
  body.style.height = ((END_H - START_H) * PX_PER_HOUR) + 'px';

  // Hour & half-hour grid lines
  for (let h = START_H; h < END_H; h++) {
    const line = document.createElement('div');
    line.className = 'hour-line';
    line.style.top = ((h - START_H) * PX_PER_HOUR) + 'px';
    body.appendChild(line);

    const half = document.createElement('div');
    half.className = 'hour-line half';
    half.style.top = ((h - START_H + 0.5) * PX_PER_HOUR) + 'px';
    body.appendChild(half);
  }

  // Now line
  const nowLine = document.createElement('div');
  nowLine.className = 'now-line';
  nowLine.dataset.datekey = dateKey;
  body.appendChild(nowLine);

  // Double-click to add event
  body.addEventListener('dblclick', e => {
    if (e.target.closest('.ev')) return;
    const y = e.clientY - body.getBoundingClientRect().top;
    const startAt = clampTime(Math.round((y / PX_PER_HOUR + START_H) * 2) / 2);
    openModal({ dateKey, startH: startAt });
  });

  const events = getEventsForDate(dateKey, activeUser);

  if (!events.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    if (viewMode === 'day') {
      empty.innerHTML = 'no events yet<span>double-click to add, or use + button</span>';
    } else {
      empty.innerHTML = '<span>empty</span>';
    }
    body.appendChild(empty);
  }

  events.forEach(ev => {
    body.appendChild(buildEventEl(ev, dateKey));
  });

  col.appendChild(body);
  return col;
}

function buildEventEl(ev, dateKey) {
  const top    = (ev.start - START_H) * PX_PER_HOUR;
  const height = Math.max((ev.end - ev.start) * PX_PER_HOUR, 24);
  const p       = palette(ev);
  const conflict = hasConflict(activeUser, dateKey, ev);

  const div = document.createElement('div');
  div.className = 'ev' + (ev.done ? ' done' : '') + (conflict ? ' conflict' : '');
  div.style.cssText = `top:${top}px;height:${height}px;background:${p.bg};`;
  div.dataset.id = ev.id;

  const badge = ev.shared ? `<span class="ev-shared">shared</span>` : '';
  div.innerHTML =
    '<div class="resize-handle top" data-r="top"></div>' +
    '<div class="resize-handle bottom" data-r="bottom"></div>' +
    `<div class="ev-title" style="color:${p.text}">${escHtml(ev.text)}${badge}</div>` +
    (height >= 40 ? `<div class="ev-time" style="color:${p.text}">${fmtFull(ev.start)} – ${fmtFull(ev.end)}</div>` : '') +
    `<div class="ev-actions">` +
      `<button class="ev-act" data-a="dup"  style="color:${p.text}" title="Repeat event…">&#10697;</button>` +
      `<button class="ev-act" data-a="edit" style="color:${p.text}" title="Edit">&#9998;</button>` +
      `<button class="ev-act" data-a="done" style="color:${p.text}">${ev.done ? '&#8617;' : '&#10003;'}</button>` +
      `<button class="ev-act" data-a="del"  style="color:${p.text}">&#215;</button>` +
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

  div.querySelectorAll('.ev-act').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const action = btn.dataset.a;
      if (action === 'edit') { openModal({ dateKey, editEvId: ev.id }); return; }
      if (action === 'dup')  { openRepeatModal(dateKey, ev); return; }
      pushHistory();
      if (action === 'del')  deleteEvent(dateKey, activeUser, ev.id);
      if (action === 'done') toggleDone(dateKey, activeUser, ev.id);
      render();
    });
  });

  return div;
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
