function renderMonthView() {
  const content = document.getElementById('main-content');
  content.innerHTML = '';

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const weeks = getMonthGrid(year, month);
  const todayKey = getDateKey(new Date());

  const container = document.createElement('div');
  container.className = 'month-view';

  // Day-of-week header row (Sun-first to match the grid, which starts on Sunday)
  const dayHeaders = document.createElement('div');
  dayHeaders.className = 'month-day-headers';
  ['sun','mon','tue','wed','thu','fri','sat'].forEach(d => {
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
      const externalEvents = typeof getGoogleCalendarEvents === 'function' ? getGoogleCalendarEvents(dateKey) : [];

      const cell = document.createElement('div');
      cell.className = 'month-cell' +
        (isCurrentMonth ? '' : ' other-month') +
        (isToday ? ' today' : '');
      cell.tabIndex = 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `${date.toLocaleDateString()}, ${events.length} event${events.length === 1 ? '' : 's'}`);

      const dateNum = document.createElement('div');
      dateNum.className = 'month-date-num';
      dateNum.textContent = date.getDate();
      cell.appendChild(dateNum);

      const maxShow = 3;
      events.slice(0, maxShow).forEach(ev => {
        const p = palette(ev);
        const pill = document.createElement('div');
        pill.className = 'month-ev-pill ' + (ev.shared ? 'shared-event' : 'personal-event') + (ev.done ? ' done' : '');
        pill.tabIndex = 0;
        pill.setAttribute('role', 'button');
        pill.setAttribute('aria-label', `Edit ${ev.text}, ${fmtFull(ev.start)} to ${fmtFull(ev.end)}`);
        pill.style.cssText = `background:${p.bg};color:${p.text};`;
        pill.textContent = ev.text;
        pill.title = `${fmtFull(ev.start)} – ${fmtFull(ev.end)}: ${ev.text}`;
        pill.addEventListener('click', e => {
          e.stopPropagation();
          openModal({ dateKey, editEvId: ev.id });
        });
        onKeyboardActivate(pill, () => pill.click());
        cell.appendChild(pill);
      });

      if (externalEvents.length) {
        const busy = document.createElement('div');
        busy.className = 'month-external-pill';
        busy.textContent = `Google busy${externalEvents.length > 1 ? ` · ${externalEvents.length}` : ''}`;
        busy.title = `${externalEvents.length} read-only Google Calendar block${externalEvents.length === 1 ? '' : 's'}`;
        busy.addEventListener('click', event => event.stopPropagation());
        cell.appendChild(busy);
      }

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
      onKeyboardActivate(cell, () => cell.click());

      row.appendChild(cell);
    });

    body.appendChild(row);
  });

  // Empty state: shown when the current month has no events at all
  const monthHasEvents = weeks.some(week =>
    week.some(date => date.getMonth() === month && getEventsForDate(getDateKey(date), activeUser).length > 0)
  );
  if (!monthHasEvents) {
    const empty = document.createElement('div');
    empty.className = 'month-empty-state';
    empty.innerHTML = 'nothing this month<span>click any day to add your first event</span>';
    body.appendChild(empty);
  }

  container.appendChild(body);
  content.appendChild(container);
}
