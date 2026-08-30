from pathlib import Path

bundle_path = Path('src/variation-bundle.js')
bundle = bundle_path.read_text(encoding='utf-8')
start = bundle.index('  function sourceMaterializerScript() {')
end = bundle.index('  function requestReadme() {', start)
helper = r'''  function sourceMaterializerScript() {
  return String.raw`#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import json
import socket
import sys
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

REQUEST_KIND = "catalogotop.image-variation-request"
REQUEST_VERSION = 2
INDEX_KIND = "catalogotop.materialized-sources"
INDEX_VERSION = 1
PLAN_KIND = "catalogotop.source-materialization-plan"
PLAN_VERSION = 1
MAX_SOURCE_BYTES = 25 * 1024 * 1024
MAX_TOTAL_BYTES = 200 * 1024 * 1024
MAX_REDIRECTS = 5
TIMEOUT_SECONDS = 20
CHUNK_BYTES = 64 * 1024


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fail(message: str) -> None:
    raise RuntimeError(message)


def validate_locator(value: str) -> str:
    try:
        parsed = urlparse(value)
        port = parsed.port
    except ValueError as exc:
        fail(f"invalid-url:{exc}")
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        fail("url-must-be-http-or-https")
    if parsed.username or parsed.password:
        fail("url-credentials-not-allowed")
    if port not in {None, 80, 443}:
        fail(f"url-port-not-allowed:{port}")
    host = parsed.hostname.rstrip(".").lower()
    if host == "localhost" or host.endswith(".local"):
        fail("local-hostname-not-allowed")
    try:
        literal_ip = ipaddress.ip_address(host.split("%", 1)[0])
    except ValueError:
        literal_ip = None
    if literal_ip is not None and not literal_ip.is_global:
        fail(f"non-public-address-blocked:{literal_ip}")
    return value


def validate_public_url(value: str) -> str:
    validate_locator(value)
    parsed = urlparse(value)
    host = parsed.hostname.rstrip(".").lower()
    resolved_port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        addresses = {
            info[4][0].split("%", 1)[0]
            for info in socket.getaddrinfo(host, resolved_port, type=socket.SOCK_STREAM)
        }
    except OSError as exc:
        fail(f"dns-resolution-failed:{exc}")
    if not addresses:
        fail("dns-resolution-empty")
    for address in addresses:
        try:
            ip = ipaddress.ip_address(address)
        except ValueError:
            fail(f"dns-address-invalid:{address}")
        if not ip.is_global:
            fail(f"non-public-address-blocked:{address}")
    return value


def fetch_source(url: str) -> tuple[bytes, str, str]:
    opener = build_opener(NoRedirect())
    current = url
    for redirect_count in range(MAX_REDIRECTS + 1):
        validate_public_url(current)
        request = Request(
            current,
            headers={
                "User-Agent": "CatalogoTop-Source-Materializer/1.1",
                "Accept": "image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml;q=0.9,*/*;q=0.1",
            },
        )
        try:
            response = opener.open(request, timeout=TIMEOUT_SECONDS)
        except HTTPError as exc:
            if exc.code in {301, 302, 303, 307, 308}:
                location = exc.headers.get("Location")
                if not location:
                    fail(f"redirect-without-location:{exc.code}")
                if redirect_count >= MAX_REDIRECTS:
                    fail("redirect-limit-exceeded")
                current = urljoin(current, location)
                continue
            fail(f"http-error:{exc.code}")

        with response:
            final_url = response.geturl()
            validate_public_url(final_url)
            declared = str(response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
            length = response.headers.get("Content-Length")
            if length:
                try:
                    if int(length) > MAX_SOURCE_BYTES:
                        fail(f"source-size-limit:{length}")
                except ValueError:
                    pass
            chunks = []
            total = 0
            while True:
                chunk = response.read(CHUNK_BYTES)
                if not chunk:
                    break
                total += len(chunk)
                if total > MAX_SOURCE_BYTES:
                    fail(f"source-size-limit:{total}")
                chunks.append(chunk)
            if not total:
                fail("source-empty")
            return b"".join(chunks), final_url, declared
    fail("redirect-limit-exceeded")


def sniff_image(data: bytes, declared: str = "") -> tuple[str, str]:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png", "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg", "jpg"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp", "webp"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif", "gif"
    if len(data) >= 12 and data[4:8] == b"ftyp" and data[8:12] in {b"avif", b"avis"}:
        return "image/avif", "avif"
    head = data[:4096].lstrip(b"\xef\xbb\xbf \t\r\n")
    lower = head.lower()
    if declared == "image/svg+xml" or lower.startswith(b"<svg") or (lower.startswith(b"<?xml") and b"<svg" in lower):
        if b"<svg" in lower:
            return "image/svg+xml", "svg"
    fail(f"unsupported-or-unrecognized-image:{declared or 'unknown'}")


def source_fingerprint(url: str) -> str:
    return hashlib.sha256(f"remote-url:{url}".encode("utf-8")).hexdigest()


def load_manifest(root: Path) -> dict:
    path = root / "manifest.json"
    if not path.is_file():
        fail("manifest.json-not-found")
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("kind") != REQUEST_KIND or int(manifest.get("version") or 0) != REQUEST_VERSION:
        fail("unsupported-request-kind-or-version")
    request_id = str(manifest.get("requestId") or "").lower()
    if len(request_id) != 64 or any(ch not in "0123456789abcdef" for ch in request_id):
        fail("requestId-invalid")
    if not isinstance(manifest.get("jobs"), list):
        fail("jobs-invalid")
    return manifest


def remote_sources(manifest: dict) -> list[dict]:
    by_fingerprint: dict[str, dict] = {}
    for job in manifest["jobs"]:
        source = job.get("source") if isinstance(job, dict) else None
        if not isinstance(source, dict) or source.get("mode") != "remote-url":
            continue
        url = str(source.get("url") or "").strip()
        validate_locator(url)
        fingerprint = str(source.get("fingerprint") or "").strip().lower()
        expected = source_fingerprint(url)
        if fingerprint != expected:
            fail(f"source-fingerprint-mismatch:{job.get('jobId', '')}")
        current = by_fingerprint.get(fingerprint)
        if current and current["url"] != url:
            fail(f"source-fingerprint-collision:{fingerprint}")
        if not current:
            current = {"fingerprint": fingerprint, "url": url, "jobIds": []}
            by_fingerprint[fingerprint] = current
        job_id = str(job.get("jobId") or "")
        if job_id and job_id not in current["jobIds"]:
            current["jobIds"].append(job_id)
    return [by_fingerprint[key] for key in sorted(by_fingerprint)]


def incoming_relative(source: dict) -> Path:
    return Path("sources") / "incoming" / f"{source['fingerprint']}.bin"


def write_plan(root: Path, manifest: dict, sources: list[dict]) -> Path:
    context_dir = root / "context"
    incoming_dir = root / "sources" / "incoming"
    context_dir.mkdir(parents=True, exist_ok=True)
    incoming_dir.mkdir(parents=True, exist_ok=True)
    plan = {
        "kind": PLAN_KIND,
        "version": PLAN_VERSION,
        "requestId": manifest["requestId"],
        "manifestAuthority": "manifest.json",
        "downloads": [
            {
                "fingerprint": source["fingerprint"],
                "url": source["url"],
                "downloadPath": incoming_relative(source).as_posix(),
                "jobIds": sorted(source["jobIds"]),
            }
            for source in sources
        ],
    }
    path = context_dir / "materialization-plan.json"
    path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def materialize_bytes(root: Path, source: dict, data: bytes, final_url: str, declared: str, transport: str) -> dict:
    if not data:
        fail("source-empty")
    if len(data) > MAX_SOURCE_BYTES:
        fail(f"source-size-limit:{len(data)}")
    mime_type, extension = sniff_image(data, declared)
    digest = hashlib.sha256(data).hexdigest()
    relative_path = Path("sources") / "materialized" / f"{source['fingerprint']}.{extension}"
    destination = root / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return {
        "fingerprint": source["fingerprint"],
        "url": source["url"],
        "finalUrl": final_url,
        "path": relative_path.as_posix(),
        "mimeType": mime_type,
        "sha256": digest,
        "byteLength": len(data),
        "transport": transport,
        "jobIds": sorted(source["jobIds"]),
    }


def write_index(root: Path, manifest: dict, materialized: list[dict], failures: list[dict]) -> Path:
    context_dir = root / "context"
    context_dir.mkdir(parents=True, exist_ok=True)
    index = {
        "kind": INDEX_KIND,
        "version": INDEX_VERSION,
        "requestId": manifest["requestId"],
        "manifestAuthority": "manifest.json",
        "sources": materialized,
        "failures": failures,
    }
    path = context_dir / "materialized-sources.json"
    path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def failure_record(source: dict, exc: Exception) -> dict:
    return {
        "fingerprint": source["fingerprint"],
        "url": source["url"],
        "jobIds": sorted(source["jobIds"]),
        "error": str(exc),
    }


def materialize_direct(root: Path, manifest: dict, sources: list[dict]) -> int:
    materialized = []
    failures = []
    total_bytes = 0
    for source in sources:
        try:
            data, final_url, declared = fetch_source(source["url"])
            total_bytes += len(data)
            if total_bytes > MAX_TOTAL_BYTES:
                fail(f"total-size-limit:{total_bytes}")
            materialized.append(materialize_bytes(root, source, data, final_url, declared, "python-http"))
        except Exception as exc:
            failures.append(failure_record(source, exc))
    index_path = write_index(root, manifest, materialized, failures)
    print(f"Materialized {len(materialized)} remote source(s) with Python HTTP; failures={len(failures)}")
    print(f"Index: {index_path}")
    if failures:
        print("Direct fetch was incomplete. If the host platform can download URL bytes to files, follow context/materialization-plan.json and then run --mode ingest.", file=sys.stderr)
    return 2 if failures else 0


def ingest_downloads(root: Path, manifest: dict, sources: list[dict]) -> int:
    materialized = []
    failures = []
    total_bytes = 0
    for source in sources:
        incoming = root / incoming_relative(source)
        try:
            if not incoming.is_file():
                fail(f"incoming-file-missing:{incoming_relative(source).as_posix()}")
            size = incoming.stat().st_size
            if size <= 0:
                fail("source-empty")
            if size > MAX_SOURCE_BYTES:
                fail(f"source-size-limit:{size}")
            total_bytes += size
            if total_bytes > MAX_TOTAL_BYTES:
                fail(f"total-size-limit:{total_bytes}")
            data = incoming.read_bytes()
            materialized.append(materialize_bytes(root, source, data, source["url"], "", "platform-download"))
            incoming.unlink(missing_ok=True)
        except Exception as exc:
            failures.append(failure_record(source, exc))
    index_path = write_index(root, manifest, materialized, failures)
    print(f"Ingested {len(materialized)} platform-downloaded source(s); failures={len(failures)}")
    print(f"Index: {index_path}")
    return 2 if failures else 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Materialize remote-url sources from a CatalogoTop Image Variation Request.")
    parser.add_argument("root", nargs="?", default=".", help="Extracted request-bundle directory (default: current directory).")
    parser.add_argument("--mode", choices=("fetch", "plan", "ingest"), default="fetch", help="fetch=Python HTTP, plan=no network, ingest=validate files downloaded by the host platform.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    manifest = load_manifest(root)
    sources = remote_sources(manifest)
    plan_path = write_plan(root, manifest, sources)
    print(f"Plan: {plan_path}")
    if args.mode == "plan":
        for source in sources:
            print(f"{source['url']} -> {incoming_relative(source).as_posix()}")
        return 0
    if args.mode == "ingest":
        return ingest_downloads(root, manifest, sources)
    return materialize_direct(root, manifest, sources)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
`;
}

'''
bundle = bundle[:start] + helper + bundle[end:]
old_readme = "      'If any job uses source.mode=remote-url, first materialize its bytes locally with: python3 tools/materialize-sources.py .',\n      'The helper writes sources/materialized/... plus context/materialized-sources.json; this index is evidence only and never replaces manifest.json or changes requestId.',"
new_readme = "      'If any job uses source.mode=remote-url, preferred path: python3 tools/materialize-sources.py . --mode fetch',\n      'If Python/local code has no outbound network, use: python3 tools/materialize-sources.py . --mode plan; then use the host/platform download tool to save every URL to its downloadPath from context/materialization-plan.json; finally run: python3 tools/materialize-sources.py . --mode ingest',\n      'A platform downloader must save the response bytes to the declared local path. A browser screenshot, rendered preview or visual lookup is not equivalent.',\n      'The helper writes sources/materialized/... plus context/materialized-sources.json; the plan/index are evidence only and never replace manifest.json or change requestId.',"
if bundle.count(old_readme) != 1:
    raise SystemExit('README helper block target mismatch')
