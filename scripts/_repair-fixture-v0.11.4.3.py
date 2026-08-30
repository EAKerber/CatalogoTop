from pathlib import Path

path = Path('scripts/storage-contract-fixture.mjs')
text = path.read_text(encoding='utf-8')
old = "files.assets.indexOf('source_authority_changed') < files.assets.indexOf('fetchRemoteProductSource')"
new = "files.assets.indexOf('source_authority_changed') < files.assets.indexOf('const remote = await fetchRemoteProductSource')"
if text.count(old) != 1:
    raise RuntimeError(f'authority fixture anchor mismatch: {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('v0.11.4.3 authority fixture now compares against the executable fetch call')
