/**
 * ConTeXt activity-bar Document structure TreeView (sectioning outline).
 * Primary data: extension-owned head scan. DigestiF titles are optional enrichment.
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { logDebug } from '../outputLog';
import { isContextSourcePath } from '../project/documentFilter';
import { buildProjectModel, type ProjectModelResult } from '../project/projectModel';
import {
  collectGraphPaths,
  resolveProjectAnchor,
} from '../project/projectAnchor';
import { openTextFromDocuments, readTexSource } from '../project/readSource';
import { applyDigestifTitles, indexEnrichTitles, type EnrichSymbol } from './digestifEnrich';
import type { OutlineNode } from './headScan';
import { buildOutlineAggregate, type OutlineAggregateResult } from './outlineAggregate';

export const DOCUMENT_OUTLINE_VIEW_ID = 'context.documentOutline';

export interface OutlineTreeProviderDeps {
  workspaceFolderPaths: () => string[];
  activeTexPath: () => string | undefined;
  getRootFileSetting: () => string;
  /** Soft DigestiF readiness; never awaited for the scan path. */
  isDigestifRunning: () => boolean;
}

class OutlineTreeItem extends vscode.TreeItem {
  constructor(
    public readonly node: OutlineNode | undefined,
    label: string,
    collapsible: vscode.TreeItemCollapsibleState,
    opts?: {
      description?: string;
      tooltip?: string;
      message?: boolean;
    },
  ) {
    super(label, collapsible);
    this.description = opts?.description;
    this.tooltip = opts?.tooltip ?? label;
    if (opts?.message) {
      this.contextValue = 'context.outlineNode.message';
      this.iconPath = new vscode.ThemeIcon('info');
      return;
    }
    if (node) {
      this.contextValue = `context.outlineNode.${node.kind}`;
      this.iconPath = iconForKind(node.kind);
      this.resourceUri = vscode.Uri.file(node.fsPath);
      this.command = {
        command: 'context.documentOutline.openNode',
        title: 'Open',
        arguments: [node],
      };
      this.description = `${path.basename(node.fsPath)}:${node.line + 1}`;
      this.tooltip = `${node.title}\n${node.fsPath}:${node.line + 1}\n${node.kind}`;
    }
  }
}

function iconForKind(kind: string): vscode.ThemeIcon {
  switch (kind) {
    case 'part':
      return new vscode.ThemeIcon('symbol-namespace');
    case 'chapter':
      return new vscode.ThemeIcon('book');
    case 'section':
      return new vscode.ThemeIcon('symbol-class');
    default:
      return new vscode.ThemeIcon('symbol-method');
  }
}

function messageItem(label: string, detail?: string): OutlineTreeItem {
  return new OutlineTreeItem(undefined, label, vscode.TreeItemCollapsibleState.None, {
    message: true,
    tooltip: detail ?? label,
    description: detail,
  });
}

function collapsible(node: OutlineNode): vscode.TreeItemCollapsibleState {
  if (!node.children.length) {
    return vscode.TreeItemCollapsibleState.None;
  }
  // Expand top levels so a book outline is readable on first open.
  return node.level <= 2
    ? vscode.TreeItemCollapsibleState.Expanded
    : vscode.TreeItemCollapsibleState.Collapsed;
}

