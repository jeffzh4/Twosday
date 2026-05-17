function renderMonthView() {
  const content = document.getElementById('main-content');
  content.innerHTML = '';

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = getMonthGrid(year, month);
  const todayKey = getDateKey(new Date());

  const container = document.createElement('div');
  container.className = 'month-view';

  // Day-of-week header row
  const dayHeaders = document.createElement('div');
  dayHeaders.className = 'month-day-headers';
  ['mon','tue','wed','thu','fri','sat','sun'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'month-day-header';
    h.textContent = d;
    dayHeaders.appendChild(h);
  });
  container.appendChild(dayHeaders);

  // Scrollable body
  const body = document.createElement('div');
  body.className = 'month-body';

  weeks.forEach(week => {
    const row = document.createElement('div');
    row.className = 'month-row';

    week.forEach(date => {
      const dateKey = getDateKey(date);
      const isCurrentMonth = date.getMonth() === month;
      const isToday = dateKey === todayKey;
      const events = getEventsForDate(dateKey, activeUser);

      const cell = document.createElement('div');
      cell.className = 'month-cell' +
        (isCurrentMonth ? '' : ' other-month') +
        (isToday ? ' today' : '');

      const dateNum = document.createElement('div');
      dateNum.className = 'month-date-num';
      dateNum.textContent = date.getDate();
      cell.appendChild(dateNum);

      const maxShow = 3;
      events.slice(0, maxShow).forEach(ev => {
        const p = palette(ev);
        const pill = document.createElement('div');
        pill.className = 'month-ev-pill' + (ev.done ? ' done' : '');
        pill.style.cssText = `background:${p.bg};color:${p.text};`;
        pill.textContent = ev.text;
        pill.title = `${fmtFull(ev.start)} – ${fmtFull(ev.end)}: ${ev.text}`;
        pill.addEventListener('click', e => {
          e.stopPropagation();
          openModal({ dateKey, editEvId: ev.id });
        });
        cell.appendChild(pill);
      });

      if (events.length > maxShow) {
        const more = document.createElement('div');
        more.className = 'month-more';
        more.textContent = `+${events.length - maxShow} more`;
        cell.appendChild(more);
      }

      // Single click → day view
      cell.addEventListener('click', () => {
        currentDate = new Date(date);
        viewMode = 'day';
        render();
      });

      // Double click → open add modal for that day
      cell.addEventListener('dblclick', e => {
        e.stopPropagation();
        currentDate = new Date(date);
        openModal({ dateKey });
      });

      row.appendChild(cell);
    });

    body.appendChild(row);
  });

  container.appendChild(body);
  content.appendChild(container);
}
