// Conflict center
function conflictKey(dateKey, user, a, b, kind) {
  const ids = [a.id, b.id].sort().join(':');
  return `${dateKey}:${user}:${kind}:${ids}`;
}

function collectConflicts({ range = 'upcoming', userScope = 'all' } = {}) {
  const todayKey = getDateKey(new Date());
  const conflicts = [];
  const seen = new Set();

  Object.keys(allData).sort().forEach(dateKey => {
    if (range === 'upcoming' && dateKey < todayKey) return;
    USERS.forEach(user => {
      if (userScope !== 'all' && userScope !== user) return;
      const events = getEventsForDate(dateKey, user);

      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          const a = events[i], b = events[j];
          if (!overlaps(a.start, a.end, b.start, b.end)) continue;
          const key = conflictKey(dateKey, user, a, b, 'own');
          if (seen.has(key)) continue;
          seen.add(key);
          conflicts.push({ dateKey, user, otherUser: null, kind: 'same-profile', a, b });
        }
      }

      events.filter(ev => ev.shared).forEach(ev => {
        const other = getOtherUser(user);
        getEventsForDate(dateKey, other).forEach(otherEv => {
          if (ev.sharedId && ev.sharedId === otherEv.sharedId) return;
          if (!overlaps(ev.start, ev.end, otherEv.start, otherEv.end)) return;
          const key = conflictKey(dateKey, user, ev, otherEv, 'shared');
          if (seen.has(key)) return;
          seen.add(key);
          conflicts.push({ dateKey, user, otherUser: other, kind: 'shared', a: ev, b: otherEv });
        });
      });
    });
  });

  return conflicts.sort((a, b) => a.dateKey.localeCompare(b.dateKey) || a.a.start - b.a.start);
}

function describeConflict(c) {
  const d = parseDateKey(c.dateKey);
  const date = `${DAY_NAMES_LONG[d.getDay()]}, ${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
  const start = Math.min(c.a.start, c.b.start);
  const end = Math.max(c.a.end, c.b.end);
  const people = c.kind === 'shared' ? `${c.user} + ${c.otherUser}` : c.user;
  return { date, time: `${fmtFull(start)} - ${fmtFull(end)}`, people };
}

function renderConflictRows(bg) {
  const range = bg.querySelector('#c-range').value;
  const scope = bg.querySelector('#c-scope').value;
  const conflicts = collectConflicts({ range, userScope: scope });
  const list = bg.querySelector('#c-list');
  const summary = bg.querySelector('#c-summary');

  summary.textContent = conflicts.length
    ? `${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'} found`
    : 'no conflicts found';

  if (!conflicts.length) {
    list.innerHTML = '<div class="conflict-center-empty">nothing is overlapping in this view</div>';
    return;
  }

  list.innerHTML = '';
  conflicts.slice(0, 40).forEach(c => {
    const meta = describeConflict(c);
    const row = document.createElement('div');
    row.className = 'conflict-center-row';
    row.innerHTML = `
      <div class="conflict-center-date">
        <strong>${escHtml(meta.date)}</strong>
        <span>${escHtml(meta.time)}</span>
      </div>
      <div class="conflict-center-events">
        <span>${escHtml(c.a.text)}</span>
        <span>${escHtml(c.b.text)}</span>
        <em>${escHtml(meta.people)} · ${c.kind === 'shared' ? 'shared overlap' : 'same profile'}</em>
      </div>
      <div class="conflict-center-actions">
        <button class="mbtn mbtn-cancel" data-a="view">view</button>
        <button class="mbtn mbtn-cancel" data-a="edit">edit</button>
        <button class="mbtn mbtn-save" data-a="find">find time</button>
      </div>
    `;

    row.querySelector('[data-a="view"]').onclick = () => {
      currentDate = parseDateKey(c.dateKey);
      activeUser = c.user;
      viewMode = 'day';
      bg.remove();
      applyTheme();
      render();
    };
    row.querySelector('[data-a="edit"]').onclick = () => {
      currentDate = parseDateKey(c.dateKey);
      activeUser = c.user;
      bg.remove();
      applyTheme();
      render();
      setTimeout(() => openModal({ dateKey: c.dateKey, editEvId: c.a.id }), 80);
    };
    row.querySelector('[data-a="find"]').onclick = () => {
      currentDate = parseDateKey(c.dateKey);
      bg.remove();
      render();
      setTimeout(() => openFindTimeModal(), 80);
    };

    list.appendChild(row);
  });

  if (conflicts.length > 40) {
    const more = document.createElement('div');
    more.className = 'conflict-center-empty';
    more.textContent = `${conflicts.length - 40} more hidden`;
    list.appendChild(more);
  }
}

function openConflictsModal() {
  if (document.querySelector('.modal-bg')) return;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal conflict-center-modal">
      <div class="conflict-center-head">
        <div>
          <h3>conflict center</h3>
          <p>review overlaps and jump straight to a fix</p>
        </div>
        <button class="conflict-center-close" id="c-close">&times;</button>
      </div>
      <div class="conflict-center-controls">
        <label>
          <span>range</span>
          <select id="c-range">
            <option value="upcoming">upcoming</option>
            <option value="all">all dates</option>
          </select>
        </label>
        <label>
          <span>profile</span>
          <select id="c-scope">
            <option value="all">all profiles</option>
            ${USERS.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="conflict-center-summary" id="c-summary"></div>
      <div class="conflict-center-list" id="c-list"></div>
    </div>
  `;

  function close() { bg.remove(); }
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  document.getElementById('c-close').onclick = close;
  ['c-range', 'c-scope'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => renderConflictRows(bg));
  });
  renderConflictRows(bg);
}
