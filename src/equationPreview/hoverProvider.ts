import * as vscode from 'vscode';
import { ToolchainError, type Toolchain } from '../toolchain/discover';
import { rememberEquationArtifacts } from './artifactRegistry';
import { extractMathAt } from './extractMath';
import {
  buildEquationHoverMarkdown,
  buildEquationHoverMessage,
} from './hoverMarkdown';
import {
  equationPreviewStorageRoot,
  getEquationPreview,
} from './pipeline';
import { readEquationPreviewSettings } from './settings';

export interface EquationHoverProviderDeps {
  resolveToolchain: () => Toolchain;
  /** Extension global storage fs path (storageUri). */
  getStorageRoot: () => string | undefined;
}

function delay(ms: number, token: vscode.CancellationToken): Promise<boolean> {
  if (ms <= 0) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    const sub = token.onCancellationRequested(() => {
      clearTimeout(timer);
      sub.dispose();
      resolve(true);
    });
  });
}

/**
 * HoverProvider for language `context`: on-demand TEXpage equation preview.
 * Debounced; uses extension storage cache; never touches the document build queue.
 */
export class EquationHoverProvider implements vscode.HoverProvider {
  constructor(private readonly deps: EquationHoverProviderDeps) {}

  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
  ): Promise<vscode.Hover | undefined> {
    if (document.languageId !== 'context') {
      return undefined;
    }
    const settings = readEquationPreviewSettings();
    if (!settings.enabled) {
      return undefined;
    }

    const text = document.getText();
    const offset = document.offsetAt(position);
    const editor = vscode.window.activeTextEditor;
    let selection: { start: number; end: number } | undefined;
    if (editor && editor.document === document && !editor.selection.isEmpty) {
      const selStart = document.offsetAt(editor.selection.start);
      const selEnd = document.offsetAt(editor.selection.end);
      // Selection fallback only when the cursor lies inside the selection (avoids
      // previewing an unrelated selection on every prose hover).
      if (offset >= selStart && offset <= selEnd) {
        selection = { start: selStart, end: selEnd };
      }
    }

    const extracted = extractMathAt(text, offset, selection);
    if (!extracted) {
      // No delimiter and no usable selection: stay quiet over prose.
      return undefined;
    }

    // Selection fallback with no recognized delimiter: still preview, but after debounce.
    const range = new vscode.Range(
      document.positionAt(extracted.start),
      document.positionAt(extracted.end),
    );

    const cancelled = await delay(settings.debounceMs, token);
    if (cancelled || token.isCancellationRequested) {
      return undefined;
    }

    const storageUriPath = this.deps.getStorageRoot();
    if (!storageUriPath) {
      return new vscode.Hover(
        buildEquationHoverMessage('Equation preview needs extension storage (storageUri).'),
        range,
      );
    }

    let toolchain: Toolchain;
    try {
      toolchain = this.deps.resolveToolchain();
    } catch (err) {
      const msg =
        err instanceof ToolchainError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err);
      return new vscode.Hover(
        buildEquationHoverMessage(`Equation preview: ${msg}`),
        range,
      );
    }

    const outcome = await getEquationPreview({
      snippet: extracted.text,
      settings,
      toolchain,
      storageRoot: equationPreviewStorageRoot(storageUriPath),
    });

    if (token.isCancellationRequested) {
      return undefined;
    }

    if (!outcome.ok) {
      return new vscode.Hover(buildEquationHoverMessage(outcome.message), range);
    }

    rememberEquationArtifacts(outcome.artifacts);
    const status =
      settings.format === 'svg'
        ? '_Hover shows PNG (SVG Markdown hover is unreliable); Save SVG uses the vector export._'
        : undefined;
    const md = buildEquationHoverMarkdown({
      imagePath: outcome.artifacts.hoverImagePath,
      cacheKey: outcome.artifacts.cacheKey,
      maxWidth: settings.maxWidth,
      maxHeight: settings.maxHeight,
      statusLine: status,
    });
    return new vscode.Hover(md, range);
  }
}
