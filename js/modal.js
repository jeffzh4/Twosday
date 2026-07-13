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

  // Recurrence control: full picker on new events; a note on recurring edits.
  const recurHTML = isEdit
    ? (editEv.recurrenceId
        ? `<div class="field"><label>repeats</label><div class="recur-note">part of a recurring series${editEv.recurrence ? ` · ${escHtml(recurrenceLabel(editEv.recurrence))}` : ''} — saving asks which occurrences to change</div></div>`
        : '')
    : `<div class="field">
        <label for="m-recur-freq">repeats</label>
        <select id="m-recur-freq">${RECURRENCE_OPTIONS.map(o => `<option value="${o.value}">${escHtml(o.label)}</option>`).join('')}</select>
        <div class="recur-ends" id="m-recur-ends" style="display:none">
          <label for="m-recur-count" class="recur-ends-label">ends after</label>
          <div class="recur-ends-row">
            <input type="number" id="m-recur-count" value="12" min="2" max="${RECURRENCE_CAP}" />
            <span>occurrences</span>
          </div>
          <div class="recur-preview" id="m-recur-preview"></div>
        </div>
      </div>`;

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
      ${recurHTML}
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

  // Recurrence control (new events only)
  const recurFreq = document.getElementById('m-recur-freq');
  function readRule() {
    if (!recurFreq || recurFreq.value === 'none') return null;
    const count = Math.max(2, Math.min(RECURRENCE_CAP, parseInt(document.getElementById('m-recur-count').value) || 12));
    return { freq: recurFreq.value, count };
  }
  function updateRecurPreview() {
    const ends = document.getElementById('m-recur-ends');
    const rule = readRule();
    ends.style.display = rule ? 'block' : 'none';
    if (!rule) return;
    const dk = document.getElementById('m-date').value;
    const dates = expandRecurrence(rule, dk);
    const labels = dates.slice(0, 5).map(d => {
      const dd = parseDateKey(d);
      return `${MONTH_SHORT[dd.getMonth()]} ${dd.getDate()}`;
    });
    const extra = dates.length > 5 ? ` … +${dates.length - 5} more` : '';
    document.getElementById('m-recur-preview').textContent = `→ ${labels.join(', ')}${extra}`;
  }
  if (recurFreq) {
    recurFreq.addEventListener('change', updateRecurPreview);
    document.getElementById('m-recur-count').addEventListener('input', updateRecurPreview);
    document.getElementById('m-date').addEventListener('change', updateRecurPreview);
  }

  document.getElementById('m-cancel').onclick = () => bg.remove();

  // Single-event edit: date move, shared-toggle handling, field updates. Used for
  // non-recurring events and for the 'this event only' scope (which detaches the
  // instance from its series first, turning it into an exception).
  function applySingleEdit(name, s, endTime, dk, isShared) {
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

    currentDate = parseDateKey(dk);
    bg.remove();
    render();
  }

  document.getElementById('m-save').onclick = () => {
    const name = document.getElementById('m-name').value.trim();
    if (!name) return;

    const s = timeInputToDecimal(document.getElementById('m-start').value);
    const enRaw = timeInputToDecimal(document.getElementById('m-end').value);
    const endTime = enRaw > s ? enRaw : s + STEP_H;
    const dk = document.getElementById('m-date').value;
    const isShared = document.getElementById('m-shared').checked;

    if (isEdit) {
      // Recurring instance → ask which occurrences the edit applies to.
      if (editEv.recurrenceId && seriesCount(editEv.recurrenceId, activeUser) > 1) {
        const recurrenceId = editEv.recurrenceId;
        bg.remove();
        openRecurrenceScopeModal({ verb: 'edit', onChoose: scope => {
          pushHistory();
          if (scope === 'this') {
            editEv.recurrenceId = null;
            editEv.recurrence = null;
            applySingleEdit(name, s, endTime, dk, isShared);
          } else {
            // Time/text/color propagate; per-instance date and sharedness are left as-is.
            editRecurringSeries(recurrenceId, activeUser, scope === 'future' ? dateKey : null,
              { text: name, start: s, end: endTime, color: selectedColor });
            currentDate = parseDateKey(dateKey);
            render();
          }
        }});
        return;
      }
      pushHistory();
      applySingleEdit(name, s, endTime, dk, isShared);
      return;
    }

    // New event — materialize the recurrence series (or a single event).
    pushHistory();
    const rule = readRule();
    const recurrenceId = rule ? uid() : null;
    const datesToCreate = rule ? expandRecurrence(rule, dk) : [dk];

    datesToCreate.forEach(dKey => {
      const sharedId = isShared ? uid() : null;
      const newEv = normalizeEvent({
        id: uid(), text: name, start: s, end: endTime,
        done: false, shared: isShared, sharedId,
        color: selectedColor, recurrenceId, recurrence: rule,
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
