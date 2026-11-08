/**
 * DocumentSymbolProvider from the extension-owned head scan.
 * Used for Explorer Outline when DigestiF is not running.
 * When DigestiF is up, returns [] so DigestiF (plus middleware normalize) owns Outline.
 */

import * as vscode from 'vscode';
import { contextDocumentSelector } from '../project/documentFilter';
import { nestHeads, scanHeads, type OutlineNode } from './headScan';

export interface OutlineSymbolsDeps {
  /** True when DigestiF LanguageClient is running. */
  isDigestifRunning: () => boolean;
}

const KIND_TO_SYMBOL: Record<string, vscode.SymbolKind> = {
  part: vscode.SymbolKind.Namespace,
  chapter: vscode.SymbolKind.Class,
  section: vscode.SymbolKind.Method,
  subsection: vscode.SymbolKind.Method,
  subsubsection: vscode.SymbolKind.Method,
  subsubsubsection: vscode.SymbolKind.Method,
};

function offsetToPosition(text: string, offset: number): vscode.Position {
  let line = 0;
  let lastNl = -1;
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text[i] === '\n') {
      line += 1;
      lastNl = i;
    }
  }
  const character = offset - (lastNl + 1);
  return new vscode.Position(line, Math.max(0, character));
}

function nodeToSymbol(
  node: OutlineNode,
  text: string,
  endOffset: number,
): vscode.DocumentSymbol {
  const start = offsetToPosition(text, node.commandStart);
  let selEnd = offsetToPosition(text, node.commandEnd);
  if (!selEnd.isAfter(start)) {
    selEnd = start.translate(0, Math.max(1, node.kind.length));
  }
  const rangeEnd = offsetToPosition(text, Math.max(endOffset, node.commandEnd));
  const range = new vscode.Range(start, rangeEnd.isAfter(start) ? rangeEnd : selEnd);
  const selectionRange = new vscode.Range(start, selEnd);
  const sym = new vscode.DocumentSymbol(
    node.title,
    node.kind,
    KIND_TO_SYMBOL[node.kind] ?? vscode.SymbolKind.String,
    range,
    selectionRange,
  );
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i]!;
    const childEnd =
      i + 1 < node.children.length ? node.children[i + 1]!.commandStart : endOffset;
    sym.children.push(nodeToSymbol(child, text, childEnd));
  }
  return sym;
}

export function outlineNodesToDocumentSymbols(
  roots: OutlineNode[],
  text: string,
): vscode.DocumentSymbol[] {
  const fileEnd = text.length;
  const out: vscode.DocumentSymbol[] = [];
  for (let i = 0; i < roots.length; i++) {
    const node = roots[i]!;
    const end = i + 1 < roots.length ? roots[i + 1]!.commandStart : fileEnd;
    out.push(nodeToSymbol(node, text, end));
  }
  return out;
}

export class ContextOutlineSymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private readonly deps: OutlineSymbolsDeps) {}

  provideDocumentSymbols(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.DocumentSymbol[]> {
    if (this.deps.isDigestifRunning()) {
      // DigestiF owns Explorer Outline; middleware still normalizes titles.
      return [];
    }
    const text = document.getText();
    const heads = scanHeads(text).map((h) => ({ ...h, fsPath: document.uri.fsPath }));
    const roots = nestHeads(heads);
    return outlineNodesToDocumentSymbols(roots, text);
  }
}

export function registerOutlineSymbols(
  context: vscode.ExtensionContext,
  deps: OutlineSymbolsDeps,
): void {
  context.subscriptions.push(
    vscode.languages.registerDocumentSymbolProvider(
      contextDocumentSelector,
      new ContextOutlineSymbolProvider(deps),
    ),
  );
}
