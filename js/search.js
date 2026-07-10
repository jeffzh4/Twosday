let searchOpen = false;
let _searchDebounce = null;

function toggleSearch(force) {
  searchOpen = force !== undefined ? force : !searchOpen;
  const container = document.getElementById('search-container');
  container.style.display = searchOpen ? 'flex' : 'none';
  container.setAttribute('aria-hidden', String(!searchOpen));
  document.getElementById('btn-search').setAttribute('aria-expanded', String(searchOpen));
  if (searchOpen) {
    const input = document.getElementById('search-input');
    input.value = '';
    input.focus();
    renderSearchResults('');
  }
}

function onSearchInput(query) {
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(() => renderSearchResults(query), 120);
}

function renderSearchResults(query) {
  const resultsEl = document.getElementById('search-results');
  const q = query.trim().toLowerCase();

  if (!q) {
    resultsEl.innerHTML = '<div class="search-empty">type to search events across all dates</div>';
    return;
  }

  // Collect matching events sorted by date
  const results = [];
  Object.keys(allData).sort().forEach(dateKey => {
    getEventsForDate(dateKey, activeUser).forEach(ev => {
      if (ev.text.toLowerCase().includes(q)) {
        results.push({ dateKey, ev });
      }
    });
  });

  if (!results.length) {
    resultsEl.innerHTML = `<div class="search-empty">no events matching &ldquo;${escHtml(query)}&rdquo;</div>`;
    return;
  }

  resultsEl.innerHTML = '';
  const todayKey = getDateKey(new Date());

  results.slice(0, 30).forEach(({ dateKey, ev }) => {
    const p = palette(ev);
    const d = parseDateKey(dateKey);
    const dayShort  = DAY_NAMES_LONG[d.getDay()].slice(0, 3);
    const monthShort = MONTH_SHORT[d.getMonth()];
    const isToday   = dateKey === todayKey;

    // Highlight the matching substring
    const idx = ev.text.toLowerCase().indexOf(q);
    const before = escHtml(ev.text.slice(0, idx));
    const match  = escHtml(ev.text.slice(idx, idx + q.length));
    const after  = escHtml(ev.text.slice(idx + q.length));
    const highlighted = `${before}<mark>${match}</mark>${after}`;

    const row = document.createElement('div');
    row.className = 'search-result' + (ev.done ? ' done' : '');
    row.tabIndex = 0;
    row.setAttribute('role', 'button');
    row.setAttribute('aria-label', `${ev.text}, ${fmtFull(ev.start)} to ${fmtFull(ev.end)}, ${dateKey}`);
    row.innerHTML =
      `<span class="search-result-dot" style="background:${p.text}"></span>` +
      `<span class="search-result-date${isToday ? ' today' : ''}">${isToday ? 'today' : `${dayShort}, ${monthShort} ${d.getDate()}`}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}</span>` +
      `<span class="search-result-time">${fmtFull(ev.start)} – ${fmtFull(ev.end)}</span>` +
      `<span class="search-result-name" style="color:${p.text}">${highlighted}</span>` +
      (ev.done ? '<span class="search-result-tag">done</span>' : '') +
      (ev.shared ? '<span class="search-result-tag">shared</span>' : '');

    row.addEventListener('click', () => {
      currentDate = parseDateKey(dateKey);
      viewMode = 'day';
      toggleSearch(false);
      render();
      // Small delay to let the grid paint before opening modal
      setTimeout(() => openModal({ dateKey, editEvId: ev.id }), 80);
    });
    onKeyboardActivate(row, () => row.click());

    resultsEl.appendChild(row);
  });

  if (results.length > 30) {
    const more = document.createElement('div');
    more.className = 'search-empty';
    more.textContent = `${results.length - 30} more — refine your search`;
    resultsEl.appendChild(more);
  }
}
