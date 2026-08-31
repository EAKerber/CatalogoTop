(function () {
  'use strict';

  const NS = window.CatalogoTop = window.CatalogoTop || {};
  const AssetIndexSnapshot = NS.AssetIndexSnapshot;
  if (!AssetIndexSnapshot) return;

  function clone(value) {
    return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  }

  function overlay(payload, localSnapshot, { pending = false } = {}) {
    const remoteAssets = Array.isArray(payload?.assets) ? payload.assets : [];
    const local = AssetIndexSnapshot.read(localSnapshot || AssetIndexSnapshot.forWrite()).snapshot;
    const byId = new Map(remoteAssets.map(asset => [String(asset.id), clone(asset)]));

    for (const record of local.assets) {
      const existing = byId.get(record.id) || {
        id: record.id,
        sha256: record.sha256,
        url: AssetIndexSnapshot.urlFrom(record.sha256),
        usages: [],
        available: true
      };
      byId.set(record.id, {
        ...existing,
        id: record.id,
        sha256: record.sha256,
        url: AssetIndexSnapshot.urlFrom(record.sha256),
        folderId: record.folderId ?? null,
        label: record.label || existing.label || `Imagem ${record.sha256.slice(0, 8)}`,
        indexed: true,
        contentType: record.contentType || existing.contentType || '',
        bytes: Number(record.bytes || existing.bytes || 0) || 0,
        createdAt: record.createdAt || existing.createdAt || '',
        updatedAt: record.updatedAt || existing.updatedAt || '',
        usages: Array.isArray(existing.usages) ? existing.usages : [],
        pendingIndex: Boolean(pending)
      });
    }

    return {
      ...(payload || {}),
      assets: Array.from(byId.values()),
      localAssetIndexRevision: local.revision,
      assetIndexPending: Boolean(pending)
    };
  }

  NS.AssetInventory = Object.freeze({ overlay });
})();
