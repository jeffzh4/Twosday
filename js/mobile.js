// Mobile shell enhancements. They only change presentation and entry points;
// every calendar mutation continues through the standard modal and event flows.
function isMobileCalendarViewport() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function renderMobileNavigation() {
  const nav = document.getElementById('mobile-nav');
  if (!nav) return;
  nav.innerHTML = '';

  const addButton = (label, action, active = false, extraClass = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `mobile-nav-btn ${extraClass}${active ? ' active' : ''}`;
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(active));
    button.innerHTML = `<span class="mobile-nav-icon" aria-hidden="true">${label === 'Add event' ? '+' : label === 'Calendar' ? '&#9635;' : label === 'Week' ? '&#9783;' : label === 'Month' ? '&#9638;' : label === 'Find time' ? '&#8981;' : '&#8942;'}</span><span>${label}</span>`;
    button.addEventListener('click', action);
    nav.appendChild(button);
  };

  addButton('Calendar', () => { viewMode = 'day'; render(); }, viewMode === 'day');
  addButton('Week', () => { viewMode = 'week'; render(); }, viewMode === 'week');
  addButton('Add event', () => openModal({ dateKey: getDateKey(currentDate) }), false, 'mobile-nav-add');
  addButton('Month', () => { viewMode = 'month'; render(); }, viewMode === 'month');
  addButton('More', openMobileMoreSheet);
}

function openMobileMoreSheet() {
  if (document.querySelector('.mobile-more-sheet')) return;
  const sheet = document.createElement('div');
  sheet.className = 'mobile-more-sheet modal-bg';
  sheet.innerHTML = `
    <section class="mobile-more-panel" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title">
      <div class="mobile-sheet-handle" aria-hidden="true"></div>
      <div class="mobile-more-heading">
        <h2 id="mobile-more-title">more</h2>
        <button type="button" class="mobile-sheet-close" aria-label="Close more menu">&times;</button>
      </div>
      <div class="mobile-more-grid">
        <button type="button" data-mobile-action="find"><span aria-hidden="true">&#8981;</span>find time</button>
        <button type="button" data-mobile-action="search"><span aria-hidden="true">&#128269;</span>search</button>
        <button type="button" data-mobile-action="year"><span aria-hidden="true">&#9638;</span>year view</button>
        <button type="button" data-mobile-action="activity"><span aria-hidden="true">&#8801;</span>activity</button>
        <button type="button" data-mobile-action="tools"><span aria-hidden="true">&#8645;</span>import/export</button>
        <button type="button" data-mobile-action="conflicts"><span aria-hidden="true">!</span>conflicts</button>
        <button type="button" data-mobile-action="notes"><span aria-hidden="true">&#9998;</span>notes</button>
        <button type="button" data-mobile-action="theme"><span aria-hidden="true">&#9790;</span>theme</button>
        <button type="button" data-mobile-action="undo" ${appHistory.undo.length ? '' : 'disabled'}><span aria-hidden="true">&#8630;</span>undo</button>
        <button type="button" data-mobile-action="redo" ${appHistory.redo.length ? '' : 'disabled'}><span aria-hidden="true">&#8631;</span>redo</button>
        <button type="button" data-mobile-action="install"><span aria-hidden="true">&#8681;</span>${typeof canInstallTwosday === 'function' && canInstallTwosday() ? 'install app' : 'install help'}</button>
        <button type="button" data-mobile-action="sync"><span aria-hidden="true">&#8635;</span>${navigator.onLine === false ? 'offline' : 'sync status'}</button>
        <button type="button" data-mobile-action="settings"><span aria-hidden="true">&#9881;</span>settings</button>
        <button type="button" data-mobile-action="logout"><span aria-hidden="true">&#8594;</span>log out</button>
      </div>
    </section>`;

  const close = () => sheet.remove();
  sheet.addEventListener('click', event => { if (event.target === sheet) close(); });
  sheet.querySelector('.mobile-sheet-close').addEventListener('click', close);
  sheet.querySelectorAll('[data-mobile-action]').forEach(button => {
    button.addEventListener('click', () => {
      const action = button.dataset.mobileAction;
      close();
      if (action === 'find') openFindTimeModal();
      if (action === 'search') toggleSearch();
      if (action === 'year') { viewMode = 'year'; render(); }
      if (action === 'activity') openAuditModal();
      if (action === 'tools') openCalendarToolsModal();
      if (action === 'conflicts') openConflictsModal();
      if (action === 'notes') toggleNotes();
      if (action === 'undo') undoAction();
      if (action === 'redo') redoAction();
      if (action === 'theme') {
        userTheme[activeUser] = userTheme[activeUser] === 'dark' ? 'light' : 'dark';
        applyTheme();
        render();
      }
      if (action === 'install') promptTwosdayInstall();
      if (action === 'sync') showToast(navigator.onLine === false ? 'offline changes stay on this device until reconnect' : 'calendar is connected', 'info');
      if (action === 'settings') openSettingsModal();
      if (action === 'logout') logout();
    });
  });
  document.body.appendChild(sheet);
  makeModalAccessible(sheet, { initialFocusSelector: '.mobile-sheet-close' });
}
