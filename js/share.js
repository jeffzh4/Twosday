// Public read-only share links.
//
// Sharing writes a flattened snapshot of one event to shares/{token}. The
// snapshot is deliberately a copy, not a reference: the reader is anonymous and
// must never be able to reach the owner's calendar document. Editing the event
// afterwards does not change an already-published link — re-share to refresh.

const SHARE_COLLECTION = () => db.collection('shares');
const SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000;   // 90 days

function shareToken() {
  // 22 chars of base36 randomness. Not a secret in the cryptographic sense, but
  // far too large to enumerate, and the document holds no account identifiers.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 22);
}

function shareUrlFor(token) {
  return `${location.origin}/share.html?t=${encodeURIComponent(token)}`;
}

// Only the fields a recipient needs to show up in the right place at the right
// time. No ids, no account name, no profile list, no sharedId.
function buildSharePayload(ev, dateKey) {
  return {
    title: ev.text || 'event',
    dateKey,
    start: ev.start,
    end: ev.end,
    location: ev.location || null,
    description: ev.description || null,
    sharedBy: activeUser || null,
  };
}

async function createShareLink(ev, dateKey) {
  const user = firebase.auth().currentUser;
  if (!user) { showToast('log in again to share'); return null; }

  const token = shareToken();
  try {
    await SHARE_COLLECTION().doc(token).set({
      ownerUid: user.uid,
      event: buildSharePayload(ev, dateKey),
      createdAt: Date.now(),
      expiresAt: Date.now() + SHARE_TTL_MS,
    });
    return shareUrlFor(token);
  } catch (e) {
    console.warn('Share link creation failed:', e);
    showToast("couldn't create share link");
    return null;
  }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // Clipboard API needs a secure context and permission; fall back to a
    // hidden textarea so the button still works on http and older Safari.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (err) {
      return false;
    }
  }
}

function openShareModal(ev, dateKey) {
  if (document.querySelector('.modal-bg')) return;

  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `
    <div class="modal share-modal">
      <h3>share event</h3>
      <p class="share-copy">creates a read-only link to <strong>${escHtml(ev.text)}</strong>. anyone with the link can see the time, location, and description — nothing else on your calendar.</p>
      <div class="share-link-row">
        <input id="share-url" readonly placeholder="generating link…" />
        <button class="mbtn mbtn-save" id="share-copy">copy</button>
      </div>
      <div class="share-note" id="share-note">link expires in 90 days</div>
      <div class="modal-btns">
        <button class="mbtn mbtn-cancel" id="share-close">done</button>
      </div>
    </div>
  `;

  bg.addEventListener('click', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg);
  makeModalAccessible(bg, { initialFocusSelector: '#share-url' });

  document.getElementById('share-close').onclick = () => bg.remove();

  createShareLink(ev, dateKey).then(url => {
    const input = document.getElementById('share-url');
    if (!input) return;                 // modal closed while the write was in flight
    if (!url) { bg.remove(); return; }
    input.value = url;
    input.select();

    document.getElementById('share-copy').onclick = async () => {
      const ok = await copyToClipboard(url);
      document.getElementById('share-note').textContent = ok
        ? 'copied — link expires in 90 days'
        : 'copy failed — select the link and copy manually';
    };
  });
}
