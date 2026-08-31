(function () {
  'use strict';
  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const DB_NAME = 'catalogotop-cache-v1';
  const STORE = 'snapshots';
  const PRODUCT_KEY = 'products-current';
  const CATALOG_KEY = 'catalogs-current';
  const ASSET_INDEX_KEY = 'asset-index-current';
  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falha ao abrir cache local.'));
    });
  }
  async function withStore(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const store = transaction.objectStore(STORE);
      let result;
      try { result = fn(store); } catch (error) { reject(error); return; }
      transaction.oncomplete = () => { db.close(); resolve(result?.result ?? result); };
      transaction.onerror = () => { db.close(); reject(transaction.error || new Error('Falha no cache local.')); };
    });
  }
  async function getByKey(key) {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE, 'readonly');
        const request = transaction.objectStore(STORE).get(key);
        request.onsuccess = () => { db.close(); resolve(request.result || null); };
        request.onerror = () => { db.close(); reject(request.error); };
      });
    } catch (error) {
      console.warn('Cache IndexedDB indisponível:', error);
      return null;
    }
  }
  async function setByKey(key, snapshot) {
    try { await withStore('readwrite', store => store.put(snapshot, key)); }
    catch (error) { console.warn('Não foi possível atualizar cache IndexedDB:', error); }
  }
  NS.IndexedCache = {
    getSnapshot: () => getByKey(PRODUCT_KEY),
    setSnapshot: snapshot => setByKey(PRODUCT_KEY, snapshot),
    getCatalogSnapshot: () => getByKey(CATALOG_KEY),
    setCatalogSnapshot: snapshot => setByKey(CATALOG_KEY, snapshot),
    getAssetIndexSnapshot: () => getByKey(ASSET_INDEX_KEY),
    setAssetIndexSnapshot: snapshot => setByKey(ASSET_INDEX_KEY, snapshot)
  };
})();
