import assert from 'node:assert/strict';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import { pathToFileURL } from 'node:url';

const smokePath = path.join(__dirname, '..', '..', 'scripts', 'vsix-smoke.mjs');

type SmokeModule = {
  listZipEntries: (buf: Buffer) => string[];
  missingVsixEntries: (names: string[]) => string[];
};

async function loadSmoke(): Promise<SmokeModule> {
  return (await import(pathToFileURL(smokePath).href)) as SmokeModule;
}

/** Central directory + end record only; enough for listZipEntries. */
function centralDirectoryZip(names: string[]): Buffer {
  const entries = names.map((name) => {
    const nameBuf = Buffer.from(name, 'utf8');
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(nameBuf.length, 28);
    return Buffer.concat([header, nameBuf]);
  });
  const cen = Buffer.concat(entries);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cen.length, 12);
  eocd.writeUInt32LE(0, 16);
  return Buffer.concat([cen, eocd]);
}

const COMPLETE = [
  'extension.vsixmanifest',
  'extension/LICENSE.txt',
  'extension/NOTICE',
  'extension/package.json',
  'extension/dist/extension.js',
  'extension/media/viewer/viewer.js',
  'extension/media/viewer/pdfjs/pdf.min.mjs',
  'extension/media/viewer/pdfjs/pdf.worker.min.mjs',
];

describe('vsix-smoke', () => {
  it('accepts a VSIX listing with pdf.js, extension.js, LICENSE.txt, NOTICE', async () => {
    const { missingVsixEntries } = await loadSmoke();
    assert.deepEqual(missingVsixEntries(COMPLETE), []);
  });

  it('reports missing pdf.js and license files', async () => {
    const { missingVsixEntries } = await loadSmoke();
    const names = COMPLETE.filter(
      (n) => !n.includes('/pdfjs/') && !n.endsWith('LICENSE.txt') && !n.endsWith('NOTICE'),
    );
    assert.deepEqual(missingVsixEntries(names), [
      'extension/media/viewer/pdfjs/pdf.min.mjs',
      'extension/media/viewer/pdfjs/pdf.worker.min.mjs',
      'extension/LICENSE*',
      'extension/NOTICE',
    ]);
  });

  it('reads entry names from a zip central directory', async () => {
    const { listZipEntries } = await loadSmoke();
    assert.deepEqual(listZipEntries(centralDirectoryZip(COMPLETE)), COMPLETE);
  });

  it('rejects data that is not a zip', async () => {
    const { listZipEntries } = await loadSmoke();
    assert.throws(() => listZipEntries(Buffer.from('not a zip')), /Not a zip archive/);
  });
});
