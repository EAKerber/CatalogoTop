from pathlib import Path

path = Path('scripts/_apply-v0.11.4.3.py')
text = path.read_text(encoding='utf-8')
old = """files.remoteSource.includes(\"redirect: 'manual'\")"""
new = r"""files.remoteSource.includes(\"redirect: 'manual'\")"""
# `old` is how the invalid Python source is parsed as text; `new` writes escaped
# double quotes into that source so its generated JavaScript remains identical.
if text.count(old) != 1:
    raise RuntimeError(f'quoting repair anchor mismatch: {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('v0.11.4.3 staging script quoting repaired')
