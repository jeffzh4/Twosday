// ICS import
function unfoldICSLines(text) {
  return text.replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((lines, line) => {
      if (/^[ \t]/.test(line) && lines.length) {
        lines[lines.length - 1] += line.slice(1);
      } else {
        lines.push(line);
      }
      return lines;
    }, []);
}

function parseICSProperty(line) {
  const idx = line.indexOf(':');
  if (idx < 0) return null;
  const left = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const parts = left.split(';');
  const name = parts.shift().toUpperCase();
  const params = {};
  parts.forEach(part => {
    const eq = part.indexOf('=');
    if (eq > -1) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  });
  return { name, params, value };
}

function unescapeICSText(value) {
  return String(value || '')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseICSDateTime(value) {
  const clean = String(value || '').trim();
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const hh = Number(match[4] || 9);
  const mm = Number(match[5] || 0);
  const ss = Number(match[6] || 0);
  const date = match[7]
    ? new Date(Date.UTC(y, m, d, hh, mm, ss))
    : new Date(y, m, d, hh, mm, ss);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function decimalHourFromDate(date) {
  return date.getHours() + date.getMinutes() / 60;
}

function parseICSEvents(text) {
  const lines = unfoldICSLines(text);
  const events = [];
  let cur = null;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed === 'BEGIN:VEVENT') {
      cur = {};
      return;
    }
    if (trimmed === 'END:VEVENT') {
      if (cur) events.push(cur);
      cur = null;
      return;
    }
    if (!cur) return;

    const prop = parseICSProperty(trimmed);
    if (!prop) return;
    if (prop.name === 'SUMMARY') cur.summary = unescapeICSText(prop.value);
    if (prop.name === 'DTSTART') cur.start = parseICSDateTime(prop.value);
    if (prop.name === 'DTEND') cur.end = parseICSDateTime(prop.value);
    if (prop.name === 'UID') cur.uid = prop.value;
  });

  return events
    .filter(ev => ev.summary && ev.start)
    .map((ev, idx) => {
      const fallbackEnd = new Date(ev.start);
      fallbackEnd.setHours(fallbackEnd.getHours() + 1);
      const end = ev.end && ev.end > ev.start ? ev.end : fallbackEnd;
      return {
        importId: ev.uid || `ics-${idx}`,
        text: ev.summary,
        dateKey: getDateKey(ev.start),
        start: decimalHourFromDate(ev.start),
        end: Math.max(decimalHourFromDate(end), decimalHourFromDate(ev.start) + STEP_H),
      };
    });
}

function importParsedEvents(events, user, shared) {
  const importedAt = Date.now();
  events.forEach((item, idx) => {
    const sharedId = shared ? uid() : null;
    const ev = normalizeEvent({
      id: uid(),
      text: item.text,
      start: item.start,
      end: item.end,
      done: false,
      shared,
      sharedId,
      color: null,
      updatedAt: importedAt + idx,
      updatedBy: user,
    });
    ensureDateUser(item.dateKey, user);
    allData[item.dateKey][user].push(ev);
    sortDateUser(item.dateKey, user);
    if (shared) {
      syncSharedEvent(user, sharedId, item.dateKey, 'add', {
        ...clone(ev), id: uid(), shared: true, sharedId,
      });
    }
  });
  if (events.length && typeof logAudit === 'function') {
    logAudit('imported', `${events.length} event${events.length === 1 ? '' : 's'}`);
  }
}

