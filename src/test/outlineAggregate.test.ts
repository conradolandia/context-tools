import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildProjectModel } from '../project/projectModel';
import {
  buildOutlineAggregate,
  collectOutlineContentFiles,
  selectOutlineRoot,
} from '../outline/outlineAggregate';
import { applyDigestifTitles, indexEnrichTitles } from '../outline/digestifEnrich';
import { makeTempDir } from './helpers/tmpDir';

function write(dir: string, rel: string, body: string): string {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}

describe('outlineAggregate', () => {
  it('aggregates heads across product + components without DigestiF', async () => {
    const dir = await makeTempDir('context-outline-');
    write(
      dir,
      'env.tex',
      '\\startenvironment\n\\startchapter[title={EnvShouldSkip}]\n\\stopenvironment\n',
    );
    const intro = write(
      dir,
      'chapters/intro.tex',
      '\\startcomponent\n\\startsection[title={Intro sec}]\n\\stopcomponent\n',
    );
    const more = write(
      dir,
      'chapters/more.tex',
      '\\startcomponent\n\\startsection[title={More sec}]\n\\startsubsection[title={Sub}]\n\\stopcomponent\n',
    );
    const product = write(
      dir,
      'book.tex',
      [
        '\\startproduct book',
        '\\environment env',
        '\\usepath[chapters]',
        '\\startchapter[title={From product}]',
        '\\component intro',
        '\\component more',
        '\\stopproduct',
        '',
      ].join('\n'),
    );

    const model = buildProjectModel({ entryFile: product, workspaceFolders: [dir] });
    const outlineRoot = selectOutlineRoot(model.roots);
    assert.ok(outlineRoot);
    const files = collectOutlineContentFiles(outlineRoot!);
    assert.ok(files.includes(product));
    assert.ok(files.includes(intro));
    assert.ok(files.includes(more));
    assert.ok(!files.some((f) => f.endsWith('env.tex')));

    const agg = buildOutlineAggregate({
      projectRoots: model.roots,
      readFile: (p) => fs.readFileSync(p, 'utf8'),
    });
    assert.equal(agg.emptyMessage, undefined);
    assert.equal(agg.roots.length, 1);
    assert.equal(agg.roots[0]!.title, 'From product');
    assert.equal(agg.roots[0]!.children.length, 2);
    assert.equal(agg.roots[0]!.children[0]!.title, 'Intro sec');
    assert.equal(agg.roots[0]!.children[1]!.title, 'More sec');
    assert.equal(agg.roots[0]!.children[1]!.children[0]!.title, 'Sub');
  });

  it('reports no heads without requiring DigestiF', async () => {
    const dir = await makeTempDir('context-outline-empty-');
    const product = write(dir, 'book.tex', '\\startproduct book\n\\stopproduct\n');
    const model = buildProjectModel({ entryFile: product, workspaceFolders: [dir] });
    const agg = buildOutlineAggregate({
      projectRoots: model.roots,
      readFile: (p) => fs.readFileSync(p, 'utf8'),
    });
    assert.equal(agg.roots.length, 0);
    assert.equal(agg.emptyMessage, 'No sectioning heads found');
  });
});

describe('digestifEnrich', () => {
  it('overlays DigestiF titles by file:line without changing structure', () => {
    const roots = [
      {
        kind: 'chapter' as const,
        level: 2,
        title: 'Scan title',
        fsPath: '/tmp/a.tex',
        commandStart: 0,
        commandEnd: 10,
        line: 3,
        children: [
          {
            kind: 'section' as const,
            level: 3,
            title: 'Scan sec',
            fsPath: '/tmp/a.tex',
            commandStart: 20,
            commandEnd: 30,
            line: 5,
            children: [],
          },
        ],
      },
    ];
    const titles = indexEnrichTitles('/tmp/a.tex', [
      { name: '{DigestiF Chapter}', line: 3, children: [{ name: 'Keep sec', line: 5 }] },
    ]);
    applyDigestifTitles(roots, titles);
    assert.equal(roots[0]!.title, 'DigestiF Chapter');
    assert.equal(roots[0]!.children[0]!.title, 'Keep sec');
    assert.equal(roots[0]!.children.length, 1);
  });
});
