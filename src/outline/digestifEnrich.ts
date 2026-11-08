/**
 * Soft DigestiF title enrichment for the scan-backed outline tree.
 * Never required; failures leave the scan tree unchanged.
 */

import { normalizeOutlineTitle } from '../lsp/normalizeOutlineTitle';
import type { OutlineNode } from './headScan';

/** Minimal symbol shape from DigestiF / DocumentSymbol. */
export interface EnrichSymbol {
  name: string;
  /** 0-based start line of the symbol selection / range. */
  line: number;
  children?: EnrichSymbol[];
}

/**
 * Flatten DigestiF symbols to path+line → normalized title.
 */
export function indexEnrichTitles(
  fsPath: string,
  symbols: EnrichSymbol[],
  into: Map<string, string> = new Map(),
): Map<string, string> {
  const walk = (syms: EnrichSymbol[]): void => {
    for (const s of syms) {
      const title = normalizeOutlineTitle(s.name ?? '');
      if (title) {
        into.set(enrichKey(fsPath, s.line), title);
      }
      if (s.children?.length) {
        walk(s.children);
      }
    }
  };
  walk(symbols);
  return into;
}

export function enrichKey(fsPath: string, line: number): string {
  return `${fsPath}::${line}`;
}

/**
 * Prefer DigestiF titles when present and non-empty after normalize.
 * Mutates nodes in place; structural backbone (levels / ranges) stays scan-derived.
 */
export function applyDigestifTitles(roots: OutlineNode[], titles: Map<string, string>): void {
  const walk = (nodes: OutlineNode[]): void => {
    for (const n of nodes) {
      const t = titles.get(enrichKey(n.fsPath, n.line));
      if (t) {
        n.title = t;
      }
      if (n.children.length) {
        walk(n.children);
      }
    }
  };
  walk(roots);
}
