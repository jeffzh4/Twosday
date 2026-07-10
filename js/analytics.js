// Analytics dashboard
const ANALYTICS_CATEGORIES = [
  { key: 'class',  label: 'class',  color: 'violet' },
  { key: 'work',   label: 'work',   color: 'blue' },
  { key: 'meal',   label: 'meals',  color: 'green' },
  { key: 'social', label: 'social', color: 'orange' },
  { key: 'other',  label: 'other',  color: 'gray' },
];

function getAnalyticsBounds(rangeKey) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let start = null;
  let end = new Date(today);

  if (rangeKey === '30' || rangeKey === '90') {
    start = new Date(today);
    start.setDate(today.getDate() - Number(rangeKey) + 1);
  } else if (rangeKey === 'year') {
    start = new Date(today.getFullYear(), 0, 1);
  }

  return { start, end };
}

function isWithinAnalyticsRange(date, bounds) {
  if (bounds.start && date < bounds.start) return false;
  if (bounds.end && date > bounds.end) return false;
  return true;
}

function getAnalyticsEvents(rangeKey, scope) {
  const bounds = getAnalyticsBounds(rangeKey);
  const events = [];
  const seenShared = new Set();

  Object.keys(allData).sort().forEach(dateKey => {
    const date = parseDateKey(dateKey);
    if (!isWithinAnalyticsRange(date, bounds)) return;

    USERS.forEach(user => {
      if (scope !== 'both' && scope !== user) return;
      getEventsForDate(dateKey, user).forEach(ev => {
        if (scope === 'both' && ev.sharedId) {
          const sharedKey = dateKey + ':' + ev.sharedId;
          if (seenShared.has(sharedKey)) return;
          seenShared.add(sharedKey);
        }
        const duration = Math.max(0, ev.end - ev.start);
        events.push({
          ...ev,
          date,
          dateKey,
          user,
          duration,
          category: categorize(ev.text),
        });
      });
    });
  });

  return events;
}

function getAnalyticsProfileLoads(rangeKey) {
  const bounds = getAnalyticsBounds(rangeKey);
  const loads = {};
  USERS.forEach(u => { loads[u] = { events: 0, hours: 0, done: 0 }; });

  Object.keys(allData).forEach(dateKey => {
    const date = parseDateKey(dateKey);
    if (!isWithinAnalyticsRange(date, bounds)) return;
    USERS.forEach(user => {
      getEventsForDate(dateKey, user).forEach(ev => {
        const duration = Math.max(0, ev.end - ev.start);
        loads[user].events++;
        loads[user].hours += duration;
        if (ev.done) loads[user].done++;
      });
    });
  });

  return loads;
}

function getAnalyticsSummary(events, rangeKey) {
  const totalEvents = events.length;
  const totalHours = events.reduce((sum, ev) => sum + ev.duration, 0);
  const done = events.filter(ev => ev.done).length;
  const shared = events.filter(ev => ev.shared).length;
  const sharedHours = events.filter(ev => ev.shared).reduce((sum, ev) => sum + ev.duration, 0);
  const uniqueDays = new Set(events.map(ev => ev.dateKey)).size;
  const rangeDays = getAnalyticsRangeDays(events, rangeKey);

  const hourBuckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: 0, hours: 0 }));
  const dayBuckets = Array.from({ length: 7 }, (_, day) => ({ day, count: 0, hours: 0 }));
  events.forEach(ev => {
    const startHour = Math.floor(ev.start);
    if (hourBuckets[startHour]) {
      hourBuckets[startHour].count++;
      hourBuckets[startHour].hours += ev.duration;
    }
    const day = ev.date.getDay();
    dayBuckets[day].count++;
    dayBuckets[day].hours += ev.duration;
  });

  const busiestHour = hourBuckets.reduce((best, cur) => cur.count > best.count ? cur : best, hourBuckets[0]);
  const busiestDay = dayBuckets.reduce((best, cur) => cur.count > best.count ? cur : best, dayBuckets[0]);

  return {
    totalEvents,
    totalHours,
    done,
    shared,
    sharedHours,
    uniqueDays,
    rangeDays,
    avgEventsPerWeek: rangeDays ? totalEvents / (rangeDays / 7) : 0,
    completionRate: totalEvents ? done / totalEvents : 0,
    sharedRate: totalEvents ? shared / totalEvents : 0,
    sharedHourRate: totalHours ? sharedHours / totalHours : 0,
    busiestHour,
    busiestDay,
  };
}

function getAnalyticsRangeDays(events, rangeKey) {
  if (rangeKey === '30' || rangeKey === '90') return Number(rangeKey);
  if (rangeKey === 'year') {
    const start = new Date(new Date().getFullYear(), 0, 1);
    return Math.max(1, Math.round((new Date() - start) / 86400000) + 1);
  }
  if (!events.length) return 1;
  const times = events.map(ev => ev.date.getTime());
  return Math.max(1, Math.round((Math.max(...times) - Math.min(...times)) / 86400000) + 1);
}

