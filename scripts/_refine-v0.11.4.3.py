from pathlib import Path

path = Path('netlify/lib/remote-product-source.mts')
text = path.read_text(encoding='utf-8')
old = r'''    let response;
    try {
      response = await fetchFn(validated.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'CatalogoTop-Producer-Materializer/1.0',
          accept: 'image/png,image/jpeg,image/webp,image/gif;q=0.9,*/*;q=0.1'
        }
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw new Error('remote-source-timeout');
      throw new Error(`remote-source-fetch-failed:${error?.message || error}`);
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('remote-source-redirect-without-location');
      if (redirectCount >= REMOTE_SOURCE_MAX_REDIRECTS) throw new Error('remote-source-redirect-limit');
      current = new URL(location, validated).toString();
      continue;
    }
    if (!response.ok) throw new Error(`remote-source-http:${response.status}`);

    const declared = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
    if (declared && declared !== 'application/octet-stream' && !PASSIVE_RASTER_TYPES.has(declared)) {
      throw new Error(`remote-source-content-type-unsupported:${declared}`);
    }
    const bytes = await readLimitedBody(response, maxBytes);
    const detected = sniffPassiveRaster(bytes);
    if (declared && declared !== 'application/octet-stream' && declared !== detected) {
      throw new Error(`remote-source-content-type-mismatch:${declared}:${detected}`);
    }
    return { bytes, contentType: detected, finalUrl: validated.toString() };
'''
new = r'''    let response;
    try {
      try {
        response = await fetchFn(validated.toString(), {
          method: 'GET',
          redirect: 'manual',
          signal: controller.signal,
          headers: {
            'user-agent': 'CatalogoTop-Producer-Materializer/1.0',
            accept: 'image/png,image/jpeg,image/webp,image/gif;q=0.9,*/*;q=0.1'
          }
        });
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') throw new Error('remote-source-timeout');
        throw new Error(`remote-source-fetch-failed:${error?.message || error}`);
      }

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('remote-source-redirect-without-location');
        if (redirectCount >= REMOTE_SOURCE_MAX_REDIRECTS) throw new Error('remote-source-redirect-limit');
        current = new URL(location, validated).toString();
        continue;
      }
      if (!response.ok) throw new Error(`remote-source-http:${response.status}`);

      const declared = String(response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
      if (declared && declared !== 'application/octet-stream' && !PASSIVE_RASTER_TYPES.has(declared)) {
        throw new Error(`remote-source-content-type-unsupported:${declared}`);
      }
      let bytes;
      try {
        bytes = await readLimitedBody(response, maxBytes);
      } catch (error) {
        if (controller.signal.aborted || error?.name === 'AbortError') throw new Error('remote-source-timeout');
        throw error;
      }
      const detected = sniffPassiveRaster(bytes);
      if (declared && declared !== 'application/octet-stream' && declared !== detected) {
        throw new Error(`remote-source-content-type-mismatch:${declared}:${detected}`);
      }
      return { bytes, contentType: detected, finalUrl: validated.toString() };
    } finally {
      clearTimeout(timer);
    }
'''
if text.count(old) != 1:
    raise RuntimeError(f'deadline anchor mismatch: {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('v0.11.4.3 deadline now covers headers + body')