bundle = bundle.replace(old_readme, new_readme, 1)
bundle_path.write_text(bundle, encoding='utf-8')

fixture_path = Path('scripts/variation-bundle-request-fixture.mjs')
fixture = fixture_path.read_text(encoding='utf-8')
fixture = fixture.replace("import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';", "import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';", 1)
old_check = "if (!helperSource.includes('catalogotop.materialized-sources') || !helperSource.includes('non-public-address-blocked') || !helperSource.includes('source-fingerprint-mismatch')) fail('helper de materialização não preserva índice/guards esperados');\nconst helperTemp = await mkdtemp(join(tmpdir(), 'catalogotop-materializer-'));\ntry {\n  const helperPath = join(helperTemp, 'materialize-sources.py');\n  await writeFile(helperPath, helperSource, 'utf8');\n  const probe = spawnSync('python3', ['--version'], { encoding: 'utf8' });\n  if (probe.status === 0) {\n    const compiled = spawnSync('python3', ['-m', 'py_compile', helperPath], { encoding: 'utf8' });\n    if (compiled.status !== 0) fail(`helper Python inválido: ${compiled.stderr || compiled.stdout}`);\n  }\n} finally {\n  await rm(helperTemp, { recursive: true, force: true });\n}"
new_check = "if (!helperSource.includes('catalogotop.materialized-sources') || !helperSource.includes('catalogotop.source-materialization-plan') || !helperSource.includes('non-public-address-blocked') || !helperSource.includes('source-fingerprint-mismatch') || !helperSource.includes('--mode')) fail('helper de materialização não preserva índice/plano/guards esperados');\nconst helperTemp = await mkdtemp(join(tmpdir(), 'catalogotop-materializer-'));\ntry {\n  const helperPath = join(helperTemp, 'materialize-sources.py');\n  await writeFile(helperPath, helperSource, 'utf8');\n  const probe = spawnSync('python3', ['--version'], { encoding: 'utf8' });\n  if (probe.status === 0) {\n    const compiled = spawnSync('python3', ['-m', 'py_compile', helperPath], { encoding: 'utf8' });\n    if (compiled.status !== 0) fail(`helper Python inválido: ${compiled.stderr || compiled.stdout}`);\n    const testUrl = 'https://cdn.example.com/catalog/product.png';\n    const fingerprintBytes = await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(`remote-url:${testUrl}`));\n    const fingerprint = Array.from(new Uint8Array(fingerprintBytes), byte => byte.toString(16).padStart(2, '0')).join('');\n    await writeFile(join(helperTemp, 'manifest.json'), `${JSON.stringify({ kind: 'catalogotop.image-variation-request', version: 2, requestId: 'a'.repeat(64), jobs: [{ jobId: 'job-materializer-test', source: { mode: 'remote-url', url: testUrl, fingerprint } }] }, null, 2)}\\n`, 'utf8');\n    const planned = spawnSync('python3', [helperPath, helperTemp, '--mode', 'plan'], { encoding: 'utf8' });\n    if (planned.status !== 0) fail(`helper --mode plan falhou sem precisar de rede: ${planned.stderr || planned.stdout}`);\n    const plan = JSON.parse(await readFile(join(helperTemp, 'context', 'materialization-plan.json'), 'utf8'));\n    const expectedIncoming = `sources/incoming/${fingerprint}.bin`;\n    if (plan.kind !== 'catalogotop.source-materialization-plan' || plan.downloads?.[0]?.url !== testUrl || plan.downloads?.[0]?.downloadPath !== expectedIncoming) fail(`plano de materialização inválido: ${JSON.stringify(plan)}`);\n    await mkdir(join(helperTemp, 'sources', 'incoming'), { recursive: true });\n    await writeFile(join(helperTemp, expectedIncoming), Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlKZcQAAAAASUVORK5CYII=', 'base64'));\n    const ingested = spawnSync('python3', [helperPath, helperTemp, '--mode', 'ingest'], { encoding: 'utf8' });\n    if (ingested.status !== 0) fail(`helper --mode ingest falhou com pixels locais válidos: ${ingested.stderr || ingested.stdout}`);\n    const index = JSON.parse(await readFile(join(helperTemp, 'context', 'materialized-sources.json'), 'utf8'));\n    if (index.kind !== 'catalogotop.materialized-sources' || index.failures?.length || index.sources?.[0]?.transport !== 'platform-download' || !index.sources?.[0]?.path?.endsWith('.png')) fail(`índice materializado inválido: ${JSON.stringify(index)}`);\n  }\n} finally {\n  await rm(helperTemp, { recursive: true, force: true });\n}"
if fixture.count(old_check) != 1:
    raise SystemExit('request fixture helper block target mismatch')
