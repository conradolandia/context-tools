import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractMathAt,
  findDollarMathAt,
  findFormulaEnvAt,
} from '../equationPreview/extractMath';

describe('findFormulaEnvAt', () => {
  it('extracts \\startformula…\\stopformula under the cursor', () => {
    const text = 'before\n\\startformula\nx^2\n\\stopformula\nafter';
    const offset = text.indexOf('x^2');
    const hit = findFormulaEnvAt(text, offset);
    assert.ok(hit);
    assert.equal(hit!.kind, 'formula-env');
    assert.equal(hit!.text, '\\startformula\nx^2\n\\stopformula');
  });

  it('extracts \\startplaceformula variants', () => {
    const text =
      '\\startplaceformula\n\\startformula E=mc^2 \\stopformula\n\\stopplaceformula';
    const offset = text.indexOf('E=mc^2');
    const inner = findFormulaEnvAt(text, offset);
    assert.ok(inner);
    // Innermost wins
    assert.equal(inner!.text, '\\startformula E=mc^2 \\stopformula');

    const outerOffset = text.indexOf('\\startplaceformula');
    const outer = findFormulaEnvAt(text, outerOffset);
    assert.ok(outer);
    assert.match(outer!.text, /^\\startplaceformula/);
    assert.match(outer!.text, /\\stopplaceformula$/);
  });

  it('returns undefined outside any formula env', () => {
    const text = 'plain text \\input foo';
    assert.equal(findFormulaEnvAt(text, 2), undefined);
  });
});

describe('findDollarMathAt', () => {
  it('finds inline $…$', () => {
    const text = 'a $x+y$ b';
    const hit = findDollarMathAt(text, text.indexOf('x'));
    assert.ok(hit);
    assert.equal(hit!.kind, 'inline-dollar');
    assert.equal(hit!.text, '$x+y$');
  });

  it('prefers $$…$$ over nested single dollars', () => {
    const text = '$$a+b$$';
    const hit = findDollarMathAt(text, 3);
    assert.ok(hit);
    assert.equal(hit!.kind, 'display-dollar');
    assert.equal(hit!.text, '$$a+b$$');
  });

  it('skips escaped dollars', () => {
    const text = 'price \\$5 and $x$';
    const hit = findDollarMathAt(text, text.indexOf('x'));
    assert.ok(hit);
    assert.equal(hit!.text, '$x$');
    assert.equal(findDollarMathAt(text, text.indexOf('5')), undefined);
  });
});

describe('extractMathAt', () => {
  it('falls back to selection when no delimiter matches', () => {
    const text = 'alpha beta gamma';
    const hit = extractMathAt(text, 8, { start: 6, end: 10 });
    assert.ok(hit);
    assert.equal(hit!.kind, 'selection');
    assert.equal(hit!.text, 'beta');
  });

  it('returns undefined with no delimiter and no selection', () => {
    assert.equal(extractMathAt('no math here', 3), undefined);
  });

  it('prefers formula env over selection', () => {
    const text = '\\startformula x \\stopformula';
    const hit = extractMathAt(text, 15, { start: 0, end: text.length });
    assert.equal(hit!.kind, 'formula-env');
  });
});
