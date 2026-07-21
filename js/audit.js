// ── Audit log (append-only event history) ─────────────────────────────────────
// Every mutation appends an immutable entry to `auditLog` rather than only
// overwriting the event in place. This is the event-sourcing pattern used in
// trading/settlement systems, where every amendment must be independently
// reviewable and replayable. The log is capped, synced in the calendar document,
// and merged by union across both profiles (see reconcile.js / mergeAuditLogs),
// so each partner sees a shared, ordered history of who changed what and when.

const AUDIT_CAP = 300;

const AUDIT_VERBS = {
  created:   'created',
  edited:    'edited',
  deleted:   'deleted',
  completed: 'marked done',
  reopened:  'reopened',
  moved:     'moved',
  resized:   'resized',
  imported:  'imported',
};

function logAudit(action, target, detail) {
  if (typeof auditLog === 'undefined' || !Array.isArray(auditLog)) return;
  auditLog.unshift({
    id: uid(),
    ts: Date.now(),
    actor: activeUser,
    action,
    target: target || '',
    detail: detail || '',
  });
  if (auditLog.length > AUDIT_CAP) auditLog.length = AUDIT_CAP;
}

function getAuditLog() {
  return (typeof auditLog !== 'undefined' && Array.isArray(auditLog)) ? auditLog : [];
}

function auditSentence(entry) {
  const verb = AUDIT_VERBS[entry.action] || entry.action;
  const target = entry.target ? ` “${escHtml(entry.target)}”` : '';
  const detail = entry.detail ? ` <span class="audit-detail">${escHtml(entry.detail)}</span>` : '';
  return `<strong>${escHtml(entry.actor || '?')}</strong> ${verb}${target}${detail}`;
}

function openAuditModal() {
  if (document.querySelector('.modal-bg')) return;
  const log = getAuditLog();

  const rows = log.length
    ? log.map(entry => `
        <li class="audit-row audit-${escHtml(entry.action)}">
          <span class="audit-dot"></span>
          <span class="audit-text">${auditSentence(entry)}</span>
          <span class="audit-time" title="${new Date(entry.ts).toLocaleString()}">${escHtml(fmtRelativeTime(entry.ts))}</span>
        </li>`).join('')
    : '<li class="audit-empty">no changes recorded yet</li>';

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal audit-modal">
      <div class="audit-header">
        <h3>change history</h3>
        <button class="settings-close-btn" id="audit-close" aria-label="Close history">&times;</button>
      </div>
      <p class="audit-copy">an append-only record of every calendar change, shared across both profiles.</p>
      <ul class="audit-list">${rows}</ul>
    </div>
  `;
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#audit-close' });
  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.getElementById('audit-close').onclick = () => bg.remove();
}
