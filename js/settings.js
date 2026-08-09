// ── Account settings modal ────────────────────────────────────────────────────

const EMOJI_PRESETS = ['☕','🌙','🌸','😎','🏃','⭐','🎯','🦋','🌿','💫','🎵','🍀','🔥','✨','🌊'];

function getFloatingPopoverPosition(triggerRect, pickerRect, viewportWidth, viewportHeight) {
  const left = Math.max(8, Math.min(triggerRect.left, viewportWidth - pickerRect.width - 8));
  const below = triggerRect.bottom + 6;
  const top = below + pickerRect.height <= viewportHeight - 8
    ? below
    : Math.max(8, triggerRect.top - pickerRect.height - 6);
  return { left, top };
}

// Firebase refuses to change an account's email or password on a stale sign-in,
// so both of those flows have to re-prove the current password first. Throws on
// a missing session or a bad password; callers report the failure to the user.
async function reauthenticate(password) {
  const authUser = firebase.auth().currentUser;
  if (!authUser) throw new Error('sign in again before changing your account');
  const credential = firebase.auth.EmailAuthProvider.credential(authUser.email, password);
  await authUser.reauthenticateWithCredential(credential);
  return authUser;
}

// ── Compute stats across both profiles ───────────────────────────────────────
function computeStats() {
  const now = new Date();
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let total = 0, thisMonth = 0, shared = 0, done = 0;
  const dayCount = [0, 0, 0, 0, 0, 0, 0]; // 0 = Sun … 6 = Sat
  const colorCount = {};

  USERS.forEach((user, userIdx) => {
    Object.keys(allData).forEach(dk => {
      getEventsForDate(dk, user).forEach(ev => {
        // Shared events are mirrored under both profiles — only count from profile 0
        if (ev.shared && userIdx > 0) return;
        total++;
        if (dk.startsWith(thisMonthPrefix)) thisMonth++;
        if (ev.shared) shared++;
        if (ev.done) done++;
        dayCount[parseDateKey(dk).getDay()]++;
        if (ev.color) colorCount[ev.color] = (colorCount[ev.color] || 0) + 1;
      });
    });
  });

  const maxDayVal = Math.max(...dayCount);
  const busiestDay = maxDayVal > 0 ? DAY_NAMES_LONG[dayCount.indexOf(maxDayVal)] : null;

  let topColor = null, topColorHex = null;
  const sortedColors = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
  if (sortedColors.length > 0) {
    topColor = sortedColors[0][0];
    try { topColorHex = getColor(topColor).text; } catch (e) { topColorHex = '#a1a1aa'; }
  }

  return { total, thisMonth, shared, done, busiestDay, topColor, topColorHex };
}

