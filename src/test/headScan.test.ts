import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractBracketGroup,
  extractTitleFromSetup,
  nestHeads,
  scanHeads,
} from '../outline/headScan';

describe('extractTitleFromSetup', () => {
  it('reads title={…}', () => {
    assert.equal(extractTitleFromSetup('title={Hello World}'), 'Hello World');
  });

  it('reads title=plain', () => {
    assert.equal(extractTitleFromSetup('title=Plain,reference=x'), 'Plain');
  });

  it('reads bare braced positional', () => {
    assert.equal(extractTitleFromSetup('{Only title}'), 'Only title');
  });
});

describe('extractBracketGroup', () => {
  it('handles braces inside brackets', () => {
    const text = '\\startchapter[title={A [weird] title}]';
    const cmd = '\\startchapter';
    const g = extractBracketGroup(text, cmd.length);
    assert.ok(g);
    assert.equal(g!.body, 'title={A [weird] title}');
    assert.equal(text.slice(g!.end), '');
  });
});

describe('scanHeads', () => {
  it('finds start-forms with titles and nests by level', () => {
    const text = [
      '\\startchapter[title={One}]',
      '\\startsection[title=Sec]',
      '\\startsubsection[title={Sub}]',
      '\\startchapter[title={Two}]',
      '',
    ].join('\n');
    const heads = scanHeads(text);
    assert.equal(heads.length, 4);
    assert.equal(heads[0]!.kind, 'chapter');
    assert.equal(heads[0]!.title, 'One');
    assert.equal(heads[1]!.title, 'Sec');
    assert.equal(heads[2]!.kind, 'subsection');
    assert.equal(heads[3]!.title, 'Two');

    const tree = nestHeads(heads.map((h) => ({ ...h, fsPath: '/tmp/a.tex' })));
    assert.equal(tree.length, 2);
    assert.equal(tree[0]!.children.length, 1);
    assert.equal(tree[0]!.children[0]!.children.length, 1);
    assert.equal(tree[0]!.children[0]!.children[0]!.title, 'Sub');
    assert.equal(tree[1]!.children.length, 0);
  });

  it('accepts short-form \\chapter / \\section', () => {
    const heads = scanHeads('\\chapter[title={Ch}]\n\\section[title={S}]\n');
    assert.equal(heads.length, 2);
    assert.equal(heads[0]!.kind, 'chapter');
    assert.equal(heads[1]!.kind, 'section');
  });

  it('skips heads inside typing', () => {
    const text = [
      '\\startchapter[title={Real}]',
      '\\starttyping',
      '\\startsection[title={Fake}]',
      '\\stoptyping',
      '\\startsection[title={After}]',
      '',
    ].join('\n');
    const heads = scanHeads(text);
    assert.deepEqual(
      heads.map((h) => h.title),
      ['Real', 'After'],
    );
  });

  it('skips comment-line heads', () => {
    const heads = scanHeads('% \\startchapter[title={Nope}]\n\\startsection[title={Yes}]\n');
    assert.equal(heads.length, 1);
    assert.equal(heads[0]!.title, 'Yes');
  });

  it('uses untitled fallback when title missing', () => {
    const heads = scanHeads('\\startchapter\n');
    assert.equal(heads.length, 1);
    assert.equal(heads[0]!.title, '(untitled chapter)');
  });

  it('normalizes braced multiline titles', () => {
    const heads = scanHeads('\\startchapter[title={Enfermedad de\nGaucher}]\n');
    assert.equal(heads[0]!.title, 'Enfermedad de Gaucher');
  });
});
