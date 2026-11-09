import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTEXT_TOOLS_LANGUAGE_ID,
  collectConflictReasons,
  findConflictingExtensions,
  formatConflictExtensionLine,
  normalizeFileExtension,
  resolveExtensionConflictDontAsk,
  shouldWarnExtensionConflict,
} from '../compat/extensionConflictPolicy';

describe('normalizeFileExtension', () => {
  it('lowercases and adds a leading dot', () => {
    assert.equal(normalizeFileExtension('MKIV'), '.mkiv');
    assert.equal(normalizeFileExtension('.MkXl'), '.mkxl');
    assert.equal(normalizeFileExtension(''), '');
  });
});

describe('collectConflictReasons', () => {
  it('detects language id context', () => {
    const reasons = collectConflictReasons({
      contributes: {
        languages: [{ id: 'latex' }, { id: 'context', extensions: ['.ctx'] }],
      },
    });
    assert.deepEqual(reasons, [{ kind: 'languageId', detail: CONTEXT_TOOLS_LANGUAGE_ID }]);
  });

  it('detects overlapping ConTeXt file extensions without context language id', () => {
    const reasons = collectConflictReasons({
      contributes: {
        languages: [{ id: 'plaintext', extensions: ['mkiv', '.TEX'] }],
      },
    });
    assert.deepEqual(reasons, [{ kind: 'fileExtension', detail: '.mkiv' }]);
  });

  it('detects grammar for language context', () => {
    const reasons = collectConflictReasons({
      contributes: {
        grammars: [{ language: 'context', scopeName: 'text.tex.other' }],
      },
    });
    assert.deepEqual(reasons, [
      { kind: 'grammarLanguage', detail: CONTEXT_TOOLS_LANGUAGE_ID },
    ]);
  });

  it('dedupes and combines multiple reason kinds', () => {
    const reasons = collectConflictReasons({
      contributes: {
        languages: [
          { id: 'context', extensions: ['.mkiv', '.mkiv', '.mkxl'] },
        ],
        grammars: [{ language: 'context', scopeName: 'text.tex.other' }],
      },
    });
    assert.equal(reasons.length, 4);
    assert.ok(reasons.some((r) => r.kind === 'languageId'));
    assert.ok(reasons.some((r) => r.kind === 'fileExtension' && r.detail === '.mkiv'));
    assert.ok(reasons.some((r) => r.kind === 'fileExtension' && r.detail === '.mkxl'));
    assert.ok(reasons.some((r) => r.kind === 'grammarLanguage'));
  });

  it('returns empty for unrelated or empty packages', () => {
    assert.deepEqual(
      collectConflictReasons({
        contributes: { languages: [{ id: 'latex', extensions: ['.tex'] }] },
      }),
      [],
    );
    assert.deepEqual(collectConflictReasons({}), []);
    assert.deepEqual(collectConflictReasons(null), []);
    assert.deepEqual(collectConflictReasons(undefined), []);
  });
});

describe('findConflictingExtensions', () => {
  const ourId = 'context-lab.context-tools';

  it('excludes our extension and returns sorted conflicts', () => {
    const found = findConflictingExtensions(
      [
        {
          id: ourId,
          packageJSON: {
            displayName: 'ConTeXt Tools',
            contributes: {
              languages: [{ id: 'context', extensions: ['.mkiv'] }],
            },
          },
        },
        {
          id: 'zzz.other',
          displayName: 'Zed Other',
          packageJSON: {
            contributes: { languages: [{ id: 'context' }] },
          },
        },
        {
          id: 'aaa.overlap',
          packageJSON: {
            displayName: 'Overlap Pack',
            contributes: {
              languages: [{ id: 'context', extensions: ['.mkiv'] }],
              grammars: [{ language: 'context', scopeName: 'text.tex.other' }],
            },
          },
        },
        {
          id: 'harmless.ext',
          packageJSON: {
            contributes: { languages: [{ id: 'python' }] },
          },
        },
      ],
      ourId,
    );

    assert.deepEqual(
      found.map((f) => f.id),
      ['aaa.overlap', 'zzz.other'],
    );
    assert.equal(found[0]?.displayName, 'Overlap Pack');
    assert.ok(found[0]!.reasons.length >= 2);
    assert.equal(found[1]?.displayName, 'Zed Other');
  });

  it('formats dialog lines with id and reasons', () => {
    const line = formatConflictExtensionLine({
      id: 'aaa.overlap',
      displayName: 'Overlap Pack',
      reasons: [
        { kind: 'languageId', detail: 'context' },
        { kind: 'fileExtension', detail: '.mkiv' },
      ],
    });
    assert.match(line, /Overlap Pack/);
    assert.match(line, /aaa\.overlap/);
    assert.match(line, /language id "context"/);
    assert.match(line, /\.mkiv/);
  });
});

describe('shouldWarnExtensionConflict', () => {
  const conflict = {
    id: 'aaa.overlap',
    displayName: 'Overlap Pack',
    reasons: [{ kind: 'languageId' as const, detail: 'context' }],
  };

  const base = {
    dontAsk: false,
    alreadyShownThisSession: false,
    conflictingExtensions: [conflict],
    extensionModeDevelopment: false,
  };

  it('warns when conflicts exist', () => {
    assert.equal(shouldWarnExtensionConflict(base), true);
  });

  it('skips dontAsk, session, F5, or empty conflict list', () => {
    assert.equal(shouldWarnExtensionConflict({ ...base, dontAsk: true }), false);
    assert.equal(
      shouldWarnExtensionConflict({ ...base, alreadyShownThisSession: true }),
      false,
    );
    assert.equal(
      shouldWarnExtensionConflict({ ...base, extensionModeDevelopment: true }),
      false,
    );
    assert.equal(
      shouldWarnExtensionConflict({ ...base, conflictingExtensions: [] }),
      false,
    );
  });
});

describe('resolveExtensionConflictDontAsk', () => {
  it('honors setting and state flags', () => {
    assert.equal(resolveExtensionConflictDontAsk({}), false);
    assert.equal(resolveExtensionConflictDontAsk({ setting: true }), true);
    assert.equal(resolveExtensionConflictDontAsk({ globalState: true }), true);
    assert.equal(resolveExtensionConflictDontAsk({ workspaceState: true }), true);
  });
});