fixture = fixture.replace(old_check, new_check, 1)
fixture_path.write_text(fixture, encoding='utf-8')

static_path = Path('scripts/variation-bundle-static-fixture.mjs')
static = static_path.read_text(encoding='utf-8')
old_static = "  ['remote-url inclui paved path local e proíbe aproximação a partir de preview', bundle.includes('tools/materialize-sources.py') && bundle.includes('python3 tools/materialize-sources.py .') && bundle.includes('A browser/web preview is not a source asset') && bundle.includes('catalogotop.materialized-sources')],"
new_static = "  ['remote-url inclui paved path local/sandbox e proíbe aproximação a partir de preview', bundle.includes('tools/materialize-sources.py') && bundle.includes('--mode fetch') && bundle.includes('--mode plan') && bundle.includes('--mode ingest') && bundle.includes('materialization-plan.json') && bundle.includes('A browser/web preview is not a source asset') && bundle.includes('catalogotop.materialized-sources')],"
if static.count(old_static) != 1:
    raise SystemExit('static fixture target mismatch')
static_path.write_text(static.replace(old_static, new_static, 1), encoding='utf-8')

doc_path = Path('docs/v0.11.4.2-source-materializer.md')
doc = doc_path.read_text(encoding='utf-8')
old_paved = "Após extrair o Request Bundle:\n\n```bash\npython3 tools/materialize-sources.py .\n```\n\nPara `embedded`, o arquivo em `source.path` já é a fonte. Para `remote-url`, o consumidor usa o caminho correspondente no índice materializado. Uma imagem vista em browser/web search não deve ser usada como justificativa para recriação aproximada."
new_paved = "Após extrair o Request Bundle, o caminho preferencial é:\n\n```bash\npython3 tools/materialize-sources.py . --mode fetch\n```\n\nSe o runtime local/Python não tiver acesso de rede, mas o ambiente do agente oferecer uma ferramenta própria capaz de baixar uma URL para arquivo local, usar o caminho sandbox-aware:\n\n```bash\npython3 tools/materialize-sources.py . --mode plan\n# usar a ferramenta de download da plataforma para cada URL -> downloadPath\n# declarado em context/materialization-plan.json\npython3 tools/materialize-sources.py . --mode ingest\n```\n\nO modo `plan` não faz acesso de rede. O modo `ingest` valida os bytes já salvos, reconhece o formato, calcula SHA-256 e produz o mesmo índice `context/materialized-sources.json`. Isso separa a capacidade de rede da plataforma da capacidade file-native do agente sem transformar preview ou screenshot em fonte.\n\nPara `embedded`, o arquivo em `source.path` já é a fonte. Para `remote-url`, o consumidor usa o caminho correspondente no índice materializado. Uma imagem vista em browser/web search não deve ser usada como justificativa para recriação aproximada."
if doc.count(old_paved) != 1:
    raise SystemExit('v0.11.4.2 doc paved path target mismatch')
