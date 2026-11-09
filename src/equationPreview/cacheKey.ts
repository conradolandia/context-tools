import { createHash } from 'node:crypto';

export interface EquationPreviewCacheInput {
  snippet: string;
  environment: string;
  /** Requested hover format setting (png | svg). */
  format: string;
  maxWidth: number;
  maxHeight: number;
  /** Optional DPI / raster scale baked into the key when used. */
  rasterDpi?: number;
}

/**
 * Stable SHA-256 hex key for equation-preview cache entries.
 * Includes snippet, environment preamble, format, and hover clamp dims.
 */
export function equationPreviewCacheKey(input: EquationPreviewCacheInput): string {
  const h = createHash('sha256');
  h.update('equation-preview-v1\n');
  h.update(`format=${input.format}\n`);
  h.update(`maxWidth=${input.maxWidth}\n`);
  h.update(`maxHeight=${input.maxHeight}\n`);
  h.update(`rasterDpi=${input.rasterDpi ?? 150}\n`);
  h.update('---environment---\n');
  h.update(input.environment);
  h.update('\n---snippet---\n');
  h.update(input.snippet);
  return h.digest('hex');
}
