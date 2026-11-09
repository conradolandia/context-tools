/**
 * Extract a math snippet under a cursor offset (or fall back to selection).
 *
 * v1 priority: \start…formula…\stop… blocks (formula, placeformula, …),
 * then $$…$$ / $…$, then non-empty selection.
 */

export type MathExtractKind = 'formula-env' | 'display-dollar' | 'inline-dollar' | 'selection';

export interface MathExtract {
  kind: MathExtractKind;
  /** Inclusive start offset in the document text. */
  start: number;
  /** Exclusive end offset. */
  end: number;
  /** Text to typeset (includes delimiters for env / dollar forms). */
  text: string;
}

export interface SelectionRange {
  start: number;
  end: number;
}

const START_FORMULA = /\\start([A-Za-z]*formula)\b/gi;
const STOP_PREFIX = '\\stop';

/**
 * Find the innermost \startXformula … \stopXformula (case-sensitive name match)
 * that contains `offset`.
 */
export function findFormulaEnvAt(text: string, offset: number): MathExtract | undefined {
  const matches: { name: string; start: number; openEnd: number }[] = [];
  START_FORMULA.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = START_FORMULA.exec(text)) !== null) {
    const name = m[1]!;
    matches.push({ name, start: m.index, openEnd: m.index + m[0].length });
  }

  let best: MathExtract | undefined;
  for (const open of matches) {
    const stopCmd = `${STOP_PREFIX}${open.name}`;
    const searchFrom = open.openEnd;
    const stopIdx = text.indexOf(stopCmd, searchFrom);
    if (stopIdx < 0) {
      continue;
    }
    // Ensure stop is a real command boundary (not \stopformulaX).
    const after = stopIdx + stopCmd.length;
    if (after < text.length && /[A-Za-z]/.test(text[after]!)) {
      continue;
    }
    const end = after;
    if (offset < open.start || offset > end) {
      continue;
    }
    const candidate: MathExtract = {
      kind: 'formula-env',
      start: open.start,
      end,
      text: text.slice(open.start, end),
    };
    if (!best || candidate.end - candidate.start < best.end - best.start) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Find $$…$$ or $…$ containing offset. Display ($$) preferred when both match.
 * Skips escaped \$ and avoids matching across newlines for single $.
 */
export function findDollarMathAt(text: string, offset: number): MathExtract | undefined {
  const display = findDelimited(text, offset, '$$', '$$', true);
  if (display) {
    return {
      kind: 'display-dollar',
      start: display.start,
      end: display.end,
      text: text.slice(display.start, display.end),
    };
  }
  const inline = findDelimited(text, offset, '$', '$', false);
  if (inline) {
    return {
      kind: 'inline-dollar',
      start: inline.start,
      end: inline.end,
      text: text.slice(inline.start, inline.end),
    };
  }
  return undefined;
}

function findDelimited(
  text: string,
  offset: number,
  open: string,
  close: string,
  allowNewline: boolean,
): { start: number; end: number } | undefined {
  // Scan left for an unescaped opener whose matching closer is after offset.
  let i = 0;
  while (i < text.length) {
    const start = indexOfUnescaped(text, open, i);
    if (start < 0) {
      return undefined;
    }
    const contentStart = start + open.length;
    const endDelim = indexOfUnescaped(text, close, contentStart);
    if (endDelim < 0) {
      return undefined;
    }
    const end = endDelim + close.length;
    const body = text.slice(contentStart, endDelim);
    if (!allowNewline && body.includes('\n')) {
      i = start + open.length;
      continue;
    }
    if (body.length === 0) {
      i = end;
      continue;
    }
    if (offset >= start && offset <= end) {
      return { start, end };
    }
    i = end;
  }
  return undefined;
}

function indexOfUnescaped(text: string, needle: string, from: number): number {
  let i = from;
  while (i < text.length) {
    const idx = text.indexOf(needle, i);
    if (idx < 0) {
      return -1;
    }
    // Count preceding backslashes; odd = escaped.
    let bs = 0;
    for (let j = idx - 1; j >= 0 && text[j] === '\\'; j--) {
      bs += 1;
    }
    if (bs % 2 === 0) {
      return idx;
    }
    i = idx + needle.length;
  }
  return -1;
}

/**
 * Resolve math under cursor: formula env → dollar → selection.
 * When nothing matches and selection is empty, returns undefined.
 */
export function extractMathAt(
  text: string,
  offset: number,
  selection?: SelectionRange,
): MathExtract | undefined {
  const env = findFormulaEnvAt(text, offset);
  if (env) {
    return env;
  }
  const dollar = findDollarMathAt(text, offset);
  if (dollar) {
    return dollar;
  }
  if (selection && selection.end > selection.start) {
    const selText = text.slice(selection.start, selection.end);
    if (selText.trim().length > 0) {
      return {
        kind: 'selection',
        start: selection.start,
        end: selection.end,
        text: selText,
      };
    }
  }
  return undefined;
}
