/**
 * Aggregate stock-head scans over the active compile unit (product / document).
 * File set comes from ProjectModel; environments are skipped by default.
 */

import * as path from 'node:path';
import type { ProjectNode } from '../project/projectModel';
import { nestHeads, scanHeads, type OutlineNode } from './headScan';

const CONTENT_KINDS = new Set(['product', 'component', 'document']);

export interface OutlineAggregateOptions {
  /** ProjectModel roots for the active compile unit. */
  projectRoots: ProjectNode[];
  /** Read source text for an absolute path (open buffer or disk). */
  readFile: (absolutePath: string) => string | undefined;
  /** Cap on content files scanned (mirrors projectView.maxFiles spirit). */
  maxFiles?: number;
}

export interface OutlineAggregateResult {
  roots: OutlineNode[];
  /** Absolute paths scanned in document order. */
  contentFiles: string[];
  truncated: boolean;
  emptyMessage?: string;
}

/**
 * Prefer the expanded / preferred product under a project root; otherwise the
 * first content root (product, document, or lone component).
 */
export function selectOutlineRoot(projectRoots: ProjectNode[]): ProjectNode | undefined {
  if (projectRoots.length === 0) {
    return undefined;
  }
  const top = projectRoots[0]!;
  if (top.kind === 'project') {
    const preferred =
      top.children.find((c) => c.kind === 'product' && c.preferExpand) ??
      top.children.find((c) => c.kind === 'product');
    return preferred ?? top;
  }
  if (top.kind === 'message') {
    return undefined;
  }
  return top;
}

/**
 * Collect product / component / document paths in include order under `root`.
 * Skips environments, inputs, missing, and message nodes.
 */
export function collectOutlineContentFiles(root: ProjectNode): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const walk = (node: ProjectNode): void => {
    if (CONTENT_KINDS.has(node.kind) && node.fsPath && !node.missing) {
      const abs = path.resolve(node.fsPath);
      if (!seen.has(abs)) {
        seen.add(abs);
        out.push(abs);
      }
    }
    for (const child of node.children) {
      if (child.kind === 'environment' || child.kind === 'input') {
        continue;
      }
      if (child.kind === 'missing' || child.kind === 'message') {
        continue;
      }
      walk(child);
    }
  };

  walk(root);
  return out;
}

/**
 * Scan content files of the active product / document into one nest tree.
 */
export function buildOutlineAggregate(opts: OutlineAggregateOptions): OutlineAggregateResult {
  const maxFiles = opts.maxFiles ?? 500;
  const outlineRoot = selectOutlineRoot(opts.projectRoots);
  if (!outlineRoot) {
    return {
      roots: [],
      contentFiles: [],
      truncated: false,
      emptyMessage:
        'No compile root for Document structure. Set a main file in the Project view or with ConTeXt: Set Main (Root) File.',
    };
  }

  const allContent = collectOutlineContentFiles(outlineRoot);
  if (allContent.length === 0) {
    return {
      roots: [],
      contentFiles: [],
      truncated: false,
      emptyMessage: 'No content files in the active product (empty product or unresolved includes).',
    };
  }

  const truncated = allContent.length > maxFiles;
  const contentFiles = truncated ? allContent.slice(0, maxFiles) : allContent;
  const flat: Array<ReturnType<typeof scanHeads>[number] & { fsPath: string }> = [];

  for (const fsPath of contentFiles) {
    const text = opts.readFile(fsPath);
    if (text == null) {
      continue;
    }
    for (const head of scanHeads(text)) {
      flat.push({ ...head, fsPath });
    }
  }

  const roots = nestHeads(flat);
  if (roots.length === 0) {
    return {
      roots: [],
      contentFiles,
      truncated,
      emptyMessage: truncated
        ? `No sectioning heads found (scanned ${contentFiles.length} files; truncated).`
        : 'No sectioning heads found',
    };
  }

  return {
    roots,
    contentFiles,
    truncated,
    emptyMessage: truncated
      ? `Outline truncated after ${contentFiles.length} content files`
      : undefined,
  };
}
