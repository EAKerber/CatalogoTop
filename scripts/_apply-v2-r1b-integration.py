from pathlib import Path


def replace_exact(path, old, new):
    p = Path(path)
    text = p.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected exactly one anchor, found {count}')
    p.write_text(text.replace(old, new), encoding='utf-8')


replace_exact(
    'src/core.js',
    """  function assignProductToLegacyPath(draft, product) {\n    if (!NS.ProductSnapshot) return normalizeProduct(product);\n    const assigned = NS.ProductSnapshot.assignLegacyProduct(draft.folders || [], normalizeProduct(product), { idFactory: folderUuid });\n    draft.folders = assigned.folders;\n    return normalizeProduct(assigned.product);\n  }\n""",
    """  function assignProductToLegacyPath(draft, product) {\n    const normalized = normalizeProduct(product);\n    if (!NS.ProductSnapshot) return normalized;\n\n    if (normalized.folderId && NS.ProductFolderMigration) {\n      try {\n        const projection = NS.ProductFolderMigration.projectLegacyForFolder(draft.folders || [], normalized.folderId);\n        if (projection.category === normalized.category && projection.subcategory === normalized.subcategory) {\n          return normalizeProduct({ ...normalized, ...projection });\n        }\n      } catch (error) {\n        if (error?.code !== 'folder_not_found') throw error;\n      }\n    }\n\n    const assigned = NS.ProductSnapshot.assignLegacyProduct(draft.folders || [], normalized, { idFactory: folderUuid });\n    draft.folders = assigned.folders;\n    return normalizeProduct(assigned.product);\n  }\n"""
)

replace_exact(
    'src/app.js',
    """      save(draft => {\n        const index = draft.products.findIndex(item => item.id === id);\n        if (index >= 0) draft.products[index] = product;\n        else draft.products.push(product);\n      });\n""",
    """      save(draft => {\n        const assignedProduct = Core.assignProductToLegacyPath\n          ? Core.assignProductToLegacyPath(draft, product)\n          : product;\n        const index = draft.products.findIndex(item => item.id === id);\n        if (index >= 0) draft.products[index] = assignedProduct;\n        else draft.products.push(assignedProduct);\n      });\n"""
)

replace_exact(
    'index.html',
    """  <script defer src=\"src/catalog-date.js\"></script>\n  <script defer src=\"src/core.js\"></script>\n""",
    """  <script defer src=\"src/catalog-date.js\"></script>\n  <script defer src=\"src/folder-tree.js\"></script>\n  <script defer src=\"src/product-folder-migration.js\"></script>\n  <script defer src=\"src/product-snapshot.js\"></script>\n  <script defer src=\"src/core.js\"></script>\n"""
)

p = Path('package.json')
text = p.read_text(encoding='utf-8')
old = 'node scripts/folder-tree-fixture.mjs && node scripts/product-folder-migration-fixture.mjs && node scripts/catalog-date-fixture.mjs'
new = 'node scripts/folder-tree-fixture.mjs && node scripts/product-folder-migration-fixture.mjs && node scripts/product-snapshot-fixture.mjs && node scripts/core-folder-state-fixture.mjs && node scripts/server-product-folders-fixture.mjs && node scripts/catalog-date-fixture.mjs'
if text.count(old) != 1:
    raise SystemExit('package.json: test anchor mismatch')
p.write_text(text.replace(old, new), encoding='utf-8')

p = Path('scripts/storage-contract-fixture.mjs')
text = p.read_text(encoding='utf-8')
text = text.replace(
    "  storage: await readFile('netlify/lib/storage.mts', 'utf8'),\n",
    "  storage: await readFile('netlify/lib/storage.mts', 'utf8'),\n  productFolders: await readFile('netlify/lib/product-folders.mts', 'utf8'),\n"
)
text = text.replace(
    "  ['PUT exige expectedRevision', files.products.includes('expectedRevision') && files.products.includes('revision_conflict')],\n",
    "  ['PUT exige expectedRevision', files.products.includes('expectedRevision') && files.products.includes('revision_conflict')],\n  ['PUT publica ProductSnapshot v2 com folders', files.products.includes('PRODUCT_SNAPSHOT_VERSION') && files.products.includes('folders: body.folders || []') && files.products.includes('validateProductSnapshot(body.folders, body.products)')],\n  ['backend valida hierarquia e mirrors de folderId', files.storage.includes('validateProductFolders') && files.productFolders.includes('folderId inexistente') && files.productFolders.includes('divergentes de folderId') && files.productFolders.includes('duplicado entre irmãos')],\n"
)
text = text.replace(
    "  ['cache local usa IndexedDB', files.cache.includes('indexedDB.open') && files.cache.includes('products-current')],\n",
    "  ['cache local usa IndexedDB', files.cache.includes('indexedDB.open') && files.cache.includes('products-current')],\n  ['ProductStore publica folders e products no mesmo expectedRevision', files.client.includes('putSnapshot(localFolders, materialized)') && files.client.includes('folders: candidate.folders') && files.client.includes('products: candidate.products')],\n  ['ProductStore lê snapshots v1/v2 pela autoridade ProductSnapshot', files.client.includes('ProductSnapshot.read(raw)') && files.client.includes('snapshotMigrationPending')],\n"
)
text = text.replace(
    "  ['clientes de storage carregam antes do app', files.html.indexOf('src/product-store.js') < files.html.indexOf('src/app.js')]\n",
    "  ['contratos de folder/snapshot carregam antes do Core', files.html.indexOf('src/folder-tree.js') < files.html.indexOf('src/product-folder-migration.js') && files.html.indexOf('src/product-folder-migration.js') < files.html.indexOf('src/product-snapshot.js') && files.html.indexOf('src/product-snapshot.js') < files.html.indexOf('src/core.js')],\n  ['clientes de storage carregam antes do app', files.html.indexOf('src/product-store.js') < files.html.indexOf('src/app.js')]\n"
)
p.write_text(text, encoding='utf-8')

