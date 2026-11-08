/**
 * Extension-owned ConTeXt sectioning-head scanner.
 * Works without DigestiF. Skips verbatim / comment regions like structureScan.
 */

import { normalizeOutlineTitle } from '../lsp/normalizeOutlineTitle';
import { buildLineStarts, lineAtOffset, lineTextAtOffset } from '../project/lineMap';
import { findVerbatimRanges, isCommentLine, offsetInRanges, stripLineComment } from '../project/verbatimRegions';

/** Stock sectioning levels (lower = higher in the hierarchy). */
export const HEAD_LEVELS: Readonly<Record<string, number>> = {
  part: 1,
  chapter: 2,
  section: 3,
  subsection: 4,
  subsubsection: 5,
  subsubsubsection: 6,
};

export type HeadKind = keyof typeof HEAD_LEVELS;

/** Flat head found in a single buffer (before nesting). */
export interface OutlineHead {
  kind: HeadKind;
  level: number;
  /** Display title after normalizeOutlineTitle; never empty. */
  title: string;
  /** Offset of `\\start…` / short-form command. */
  commandStart: number;
  /** Exclusive end of the matched command + optional args. */
  commandEnd: number;
  /** 0-based line of commandStart. */
  line: number;
}

/** Nested outline node (one buffer or product-wide). */
export interface OutlineNode {
  kind: HeadKind;
  level: number;
  title: string;
  fsPath: string;
  commandStart: number;
  commandEnd: number;
  line: number;
  children: OutlineNode[];
}

const HEAD_NAMES = Object.keys(HEAD_LEVELS).join('|');
/**
 * `\\startchapter` / `\\chapter` / `\\startsection` / …
 * Short forms without `start` are included so DigestiF enrichment merges cleanly.
 */
const HEAD_CMD = new RegExp(
  String.raw`\\(?:start)?(${HEAD_NAMES})\b`,
  'g',
);

function isSkipped(
  text: string,
  offset: number,
  verbatim: ReturnType<typeof findVerbatimRanges>,
  lineStarts: number[],
): boolean {
  if (offsetInRanges(offset, verbatim)) {
    return true;
  }
  const line = lineTextAtOffset(text, lineStarts, offset);
  if (isCommentLine(line)) {
    return true;
  }
  const lineStart = lineStarts[lineAtOffset(lineStarts, offset)];
  const prefix = text.slice(lineStart, offset);
  return stripLineComment(prefix).length !== prefix.length;
}

/**
 * Scan from `from` for a `[…]` group, respecting `{…}` nesting inside.
 * Returns the body (without brackets) and exclusive end offset after `]`.
 */
export function extractBracketGroup(
  text: string,
  from: number,
): { body: string; end: number } | undefined {
  let i = from;
  while (i < text.length && /[ \t]/.test(text[i]!)) {
    i += 1;
  }
  if (text[i] !== '[') {
    return undefined;
  }
  i += 1;
  const start = i;
  let depthBrace = 0;
  for (; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '{') {
      depthBrace += 1;
      continue;
    }
    if (ch === '}') {
      if (depthBrace > 0) {
        depthBrace -= 1;
      }
      continue;
    }
    if (ch === ']' && depthBrace === 0) {
      return { body: text.slice(start, i), end: i + 1 };
    }
    // Stop at newline only when we have not opened braces and bracket is unclosed
    // — ConTeXt titles often span lines inside title={…}; keep scanning.
  }
  return undefined;
}

/**
 * Pull `title=…` from a setup body. Supports `title={…}`, `title=plain`, and
 * a bare `{…}` first positional when no title= key is present.
 */
export function extractTitleFromSetup(body: string): string | undefined {
  const titleEq = /\btitle\s*=\s*/i.exec(body);
  if (titleEq && titleEq.index != null) {
    const after = body.slice(titleEq.index + titleEq[0].length);
    if (after.startsWith('{')) {
      const inner = extractBalancedBrace(after, 0);
      if (inner) {
        return inner.body;
      }
    }
    const plain = /^([^,\]]+)/.exec(after);
    if (plain) {
      return plain[1]!.trim();
    }
  }
  const braced = /^\s*\{/.exec(body);
  if (braced) {
    const inner = extractBalancedBrace(body, braced.index + braced[0].length - 1);
    if (inner) {
      return inner.body;
    }
  }
  return undefined;
}

function extractBalancedBrace(
  text: string,
  openIndex: number,
): { body: string; end: number } | undefined {
  if (text[openIndex] !== '{') {
    return undefined;
  }
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return { body: text.slice(openIndex + 1, i), end: i + 1 };
      }
    }
  }
  return undefined;
}

function defaultTitle(kind: HeadKind): string {
  return `(untitled ${kind})`;
}

/**
 * Scan one ConTeXt buffer for stock sectioning heads.
 * Does not require DigestiF.
 */
export function scanHeads(text: string): OutlineHead[] {
  const verbatim = findVerbatimRanges(text);
  const lineStarts = buildLineStarts(text);
  const heads: OutlineHead[] = [];

  HEAD_CMD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEAD_CMD.exec(text)) !== null) {
    if (isSkipped(text, m.index, verbatim, lineStarts)) {
      continue;
    }
    const kind = m[1] as HeadKind;
    const level = HEAD_LEVELS[kind];
    if (level == null) {
      continue;
    }

    let commandEnd = m.index + m[0].length;
    let rawTitle: string | undefined;

    const bracket = extractBracketGroup(text, commandEnd);
    if (bracket) {
      commandEnd = bracket.end;
      rawTitle = extractTitleFromSetup(bracket.body);
    } else {
      // Optional `{title}` immediately after the command
      let i = commandEnd;
      while (i < text.length && /[ \t]/.test(text[i]!)) {
        i += 1;
      }
      if (text[i] === '{') {
        const braced = extractBalancedBrace(text, i);
        if (braced) {
          commandEnd = braced.end;
          rawTitle = braced.body;
        }
      }
    }

    const normalized = normalizeOutlineTitle(rawTitle ?? '');
    heads.push({
      kind,
      level,
      title: normalized || defaultTitle(kind),
      commandStart: m.index,
      commandEnd,
      line: lineAtOffset(lineStarts, m.index),
    });
  }

  return heads;
}

/**
 * Nest flat heads (encounter order) into a tree by level.
 * Invalid nesting is not repaired; a shallower head closes deeper open parents.
 */
export function nestHeads(
  heads: ReadonlyArray<OutlineHead & { fsPath: string }>,
): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const h of heads) {
    const node: OutlineNode = {
      kind: h.kind,
      level: h.level,
      title: h.title,
      fsPath: h.fsPath,
      commandStart: h.commandStart,
      commandEnd: h.commandEnd,
      line: h.line,
      children: [],
    };
    while (stack.length > 0 && stack[stack.length - 1]!.level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1]!.children.push(node);
    }
    stack.push(node);
  }

  return roots;
}