export class OutlineTreeProvider implements vscode.TreeDataProvider<OutlineTreeItem> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<
    OutlineTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private aggregate: OutlineAggregateResult | undefined;
  private lastProject: ProjectModelResult | undefined;
  private anchoredEntry: string | undefined;
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;
  private enrichGeneration = 0;

  constructor(private readonly deps: OutlineTreeProviderDeps) {}

  refresh(): void {
    this.aggregate = undefined;
    this._onDidChangeTreeData.fire();
  }

  scheduleRefresh(): void {
    const cfg = vscode.workspace.getConfiguration('context');
    const ms = cfg.get<number>('documentOutline.refreshDebounceMs', 300);
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      this.refresh();
    }, Math.max(0, ms));
  }

  getTreeItem(element: OutlineTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: OutlineTreeItem): OutlineTreeItem[] {
    if (!this.isEnabled()) {
      return [messageItem('Document structure disabled (context.documentOutline.enabled)')];
    }

    if (!element) {
      const model = this.ensureAggregate();
      if (model.emptyMessage && model.roots.length === 0) {
        return [messageItem(model.emptyMessage)];
      }
      const items = model.roots.map(
        (n) => new OutlineTreeItem(n, n.title, collapsible(n)),
      );
      if (model.truncated && model.emptyMessage) {
        items.push(messageItem(model.emptyMessage));
      }
      return items.length
        ? items
        : [messageItem('No sectioning heads found')];
    }

    if (!element.node) {
      return [];
    }
    return element.node.children.map(
      (n) => new OutlineTreeItem(n, n.title, collapsible(n)),
    );
  }

  private isEnabled(): boolean {
    return (
      vscode.workspace.getConfiguration('context').get<boolean>('documentOutline.enabled', true) ??
      true
    );
  }

  private ensureAggregate(): OutlineAggregateResult {
    if (this.aggregate) {
      return this.aggregate;
    }

    const folders = this.deps.workspaceFolderPaths();
    const active = this.deps.activeTexPath();
    const graph = this.lastProject ? collectGraphPaths(this.lastProject.roots) : undefined;
    const activeText =
      active != null
        ? readTexSource(active, {
            getOpenText: openTextFromDocuments(vscode.workspace.textDocuments),
          })
        : '';

    const anchor = resolveProjectAnchor({
      activeFile: active,
      activeText,
      rootFileSetting: this.deps.getRootFileSetting(),
      workspaceFolders: folders,
      lastEntryFile: this.anchoredEntry ?? this.lastProject?.entryFile,
      lastGraphPaths: graph,
    });

    if (!anchor) {
      this.aggregate = {
        roots: [],
        contentFiles: [],
        truncated: false,
        emptyMessage:
          'No workspace root or ConTeXt file. Open a source file or set the main file in the Project view.',
      };
      return this.aggregate;
    }

    this.anchoredEntry = anchor.entryFile;
    const cfg = vscode.workspace.getConfiguration('context');
    const maxFiles = cfg.get<number>('projectView.maxFiles', 500) ?? 500;
    const includeInputs = cfg.get<boolean>('projectView.includeInputs', false) ?? false;

    const getOpenText = openTextFromDocuments(vscode.workspace.textDocuments);
    const project = buildProjectModel({
      entryFile: anchor.entryFile,
      activeFile: active,
      workspaceFolders: folders,
      includeInputs,
      maxFiles,
    });
    this.lastProject = project;

    const result = buildOutlineAggregate({
      projectRoots: project.roots,
      maxFiles,
      readFile: (p) => readTexSource(p, { getOpenText }),
    });

    this.aggregate = result;
    logDebug(
      `[documentOutline] entry=${anchor.entryFile} files=${result.contentFiles.length} ` +
        `heads=${countNodes(result.roots)} truncated=${result.truncated}`,
    );

    // Soft DigestiF enrichment — never blocks the scan tree.
    if (
      result.roots.length > 0 &&
      (cfg.get<boolean>('documentOutline.digestifEnrichment', true) ?? true) &&
      this.deps.isDigestifRunning()
    ) {
      void this.enrichFromDigestif(result);
    }

    return result;
  }

  private async enrichFromDigestif(result: OutlineAggregateResult): Promise<void> {
    const gen = ++this.enrichGeneration;
    const titles = new Map<string, string>();
    try {
      for (const fsPath of result.contentFiles) {
        if (gen !== this.enrichGeneration) {
          return;
        }
        const uri = vscode.Uri.file(fsPath);
        const symbols = (await vscode.commands.executeCommand(
          'vscode.executeDocumentSymbolProvider',
          uri,
        )) as vscode.DocumentSymbol[] | undefined;
        if (!symbols?.length) {
          continue;
        }
        indexEnrichTitles(fsPath, documentSymbolsToEnrich(symbols), titles);
      }
      if (gen !== this.enrichGeneration || titles.size === 0) {
        return;
      }
      // Only apply when this aggregate is still current.
      if (this.aggregate !== result) {
        return;
      }
      applyDigestifTitles(result.roots, titles);
      this._onDidChangeTreeData.fire();
    } catch (err) {
      logDebug(
        `[documentOutline] DigestiF enrichment skipped: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

function documentSymbolsToEnrich(symbols: vscode.DocumentSymbol[]): EnrichSymbol[] {
  return symbols.map((s) => ({
    name: s.name,
    line: s.selectionRange.start.line,
    children: s.children?.length ? documentSymbolsToEnrich(s.children) : undefined,
  }));
}

function countNodes(nodes: OutlineNode[]): number {
  let n = 0;
  const walk = (list: OutlineNode[]): void => {
    for (const node of list) {
      n += 1;
      walk(node.children);
    }
  };
  walk(nodes);
  return n;
}

export async function openOutlineNode(node: OutlineNode): Promise<void> {
  const uri = vscode.Uri.file(node.fsPath);
  const doc = await vscode.workspace.openTextDocument(uri);
  const editor = await vscode.window.showTextDocument(doc, { preview: true, preserveFocus: false });
  const pos = new vscode.Position(node.line, 0);
  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** Register Document structure view + refresh / open commands. */
export function registerDocumentOutline(
  context: vscode.ExtensionContext,
  deps: OutlineTreeProviderDeps,
): OutlineTreeProvider {
  const provider = new OutlineTreeProvider(deps);
  const view = vscode.window.createTreeView(DOCUMENT_OUTLINE_VIEW_ID, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });

  context.subscriptions.push(
    view,
    vscode.commands.registerCommand('context.documentOutline.refresh', () => {
      provider.refresh();
    }),
    vscode.commands.registerCommand(
      'context.documentOutline.openNode',
      (node?: OutlineNode) => {
        if (node) {
          void openOutlineNode(node);
        }
      },
    ),
    vscode.window.onDidChangeActiveTextEditor(() => {
      provider.scheduleRefresh();
    }),
    vscode.workspace.onDidSaveTextDocument((doc) => {
      if (isContextSourcePath(doc.uri.fsPath)) {
        provider.scheduleRefresh();
      }
    }),
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (isContextSourcePath(e.document.uri.fsPath)) {
        provider.scheduleRefresh();
      }
    }),
    vscode.workspace.onDidCreateFiles(() => provider.scheduleRefresh()),
    vscode.workspace.onDidDeleteFiles(() => provider.scheduleRefresh()),
    vscode.workspace.onDidRenameFiles(() => provider.scheduleRefresh()),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('context.rootFile') ||
        e.affectsConfiguration('context.documentOutline') ||
        e.affectsConfiguration('context.projectView')
      ) {
        provider.refresh();
      }
    }),
  );

  return provider;
}
