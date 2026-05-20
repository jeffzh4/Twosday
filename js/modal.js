function openModal({ dateKey, editEvId = null, startH = 9 } = {}) {
  if (document.querySelector('.modal-bg')) return;
  if (!dateKey) dateKey = getDateKey(currentDate);

  const arr = getEventsForDate(dateKey, activeUser);
  const editEv = editEvId ? arr.find(e => e.id === editEvId) : null;
  const isEdit = !!editEv;
  let selectedColor = isEdit ? (editEv.color || null) : null;

  const startVal = isEdit ? editEv.start : startH;
  const endVal   = isEdit ? editEv.end   : Math.min(startH + 1, END_H);
  const sharedVal = isEdit ? editEv.shared : false;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <h3>${isEdit ? 'edit event' : 'new event'}</h3>
      <div class="field">
        <label>name</label>
        <input id="m-name" value="${isEdit ? escHtml(editEv.text) : ''}" placeholder="e.g. chem lab" autofocus />
      </div>
      <div class="field-row">
        <div class="field"><label>start</label><select id="m-start">${timeOpts(startVal)}</select></div>
        <div class="field"><label>end</label><select id="m-end">${timeOpts(endVal)}</select></div>
      </div>
      <div class="field">
        <label>date</label>
        <input type="date" id="m-date" value="${dateKey}" />
      </div>
      ${!isEdit ? `
      <div class="field">
        <label>repeat this week</label>
        <div class="shared-toggle">
          <label class="toggle-switch">
            <input type="checkbox" id="m-repeat" />
            <span class="toggle-slider"></span>
          </label>
          <label for="m-repeat" style="cursor:pointer">repeat on selected days</label>
        </div>
        <div class="repeat-days" id="m-repeat-days" style="display:none;margin-top:8px">
          ${DAYS.map(d => `<label class="repeat-day"><input type="checkbox" value="${d}"> ${d}</label>`).join('')}
        </div>
      </div>
      ` : ''}
      <div class="field">
        <label>color</label>
        <div class="color-picker-row" id="m-colors"></div>
      </div>
      <div class="shared-toggle">
        <label class="toggle-switch">
          <input type="checkbox" id="m-shared" ${sharedVal ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <label for="m-shared" style="cursor:pointer">shared with ${getOtherUser(activeUser)}</label>
      </div>
      <div class="conflict-warning" id="m-conflict"></div>
      <div class="modal-btns">
        <button class="mbtn mbtn-cancel" id="m-cancel">cancel</button>
        <button class="mbtn mbtn-save" id="m-save">${isEdit ? 'save changes' : 'add event'}</button>
      </div>
    </div>
  `;

  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);

  // Color swatches
  const colorRow = document.getElementById('m-colors');
  const autoSwatch = document.createElement('div');
  autoSwatch.className = 'color-swatch' + (selectedColor === null ? ' active' : '');
  autoSwatch.title = 'auto';
  autoSwatch.style.background = 'linear-gradient(135deg,#a78bfa 0%,#34d399 50%,#fb923c 100%)';
  autoSwatch.onclick = () => {
    selectedColor = null;
    colorRow.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    autoSwatch.classList.add('active');
  };
  colorRow.appendChild(autoSwatch);

  COLOR_PRESETS.forEach(preset => {
    const s = document.createElement('div');
    s.className = 'color-swatch' + (selectedColor === preset.name ? ' active' : '');
    s.title = preset.name;
    s.style.cssText = `background:${preset.dark.text};opacity:0.8`;
    s.onclick = () => {
      selectedColor = preset.name;
      colorRow.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('active'));
      s.classList.add('active');
    };
    colorRow.appendChild(s);
  });

  // Conflict warning
  const conflictNode = document.getElementById('m-conflict');
  function updateConflict() {
    const dk = document.getElementById('m-date').value;
    const s = parseFloat(document.getElementById('m-start').value);
    const enRaw = parseFloat(document.getElementById('m-end').value);
    const en = enRaw > s ? enRaw : s + STEP_H;
    const shared = document.getElementById('m-shared').checked;
    const res = detectConflicts({
      user: activeUser, dateKey: dk, start: s, end: en,
      excludeId: editEv ? editEv.id : null,
      excludeSharedId: editEv ? (editEv.sharedId || null) : null,
      shared,
    });
    if (!res.hasConflict) { conflictNode.textContent = ''; return; }
    let msg = `conflict: overlaps ${res.own.length} event${res.own.length !== 1 ? 's' : ''} on your calendar`;
    if (shared && res.other.length) msg += ` and ${res.other.length} on ${getOtherUser(activeUser)}'s`;
    conflictNode.textContent = msg;
  }

  ['m-start','m-end','m-date','m-shared'].forEach(id => {
    document.getElementById(id).addEventListener('change', updateConflict);
  });
  updateConflict();

  // Repeat toggle
  if (!isEdit) {
    const repeatToggle = document.getElementById('m-repeat');
    const repeatDays = document.getElementById('m-repeat-days');
    repeatToggle.onchange = () => {
      repeatDays.style.display = repeatToggle.checked ? 'flex' : 'none';
    };
  }

  document.getElementById('m-cancel').onclick = () => bg.remove();

  document.getElementById('m-save').onclick = () => {
    const name = document.getElementById('m-name').value.trim();
    if (!name) return;

    const s = parseFloat(document.getElementById('m-start').value);
    const enRaw = parseFloat(document.getElementById('m-end').value);
    const endTime = enRaw > s ? enRaw : s + STEP_H;
    const dk = document.getElementById('m-date').value;
    const isShared = document.getElementById('m-shared').checked;
    pushHistory();

    if (isEdit) {
      const oldDk = dateKey;
      const wasShared = editEv.shared;
      const oldSharedId = editEv.sharedId;

      if (dk !== oldDk) {
        const oldArr = getEventsForDate(oldDk, activeUser);
        const oi = oldArr.indexOf(editEv);
        if (oi >= 0) oldArr.splice(oi, 1);
        ensureDateUser(dk, activeUser);
        allData[dk][activeUser].push(editEv);
      }

      editEv.text = name;
      editEv.start = s;
      editEv.end = endTime;
      editEv.color = selectedColor;

      if (wasShared && !isShared) {
        syncSharedEvent(activeUser, oldSharedId, oldDk, 'delete');
        if (dk !== oldDk) syncSharedEvent(activeUser, oldSharedId, dk, 'delete');
        editEv.shared = false; editEv.sharedId = null;
      } else if (!wasShared && isShared) {
        const sid = uid();
        editEv.shared = true; editEv.sharedId = sid;
        syncSharedEvent(activeUser, sid, dk, 'add', { ...clone(editEv), id: uid(), shared: true, sharedId: sid });
      } else if (wasShared && isShared) {
        if (dk !== oldDk) {
          syncSharedEvent(activeUser, oldSharedId, oldDk, 'delete');
          syncSharedEvent(activeUser, oldSharedId, dk, 'add', { ...clone(editEv), id: uid(), shared: true, sharedId: oldSharedId });
        } else {
          syncSharedEvent(activeUser, oldSharedId, dk, 'edit', { text: name, start: s, end: endTime, color: selectedColor });
        }
      }
      editEv.shared = isShared;

      sortDateUser(oldDk, activeUser);
      sortDateUser(dk, activeUser);
      currentDate = parseDateKey(dk);
      bg.remove();
      render();
      return;
    }

    // New event — gather dates
    let datesToCreate = [dk];
    let recurrenceId = null;

    if (document.getElementById('m-repeat') && document.getElementById('m-repeat').checked) {
      const checked = Array.from(document.querySelectorAll('#m-repeat-days input:checked')).map(el => el.value);
      if (checked.length) {
        const base = parseDateKey(dk);
        const weekDates = getWeekDates(base);
        datesToCreate = checked.map(dayName => getDateKey(weekDates[DAYS.indexOf(dayName)]));
        recurrenceId = uid();
      }
    }

    datesToCreate.forEach(dKey => {
      const sharedId = isShared ? uid() : null;
      const newEv = normalizeEvent({
        id: uid(), text: name, start: s, end: endTime,
        done: false, shared: isShared, sharedId,
        color: selectedColor, recurrenceId,
      });
      ensureDateUser(dKey, activeUser);
      allData[dKey][activeUser].push(newEv);
      sortDateUser(dKey, activeUser);

      if (isShared) {
        syncSharedEvent(activeUser, sharedId, dKey, 'add', {
          ...clone(newEv), id: uid(), shared: true, sharedId,
        });
      }
    });

    currentDate = parseDateKey(dk);
    bg.remove();
    render();
  };

  document.getElementById('m-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('m-save').click();
  });
}
