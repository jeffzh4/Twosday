// ── Mutual free-window detector ──────────────────────────────────────────────
function mergeBusyIntervals(intervals) {
  const clipped = intervals
    .map(i => ({ start: clampTime(i.start), end: clampTime(i.end) }))
    .filter(i => i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged = [];
  clipped.forEach(i => {
    const last = merged[merged.length - 1];
    if (!last || i.start > last.end) {
      merged.push({ ...i });
    } else {
      last.end = Math.max(last.end, i.end);
    }
  });
  return merged;
}

function getMutualBusyIntervals(dateKey) {
  const seenShared = new Set();
  const intervals = [];

  USERS.forEach(user => {
    getEventsForDate(dateKey, user).forEach(ev => {
      // Shared events are mirrored into both profiles. Count the mirror pair once
      // so a shared 9-10 event does not appear as two separate conflicts.
      if (ev.sharedId) {
        if (seenShared.has(ev.sharedId)) return;
        seenShared.add(ev.sharedId);
      }
      intervals.push({ start: ev.start, end: ev.end });
    });
  });

  return mergeBusyIntervals(intervals);
}

function findMutualFreeWindows({ startDate, days, duration, windowStart, windowEnd }) {
  const results = [];
  const minEnd = Math.max(windowStart + duration, windowEnd);

  if (duration <= 0 || windowStart < START_H || minEnd > END_H) return results;

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const dateKey = getDateKey(date);
    let cursor = windowStart;

    getMutualBusyIntervals(dateKey).forEach(busy => {
      if (busy.end <= windowStart || busy.start >= windowEnd) return;
      const busyStart = Math.max(windowStart, busy.start);
      const busyEnd = Math.min(windowEnd, busy.end);
      if (busyStart - cursor >= duration) {
        results.push({ dateKey, start: cursor, end: busyStart });
      }
      cursor = Math.max(cursor, busyEnd);
    });

    if (windowEnd - cursor >= duration) {
      results.push({ dateKey, start: cursor, end: windowEnd });
    }
  }

  return results;
}

function scoreFreeWindow(slot) {
  const todayKey = getDateKey(new Date());
  const dateDist = Math.abs(parseDateKey(slot.dateKey) - parseDateKey(todayKey));
  const midday = Math.abs(((slot.start + slot.end) / 2) - 13);
  return dateDist / 86400000 + midday / 24;
}

function openFindTimeModal() {
  if (document.querySelector('.modal-bg')) return;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal find-time-modal">
      <div class="find-time-head">
        <h3>find time</h3>
        <button class="find-time-close" id="ft-close">&times;</button>
      </div>
      <div class="find-time-copy">mutual openings for ${escHtml(USERS[0])} and ${escHtml(USERS[1])}</div>
      <div class="field-row">
        <div class="field">
          <label>starting</label>
          <input type="date" id="ft-date" value="${getDateKey(currentDate)}" />
        </div>
        <div class="field">
          <label>range</label>
          <select id="ft-days">
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>duration</label>
          <select id="ft-duration">
            <option value="0.5">30 min</option>
            <option value="1" selected>1 hour</option>
            <option value="1.5">1.5 hours</option>
            <option value="2">2 hours</option>
            <option value="3">3 hours</option>
          </select>
        </div>
        <div class="field">
          <label>show</label>
          <select id="ft-sort">
            <option value="soonest">soonest</option>
            <option value="best">best fit</option>
            <option value="longest">longest</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>after</label>
          <input type="time" id="ft-start" value="08:00" />
        </div>
        <div class="field">
          <label>before</label>
          <input type="time" id="ft-end" value="22:00" />
        </div>
      </div>
      <div class="find-time-summary" id="ft-summary"></div>
      <div class="find-time-results" id="ft-results"></div>
    </div>
  `;

  function close() { bg.remove(); }
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  document.getElementById('ft-close').onclick = close;

  function readOptions() {
    return {
      startDate: parseDateKey(document.getElementById('ft-date').value),
      days: Number(document.getElementById('ft-days').value),
      duration: Number(document.getElementById('ft-duration').value),
      windowStart: timeInputToDecimal(document.getElementById('ft-start').value),
      windowEnd: timeInputToDecimal(document.getElementById('ft-end').value),
      sort: document.getElementById('ft-sort').value,
    };
  }

  function renderResults() {
    const opts = readOptions();
    const summary = document.getElementById('ft-summary');
    const resultsEl = document.getElementById('ft-results');

    if (!opts.startDate || opts.windowEnd <= opts.windowStart || opts.windowEnd - opts.windowStart < opts.duration) {
      summary.textContent = 'choose a longer daily window';
      resultsEl.innerHTML = '';
      return;
    }

    let results = findMutualFreeWindows(opts);
    if (opts.sort === 'longest') {
      results.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.dateKey.localeCompare(b.dateKey));
    } else if (opts.sort === 'best') {
      results.sort((a, b) => scoreFreeWindow(a) - scoreFreeWindow(b));
    }

    summary.textContent = results.length
      ? `${results.length} mutual opening${results.length === 1 ? '' : 's'} found`
      : 'no mutual openings found';

    if (!results.length) {
      resultsEl.innerHTML = '<div class="find-time-empty">try a shorter duration or wider daily window</div>';
      return;
    }

    resultsEl.innerHTML = '';
    results.slice(0, 24).forEach(slot => {
      const d = parseDateKey(slot.dateKey);
      const p = document.createElement('div');
      p.className = 'find-time-result';
      p.innerHTML = `
        <div class="find-time-date">
          <strong>${escHtml(DAY_NAMES_LONG[d.getDay()])}</strong>
          <span>${escHtml(MONTH_SHORT[d.getMonth()])} ${d.getDate()}</span>
        </div>
        <div class="find-time-slot">
          <strong>${fmtFull(slot.start)} - ${fmtFull(slot.start + opts.duration)}</strong>
          <span>${fmtDuration(slot.start, slot.end)} open until ${fmtFull(slot.end)}</span>
        </div>
        <div class="find-time-actions">
          <button class="mbtn mbtn-cancel" data-a="view">view</button>
          <button class="mbtn mbtn-save" data-a="book">book</button>
        </div>
      `;

      p.querySelector('[data-a="view"]').onclick = () => {
        currentDate = parseDateKey(slot.dateKey);
        viewMode = 'day';
        close();
        render();
      };
      p.querySelector('[data-a="book"]').onclick = () => {
        close();
        openModal({
          dateKey: slot.dateKey,
          startH: slot.start,
          endH: slot.start + opts.duration,
          sharedDefault: true,
        });
      };
      resultsEl.appendChild(p);
    });

    if (results.length > 24) {
      const more = document.createElement('div');
      more.className = 'find-time-empty';
      more.textContent = `${results.length - 24} more openings hidden`;
      resultsEl.appendChild(more);
    }
  }

  ['ft-date','ft-days','ft-duration','ft-sort','ft-start','ft-end'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderResults);
  });
  renderResults();
}
