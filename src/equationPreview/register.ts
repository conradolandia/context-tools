import * as vscode from 'vscode';
import type { Toolchain } from '../toolchain/discover';
import { EquationHoverProvider } from './hoverProvider';
import { registerEquationPreviewSaveCommands } from './saveCommands';

/**
 * Register equation hover preview (HoverProvider + save commands).
 */
export function registerEquationPreview(
  context: vscode.ExtensionContext,
  deps: { resolveToolchain: () => Toolchain },
): void {
  registerEquationPreviewSaveCommands(context.subscriptions);

  const provider = new EquationHoverProvider({
    resolveToolchain: deps.resolveToolchain,
    getStorageRoot: () => context.storageUri?.fsPath ?? context.globalStorageUri?.fsPath,
  });

  context.subscriptions.push(
    vscode.languages.registerHoverProvider({ language: 'context' }, provider),
  );
}
