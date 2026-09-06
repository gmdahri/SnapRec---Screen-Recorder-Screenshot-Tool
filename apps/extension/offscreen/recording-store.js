/** Durable capture journal. Separate DB leaves the legacy preview bridge unchanged. */
(function (root) {
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SnapRecRecovery', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('sessions', { keyPath: 'id' });
        request.result.createObjectStore('chunks', { keyPath: ['sessionId', 'index'] });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other recovery tabs and retry.'));
    });
  }
  async function transaction(stores, mode, action) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      tx.oncomplete = () => { db.close(); resolve(typeof result === 'function' ? result() : result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error || new Error('Capture storage failed')); };
      try { result = action(tx); } catch (error) { tx.abort(); db.close(); reject(error); }
    });
  }
  const api = {
    begin: async mime => {
      const session = { id: crypto.randomUUID(), mime, createdAt: Date.now(), complete: false };
      await transaction(['sessions'], 'readwrite', tx => { tx.objectStore('sessions').add(session); });
      return session.id;
    },
    append: (sessionId, index, blob) => transaction(['chunks'], 'readwrite', tx => {
      tx.objectStore('chunks').add({ sessionId, index, blob });
    }),
    list: () => transaction(['sessions'], 'readonly', tx => {
      const req = tx.objectStore('sessions').getAll(); return () => req.result;
    }),
    blob: (id, mime) => transaction(['chunks'], 'readonly', tx => {
      const req = tx.objectStore('chunks').getAll(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
      return () => new Blob(req.result.map(row => row.blob), { type: mime });
    }),
    finish: id => transaction(['sessions'], 'readwrite', tx => {
      const store = tx.objectStore('sessions'); const req = store.get(id);
      req.onsuccess = () => { if (req.result) store.put({ ...req.result, complete: true }); };
    }),
    remove: id => transaction(['sessions', 'chunks'], 'readwrite', tx => {
      tx.objectStore('sessions').delete(id);
      tx.objectStore('chunks').delete(IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]));
    }),
  };
  root.SnapRecRecordingStore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
