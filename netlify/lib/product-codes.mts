export function productCodeKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

export function validateUniqueProductCodes(products: unknown[]) {
  const keys = new Set<string>();
  for (const item of products) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const product = item as Record<string, unknown>;
    const key = productCodeKey(product.code);
    if (!key) continue;
    if (keys.has(key)) return `Código de produto duplicado: ${String(product.code || '').trim()}.`;
    keys.add(key);
  }
  return '';
}
