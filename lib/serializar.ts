export function serializar<T>(data: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) {
      out[k] = v;
    } else if (typeof (v as any).toMillis === 'function') {
      out[k] = (v as any).toMillis();
    } else if (typeof (v as any).toDate === 'function') {
      out[k] = (v as any).toDate().toISOString();
    } else if (Array.isArray(v)) {
      out[k] = v.map(item =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? serializar(item as Record<string, unknown>)
          : item
      );
    } else if (typeof v === 'object') {
      out[k] = serializar(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
