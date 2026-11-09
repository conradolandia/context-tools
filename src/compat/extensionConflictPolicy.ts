/** Language id ConTeXt Tools contributes and DigestiF expects for ConTeXt mode. */
export const CONTEXT_TOOLS_LANGUAGE_ID = 'context';

/**
 * Filename extensions ConTeXt Tools claims via `contributes.languages`.
 * Overlap with another extension's language contribution is a conflict signal.
 */
export const CONTEXT_TOOLS_FILE_EXTENSIONS = [
  '.mkiv',
  '.mkxl',
  '.mkvi',
  '.mklx',
  '.mkii',
] as const;

/** Known Marketplace example that contributes language id `context` (LW 10.x+). */
export const LATEX_WORKSHOP_EXT_ID = 'James-Yu.latex-workshop';

const DONT_ASK_STATE_KEY = 'context.extensionConflict.dontAsk';
const DONT_ASK_SETTING_KEY = 'extensionConflict.dontAsk';

/** Legacy keys from the LW-only warning; still honored so users are not re-prompted. */
const LEGACY_DONT_ASK_STATE_KEY = 'context.latexWorkshopConflict.dontAsk';
const LEGACY_DONT_ASK_SETTING_KEY = 'latexWorkshopConflict.dontAsk';

export {
  DONT_ASK_STATE_KEY,
  DONT_ASK_SETTING_KEY,
  LEGACY_DONT_ASK_STATE_KEY,
  LEGACY_DONT_ASK_SETTING_KEY,
};

export type ExtensionInspectInput = {
  id: string;
  displayName?: string;
  packageJSON: unknown;
};

export type ConflictReasonKind = 'languageId' | 'fileExtension' | 'grammarLanguage';

export type ConflictReason = {
  kind: ConflictReasonKind;
  detail: string;
};

export type ConflictingExtension = {
  id: string;
  displayName: string;
  reasons: ConflictReason[];
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

/** Normalize to lowercase with a leading dot (`.mkiv`). */
export function normalizeFileExtension(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
}

function languageEntries(packageJSON: unknown): Array<Record<string, unknown>> {
  const contributes = asRecord(asRecord(packageJSON)?.contributes);
  const languages = contributes?.languages;
  if (!Array.isArray(languages)) {
    return [];
  }
  return languages
    .map((lang) => asRecord(lang))
    .filter((lang): lang is Record<string, unknown> => lang !== undefined);
}

function grammarEntries(packageJSON: unknown): Array<Record<string, unknown>> {
  const contributes = asRecord(asRecord(packageJSON)?.contributes);
  const grammars = contributes?.grammars;
  if (!Array.isArray(grammars)) {
    return [];
  }
  return grammars
    .map((g) => asRecord(g))
    .filter((g): g is Record<string, unknown> => g !== undefined);
}

/**
 * Collect conflict reasons for one extension package.json against ConTeXt Tools'
 * claimed language id / ConTeXt filename extensions / context grammars.
 */
export function collectConflictReasons(packageJSON: unknown): ConflictReason[] {
  const reasons: ConflictReason[] = [];
  const seen = new Set<string>();

  const push = (kind: ConflictReasonKind, detail: string): void => {
    const key = `${kind}:${detail}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    reasons.push({ kind, detail });
  };

  for (const lang of languageEntries(packageJSON)) {
    if (lang.id === CONTEXT_TOOLS_LANGUAGE_ID) {
      push('languageId', CONTEXT_TOOLS_LANGUAGE_ID);
    }
    const extensions = lang.extensions;
    if (Array.isArray(extensions)) {
      for (const ext of extensions) {
        if (typeof ext !== 'string') {
          continue;
        }
        const normalized = normalizeFileExtension(ext);
        if (
          (CONTEXT_TOOLS_FILE_EXTENSIONS as readonly string[]).includes(normalized)
        ) {
          push('fileExtension', normalized);
        }
      }
    }
  }

  for (const grammar of grammarEntries(packageJSON)) {
    if (grammar.language === CONTEXT_TOOLS_LANGUAGE_ID) {
      push('grammarLanguage', CONTEXT_TOOLS_LANGUAGE_ID);
    }
  }

  return reasons;
}

function resolveDisplayName(ext: ExtensionInspectInput): string {
  const pkg = asRecord(ext.packageJSON);
  if (typeof ext.displayName === 'string' && ext.displayName.trim()) {
    return ext.displayName.trim();
  }
  if (typeof pkg?.displayName === 'string' && pkg.displayName.trim()) {
    return pkg.displayName.trim();
  }
  if (typeof pkg?.name === 'string' && pkg.name.trim()) {
    return pkg.name.trim();
  }
  return ext.id;
}

/**
 * Scan installed extensions for contributions that overlap ConTeXt Tools.
 * Excludes `ourExtensionId`. Pure: no VS Code API.
 */
export function findConflictingExtensions(
  extensions: ReadonlyArray<ExtensionInspectInput>,
  ourExtensionId: string,
): ConflictingExtension[] {
  const out: ConflictingExtension[] = [];
  for (const ext of extensions) {
    if (!ext.id || ext.id === ourExtensionId) {
      continue;
    }
    const reasons = collectConflictReasons(ext.packageJSON);
    if (reasons.length === 0) {
      continue;
    }
    out.push({
      id: ext.id,
      displayName: resolveDisplayName(ext),
      reasons,
    });
  }
  out.sort((a, b) => a.id.localeCompare(b.id));
  return out;
}

/** Format one conflicting extension for dialog / log lines. */
export function formatConflictExtensionLine(ext: ConflictingExtension): string {
  const reasonText = ext.reasons
    .map((r) => {
      switch (r.kind) {
        case 'languageId':
          return `language id "${r.detail}"`;
        case 'fileExtension':
          return `file extension ${r.detail}`;
        case 'grammarLanguage':
          return `grammar for language "${r.detail}"`;
        default:
          return r.detail;
      }
    })
    .join(', ');
  return `${ext.displayName} (${ext.id}) — ${reasonText}`;
}

/**
 * Pure gate for the one-shot extension-conflict warning.
 * Skips Extension Development Host (F5): the under-development grammar
 * registers last and wins, so the conflict does not appear there.
 */
export function shouldWarnExtensionConflict(options: {
  dontAsk: boolean;
  alreadyShownThisSession: boolean;
  conflictingExtensions: ReadonlyArray<ConflictingExtension>;
  extensionModeDevelopment: boolean;
}): boolean {
  if (options.dontAsk) {
    return false;
  }
  if (options.alreadyShownThisSession) {
    return false;
  }
  if (options.extensionModeDevelopment) {
    return false;
  }
  if (options.conflictingExtensions.length === 0) {
    return false;
  }
  return true;
}

/**
 * True when either the new or legacy don't-ask flag is set (setting or state).
 */
export function resolveExtensionConflictDontAsk(flags: {
  setting?: boolean;
  legacySetting?: boolean;
  globalState?: boolean;
  workspaceState?: boolean;
  legacyGlobalState?: boolean;
  legacyWorkspaceState?: boolean;
}): boolean {
  return (
    flags.setting === true ||
    flags.legacySetting === true ||
    flags.globalState === true ||
    flags.workspaceState === true ||
    flags.legacyGlobalState === true ||
    flags.legacyWorkspaceState === true
  );
}