doc = doc.replace(old_paved, new_paved, 1)
doc = doc.replace("- retorna código não-zero se alguma fonte falhar.\n", "- oferece `fetch`, `plan` e `ingest`, separando rede direta de download provido pela plataforma;\n- retorna código não-zero se alguma fonte falhar.\n", 1)
doc = doc.replace("O fixture do Request Bundle extrai o helper gerado e exige que ele compile com `python3 -m py_compile` quando Python 3 está disponível no runner.", "O fixture do Request Bundle extrai o helper gerado, exige que ele compile com `python3 -m py_compile` e executa um round-trip sem rede `--mode plan` → arquivo local → `--mode ingest` quando Python 3 está disponível no runner.", 1)
doc_path.write_text(doc, encoding='utf-8')

variants_doc = Path('docs/image-variants-v0.11.4.md')
text = variants_doc.read_text(encoding='utf-8')
old = "Quando CORS impede embedding, `source.mode=remote-url` continua apontando para a fonte canônica. O consumidor deve materializar esses bytes antes de editar; uma visualização obtida pela web não é substituto para o pixel source. O helper gera `context/materialized-sources.json` como índice não autoritativo, preservando `manifest.json`, `requestId`, `jobId` e `usageSignature`."
new = "Quando CORS impede embedding, `source.mode=remote-url` continua apontando para a fonte canônica. O consumidor deve materializar esses bytes antes de editar; uma visualização obtida pela web não é substituto para o pixel source. O helper suporta download HTTP direto e também `plan` → downloader da plataforma → `ingest` para sandboxes cujo runtime local não possui rede. Ele gera índices auxiliares não autoritativos e preserva `manifest.json`, `requestId`, `jobId` e `usageSignature`."
if text.count(old) != 1:
    raise SystemExit('image variants doc remote paragraph target mismatch')
variants_doc.write_text(text.replace(old, new, 1), encoding='utf-8')

agents = Path('AGENTS.md')
text = agents.read_text(encoding='utf-8')
old = "- `source.mode=remote-url` é apenas um locator canônico quando CORS impede embedding. O Request Bundle deve carregar um paved path de materialização local dos bytes; preview/web lookup não substitui pixel source, e consumidor sem capacidade de ingerir pixels reais deve falhar explicitamente em vez de aproximar a identidade do produto."
new = "- `source.mode=remote-url` é apenas um locator canônico quando CORS impede embedding. O Request Bundle deve carregar um paved path de materialização local dos bytes, incluindo fallback `plan` → downloader da plataforma → `ingest` para runtimes sem rede; preview/web lookup não substitui pixel source, e consumidor sem capacidade de ingerir pixels reais deve falhar explicitamente em vez de aproximar a identidade do produto."
if text.count(old) != 1:
    raise SystemExit('AGENTS remote-url guardrail target mismatch')
agents.write_text(text.replace(old, new, 1), encoding='utf-8')
