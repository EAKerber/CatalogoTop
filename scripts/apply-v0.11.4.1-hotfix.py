from pathlib import Path


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def patch(path, transform):
    file = Path(path)
    before = file.read_text(encoding="utf-8")
    after = transform(before)
    if after == before:
        raise SystemExit(f"{path}: patch produced no change")
    file.write_text(after, encoding="utf-8")
    print(f"patched {path}")


def variation_bundle(text):
    text = replace_once(text, "  const REQUEST_VERSION = 1;", "  const REQUEST_VERSION = 2;", "request version")
    text = replace_once(
        text,
        "  async function fetchSourceAsset(sourceRef, fetchFn = fetch) {",
        """  function isRemoteHttpSource(value) {
    return /^https?:\\/\\/[^\\s]+$/i.test(String(value || '').trim());
  }

  async function remoteSourceDescriptor(sourceRef) {
    const ref = String(sourceRef || '').trim();
    if (!isRemoteHttpSource(ref)) throw new Error('variation_remote_source_invalid');
    return {
      mode: 'remote-url',
      sourceRef: ref,
      url: ref,
      fingerprint: await sha256(`remote-url:${ref}`)
    };
  }

  async function fetchSourceAsset(sourceRef, fetchFn = fetch) {""",
        "remote helper insertion"
    )
    text = replace_once(
        text,
        """      return {
        sourceRef: ref,
        mimeType: blob.type || 'application/octet-stream',
        bytes,
        sha256: hash,
        path: `sources/sha256-${hash}.${extension}`
      };""",
        """      return {
        mode: 'embedded',
        sourceRef: ref,
        mimeType: blob.type || 'application/octet-stream',
        bytes,
        sha256: hash,
        fingerprint: hash,
        path: `sources/sha256-${hash}.${extension}`
      };""",
        "embedded source descriptor"
    )
    text = replace_once(
        text,
        """      const source = await sourceCache.get(sourceRef);
      if (source?.error) {
        issues.push({
          placementKey: placement.placementKey,
          productId: placement.productId,
          code: String(product?.code || ''),
          reason: 'source-unavailable',
          detail: String(source.error?.message || source.error)
        });
        continue;
      }
      if (!archiveAssets.has(source.path)) archiveAssets.set(source.path, source.bytes);""",
        """      let source = await sourceCache.get(sourceRef);
      if (source?.error) {
        if (isRemoteHttpSource(sourceRef)) {
          source = await remoteSourceDescriptor(sourceRef);
        } else {
          issues.push({
            placementKey: placement.placementKey,
            productId: placement.productId,
            code: String(product?.code || ''),
            reason: 'source-unavailable',
            detail: String(source.error?.message || source.error)
          });
          continue;
        }
      }
      if (source.mode === 'embedded' && !archiveAssets.has(source.path)) archiveAssets.set(source.path, source.bytes);""",
        "source fallback"
    )
    text = replace_once(text, "        sourceSha256: source.sha256", "        sourceFingerprint: source.fingerprint", "signature source identity")
    text = replace_once(
        text,
        """        source: {
          path: source.path,
          mimeType: source.mimeType,
          sha256: source.sha256,
          originalRef: source.sourceRef
        }""",
        """        source: source.mode === 'remote-url'
          ? {
              mode: 'remote-url',
              url: source.url,
              fingerprint: source.fingerprint,
              originalRef: source.sourceRef
            }
          : {
              mode: 'embedded',
              path: source.path,
              mimeType: source.mimeType,
              sha256: source.sha256,
              fingerprint: source.fingerprint,
              originalRef: source.sourceRef
            }""",
        "manifest source union"
    )
    text = replace_once(
        text,
        "      'CatalogoTop — Image Variation Request v1',",
        "      'CatalogoTop — Image Variation Request v2',",
        "readme version"
    )
    text = replace_once(
        text,
        "      'Use manifest.json as the authoritative contract. source.path points to the canonical original image included in this ZIP.',",
        """      'Use manifest.json as the authoritative contract.',
      'For source.mode=embedded, source.path points to the canonical original included in this ZIP.',
      'For source.mode=remote-url, source.url is the canonical external locator because browser CORS prevented embedding; retrieve it subject to your own network/security policy.',""",
        "readme source contract"
    )
    text = replace_once(
        text,
        "        sourceAuthority: 'product.image',\n        resultScope: 'catalog-local',",
        "        sourceAuthority: 'product.image',\n        externalUrlFallback: true,\n        resultScope: 'catalog-local',",
        "policy external fallback"
    )
    text = replace_once(
        text,
        "    mimeExtension,\n    fetchSourceAsset,",
        "    mimeExtension,\n    isRemoteHttpSource,\n    remoteSourceDescriptor,\n    fetchSourceAsset,",
        "exports"
    )
    return text