p = Path('scripts/validate.mjs')
text = p.read_text(encoding='utf-8')
old = "  ['estado local migra para schema v7', core.includes('SCHEMA_VERSION = 7') && core.includes('imageGallery: normalizeImageGallery') && core.includes('order: []') && core.includes('blocks: []')],"
new = "  ['estado local migra para schema v8 com folders', core.includes('SCHEMA_VERSION = 8') && core.includes('folders: organization.folders || []') && core.includes('folderId: String(product.folderId || \\\'\\\').trim()') && core.includes('imageGallery: normalizeImageGallery') && core.includes('order: []') && core.includes('blocks: []') && html.indexOf('src/folder-tree.js') < html.indexOf('src/product-folder-migration.js') && html.indexOf('src/product-folder-migration.js') < html.indexOf('src/product-snapshot.js') && html.indexOf('src/product-snapshot.js') < html.indexOf('src/core.js')],"
if text.count(old) != 1:
    raise SystemExit('scripts/validate.mjs: schema gate anchor mismatch')
p.write_text(text.replace(old, new), encoding='utf-8')

replace_exact(
    'scripts/collection-runtime-fixture.mjs',
    "core.includes('SCHEMA_VERSION = 7')",
    "core.includes('SCHEMA_VERSION = 8')"
)

replace_exact(
    'scripts/quantity-pricing-fixture.mjs',
    "if (Core.SCHEMA_VERSION !== 7) fail(`schema esperado 7, recebeu ${Core.SCHEMA_VERSION}`);",
    "if (Core.SCHEMA_VERSION !== 8) fail(`schema esperado 8, recebeu ${Core.SCHEMA_VERSION}`);"
)
replace_exact(
    'scripts/quantity-pricing-fixture.mjs',
    "if (migrated.schemaVersion !== 7 || migrated.products[0]?.quantityPrice !== null) fail(`migração v5→v7 inesperada: ${JSON.stringify(migrated)}`);",
    "if (migrated.schemaVersion !== 8 || migrated.products[0]?.quantityPrice !== null) fail(`migração v5→v8 inesperada: ${JSON.stringify(migrated)}`);"
)
replace_exact(
    'scripts/quantity-pricing-fixture.mjs',
    "console.log('PASS quantity pricing fixture: schema 7, normalização, merge conservador, importação e Table sem herança indevida');",
    "console.log('PASS quantity pricing fixture: schema 8, normalização, merge conservador, importação e Table sem herança indevida');"
)

replace_exact(
    'scripts/image-variants-fixture.mjs',
    "if (legacy.schemaVersion !== 7) fail(`schema legado não migrou para v7: ${legacy.schemaVersion}`);",
    "if (legacy.schemaVersion !== 8) fail(`schema legado não migrou para v8: ${legacy.schemaVersion}`);"
)
replace_exact(
    'scripts/image-variants-fixture.mjs',
    "console.log('PASS image variants fixture: schema 7, galeria, seleção local e fallback Original');",
    "console.log('PASS image variants fixture: schema 8, galeria, seleção local e fallback Original');"
)

replace_exact(
    'scripts/image-variants-backup-fixture.mjs',
    "if (restored.schemaVersion !== 7) fail(`round-trip deve permanecer schema 7: ${restored.schemaVersion}`);",
    "if (restored.schemaVersion !== 8) fail(`round-trip deve migrar para schema 8: ${restored.schemaVersion}`);"
)
replace_exact(
    'scripts/image-variants-backup-fixture.mjs',
    "console.log('PASS image variants backup fixture: schema 7, Original, gallery, local variants, selection, framing, sessão e publicação product-only');",
    "console.log('PASS image variants backup fixture: schema 8, Original, gallery, local variants, selection, framing, sessão e publicação product-only');"
)

replace_exact(
    'scripts/browser-inspector-gate.mjs',
    "if (migration.schemaVersion !== 7 || migration.order.join(',') !== 'p2,p1') throw new Error(`migração legada→v7 não preservou ordem: ${JSON.stringify(migration)}`);",
    "if (migration.schemaVersion !== 8 || migration.order.join(',') !== 'p2,p1') throw new Error(`migração legada→v8 não preservou ordem: ${JSON.stringify(migration)}`);"
)
