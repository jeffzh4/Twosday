function renderYearView() {
  const content = document.getElementById('main-content');
  content.innerHTML = '';

  const year    = currentDate.getFullYear();
  const todayKey = getDateKey(new Date());

  const container = document.createElement('div');
  container.className = 'year-view';

  for (let m = 0; m < 12; m++) {
    const mini = document.createElement('div');
    mini.className = 'mini-month';

    const header = document.createElement('div');
    header.className = 'mini-month-header';
    header.textContent = MONTH_NAMES[m];
    header.addEventListener('click', () => {
      currentDate = new Date(year, m, 1);
      viewMode = 'month';
      render();
    });
    mini.appendChild(header);

    // Day letter headers
    const dayRow = document.createElement('div');
    dayRow.className = 'mini-day-headers';
    ['m','t','w','t','f','s','s'].forEach(letter => {
      const span = document.createElement('span');
      span.textContent = letter;
      dayRow.appendChild(span);
    });
    mini.appendChild(dayRow);

    const weeks = getMonthGrid(year, m);
    weeks.forEach(week => {
      const row = document.createElement('div');
      row.className = 'mini-week';
      week.forEach(date => {
        const dateKey = getDateKey(date);
        const isCurrentMonth = date.getMonth() === m;
        const isToday = dateKey === todayKey;
        const hasEvents = getEventsForDate(dateKey, activeUser).length > 0;

        const cell = document.createElement('div');
        cell.className = 'mini-cell' +
          (isCurrentMonth ? '' : ' other-month') +
          (isToday ? ' today' : '') +
          (hasEvents && isCurrentMonth ? ' has-events' : '');
        cell.textContent = date.getDate();
        cell.title = dateKey;

        cell.addEventListener('click', () => {
          currentDate = new Date(date);
          viewMode = 'day';
          render();
        });

        row.appendChild(cell);
      });
      mini.appendChild(row);
    });

    container.appendChild(mini);
  }

  content.appendChild(container);
}