def variation_controls(text):
    text = replace_once(
        text,
        """      const jobs = result.manifest.jobs.length;
      const issues = result.manifest.issues;
      const issueText = issueSummary(issues);""",
        """      const jobs = result.manifest.jobs.length;
      const issues = result.manifest.issues;
      const remoteJobs = result.manifest.jobs.filter(job => job?.source?.mode === 'remote-url').length;
      const issueText = issueSummary(issues);
      const remoteText = remoteJobs ? `${remoteJobs} ${remoteJobs === 1 ? 'por URL externa' : 'por URLs externas'}` : '';""",
        "controls remote count"
    )
    text = replace_once(
        text,
        """      downloadBundle(result);
      setStatus(`${jobs} ${jobs === 1 ? 'imagem preparada' : 'imagens preparadas'}${issueText ? ` · ${issueText}` : ''}.`, issues.length ? 'warning' : 'success');""",
        """      downloadBundle(result);
      setStatus(`${jobs} ${jobs === 1 ? 'imagem preparada' : 'imagens preparadas'}${remoteText ? ` · ${remoteText}` : ''}${issueText ? ` · ${issueText}` : ''}.`, remoteJobs || issues.length ? 'warning' : 'success');""",
        "controls status"
    )
    text = replace_once(
        text,
        """          jobs,
          issues: structuredClone(issues),
          byteLength: result.archive.byteLength""",
        """          jobs,
          remoteJobs,
          issues: structuredClone(issues),
          byteLength: result.archive.byteLength""",
        "controls event"
    )
    return text


def mobile_workspace(text):
    return replace_once(
        text,
        """    if (mobile.matches && appPrimaryTools) appPrimaryTools.appendChild(controls);
    else if (historyMarker.isConnected) historyMarker.after(controls);""",
        """    if (mobile.matches && isCatalogActive() && appPrimaryTools) appPrimaryTools.appendChild(controls);
    else if (historyMarker.isConnected) historyMarker.after(controls);""",
        "history physical scope"
    )