function getCategoryStats(events) {
  const stats = {};
  ANALYTICS_CATEGORIES.forEach(c => { stats[c.key] = { ...c, count: 0, hours: 0 }; });
  events.forEach(ev => {
    const key = stats[ev.category] ? ev.category : 'other';
    stats[key].count++;
    stats[key].hours += ev.duration;
  });
  return Object.values(stats).sort((a, b) => b.hours - a.hours);
}

function getWeeklyTrend(events) {
  const weeks = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisSunday = getSundayOfWeek(today);

  for (let i = 7; i >= 0; i--) {
    const start = new Date(thisSunday);
    start.setDate(thisSunday.getDate() - i * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    weeks.push({
      key: getDateKey(start),
      label: `${MONTH_SHORT[start.getMonth()]} ${start.getDate()}`,
      start,
      end,
      count: 0,
      hours: 0,
      done: 0,
    });
  }

  events.forEach(ev => {
    const week = weeks.find(w => ev.date >= w.start && ev.date <= w.end);
    if (!week) return;
    week.count++;
    week.hours += ev.duration;
    if (ev.done) week.done++;
  });

  return weeks;
}

function getHourMatrix(events) {
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => 0));
  events.forEach(ev => {
    const day = ev.date.getDay();
    const blocks = [
      [0, 6], [6, 12], [12, 18], [18, 24],
    ];
    blocks.forEach(([start, end], idx) => {
      const overlap = Math.max(0, Math.min(ev.end, end) - Math.max(ev.start, start));
      matrix[day][idx] += overlap;
    });
  });
  return matrix;
}

function getTopEvents(events) {
  return [...events]
    .sort((a, b) => b.duration - a.duration || a.dateKey.localeCompare(b.dateKey))
    .slice(0, 5);
}

function fmtAnalyticsNumber(n, digits = 1) {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n - Math.round(n)) < 0.05) return String(Math.round(n));
  return n.toFixed(digits);
}

function fmtAnalyticsPercent(n) {
  return Math.round(n * 100) + '%';
}

function renderAnalyticsKpis(summary) {
  return `
    <div class="analytics-kpis">
      <div class="analytics-kpi">
        <span>scheduled</span>
        <strong>${fmtAnalyticsNumber(summary.totalHours)}h</strong>
        <em>${summary.totalEvents} events</em>
      </div>
      <div class="analytics-kpi">
        <span>completion</span>
        <strong>${fmtAnalyticsPercent(summary.completionRate)}</strong>
        <em>${summary.done} completed</em>
      </div>
      <div class="analytics-kpi">
        <span>shared time</span>
        <strong>${fmtAnalyticsPercent(summary.sharedHourRate)}</strong>
        <em>${fmtAnalyticsNumber(summary.sharedHours)}h together</em>
      </div>
      <div class="analytics-kpi">
        <span>pace</span>
        <strong>${fmtAnalyticsNumber(summary.avgEventsPerWeek)}</strong>
        <em>events / week</em>
      </div>
    </div>
  `;
}

function renderCategoryBars(categories, totalHours) {
  return categories.map(cat => {
    const pct = totalHours ? (cat.hours / totalHours) * 100 : 0;
    const p = getColor(cat.color);
    return `
      <div class="analytics-bar-row">
        <div class="analytics-bar-label">
          <span class="analytics-color-dot" style="background:${escHtml(p.text)}"></span>
          <span>${escHtml(cat.label)}</span>
        </div>
        <div class="analytics-bar-track">
          <div class="analytics-bar-fill" style="width:${pct}%;background:${escHtml(p.text)}"></div>
        </div>
        <div class="analytics-bar-value">${fmtAnalyticsNumber(cat.hours)}h</div>
      </div>
    `;
  }).join('');
}

