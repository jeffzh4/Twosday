function openModal({ dateKey, editEvId = null, startH = 9, endH = null, sharedDefault = false } = {}) {
  if (document.querySelector('.modal-bg')) return;
  if (!dateKey) dateKey = getDateKey(currentDate);

  const arr = getEventsForDate(dateKey, activeUser);
  const editEv = editEvId ? arr.find(e => e.id === editEvId) : null;
  const isEdit = !!editEv;
  let selectedColor = isEdit ? (editEv.color || null) : null;

  const startVal = isEdit ? editEv.start : startH;
  const endVal   = isEdit ? editEv.end   : Math.min(endH !== null ? endH : startH + 1, END_H);
  const sharedVal = isEdit ? editEv.shared : sharedDefault;
  const metaHTML = isEdit && editEv.updatedAt
    ? `<div class="event-meta">last updated ${fmtRelativeTime(editEv.updatedAt)} by ${escHtml(editEv.updatedBy || activeUser)}</div>`
    : '';

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
        <div class="field"><label>start</label><input type="time" id="m-start" value="${decimalToTimeInput(startVal)}" /></div>
        <div class="field"><label>end</label><input type="time" id="m-end" value="${decimalToTimeInput(endVal)}" /></div>
      </div>
      <div class="field">
        <label>date</label>
        <input type="date" id="m-date" value="${dateKey}" />
      </div>
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
      <div class="field">
        <label>color</label>
        <div id="m-color-section"></div>
      </div>
      <div class="shared-toggle">
        <label class="toggle-switch">
          <input type="checkbox" id="m-shared" ${sharedVal ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
        <label for="m-shared" style="cursor:pointer">shared with ${getOtherUser(activeUser)}</label>
      </div>
      <div class="conflict-warning" id="m-conflict"></div>
      ${metaHTML}
      <div class="modal-btns">
        <button class="mbtn mbtn-cancel" id="m-cancel">cancel</button>
        <button class="mbtn mbtn-save" id="m-save">${isEdit ? 'save changes' : 'add event'}</button>
      </div>
    </div>
  `;

  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#m-name' });

  // ── Color picker ─────────────────────────────────────────────────────────────
  function loadCustomColors() {
    if (!CUSTOM_COLORS_KEY) return [];
    try { return JSON.parse(localStorage.getItem(CUSTOM_COLORS_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCustomColors(colors) {
    if (!CUSTOM_COLORS_KEY) return;
    try { localStorage.setItem(CUSTOM_COLORS_KEY, JSON.stringify(colors.slice(0, 7))); } catch (e) {}
  }

  function buildColorPicker() {
    const section = document.getElementById('m-color-section');
    section.innerHTML = '';

    // ── Row 1: ROYGBIV presets ──
    const presetRow = document.createElement('div');
    presetRow.className = 'color-picker-row';

    // Auto swatch (rainbow gradient)
    const autoSwatch = document.createElement('button');
    autoSwatch.type = 'button';
    autoSwatch.className = 'color-swatch' + (selectedColor === null ? ' active' : '');
    autoSwatch.title = 'auto';
    autoSwatch.setAttribute('aria-label', 'Automatic event color');
    autoSwatch.setAttribute('aria-pressed', String(selectedColor === null));
    autoSwatch.style.background = 'linear-gradient(135deg,#f87171 0%,#fb923c 17%,#fde047 34%,#6ee7b7 50%,#93c5fd 67%,#a5b4fc 83%,#d8b4fe 100%)';
    autoSwatch.onclick = () => { selectedColor = null; buildColorPicker(); };
    presetRow.appendChild(autoSwatch);

    COLOR_PRESETS.filter(p => p.name !== 'gray').forEach(preset => {
      const s = document.createElement('button');
      s.type = 'button';
      s.className = 'color-swatch' + (selectedColor === preset.name ? ' active' : '');
      s.title = preset.name;
      s.setAttribute('aria-label', `${preset.name} event color`);
      s.setAttribute('aria-pressed', String(selectedColor === preset.name));
      s.style.cssText = `background:${preset.dark.text}`;
      s.onclick = () => { selectedColor = preset.name; buildColorPicker(); };
      presetRow.appendChild(s);
    });
    section.appendChild(presetRow);

    // ── Row 2: saved custom colors + add button ──
    const customColors = loadCustomColors();
    const customRow = document.createElement('div');
    customRow.className = 'color-picker-row color-custom-row';

    customColors.forEach((hex, i) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'color-swatch-custom' + (selectedColor === hex ? ' active' : '');

      const inner = document.createElement('button');
      inner.type = 'button';
      inner.className = 'color-swatch-inner';
      inner.style.background = hex;
      inner.title = hex;
      inner.setAttribute('aria-label', `Custom event color ${hex}`);
      inner.setAttribute('aria-pressed', String(selectedColor === hex));
      inner.onclick = () => { selectedColor = hex; buildColorPicker(); };

      const delBtn = document.createElement('button');
      delBtn.className = 'color-swatch-del';
      delBtn.type = 'button';
      delBtn.innerHTML = '&times;';
      delBtn.title = 'Remove';
      delBtn.setAttribute('aria-label', `Remove custom color ${hex}`);
      delBtn.onclick = e => {
        e.stopPropagation();
        const colors = loadCustomColors();
        colors.splice(i, 1);
        saveCustomColors(colors);
        if (selectedColor === hex) selectedColor = null;
        buildColorPicker();
      };

      wrapper.appendChild(inner);
      wrapper.appendChild(delBtn);
      customRow.appendChild(wrapper);
    });

    // "+" add button (hidden once 7 custom colors are saved)
    if (customColors.length < 7) {
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'color-add-btn';
      addBtn.title = 'Add custom color';
      addBtn.setAttribute('aria-label', 'Add custom event color');
      addBtn.textContent = '+';

      // Hidden native color input — clicking addBtn triggers it
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = '#7c3aed';
      colorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
      colorInput.onchange = () => {
        const hex = colorInput.value;
        const colors = loadCustomColors();
        if (colors.length < 7) {
          // Replace if hex already exists, otherwise append
          if (!colors.includes(hex)) colors.push(hex);
          saveCustomColors(colors);
          selectedColor = hex;
          buildColorPicker();
        }
      };

      addBtn.onclick = () => colorInput.click();
      customRow.appendChild(colorInput);
      customRow.appendChild(addBtn);
    }

    section.appendChild(customRow);
  }

  buildColorPicker();

  // Conflict warning
  const conflictNode = document.getElementById('m-conflict');
  function updateConflict() {
    const dk = document.getElementById('m-date').value;
    const s = timeInputToDecimal(document.getElementById('m-start').value);
    const enRaw = timeInputToDecimal(document.getElementById('m-end').value);
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
  const repeatToggle = document.getElementById('m-repeat');
  const repeatDays = document.getElementById('m-repeat-days');
  repeatToggle.onchange = () => {
    repeatDays.style.display = repeatToggle.checked ? 'flex' : 'none';
  };

  document.getElementById('m-cancel').onclick = () => bg.remove();

  document.getElementById('m-save').onclick = () => {
    const name = document.getElementById('m-name').value.trim();
    if (!name) return;

    const s = timeInputToDecimal(document.getElementById('m-start').value);
    const enRaw = timeInputToDecimal(document.getElementById('m-end').value);
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
      markEventUpdated(editEv, activeUser);

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
          syncSharedEvent(activeUser, oldSharedId, dk, 'edit', {
            text: name, start: s, end: endTime, color: selectedColor,
            updatedAt: editEv.updatedAt, updatedBy: editEv.updatedBy,
          });
        }
      }
      editEv.shared = isShared;

      sortDateUser(oldDk, activeUser);
      sortDateUser(dk, activeUser);

      // Repeat: copy the (now-edited) event to additional selected days
      if (repeatToggle.checked) {
        const checked = Array.from(document.querySelectorAll('#m-repeat-days input:checked')).map(el => el.value);
        if (checked.length) {
          const base = parseDateKey(dk);
          const weekDates = getWeekDates(base);
          checked.forEach(dayName => {
            const copyDk = getDateKey(weekDates[DAYS.indexOf(dayName)]);
            if (copyDk === dk) return; // skip the event's own day
            const sharedId = isShared ? uid() : null;
            const copy = normalizeEvent({
              id: uid(), text: editEv.text, start: editEv.start, end: editEv.end,
              done: false, shared: isShared, sharedId,
              color: editEv.color, recurrenceId: editEv.recurrenceId || null,
            });
            markEventUpdated(copy, activeUser);
            ensureDateUser(copyDk, activeUser);
            allData[copyDk][activeUser].push(copy);
            sortDateUser(copyDk, activeUser);
            if (isShared) {
              syncSharedEvent(activeUser, sharedId, copyDk, 'add', {
                ...clone(copy), id: uid(), shared: true, sharedId,
              });
            }
          });
        }
      }

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
        const extraDates = checked.map(dayName => getDateKey(weekDates[DAYS.indexOf(dayName)]));
        // Always include the original date; deduplicate in case the user also checked it
        datesToCreate = [...new Set([dk, ...extraDates])];
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
      markEventUpdated(newEv, activeUser);
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