def request_fixture(text):
    text = replace_once(
        text,
        "if (first.manifest.kind !== 'catalogotop.image-variation-request' || first.manifest.version !== 1) fail('manifest kind/version inválidos');",
        "if (first.manifest.kind !== 'catalogotop.image-variation-request' || first.manifest.version !== 2) fail('manifest kind/version inválidos');",
        "fixture version"
    )
    text = replace_once(
        text,
        "if (first.manifest.jobs[0].target.imageFrame.zoom !== 1.4 || first.manifest.jobs[0].source.originalRef !== sharedSource) fail('job não preservou framing/source canônico');",
        "if (first.manifest.jobs[0].target.imageFrame.zoom !== 1.4 || first.manifest.jobs[0].source.originalRef !== sharedSource || first.manifest.jobs[0].source.mode !== 'embedded' || first.manifest.jobs[0].source.fingerprint !== first.manifest.jobs[0].source.sha256) fail('job não preservou framing/source canônico embutido');",
        "fixture embedded assertion"
    )
    marker = "\nconsole.log('PASS variation bundle request fixture: placements, signatures, timestamp informativo, policy, issues, dedupe e ZIP');\n"
    addition = r'''

const remoteProduct = product('remote', 'https://cdn.example.com/catalog/product.webp');
const remoteDocument = {
  schemaVersion: 4,
  template: { id: 'technical' },
  selectedCount: 1,
  pageCount: 1,
  orderedIds: ['remote'],
  pages: [{
    index: 0,
    category: 'Ferragens',
    items: [{ type: 'card', product: remoteProduct, productId: 'remote', row: 1, start: 1, span: 3, contentPreset: 'visual', emphasis: 'normal', width: 'simple' }]
  }]
};
const remoteState = {
  ...state,
  products: [remoteProduct],
  selectedIds: ['remote'],
  catalog: { ...state.catalog, presentation: { imageFrames: {}, imageSelections: {}, imageVariants: {} } }
};
const failingFetch = async () => { throw new TypeError('Failed to fetch'); };
const remoteRequest = await VariationBundle.buildRequest(remoteState, {
  documentModel: remoteDocument,
  measurements: { 'card:remote': { widthPx: 200, heightPx: 150, widthMm: 52.5, heightMm: 39.4, aspectRatio: 1.3333 } },
  fetchFn: failingFetch,
  generatedAt: '2026-08-29T12:00:00.000Z'
});
if (remoteRequest.manifest.jobs.length !== 1 || remoteRequest.manifest.issues.length !== 0) fail(`URL externa bloqueada por CORS deve continuar elegível: ${JSON.stringify(remoteRequest.manifest)}`);
const remoteSource = remoteRequest.manifest.jobs[0].source;
if (remoteSource.mode !== 'remote-url' || remoteSource.url !== remoteProduct.image || remoteSource.originalRef !== remoteProduct.image || !/^[a-f0-9]{64}$/.test(remoteSource.fingerprint) || remoteSource.path || remoteSource.sha256) fail(`source remote-url inválida: ${JSON.stringify(remoteSource)}`);
if (remoteRequest.archive.entries.some(item => item.path.startsWith('sources/'))) fail('fallback remote-url não pode fingir bytes de imagem no ZIP');
if (!remoteRequest.manifest.policy.externalUrlFallback) fail('policy precisa declarar fallback de URL externa');

const managedFailure = await VariationBundle.buildRequest({ ...state, products: [p1], selectedIds: ['p1'] }, {
  documentModel: { ...remoteDocument, orderedIds: ['p1'], pages: [{ ...remoteDocument.pages[0], items: [{ type: 'card', product: p1, productId: 'p1', row: 1, start: 1, span: 3, contentPreset: 'visual', emphasis: 'normal', width: 'simple' }] }] },
  measurements: { 'card:p1': measurements['card:p1'] },
  fetchFn: failingFetch,
  generatedAt: '2026-08-29T12:00:00.000Z'
});
if (managedFailure.manifest.jobs.length !== 0 || managedFailure.manifest.issues[0]?.reason !== 'source-unavailable') fail('asset gerenciado indisponível deve continuar fail-closed; não pode virar URL externa');

console.log('PASS variation bundle request fixture: placements, signatures, source embedded/remote-url, timestamp, policy, issues, dedupe e ZIP');
'''
    text = replace_once(text, marker, addition, "fixture remote cases")
    return text


def browser_variation(text):
    text = replace_once(
        text,
        """    {
      id: 'request-p2', code: 'REQ-2', description: 'Produto sem imagem', category: 'Teste', subcategory: '', price: 'R$ 60,00', status: 'Ativo', notes: '',
      image: '', imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    }
  ];""",
        """    {
      id: 'request-p2', code: 'REQ-2', description: 'Produto sem imagem', category: 'Teste', subcategory: '', price: 'R$ 60,00', status: 'Ativo', notes: '',
      image: '', imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    },
    {
      id: 'request-p3', code: 'REQ-3', description: 'Produto com URL externa', category: 'Teste', subcategory: '', price: 'R$ 70,00', status: 'Ativo', notes: '',
      image: 'https://cdn.example.invalid/request-p3.webp', imageGallery: [], specs: [], variants: [], tableRows: [], updatedAt: '2026-08-29T00:00:00.000Z'
    }
  ];""",
        "browser remote product"
    )
    text = replace_once(
        text,
        """  await page.evaluate(seedState);

  const before = await page.evaluate(() => JSON.stringify(window.CatalogoTop.Core.getState()));""",
        """  await page.evaluate(seedState);
  await page.evaluate(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (...args) => String(args[0] || '').startsWith('https://cdn.example.invalid/')
      ? Promise.reject(new TypeError('Failed to fetch'))
      : nativeFetch(...args);
  });

  const before = await page.evaluate(() => JSON.stringify(window.CatalogoTop.Core.getState()));""",
        "browser fetch failure"
    )
    text = replace_once(
        text,
        "if (exported.detail.jobs !== 1 || exported.detail.issues?.length !== 1 || exported.detail.issues[0]?.reason !== 'missing-source') throw new Error(`resumo de exportação inesperado: ${JSON.stringify(exported.detail)}`);",
        "if (exported.detail.jobs !== 2 || exported.detail.remoteJobs !== 1 || exported.detail.issues?.length !== 1 || exported.detail.issues[0]?.reason !== 'missing-source') throw new Error(`resumo de exportação inesperado: ${JSON.stringify(exported.detail)}`);",
        "browser export counts"
    )
    text = replace_once(
        text,
        "if (exported.statusState !== 'warning' || !exported.status.includes('1 imagem preparada') || !exported.status.includes('1 sem imagem original')) throw new Error(`status de exportação inesperado: ${JSON.stringify(exported)}`);",
        "if (exported.statusState !== 'warning' || !exported.status.includes('2 imagens preparadas') || !exported.status.includes('1 por URL externa') || !exported.status.includes('1 sem imagem original')) throw new Error(`status de exportação inesperado: ${JSON.stringify(exported)}`);",
        "browser export status"
    )
    text = replace_once(
        text,
        "if (blocked.detail.jobs !== 0 || blocked.detail.issues?.length !== 2) throw new Error(`bloqueio sem jobs incorreto: ${JSON.stringify(blocked)}`);",
        "if (blocked.detail.jobs !== 0 || blocked.detail.issues?.length !== 3) throw new Error(`bloqueio sem jobs incorreto: ${JSON.stringify(blocked)}`);",
        "browser blocked count"
    )
    text = replace_once(
        text,
        "console.log('PASS browser variation bundle gate: export ZIP, renderer real, issues, zero-job block e estado imutável');",
        "console.log('PASS browser variation bundle gate: export ZIP, fallback URL externa/CORS, renderer real, issues, zero-job block e estado imutável');",
        "browser log"
    )
    return text


