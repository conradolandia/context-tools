import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { equationPreviewCacheKey } from '../equationPreview/cacheKey';
import { constrainHoverImageSize } from '../links/figureHoverMarkdown';
import { buildEquationTexpageSource } from '../equationPreview/texpageSource';

describe('equationPreviewCacheKey', () => {
  it('is stable for the same inputs', () => {
    const a = equationPreviewCacheKey({
      snippet: '\\startformula x \\stopformula',
      environment: '\\environment myenv',
      format: 'png',
      maxWidth: 512,
      maxHeight: 512,
    });
    const b = equationPreviewCacheKey({
      snippet: '\\startformula x \\stopformula',
      environment: '\\environment myenv',
      format: 'png',
      maxWidth: 512,
      maxHeight: 512,
    });
    assert.equal(a, b);
    assert.match(a, /^[a-f0-9]{64}$/);
  });

  it('changes when environment, format, or clamp dims change', () => {
    const base = {
      snippet: 'x',
      environment: '',
      format: 'png',
      maxWidth: 512,
      maxHeight: 512,
    };
    const k0 = equationPreviewCacheKey(base);
    assert.notEqual(k0, equationPreviewCacheKey({ ...base, environment: '\\setupbodyfont[10pt]' }));
    assert.notEqual(k0, equationPreviewCacheKey({ ...base, format: 'svg' }));
    assert.notEqual(k0, equationPreviewCacheKey({ ...base, maxWidth: 256 }));
    assert.notEqual(k0, equationPreviewCacheKey({ ...base, snippet: 'y' }));
  });
});

describe('constrainHoverImageSize (equation defaults)', () => {
  it('clamps to 512×512 without upscaling', () => {
    const s = constrainHoverImageSize(2000, 1000, 512, 512);
    assert.equal(s.width, 512);
    assert.equal(s.height, 256);
    const small = constrainHoverImageSize(100, 50, 512, 512);
    assert.deepEqual(small, { width: 100, height: 50 });
  });
});

describe('buildEquationTexpageSource', () => {
  it('wraps environment + snippet in startTEXpage', () => {
    const src = buildEquationTexpageSource('\\environment demo', '\\startformula x\\stopformula');
    assert.match(src, /\\starttext/);
    assert.match(src, /\\environment demo/);
    assert.match(src, /\\startTEXpage\[offset=1ex\]/);
    assert.match(src, /\\startformula x\\stopformula/);
    assert.match(src, /\\stopTEXpage/);
    assert.match(src, /\\stoptext/);
  });

  it('omits empty environment block', () => {
    const src = buildEquationTexpageSource('  ', 'x');
    assert.doesNotMatch(src, /\\environment/);
    assert.match(src, /\\startTEXpage/);
  });
});
