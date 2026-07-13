// ── Command palette (⌘K / Ctrl-K) ─────────────────────────────────────────────
// A single discoverable surface over the app's actions and keyboard shortcuts:
// filter by typing, navigate with the arrow keys, run with Enter. Typing a date
// (e.g. 2026-08-14 or 8/14) surfaces a "jump to" command at the top.

function buildCommandList() {
  const setView = v => () => { viewMode = v; render(); };
  return [
    { label: 'New event',        hint: 'n',       keywords: 'add create', run: () => openModal({ dateKey: getDateKey(currentDate) }) },
    { label: 'Go to today',      hint: '',        keywords: 'now current', run: () => gotoToday() },
    { label: 'Next period',      hint: '→',       keywords: 'forward',     run: () => navigate(1) },
    { label: 'Previous period',  hint: '←',       keywords: 'back',        run: () => navigate(-1) },
    { label: 'Day view',         hint: 'd',       keywords: 'view',        run: setView('day') },
    { label: 'Week view',        hint: 'w',       keywords: 'view',        run: setView('week') },
    { label: 'Month view',       hint: 'm',       keywords: 'view',        run: setView('month') },
    { label: 'Year view',        hint: 'y',       keywords: 'view',        run: setView('year') },
    { label: 'Search events',    hint: '/',       keywords: 'find',        run: () => toggleSearch(true) },
    { label: 'Find mutual time', hint: '',        keywords: 'free window schedule', run: () => openFindTimeModal() },
    { label: 'Conflict center',  hint: '',        keywords: 'overlap',     run: () => openConflictsModal() },
    { label: 'Import / export',  hint: '',        keywords: 'ics csv calendar', run: () => openCalendarToolsModal() },
    { label: 'Toggle notes',     hint: '',        keywords: 'panel',       run: () => toggleNotes() },
    { label: 'Toggle theme',     hint: '',        keywords: 'dark light',  run: () => { userTheme[activeUser] = userTheme[activeUser] === 'dark' ? 'light' : 'dark'; applyTheme(); render(); } },
    { label: 'Account settings', hint: '',        keywords: 'profile emoji password export', run: () => openSettingsModal() },
    { label: 'Undo',             hint: '⌘Z',      keywords: '',            run: () => undoAction() },
    { label: 'Redo',             hint: '⌘Y',      keywords: '',            run: () => redoAction() },
  ];
}

// Parse a free-text date query into a date key, or null. Accepts YYYY-MM-DD and
// M/D or M/D/YYYY, defaulting the year to the currently-viewed year.
function parsePaletteDate(q) {
  const iso = q.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    return isNaN(d) ? null : d;
  }
  const slash = q.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slash) {
    let year = slash[3] ? +slash[3] : currentDate.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, +slash[1] - 1, +slash[2]);
    return isNaN(d) ? null : d;
  }
  return null;
}

function openCommandPalette() {
  if (document.querySelector('.modal-bg')) return;
  const commands = buildCommandList();

  const bg = document.createElement('div');
  bg.className = 'modal-bg cmdk-bg';
  bg.innerHTML = `
    <div class="modal cmdk" role="dialog" aria-label="Command palette">
      <div class="cmdk-input-row">
        <span class="cmdk-icon" aria-hidden="true">⌘</span>
        <input id="cmdk-input" class="cmdk-input" placeholder="type a command or a date…"
          autocomplete="off" role="combobox" aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list" />
      </div>
      <div class="cmdk-list" id="cmdk-list" role="listbox"></div>
      <div class="cmdk-hintbar"><kbd>↑</kbd><kbd>↓</kbd> navigate&ensp;·&ensp;<kbd>↵</kbd> run&ensp;·&ensp;<kbd>esc</kbd> close</div>
    </div>
  `;
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#cmdk-input' });

  const input = document.getElementById('cmdk-input');
  const list = document.getElementById('cmdk-list');
  let filtered = commands;
  let active = 0;

  function run(cmd) { bg.remove(); cmd.run(); }

  function computeFiltered(q) {
    const query = q.trim().toLowerCase();
    const result = [];

    const date = parsePaletteDate(q.trim());
    if (date) {
      result.push({
        label: `Jump to ${DAY_NAMES_LONG[date.getDay()]}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`,
        hint: '↵', keywords: '',
        run: () => { currentDate = date; if (viewMode === 'year') viewMode = 'month'; render(); },
      });
    }
    if (!query) return result.concat(commands);
    return result.concat(commands.filter(c =>
      c.label.toLowerCase().includes(query) || (c.keywords || '').includes(query)
    ));
  }

  function renderList() {
    list.innerHTML = '';
    if (!filtered.length) {
      list.innerHTML = '<div class="cmdk-empty">no matching commands</div>';
      return;
    }
    filtered.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'cmdk-item' + (i === active ? ' active' : '');
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(i === active));
      item.innerHTML = `<span class="cmdk-label">${escHtml(cmd.label)}</span>${cmd.hint ? `<kbd class="cmdk-kbd">${escHtml(cmd.hint)}</kbd>` : ''}`;
      item.addEventListener('mouseenter', () => { active = i; renderList(); });
      item.addEventListener('click', () => run(cmd));
      list.appendChild(item);
    });
    const activeEl = list.children[active];
    if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ block: 'nearest' });
  }

  input.addEventListener('input', () => {
    filtered = computeFiltered(input.value);
    active = 0;
    renderList();
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, filtered.length - 1); renderList(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); renderList(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) run(filtered[active]); }
  });

  renderList();
}