def browser_history(text):
    text = replace_once(
        text,
        """    const outsideMobile = await page.evaluate(() => ({
      hidden: document.querySelector('.editor-history-controls').hidden,
      parentClass: document.querySelector('.editor-history-controls').parentElement?.className || '',
      snapshot: JSON.stringify(window.CatalogoTop.EditorHistory.snapshot())
    }));
    if (!outsideMobile.hidden || !outsideMobile.parentClass.includes('app-primary-tools')) throw new Error(`histórico mobile visível fora de Catálogo em ${tabId}: ${JSON.stringify(outsideMobile)}`);""",
        """    const outsideMobile = await page.evaluate(() => {
      const history = document.querySelector('.editor-history-controls');
      const rect = history.getBoundingClientRect();
      return {
        hidden: history.hidden,
        display: getComputedStyle(history).display,
        width: rect.width,
        height: rect.height,
        parentClass: history.parentElement?.className || '',
        snapshot: JSON.stringify(window.CatalogoTop.EditorHistory.snapshot())
      };
    });
    if (!outsideMobile.hidden || outsideMobile.display !== 'none' || outsideMobile.width !== 0 || outsideMobile.height !== 0 || !outsideMobile.parentClass.includes('heading-actions')) throw new Error(`histórico mobile vazou visualmente fora de Catálogo em ${tabId}: ${JSON.stringify(outsideMobile)}`);""",
        "mobile history outside assertion"
    )
    text = replace_once(
        text,
        """      return {
        hidden: history.hidden,
        historyTop: h.top,
        tabsTop: t.top,
        headerHeight: header.getBoundingClientRect().height,
        snapshot: JSON.stringify(window.CatalogoTop.EditorHistory.snapshot())
      };""",
        """      return {
        hidden: history.hidden,
        parentClass: history.parentElement?.className || '',
        historyTop: h.top,
        tabsTop: t.top,
        headerHeight: header.getBoundingClientRect().height,
        snapshot: JSON.stringify(window.CatalogoTop.EditorHistory.snapshot())
      };""",
        "mobile history restore parent"
    )
    text = replace_once(
        text,
        "if (restored.hidden || Math.abs(restored.historyTop - restored.tabsTop) > 8 || restored.headerHeight > mobile.headerHeight + 2 || restored.snapshot !== mobileSnapshot) throw new Error(`histórico mobile não restaurou corretamente após ${tabId}: ${JSON.stringify(restored)}`);",
        "if (restored.hidden || !restored.parentClass.includes('app-primary-tools') || Math.abs(restored.historyTop - restored.tabsTop) > 8 || restored.headerHeight > mobile.headerHeight + 2 || restored.snapshot !== mobileSnapshot) throw new Error(`histórico mobile não restaurou corretamente após ${tabId}: ${JSON.stringify(restored)}`);",
        "mobile history restored assertion"
    )
    return text


patch('src/variation-bundle.js', variation_bundle)
patch('src/variation-bundle-controls.js', variation_controls)
patch('src/mobile-workspace.js', mobile_workspace)
patch('scripts/variation-bundle-request-fixture.mjs', request_fixture)
patch('scripts/browser-variation-bundle-gate.mjs', browser_variation)
patch('scripts/browser-editor-shortcuts-history-gate.mjs', browser_history)
