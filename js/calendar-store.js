// Calendar persistence coordinator.
//
// Views and event commands talk to the small store interface below. The cache
// and Firestore adapters keep their transport details local, while state.js
// supplies the app-specific data shape and reconciliation callbacks.

function createCalendarStore(options) {
  const {
    cache,
    remote,
    debounceMs = 400,
    now = () => Date.now(),
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
  } = options;

  let saveTimer = null;
  let lastSyncedSignature = null;
  let lastReconvergeAt = 0;
  let stopListening = null;

  function load() {
    return cache.load();
  }

  function save() {
    cache.save();
    if (remote.isLoading()) return;
    clearTimeoutFn(saveTimer);
    saveTimer = setTimeoutFn(saveRemote, debounceMs);
  }

  function saveRemote() {
    const signature = remote.signature();
    if (signature === lastSyncedSignature) return Promise.resolve(false);

    lastSyncedSignature = signature;
    remote.setStatus(remote.isOffline() ? 'offline' : 'pending');
    let write;
    try {
      write = remote.write();
    } catch (error) {
      lastSyncedSignature = null;
      remote.onWriteError(error);
      return Promise.resolve(false);
    }

    return Promise.resolve(write).then(() => {
      remote.setStatus('synced');
      return true;
    }).catch(error => {
      lastSyncedSignature = null;
      remote.onWriteError(error);
      return false;
    });
  }

  function listen() {
    if (stopListening) return stopListening;
    stopListening = remote.listen({
      getLastSyncedSignature: () => lastSyncedSignature,
      setLastSyncedSignature: signature => { lastSyncedSignature = signature; },
      canReconverge: () => now() - lastReconvergeAt > 3000,
      markReconverged: () => { lastReconvergeAt = now(); },
      saveRemote,
    });
    return stopListening;
  }

  function reset() {
    clearTimeoutFn(saveTimer);
    if (stopListening) stopListening();
    saveTimer = null;
    stopListening = null;
    lastSyncedSignature = null;
    lastReconvergeAt = 0;
  }

  return { load, save, saveRemote, listen, reset };
}

function createLocalStorageCalendarAdapter({ storage, getKey, buildPayload, applyPayload }) {
  return {
    load() {
      try {
        const raw = storage.getItem(getKey());
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return false;
        applyPayload(parsed);
        return true;
      } catch (error) {
        return false;
      }
    },
    save() {
      try {
        storage.setItem(getKey(), JSON.stringify(buildPayload()));
        return true;
      } catch (error) {
        return false;
      }
    },
  };
}

function createFirestoreCalendarAdapter(options) {
  const {
    getDocument,
    clientId,
    isLoading,
    setLoading,
    isOffline,
    signature,
    buildPayload,
    setStatus,
    onWriteError,
    mergeSnapshot,
    applyFallbackSnapshot,
    onListenerError,
  } = options;

  return {
    isLoading,
    isOffline,
    signature,
    setStatus,
    write: () => getDocument().set(buildPayload()),
    onWriteError,
    listen(controls) {
      return getDocument().onSnapshot(snap => {
        if (!snap.exists) return;
        const data = snap.data();
        if (data.clientId && data.clientId === clientId) return;

        setLoading(true);
        try {
          const result = mergeSnapshot(data);
          setLoading(false);
          if (result.needsReconverge && controls.canReconverge()) {
            controls.markReconverged();
            controls.setLastSyncedSignature(null);
            controls.saveRemote();
          } else if (!result.needsReconverge) {
            controls.setLastSyncedSignature(result.signature);
            setStatus('synced');
          }
        } catch (error) {
          try {
            applyFallbackSnapshot(data, error);
            controls.setLastSyncedSignature(signature());
          } finally {
            setLoading(false);
          }
        }
      }, onListenerError);
    },
  };
}
