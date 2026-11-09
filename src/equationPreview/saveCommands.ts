import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { lookupEquationArtifacts } from './artifactRegistry';
import { ensureSaveArtifact } from './pipeline';
import { readEquationPreviewSettings } from './settings';

type SaveFormat = 'pdf' | 'svg' | 'png';

const FILTERS: Record<SaveFormat, { [name: string]: string[] }> = {
  pdf: { PDF: ['pdf'] },
  svg: { SVG: ['svg'] },
  png: { PNG: ['png'] },
};

async function saveEquationArtifact(cacheKey: string, format: SaveFormat): Promise<void> {
  if (typeof cacheKey !== 'string' || !cacheKey) {
    void vscode.window.showErrorMessage('Equation preview: missing cache key.');
    return;
  }
  const artifacts = lookupEquationArtifacts(cacheKey);
  if (!artifacts) {
    void vscode.window.showErrorMessage(
      'Equation preview cache expired. Hover the formula again, then save.',
    );
    return;
  }
  const settings = readEquationPreviewSettings();
  const ensured = await ensureSaveArtifact({ artifacts, format, settings });
  if ('message' in ensured) {
    void vscode.window.showErrorMessage(ensured.message);
    return;
  }

  const defaultName = `equation.${format}`;
  const uri = await vscode.window.showSaveDialog({
    filters: FILTERS[format],
    saveLabel: `Save ${format.toUpperCase()}`,
    defaultUri: vscode.Uri.file(path.join(path.dirname(artifacts.pdfPath), defaultName)),
  });
  if (!uri) {
    return;
  }
  await fsp.mkdir(path.dirname(uri.fsPath), { recursive: true });
  await fsp.copyFile(ensured.path, uri.fsPath);
  if (!fs.existsSync(uri.fsPath)) {
    void vscode.window.showErrorMessage(`Failed to write ${uri.fsPath}`);
  }
}

export function registerEquationPreviewSaveCommands(
  subscriptions: vscode.Disposable[],
): void {
  subscriptions.push(
    vscode.commands.registerCommand('context.equationPreview.savePdf', (cacheKey: string) => {
      void saveEquationArtifact(cacheKey, 'pdf');
    }),
    vscode.commands.registerCommand('context.equationPreview.saveSvg', (cacheKey: string) => {
      void saveEquationArtifact(cacheKey, 'svg');
    }),
    vscode.commands.registerCommand('context.equationPreview.savePng', (cacheKey: string) => {
      void saveEquationArtifact(cacheKey, 'png');
    }),
  );
}
