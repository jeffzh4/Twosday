function openRepeatModal(srcDateKey, srcEv) {
  if (document.querySelector('.modal-bg')) return;

  let freq  = 'daily';
  let count = 7;
  const p   = palette(srcEv);

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal">
      <h3>repeat event</h3>

      <div class="field">
        <label>event</label>
        <div class="repeat-ev-chip" style="background:${p.bg};color:${p.text}">
          ${escHtml(srcEv.text)}&ensp;·&ensp;${fmtFull(srcEv.start)} – ${fmtFull(srcEv.end)}
        </div>
      </div>

      <div class="field">
        <label>frequency</label>
        <div class="freq-btns" id="r-freq-btns">
          <button class="freq-btn" data-f="hourly">hourly</button>
          <button class="freq-btn active" data-f="daily">daily</button>
          <button class="freq-btn" data-f="weekly">weekly</button>
          <button class="freq-btn" data-f="monthly">monthly</button>
        </div>
      </div>

      <div class="field">
        <label>number of copies</label>
        <input type="number" id="r-count" value="7" min="1" max="365" />
      </div>

      <div class="repeat-preview-box" id="r-preview"></div>

      <div class="modal-btns">
        <button class="mbtn mbtn-cancel" id="r-cancel">cancel</button>
        <button class="mbtn mbtn-save"   id="r-create">create copies</button>
      </div>
    </div>
  `;

  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);

  // ── Compute what copies will be created ─────────────────────────────────────
  function getCopies() {
    const n   = Math.max(1, Math.min(365, parseInt(document.getElementById('r-count').value) || 1));
    const src = parseDateKey(srcDateKey);
    const dur = srcEv.end - srcEv.start;
    const copies = [];

    if (freq === 'hourly') {
      // Same day, slide start forward 1 h each time
      for (let i = 1; i <= n; i++) {
        const start = srcEv.start + i;
        const end   = start + dur;
        if (start >= END_H || end > END_H) break;
        copies.push({ dateKey: srcDateKey, start, end });
      }
    } else {
      for (let i = 1; i <= n; i++) {
        const d = new Date(src);
        if (freq === 'daily')   d.setDate(d.getDate() + i);
        if (freq === 'weekly')  d.setDate(d.getDate() + i * 7);
        if (freq === 'monthly') d.setMonth(d.getMonth() + i);
        copies.push({ dateKey: getDateKey(d), start: srcEv.start, end: srcEv.end });
      }
    }
    return copies;
  }

  // ── Preview label ────────────────────────────────────────────────────────────
  function updatePreview() {
    const copies = getCopies();
    const node   = document.getElementById('r-preview');
    if (!copies.length) {
      node.textContent = 'no copies fit — event runs past midnight';
      node.className = 'repeat-preview-box warn';
      document.getElementById('r-create').disabled = true;
      return;
    }
    document.getElementById('r-create').disabled = false;
    node.className = 'repeat-preview-box';

    const labels = copies.map(c => {
      if (freq === 'hourly') return fmtFull(c.start);
      const d = parseDateKey(c.dateKey);
      return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
    });
    const shown = labels.slice(0, 6).join(', ');
    const extra = labels.length > 6 ? ` … +${labels.length - 6} more` : '';
    node.textContent = `→ ${shown}${extra}`;
  }

  // ── Frequency button toggle ──────────────────────────────────────────────────
  document.getElementById('r-freq-btns').querySelectorAll('.freq-btn').forEach(btn => {
    btn.onclick = () => {
      freq = btn.dataset.f;
      document.getElementById('r-freq-btns').querySelectorAll('.freq-btn')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Sensible defaults per frequency
      const defaults = { hourly: 4, daily: 7, weekly: 4, monthly: 3 };
      document.getElementById('r-count').value = defaults[freq];
      updatePreview();
    };
  });

  document.getElementById('r-count').addEventListener('input', updatePreview);
  updatePreview();

  document.getElementById('r-cancel').onclick = () => bg.remove();

  document.getElementById('r-create').onclick = () => {
    const copies = getCopies();
    if (!copies.length) return;
    pushHistory();

    copies.forEach(({ dateKey, start, end }) => {
      const sharedId = srcEv.shared ? uid() : null;
      const newEv = normalizeEvent({
        id: uid(), text: srcEv.text, start, end,
        done: false, shared: srcEv.shared, sharedId, color: srcEv.color,
      });
      ensureDateUser(dateKey, activeUser);
      allData[dateKey][activeUser].push(newEv);
      sortDateUser(dateKey, activeUser);

      if (srcEv.shared) {
        syncSharedEvent(activeUser, sharedId, dateKey, 'add', {
          ...clone(newEv), id: uid(), shared: true, sharedId,
        });
      }
    });

    bg.remove();
    render();
  };
}