function openICSImportPreview(fileName, parsedEvents, defaultUser) {
  if (document.querySelector('.import-preview-modal')) return;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal import-preview-modal">
      <div class="import-preview-head">
        <div>
          <h3>import calendar</h3>
          <p>${escHtml(fileName)} &middot; ${parsedEvents.length} event${parsedEvents.length === 1 ? '' : 's'} parsed</p>
        </div>
        <button class="import-preview-close" id="i-close">&times;</button>
      </div>
      <div class="field-row">
        <div class="field">
          <label>profile</label>
          <select id="i-user">
            ${USERS.map(u => `<option value="${escHtml(u)}"${u === defaultUser ? ' selected' : ''}>${escHtml(u)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>mode</label>
          <select id="i-shared">
            <option value="no">private events</option>
            <option value="yes">shared events</option>
          </select>
        </div>
      </div>
      <div class="import-preview-list">
        ${parsedEvents.map(ev => {
          const d = parseDateKey(ev.dateKey);
          return `
            <label class="import-preview-row">
              <input type="checkbox" value="${escHtml(ev.importId)}" checked>
              <span>
                <strong>${escHtml(ev.text)}</strong>
                <em>${escHtml(MONTH_SHORT[d.getMonth()])} ${d.getDate()} &middot; ${fmtFull(ev.start)} - ${fmtFull(ev.end)}</em>
              </span>
            </label>
          `;
        }).join('')}
      </div>
      <div class="modal-btns">
        <button class="mbtn mbtn-cancel" id="i-cancel">cancel</button>
        <button class="mbtn mbtn-save" id="i-import">import selected</button>
      </div>
    </div>
  `;

  function close() { bg.remove(); }
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#i-user', onClose: close });
  document.getElementById('i-close').onclick = close;
  document.getElementById('i-cancel').onclick = close;
  document.getElementById('i-import').onclick = () => {
    const selected = new Set(Array.from(bg.querySelectorAll('.import-preview-row input:checked')).map(el => el.value));
    const selectedEvents = parsedEvents.filter(ev => selected.has(ev.importId));
    if (!selectedEvents.length) return;
    pushHistory();
    const user = document.getElementById('i-user').value;
    const shared = document.getElementById('i-shared').value === 'yes';
    importParsedEvents(selectedEvents, user, shared);
    currentDate = parseDateKey(selectedEvents[0].dateKey);
    activeUser = user;
    applyTheme();
    close();
    render();
    showToast(`imported ${selectedEvents.length} event${selectedEvents.length === 1 ? '' : 's'}`, 'ok');
  };
}

function handleICSFileInput(file, user, setMsg, msgId = 's-import-msg') {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const parsed = parseICSEvents(String(reader.result || ''));
    if (!parsed.length) {
      setMsg(msgId, 'no importable events found');
      return;
    }
    setMsg(msgId, `${parsed.length} event${parsed.length === 1 ? '' : 's'} ready to preview`, false);
    openICSImportPreview(file.name, parsed, user);
  };
  reader.onerror = () => setMsg(msgId, 'failed to read file');
  reader.readAsText(file);
}

function openCalendarToolsModal() {
  if (document.querySelector('.modal-bg')) return;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal calendar-tools-modal">
      <div class="calendar-tools-head">
        <div>
          <h3>import / export</h3>
          <p>bring existing calendars into twosday or take your data elsewhere</p>
        </div>
        <button class="calendar-tools-close" id="ct-close">&times;</button>
      </div>
      <div class="calendar-tools-grid">
        <section class="calendar-tools-panel">
          <div class="calendar-tools-panel-head">
            <h4>import calendar</h4>
            <span>.ics from google, apple, outlook</span>
          </div>
          <div class="field">
            <label>profile</label>
            <select id="ct-import-user">
              ${USERS.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('')}
            </select>
          </div>
          <input type="file" id="ct-import-file" accept=".ics,text/calendar" style="display:none" />
          <button class="calendar-tools-primary" id="ct-import-btn">choose .ics file</button>
          <div class="calendar-tools-hint">Preview events before importing them as private or shared.</div>
          <div class="settings-msg" id="ct-import-msg"></div>
        </section>
        <section class="calendar-tools-panel">
          <div class="calendar-tools-panel-head">
            <h4>export events</h4>
            <span>backup or move your calendar</span>
          </div>
          <div class="field">
            <label>profile</label>
            <select id="ct-export-user">
              ${USERS.map(u => `<option value="${escHtml(u)}">${escHtml(u)}</option>`).join('')}
            </select>
          </div>
          <div class="calendar-tools-actions">
            <button class="mbtn export-btn" id="ct-export-ics">download .ics</button>
            <button class="mbtn export-btn" id="ct-export-csv">download .csv</button>
          </div>
          <div class="calendar-tools-hint">Use .ics for calendar apps, .csv for spreadsheets.</div>
          <div class="settings-msg" id="ct-export-msg"></div>
        </section>
      </div>
    </div>
  `;

  function close() { bg.remove(); }
  function setMsg(id, text, isError = true) {
    const el = document.getElementById(id);
    el.textContent = text;
    el.className = 'settings-msg ' + (isError ? 'settings-msg-error' : 'settings-msg-ok');
  }

  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#ct-import-user', onClose: close });
  document.getElementById('ct-close').onclick = close;

  document.getElementById('ct-import-btn').onclick = () => {
    document.getElementById('ct-import-file').click();
  };
  document.getElementById('ct-import-file').onchange = e => {
    const user = document.getElementById('ct-import-user').value;
    handleICSFileInput(e.target.files[0], user, setMsg, 'ct-import-msg');
    e.target.value = '';
  };
  document.getElementById('ct-export-ics').onclick = () => {
    const user = document.getElementById('ct-export-user').value;
    exportICS(user);
    setMsg('ct-export-msg', `downloaded ${user}'s events as .ics`, false);
  };
  document.getElementById('ct-export-csv').onclick = () => {
    const user = document.getElementById('ct-export-user').value;
    exportCSV(user);
    setMsg('ct-export-msg', `downloaded ${user}'s events as .csv`, false);
  };
}