// ── ICS export ────────────────────────────────────────────────────────────────
function _icsDateTime(dk, h) {
  const [y, m, d] = dk.split('-');
  const hh = String(Math.floor(h)).padStart(2, '0');
  const mm = String(Math.round((h % 1) * 60)).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function exportICS(user) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Twosday//Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  Object.keys(allData).sort().forEach(dk => {
    getEventsForDate(dk, user).forEach(ev => {
      // Escape special ICS characters
      const summary = ev.text
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n');
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ev.id}@twosday`,
        `DTSTART:${_icsDateTime(dk, ev.start)}`,
        `DTEND:${_icsDateTime(dk, ev.end)}`,
        `SUMMARY:${summary}`,
        `STATUS:${ev.done ? 'COMPLETED' : 'CONFIRMED'}`,
        ...(ev.shared ? ['CATEGORIES:SHARED'] : []),
        'END:VEVENT',
      );
    });
  });

  lines.push('END:VCALENDAR');

  downloadFile(
    `twosday-${user}-${getDateKey(new Date())}.ics`,
    lines.join('\r\n'),
    'text/calendar;charset=utf-8',
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
function exportCSV(user) {
  const rows = [['date', 'day', 'start_time', 'end_time', 'title', 'done', 'shared', 'color']];

  Object.keys(allData).sort().forEach(dk => {
    getEventsForDate(dk, user).forEach(ev => {
      rows.push([
        dk,
        DAY_NAMES_LONG[parseDateKey(dk).getDay()],
        fmtFull(ev.start).trim(),
        fmtFull(ev.end).trim(),
        `"${ev.text.replace(/"/g, '""')}"`,
        ev.done ? 'yes' : 'no',
        ev.shared ? 'yes' : 'no',
        ev.color || 'auto',
      ]);
    });
  });

  downloadFile(
    `twosday-${user}-${getDateKey(new Date())}.csv`,
    rows.map(r => r.join(',')).join('\n'),
    'text/csv;charset=utf-8',
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
function openSettingsModal() {
  if (document.querySelector('.modal-bg')) return;

  const stats  = computeStats();
  const emojis = currentAccount.profileEmojis || ['', ''];
  const emojiOptsHTML = EMOJI_PRESETS
    .map(e => `<button class="emoji-opt" type="button" data-emoji="${e}">${e}</button>`)
    .join('');

  const extrasHTML = stats.total > 0 ? `
    <div class="stat-extras">
      ${stats.busiestDay ? `<span class="stat-extra-pill">📅 busiest: <strong>${escHtml(stats.busiestDay)}</strong></span>` : ''}
      ${stats.topColor   ? `<span class="stat-extra-pill"><span class="stat-color-dot" style="background:${escHtml(stats.topColorHex)}"></span>top color: <strong>${escHtml(stats.topColor)}</strong></span>` : ''}
    </div>` : '';

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal settings-modal">
      <div class="settings-header">
        <h3>account settings</h3>
        <button class="settings-close-btn" id="s-close">&times;</button>
      </div>

      <!-- ── Stats ── -->
      <div class="settings-section">
        <div class="settings-section-title">your stats</div>
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">total events</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.thisMonth}</div>
            <div class="stat-label">this month</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.shared}</div>
            <div class="stat-label">shared</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.done}</div>
            <div class="stat-label">completed</div>
          </div>
        </div>
        ${extrasHTML}
        <button class="mbtn settings-insights-btn" id="s-open-insights">open calendar insights</button>
      </div>

      <!-- ── Username ── -->
      <div class="settings-section">
        <div class="settings-section-title">username</div>
        <div class="field">
          <input id="s-new-username" placeholder="new username"
            value="${escHtml(currentAccount.username)}" autocomplete="off" />
        </div>
        <div class="field">
          <input type="password" id="s-username-pwd" placeholder="current password to confirm"
            autocomplete="current-password" />
        </div>
        <div class="settings-msg" id="s-username-msg"></div>
        <button class="mbtn mbtn-save settings-save-btn" id="s-save-username">save</button>
      </div>

      <!-- ── Password ── -->
      <div class="settings-section">
        <div class="settings-section-title">password</div>
        <div class="field">
          <input type="password" id="s-cur-pwd" placeholder="current password"
            autocomplete="current-password" />
        </div>
        <div class="field">
          <input type="password" id="s-new-pwd" placeholder="new password"
            autocomplete="new-password" />
        </div>
        <div class="field">
          <input type="password" id="s-confirm-pwd" placeholder="confirm new password"
            autocomplete="new-password" />
        </div>
        <div class="settings-msg" id="s-password-msg"></div>
        <button class="mbtn mbtn-save settings-save-btn" id="s-save-password">save</button>
      </div>

      <!-- ── Connected accounts ── -->
      <div class="settings-section">
        <div class="settings-section-title">connected accounts</div>
        ${currentAccount.authClaimed ? `
          <div class="settings-msg">${currentAccount.googleLinked ? 'Google account connected ✓' : 'connect Google to sign in without a password'}</div>
          <button class="mbtn" id="s-connect-google" ${currentAccount.googleLinked ? 'disabled' : ''}>${currentAccount.googleLinked ? 'connected' : 'connect Google'}</button>
        ` : `
          <div class="settings-msg">log out and back in once to enable this, then return here to connect Google</div>
        `}
        <div class="settings-msg" id="s-google-msg"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">Google Calendar overlay</div>
        <div class="settings-msg">show selected Google calendars as read-only busy time. Event details and access tokens stay out of Twosday storage.</div>
        <button class="mbtn" id="s-google-calendar-connect" type="button">connect Google Calendar</button>
        <div class="settings-msg" id="s-google-calendar-msg" role="status" aria-live="polite"></div>
        <div class="google-calendar-picker" id="s-google-calendar-picker"></div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">system status</div>
        <div class="settings-msg">release ${escHtml(TWOSDAY_RELEASE)} · browser diagnostics exclude calendar content, account identifiers, URLs with query strings, and stack traces.</div>
        <button class="mbtn" id="s-copy-diagnostics" type="button">copy diagnostics</button>
      </div>

      <!-- ── Profile names + emoji ── -->
      <div class="settings-section">
        <div class="settings-section-title">profile names</div>
        <div class="field profile-field">
          <div class="emoji-picker-wrap">
            <button class="emoji-picker-btn" id="s-emoji-btn1" type="button" title="pick an emoji">${escHtml(emojis[0]) || '+'}</button>
            <div class="emoji-picker-popover" id="s-emoji-popover1" role="listbox" aria-label="Profile 1 emoji" hidden aria-hidden="true">${emojiOptsHTML}</div>
          </div>
          <label>profile 1</label>
          <input id="s-profile1" value="${escHtml(USERS[0])}" autocomplete="off" />
        </div>
        <div class="field profile-field">
          <div class="emoji-picker-wrap">
            <button class="emoji-picker-btn" id="s-emoji-btn2" type="button" title="pick an emoji">${escHtml(emojis[1]) || '+'}</button>
            <div class="emoji-picker-popover" id="s-emoji-popover2" role="listbox" aria-label="Profile 2 emoji" hidden aria-hidden="true">${emojiOptsHTML}</div>
          </div>
          <label>profile 2</label>
          <input id="s-profile2" value="${escHtml(USERS[1])}" autocomplete="off" />
        </div>
        <div class="settings-msg" id="s-profiles-msg"></div>
        <button class="mbtn mbtn-save settings-save-btn" id="s-save-profiles">save</button>
      </div>

      <!-- ── Danger zone ── -->
      <div class="settings-section settings-danger-zone">
        <div class="settings-section-title danger-title">danger zone</div>
        <div class="danger-desc">permanently delete this account and all its data. this cannot be undone.</div>
        <div class="field">
          <input id="s-delete-confirm" placeholder="type your username to confirm"
            autocomplete="off" />
        </div>
        <button class="mbtn danger-btn" id="s-delete-account">delete account</button>
        <div class="settings-msg" id="s-delete-msg"></div>
      </div>
    </div>
  `;

  // Close popovers when clicking outside a picker wrap
  function _closePopovers(e) {
    // Self-heal: if the modal was dismissed via Escape (which calls .remove()
    // directly, bypassing _closeModal), detach this stray document listener.
    if (!bg.isConnected) { document.removeEventListener('click', _closePopovers); return; }
    if (e && e.target.closest && e.target.closest('.emoji-picker-wrap')) return;
    bg.querySelectorAll('.emoji-picker-popover.open').forEach(closeEmojiPopover);
  }
  function _closeModal() {
    document.removeEventListener('click', _closePopovers);
    bg.remove();
  }

  bg.addEventListener('click', e => { if (e.target === bg) _closeModal(); });
  document.body.appendChild(bg);
  document.addEventListener('click', _closePopovers);
  makeModalAccessible(bg, { initialFocusSelector: '#s-close', onClose: _closeModal });

  document.getElementById('s-close').onclick = _closeModal;

  // ── Emoji picker setup ────────────────────────────────────────────────────
  function setupEmojiPicker(btnId, popoverId) {
    const btn     = document.getElementById(btnId);
    const popover = document.getElementById(popoverId);

    // Keep picker inside the dialog backdrop for focus management, but outside
    // the scrollable modal so overflow and glass transforms cannot clip it.
    bg.appendChild(popover);
    popover.dataset.triggerId = btnId;
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-controls', popoverId);
    btn.setAttribute('aria-expanded', 'false');

    // Highlight the already-selected emoji (if any)
    const current = btn.textContent.trim();
    popover.querySelectorAll('.emoji-opt').forEach(opt => {
      opt.setAttribute('role', 'option');
      const isSelected = opt.dataset.emoji === current;
      opt.classList.toggle('active', isSelected);
      opt.setAttribute('aria-selected', String(isSelected));
    });

    btn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = popover.classList.contains('open');
      bg.querySelectorAll('.emoji-picker-popover.open').forEach(closeEmojiPopover);
      if (!isOpen) {
        const r = btn.getBoundingClientRect();
        popover.hidden = false;
        popover.setAttribute('aria-hidden', 'false');
        popover.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');

        const pickerRect = popover.getBoundingClientRect();
        const position = getFloatingPopoverPosition(r, pickerRect, window.innerWidth, window.innerHeight);
        popover.style.top = position.top + 'px';
        popover.style.left = position.left + 'px';
      }
    });

    popover.querySelectorAll('.emoji-opt').forEach(opt => {
      opt.addEventListener('click', e => {
        e.stopPropagation();
        btn.textContent = opt.dataset.emoji;
        popover.querySelectorAll('.emoji-opt').forEach(o => {
          o.classList.remove('active');
          o.setAttribute('aria-selected', 'false');
        });
        opt.classList.add('active');
        opt.setAttribute('aria-selected', 'true');
        closeEmojiPopover(popover);
        btn.focus();
      });
    });
  }

  function closeEmojiPopover(popover) {
    popover.classList.remove('open');
    popover.hidden = true;
    popover.setAttribute('aria-hidden', 'true');
    const trigger = document.getElementById(popover.dataset.triggerId);
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  // Close popovers if the modal is scrolled (picker would detach from button)
  bg.querySelector('.settings-modal').addEventListener('scroll', () => {
    bg.querySelectorAll('.emoji-picker-popover.open').forEach(closeEmojiPopover);
  });

  setupEmojiPicker('s-emoji-btn1', 's-emoji-popover1');
  setupEmojiPicker('s-emoji-btn2', 's-emoji-popover2');

  document.getElementById('s-open-insights').onclick = () => {
    _closeModal();
    openAnalyticsModal();
  };
  if (typeof setupGoogleCalendarSettings === 'function') setupGoogleCalendarSettings();
  document.getElementById('s-copy-diagnostics').onclick = () => copyDiagnostics();
  // ── Connect Google ────────────────────────────────────────────────────────
  const connectGoogleBtn = document.getElementById('s-connect-google');
  if (connectGoogleBtn) {
    connectGoogleBtn.onclick = async () => {
      if (!firebase.auth().currentUser) {
        setMsg('s-google-msg', 'log out and back in first, then try again'); return;
      }
      setMsg('s-google-msg', 'connecting…', false);
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        await firebase.auth().currentUser.linkWithPopup(provider);

        const updatedAccount = { ...currentAccount, googleLinked: true };
        delete updatedAccount.username;
        await saveAccountRecord(currentAccount.username, updatedAccount);
        currentAccount = { ...currentAccount, googleLinked: true };

        connectGoogleBtn.textContent = 'connected';
        connectGoogleBtn.disabled = true;
        setMsg('s-google-msg', 'Google account connected!', false);
      } catch (err) {
        if (err.code === 'auth/provider-already-linked' || err.code === 'auth/credential-already-in-use') {
          setMsg('s-google-msg', 'this Google account is already connected');
        } else if (err.code === 'auth/popup-closed-by-user') {
          setMsg('s-google-msg', '');
        } else {
          setMsg('s-google-msg', 'connect failed: ' + err.message);
        }
      }
    };
  }

  // ── Inline message helper ─────────────────────────────────────────────────
  function setMsg(id, text, isError = true) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'settings-msg ' + (isError ? 'settings-msg-error' : 'settings-msg-ok');
  }

  // ── Save username ─────────────────────────────────────────────────────────
  document.getElementById('s-save-username').onclick = async () => {
    const newUsername = document.getElementById('s-new-username').value.trim();
    const pwd         = document.getElementById('s-username-pwd').value;

    if (!newUsername)                            { setMsg('s-username-msg', 'username required'); return; }
    if (!pwd)                                    { setMsg('s-username-msg', 'current password required'); return; }
    if (newUsername === currentAccount.username)  { setMsg('s-username-msg', 'same as current username'); return; }
    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername))  { setMsg('s-username-msg', 'letters, numbers, _ and - only'); return; }
    if (newUsername.length > 30)                 { setMsg('s-username-msg', 'max 30 characters'); return; }

    setMsg('s-username-msg', 'saving…', false);

    const oldUsername = currentAccount.username;
    const updatedAccount = { ...currentAccount };
    delete updatedAccount.username;
    const authUser = firebase.auth().currentUser;
    const oldAuthEmail = updatedAccount.authEmail;
    const newAuthEmail = syntheticEmail(newUsername);

    try {
      await reauthenticate(pwd);
      await authUser.updateEmail(newAuthEmail);
      updatedAccount.authEmail = newAuthEmail;
      await saveAccountRecord(newUsername, updatedAccount);
      await ACCOUNT_DOC(oldUsername).delete();
    } catch (err) {
      if (authUser && oldAuthEmail && authUser.email === newAuthEmail) {
        try { await authUser.updateEmail(oldAuthEmail); } catch (rollbackError) {}
      }
      removeCachedAccount(newUsername);
      setMsg('s-username-msg', 'username unavailable or save failed'); return;
    }

    // Migrate localStorage keys
    const oldSK = STORAGE_KEY, oldNK = NOTES_KEY, oldPK = PRESENCE_KEY, oldCK = CUSTOM_COLORS_KEY;
    STORAGE_KEY       = `twosday_v2_${newUsername}`;
    NOTES_KEY         = `twosday_notes_v2_${newUsername}`;
    PRESENCE_KEY      = `twosday_presence_v1_${newUsername}`;
    CUSTOM_COLORS_KEY = `twosday_colors_v1_${newUsername}`;

    const ev = localStorage.getItem(oldSK);
    const nt = localStorage.getItem(oldNK);
    const pr = localStorage.getItem(oldPK);
    const cl = localStorage.getItem(oldCK);
    if (ev) { localStorage.setItem(STORAGE_KEY, ev);       localStorage.removeItem(oldSK); }
    if (nt) { localStorage.setItem(NOTES_KEY, nt);         localStorage.removeItem(oldNK); }
    if (pr) { localStorage.setItem(PRESENCE_KEY, pr);      localStorage.removeItem(oldPK); }
    if (cl) { localStorage.setItem(CUSTOM_COLORS_KEY, cl); localStorage.removeItem(oldCK); }

    removeCachedAccount(oldUsername);
    cacheAccount(newUsername, updatedAccount);
    currentAccount = { ...currentAccount, username: newUsername, authEmail: newAuthEmail };
    saveSession(newUsername);
    renderUserPill();

    document.getElementById('s-username-pwd').value = '';
    setMsg('s-username-msg', 'username updated!', false);
  };

  // ── Save password ─────────────────────────────────────────────────────────
  document.getElementById('s-save-password').onclick = async () => {
    const cur     = document.getElementById('s-cur-pwd').value;
    const newPwd  = document.getElementById('s-new-pwd').value;
    const confirm = document.getElementById('s-confirm-pwd').value;

    if (!cur || !newPwd || !confirm) { setMsg('s-password-msg', 'all fields required'); return; }
    if (newPwd !== confirm)              { setMsg('s-password-msg', 'passwords do not match'); return; }
    if (newPwd.length < 6)              { setMsg('s-password-msg', 'min 6 characters'); return; }

    setMsg('s-password-msg', 'saving…', false);

    const updatedAccount = { ...currentAccount };
    delete updatedAccount.username;

    try {
      const authUser = await reauthenticate(cur);
      await authUser.updatePassword(newPwd);
      await saveAccountRecord(currentAccount.username, updatedAccount);
    } catch (err) {
      const authUser = firebase.auth().currentUser;
      if (authUser) {
        try { await authUser.updatePassword(cur); } catch (rollbackError) {}
      }
      setMsg('s-password-msg', 'save failed: ' + err.message); return;
    }

    currentAccount = { ...currentAccount };

    document.getElementById('s-cur-pwd').value     = '';
    document.getElementById('s-new-pwd').value     = '';
    document.getElementById('s-confirm-pwd').value = '';
    setMsg('s-password-msg', 'password updated!', false);
  };

  // ── Save profile names + emojis ───────────────────────────────────────────
  document.getElementById('s-save-profiles').onclick = async () => {
    const p1    = document.getElementById('s-profile1').value.trim().toLowerCase();
    const p2    = document.getElementById('s-profile2').value.trim().toLowerCase();
    const e1raw = document.getElementById('s-emoji-btn1').textContent.trim();
    const e2raw = document.getElementById('s-emoji-btn2').textContent.trim();
    const e1    = e1raw === '+' ? '' : e1raw;
    const e2    = e2raw === '+' ? '' : e2raw;

    if (!p1 || !p2)                                                             { setMsg('s-profiles-msg', 'both names required'); return; }
    if (p1 === p2)                                                              { setMsg('s-profiles-msg', 'names must differ'); return; }
    if (!/^[a-zA-Z0-9]+$/.test(p1) || !/^[a-zA-Z0-9]+$/.test(p2))             { setMsg('s-profiles-msg', 'letters and numbers only'); return; }
    if (p1.length > 15 || p2.length > 15)                                       { setMsg('s-profiles-msg', 'max 15 characters each'); return; }

    const old1 = USERS[0], old2 = USERS[1];
    const oldEmojis = currentAccount.profileEmojis || ['', ''];
    if (p1 === old1 && p2 === old2 && e1 === oldEmojis[0] && e2 === oldEmojis[1]) {
      setMsg('s-profiles-msg', 'no changes'); return;
    }

    setMsg('s-profiles-msg', 'saving…', false);

    const updatedAccount = {
      ...currentAccount,
      profiles: [p1, p2],
      profileEmojis: [e1, e2],
    };
    delete updatedAccount.username;

    try {
      await saveAccountRecord(currentAccount.username, updatedAccount);
    } catch (err) {
      setMsg('s-profiles-msg', 'save failed: ' + err.message); return;
    }

    renameProfiles([old1, old2], [p1, p2]);
    currentAccount = { ...currentAccount, profiles: [p1, p2], profileEmojis: [e1, e2] };

    saveToLocalStorage();
    saveNotes();
    render();

    setMsg('s-profiles-msg', 'profiles updated!', false);
  };

  // ── Delete account ────────────────────────────────────────────────────────
  document.getElementById('s-delete-account').onclick = async () => {
    const typed = document.getElementById('s-delete-confirm').value.trim();
    if (!typed)                            { setMsg('s-delete-msg', 'type your username to confirm'); return; }
    if (typed !== currentAccount.username) { setMsg('s-delete-msg', 'username does not match'); return; }

    setMsg('s-delete-msg', 'deleting…', false);

    // Delete owned data before removing the account document that authorizes it.
    try { await FIRESTORE_DOC.delete(); } catch (e) {}
    try { await NOTES_DOC.delete();     } catch (e) {}
    try { await PRESENCE_DOC.delete();  } catch (e) {}
    try { await ACCOUNT_DOC(currentAccount.username).delete(); }
    catch (err) { setMsg('s-delete-msg', 'failed: ' + err.message); return; }
    if (currentAccount.authClaimed && firebase.auth().currentUser) {
      try { await firebase.auth().currentUser.delete(); } catch (e) {}
    }

    // Clear all account-scoped localStorage
    [STORAGE_KEY, NOTES_KEY, PRESENCE_KEY, CUSTOM_COLORS_KEY].forEach(k => { if (k) localStorage.removeItem(k); });
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(ACCOUNTS_CACHE_KEY);

    location.reload();
  };
}

// Rename both profiles atomically so swaps cannot overwrite either profile's
// events or preferences before the second rename runs.
function renameProfiles(oldNames, newNames) {
  function remap(record) {
    const values = oldNames.map(name => record[name]);
    oldNames.forEach(name => { delete record[name]; });
    newNames.forEach((name, index) => {
      if (values[index] !== undefined) record[name] = values[index];
    });
  }

  Object.keys(allData).forEach(dateKey => remap(allData[dateKey]));
  remap(userNotes);
  remap(userTheme);
  remap(calendarDensity);

  const activeIndex = oldNames.indexOf(activeUser);
  USERS = newNames.slice();
  if (activeIndex >= 0) activeUser = newNames[activeIndex];
}
