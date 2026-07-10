// userNotes is keyed by profile name. Initialized fresh per-account in auth.js.
let userNotes = {};
let notesOpen = false;

function saveNotes() {
  try { localStorage.setItem(NOTES_KEY, JSON.stringify(userNotes)); } catch (e) {}
  try {
    NOTES_DOC.set({
      notes: JSON.parse(JSON.stringify(userNotes)),
      accountId: currentAccount.username,
      ownerUid: currentAccount.ownerUid,
      savedAt: Date.now(),
      clientId: CLIENT_ID,
    }).catch(() => showToast("couldn't sync notes — check your connection"));
  } catch (e) {}
}

function loadNotes() {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    USERS.forEach(u => {
      if (Array.isArray(parsed[u])) userNotes[u] = parsed[u];
    });
  } catch (e) {}
}

function startNotesListener() {
  NOTES_DOC.onSnapshot(snap => {
    if (!snap.exists) return;
    const data = snap.data();
    if (data.clientId && data.clientId === CLIENT_ID) return; // own echo — skip
    if (data.notes) {
      USERS.forEach(u => {
        if (Array.isArray(data.notes[u])) userNotes[u] = data.notes[u];
      });
      if (notesOpen) renderNotes();
    }
  }, () => {});
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  const notes = userNotes[activeUser] || [];

  if (!notes.length) {
    list.innerHTML = '<div class="notes-empty">no notes yet</div>';
    return;
  }

  list.innerHTML = '';
  // Show newest first
  notes.slice().reverse().forEach((note, ri) => {
    const realIdx = notes.length - 1 - ri;

    const item = document.createElement('div');
    item.className = 'note-item';

    const timeStr = note.time
      ? new Date(note.time).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
      : '';

    // Text display
    const textEl = document.createElement('div');
    textEl.className = 'note-text';
    textEl.textContent = note.text;

    // Meta row
    const meta = document.createElement('div');
    meta.className = 'note-meta';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'note-time';
    timeSpan.textContent = timeStr;

    const actions = document.createElement('div');
    actions.className = 'note-actions';

    const editBtn = document.createElement('button');
    editBtn.className = 'note-edit-btn';
    editBtn.title = 'Edit note';
    editBtn.setAttribute('aria-label', 'Edit note');
    editBtn.innerHTML = '&#9998;';

    const delBtn = document.createElement('button');
    delBtn.className = 'note-del';
    delBtn.title = 'Delete note';
    delBtn.setAttribute('aria-label', 'Delete note');
    delBtn.innerHTML = '&times;';

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    meta.appendChild(timeSpan);
    meta.appendChild(actions);
    item.appendChild(textEl);
    item.appendChild(meta);

    // ── Inline edit ──────────────────────────────────────────────────────────
    function enterEditMode() {
      const ta = document.createElement('textarea');
      ta.className = 'note-edit-input';
      ta.value = note.text;

      // Auto-size
      ta.addEventListener('input', function () {
        this.style.height = 'auto';
        this.style.height = this.scrollHeight + 'px';
      });

      item.replaceChild(ta, textEl);
      ta.style.height = ta.scrollHeight + 'px';
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);

      editBtn.innerHTML = '&#10003;'; // checkmark while editing
      editBtn.title = 'Save';

      function saveEdit() {
        const newText = ta.value.trim();
        if (newText) note.text = newText;
        saveNotes();
        renderNotes();
      }

      ta.addEventListener('blur', saveEdit);

      ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ta.removeEventListener('blur', saveEdit); saveEdit(); }
        if (e.key === 'Escape')               { ta.removeEventListener('blur', saveEdit); renderNotes(); }
      });

      editBtn.onclick = (e) => {
        e.stopPropagation();
        ta.removeEventListener('blur', saveEdit);
        saveEdit();
      };
    }

    editBtn.onclick = (e) => { e.stopPropagation(); enterEditMode(); };

    // Double-click text also enters edit mode
    textEl.addEventListener('dblclick', () => enterEditMode());

    delBtn.onclick = () => {
      userNotes[activeUser].splice(realIdx, 1);
      saveNotes();
      renderNotes();
    };

    list.appendChild(item);
  });
}

function addNote() {
  const input = document.getElementById('notes-input');
  const text = input.value.trim();
  if (!text) return;
  userNotes[activeUser].push({ text, time: Date.now() });
  input.value = '';
  input.style.height = '34px';
  saveNotes();
  renderNotes();
  document.getElementById('notes-list').scrollTop = 0;
}

function toggleNotes(force) {
  notesOpen = force !== undefined ? force : !notesOpen;
  const panel = document.getElementById('notes-panel');
  panel.classList.toggle('open', notesOpen);
  panel.setAttribute('aria-hidden', String(!notesOpen));
  panel.inert = !notesOpen;
  document.getElementById('btn-notes').setAttribute('aria-expanded', String(notesOpen));
  if (notesOpen) {
    renderNotes();
    document.getElementById('notes-input').focus();
  }
}
