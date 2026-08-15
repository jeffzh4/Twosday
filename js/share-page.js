// Public read-only event view. The token is validated before the Firestore
// request; Firestore rules enforce expiration again at the server boundary.
(function () {
  const params = new URLSearchParams(location.search);
  const token = (params.get('t') || '').trim();
  const statusEl = document.getElementById('share-status');
  const cardEl = document.getElementById('share-card');

  function fail(message) {
    statusEl.textContent = message;
  }

  if (!/^[0-9a-z]{22}$/.test(token)) {
    fail('this link is invalid.');
    return;
  }

  db.collection('shares').doc(token).get()
    .then(snap => {
      if (!snap.exists) {
        fail('this link has expired or was never valid.');
        return;
      }

      const ev = (snap.data() || {}).event || {};
      const date = parseDateKey(ev.dateKey);
      const dateLabel = date
        ? date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
        : ev.dateKey || '';

      cardEl.innerHTML = `
        <div class="share-eyebrow">shared event</div>
        <h1 class="share-title">${escHtml(ev.title || 'event')}</h1>
        <div class="share-when">${escHtml(dateLabel)}</div>
        <div class="share-time">${escHtml(fmtFull(ev.start))} - ${escHtml(fmtFull(ev.end))} · ${escHtml(fmtDuration(ev.start, ev.end))}</div>
        ${ev.location ? `<div class="share-row"><span class="share-label">location</span><span class="share-value">${escHtml(ev.location)}</span></div>` : ''}
        ${ev.description ? `<div class="share-row"><span class="share-label">details</span><span class="share-value">${escHtml(ev.description)}</span></div>` : ''}
      `;
    })
    .catch(error => {
      reportOperationalIssue('share-lookup', error);
      fail('this link has expired or was never valid.');
    });
})();