function renderWeeklyTrend(weeks) {
  const maxHours = Math.max(1, ...weeks.map(w => w.hours));
  return `
    <div class="analytics-week-bars">
      ${weeks.map(w => `
        <div class="analytics-week">
          <div class="analytics-week-bar" style="height:${Math.max(4, (w.hours / maxHours) * 100)}%"></div>
          <span>${escHtml(w.label)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderHeatmap(matrix) {
  const max = Math.max(1, ...matrix.flat());
  const blocks = ['night', 'am', 'pm', 'eve'];
  return `
    <div class="analytics-heatmap">
      <div></div>
      ${blocks.map(b => `<span>${b}</span>`).join('')}
      ${matrix.map((row, dayIdx) => `
        <span>${DAY_NAMES_LONG[dayIdx].slice(0, 3)}</span>
        ${row.map(hours => {
          const level = hours / max;
          return `<div class="analytics-heat-cell" style="opacity:${0.18 + level * 0.82}" title="${fmtAnalyticsNumber(hours)} scheduled hours"></div>`;
        }).join('')}
      `).join('')}
    </div>
  `;
}

function renderProfileBalance(loads) {
  const maxHours = Math.max(1, ...Object.values(loads).map(v => v.hours));
  return USERS.map((user, idx) => {
    const load = loads[user] || { events: 0, hours: 0, done: 0 };
    const pct = (load.hours / maxHours) * 100;
    return `
      <div class="analytics-profile-row user-${idx}">
        <div>
          <strong>${escHtml(user)}</strong>
          <span>${load.events} events</span>
        </div>
        <div class="analytics-profile-track">
          <div style="width:${pct}%"></div>
        </div>
        <em>${fmtAnalyticsNumber(load.hours)}h</em>
      </div>
    `;
  }).join('');
}

function renderTopEvents(events) {
  if (!events.length) return '<div class="analytics-empty-small">no scheduled events in this range</div>';
  return events.map(ev => `
    <div class="analytics-event-row">
      <div>
        <strong>${escHtml(ev.text)}</strong>
        <span>${escHtml(MONTH_SHORT[ev.date.getMonth()])} ${ev.date.getDate()} &middot; ${escHtml(ev.user)}</span>
      </div>
      <em>${fmtAnalyticsNumber(ev.duration)}h</em>
    </div>
  `).join('');
}

function renderAnalyticsDashboard(bg) {
  const range = document.getElementById('a-range').value;
  const scope = document.getElementById('a-scope').value;
  const events = getAnalyticsEvents(range, scope);
  const summary = getAnalyticsSummary(events, range);
  const categories = getCategoryStats(events);
  const weeks = getWeeklyTrend(events);
  const matrix = getHourMatrix(events);
  const loads = getAnalyticsProfileLoads(range);
  const topEvents = getTopEvents(events);

  const body = bg.querySelector('#a-body');
  if (!events.length) {
    body.innerHTML = `
      ${renderAnalyticsKpis(summary)}
      <div class="analytics-empty">
        <strong>no analytics yet</strong>
        <span>add events in this range to unlock workload, category, and rhythm insights</span>
      </div>
    `;
    return;
  }

  body.innerHTML = `
    ${renderAnalyticsKpis(summary)}
    <div class="analytics-grid">
      <section class="analytics-panel analytics-panel-wide">
        <div class="analytics-panel-head">
          <h4>weekly load</h4>
          <span>${summary.uniqueDays} active days</span>
        </div>
        ${renderWeeklyTrend(weeks)}
      </section>
      <section class="analytics-panel">
        <div class="analytics-panel-head">
          <h4>category mix</h4>
          <span>by hours</span>
        </div>
        ${renderCategoryBars(categories, summary.totalHours)}
      </section>
      <section class="analytics-panel">
        <div class="analytics-panel-head">
          <h4>rhythm map</h4>
          <span>hours by daypart</span>
        </div>
        ${renderHeatmap(matrix)}
      </section>
      <section class="analytics-panel">
        <div class="analytics-panel-head">
          <h4>profile balance</h4>
          <span>shared events count for both</span>
        </div>
        ${renderProfileBalance(loads)}
      </section>
      <section class="analytics-panel">
        <div class="analytics-panel-head">
          <h4>longest blocks</h4>
          <span>${escHtml(DAY_NAMES_LONG[summary.busiestDay.day])} / ${escHtml(fmt(summary.busiestHour.hour))}</span>
        </div>
        ${renderTopEvents(topEvents)}
      </section>
    </div>
  `;
}

function openAnalyticsModal() {
  if (document.querySelector('.modal-bg')) return;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal analytics-modal">
      <div class="analytics-header">
        <div>
          <h3>calendar insights</h3>
          <p>workload, rhythm, and shared-time analytics</p>
        </div>
        <button class="analytics-close" id="a-close">&times;</button>
      </div>
      <div class="analytics-controls">
        <label>
          <span>range</span>
          <select id="a-range">
            <option value="30">last 30 days</option>
            <option value="90" selected>last 90 days</option>
            <option value="year">year to date</option>
            <option value="all">all time</option>
          </select>
        </label>
        <label>
          <span>profile</span>
          <select id="a-scope">
            <option value="both">both profiles</option>
            ${USERS.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('')}
          </select>
        </label>
      </div>
      <div id="a-body"></div>
    </div>
  `;

  function close() { bg.remove(); }
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#a-range', onClose: close });

  document.getElementById('a-close').onclick = close;
  ['a-range', 'a-scope'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => renderAnalyticsDashboard(bg));
  });
  renderAnalyticsDashboard(bg);
}
