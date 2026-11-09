import * as vscode from 'vscode';
import {
  DONT_ASK_SETTING_KEY,
  DONT_ASK_STATE_KEY,
  LEGACY_DONT_ASK_SETTING_KEY,
  LEGACY_DONT_ASK_STATE_KEY,
  findConflictingExtensions,
  formatConflictExtensionLine,
  resolveExtensionConflictDontAsk,
  shouldWarnExtensionConflict,
  type ConflictingExtension,
  type ExtensionInspectInput,
} from './extensionConflictPolicy';

const SHOW_EXTENSIONS_ACTION = 'Show extensions';
const DONT_SHOW_AGAIN_ACTION = "Don't show again";

/** Session gate so we do not re-prompt on every context document open. */
let shownThisSession = false;

export function resetExtensionConflictSessionFlagForTests(): void {
  shownThisSession = false;
}

function readDontAsk(extensionContext: vscode.ExtensionContext): boolean {
  const cfg = vscode.workspace.getConfiguration('context');
  return resolveExtensionConflictDontAsk({
    setting: cfg.get<boolean>(DONT_ASK_SETTING_KEY, false),
    legacySetting: cfg.get<boolean>(LEGACY_DONT_ASK_SETTING_KEY, false),
    globalState: extensionContext.globalState.get<boolean>(DONT_ASK_STATE_KEY),
    workspaceState: extensionContext.workspaceState.get<boolean>(DONT_ASK_STATE_KEY),
    legacyGlobalState: extensionContext.globalState.get<boolean>(LEGACY_DONT_ASK_STATE_KEY),
    legacyWorkspaceState: extensionContext.workspaceState.get<boolean>(
      LEGACY_DONT_ASK_STATE_KEY,
    ),
  });
}

/**
 * If the user previously chose don't-ask under the LW-only keys, copy that
 * into the generalized keys so Settings UI and state stay aligned.
 */
async function migrateLegacyDontAsk(
  extensionContext: vscode.ExtensionContext,
): Promise<void> {
  const cfg = vscode.workspace.getConfiguration('context');
  const legacy =
    cfg.get<boolean>(LEGACY_DONT_ASK_SETTING_KEY, false) === true ||
    extensionContext.globalState.get<boolean>(LEGACY_DONT_ASK_STATE_KEY) === true ||
    extensionContext.workspaceState.get<boolean>(LEGACY_DONT_ASK_STATE_KEY) === true;
  if (!legacy) {
    return;
  }

  const already =
    cfg.get<boolean>(DONT_ASK_SETTING_KEY, false) === true ||
    extensionContext.globalState.get<boolean>(DONT_ASK_STATE_KEY) === true;
  if (already) {
    return;
  }

  await extensionContext.globalState.update(DONT_ASK_STATE_KEY, true);
  try {
    await cfg.update(DONT_ASK_SETTING_KEY, true, vscode.ConfigurationTarget.Global);
  } catch {
    // Settings write can fail in restricted hosts; globalState is enough.
  }
}

function inspectInstalledExtensions(
  ourExtensionId: string,
): ConflictingExtension[] {
  const inputs: ExtensionInspectInput[] = vscode.extensions.all.map((ext) => ({
    id: ext.id,
    displayName: ext.packageJSON?.displayName as string | undefined,
    packageJSON: ext.packageJSON,
  }));
  return findConflictingExtensions(inputs, ourExtensionId);
}

async function openExtensionsSearch(extensionIds: string[]): Promise<void> {
  const query =
    extensionIds.length === 1
      ? `@id:${extensionIds[0]}`
      : extensionIds.map((id) => `@id:${id}`).join(' ');
  try {
    await vscode.commands.executeCommand('workbench.extensions.search', query);
  } catch {
    try {
      if (extensionIds[0]) {
        await vscode.commands.executeCommand('extension.open', extensionIds[0]);
      }
    } catch {
      // last resort: message only
    }
  }
}

function buildWarningMessage(conflicts: ConflictingExtension[]): string {
  const lines = conflicts.map(formatConflictExtensionLine);
  const listed = lines.map((line) => `• ${line}`).join('\n');
  return (
    'Other installed extension(s) contribute language id "context" and/or the same ' +
    'ConTeXt file extensions (.mkiv, .mkxl, …), so their grammar or editor features ' +
    'can override ConTeXt Tools.\n\n' +
    `${listed}\n\n` +
    'Disable those extensions manually in the Extensions view for this workspace ' +
    '(or globally) when editing ConTeXt. ConTeXt Tools never disables other extensions.'
  );
}

/**
 * Detect other installed extensions that overlap ConTeXt Tools' language /
 * file-extension contributions and warn once (session + don't-show-again).
 * Never attempts to disable other extensions.
 */
export async function maybeWarnExtensionConflict(
  extensionContext: vscode.ExtensionContext,
  log?: (line: string) => void,
): Promise<void> {
  await migrateLegacyDontAsk(extensionContext);

  const ourId = extensionContext.extension.id;
  const conflicts = inspectInstalledExtensions(ourId);
  const dontAsk = readDontAsk(extensionContext);
  const development =
    extensionContext.extensionMode === vscode.ExtensionMode.Development;

  if (
    !shouldWarnExtensionConflict({
      dontAsk,
      alreadyShownThisSession: shownThisSession,
      conflictingExtensions: conflicts,
      extensionModeDevelopment: development,
    })
  ) {
    if (development && conflicts.length > 0) {
      const summary = conflicts.map((c) => c.id).join(', ');
      log?.(
        `[compat] overlapping extension(s) (${summary}); ` +
          'skipped warning in Extension Development Host (F5 grammar registers last and wins)',
      );
    }
    return;
  }

  shownThisSession = true;
  log?.(
    `[compat] extension conflict(s): ${conflicts.map(formatConflictExtensionLine).join('; ')}`,
  );

  const choice = await vscode.window.showWarningMessage(
    buildWarningMessage(conflicts),
    { modal: false },
    SHOW_EXTENSIONS_ACTION,
    DONT_SHOW_AGAIN_ACTION,
  );

  if (choice === SHOW_EXTENSIONS_ACTION) {
    await openExtensionsSearch(conflicts.map((c) => c.id));
    void vscode.window.showInformationMessage(
      'In the Extensions view, open each listed extension and choose Disable (Workspace) or Disable.',
    );
  } else if (choice === DONT_SHOW_AGAIN_ACTION) {
    await extensionContext.globalState.update(DONT_ASK_STATE_KEY, true);
    try {
      await vscode.workspace
        .getConfiguration('context')
        .update(DONT_ASK_SETTING_KEY, true, vscode.ConfigurationTarget.Global);
    } catch {
      // globalState alone still suppresses future prompts
    }
    log?.('[compat] will not warn again about overlapping extension contributions');
  }
}
