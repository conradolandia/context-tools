#!/usr/bin/env node
/**
 * Package a VSIX with vsce and assert it ships the runtime assets that are not
 * tracked in git or are easy to drop via .vscodeignore.
 *
 * media/viewer/pdfjs/ is gitignored and copied from node_modules at compile
 * time (esbuild.mjs); vsce runs `vscode:prepublish` → compile, so a package
 * built without `npm install` ships a viewer with no PDF.js.
 *
 * Usage:
 *   npm run smoke:vsix                                 # package to a temp dir, check, delete
 *   node scripts/vsix-smoke.mjs --vsix path/to/file.vsix   # check an existing VSIX
 *
 * Does not publish.
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VSCE = '@vscode/vsce@4';

/** [label, matcher] pairs; every matcher must hit at least one VSIX entry. */
export const REQUIRED_VSIX_ENTRIES = [
  ['extension/dist/extension.js', /^extension\/dist\/extension\.js$/],
  ['extension/media/viewer/pdfjs/pdf.min.mjs', /^extension\/media\/viewer\/pdfjs\/pdf\.min\.mjs$/],
  [
    'extension/media/viewer/pdfjs/pdf.worker.min.mjs',
    /^extension\/media\/viewer\/pdfjs\/pdf\.worker\.min\.mjs$/,
  ],
  // vsce writes the license file as LICENSE.txt.
  ['extension/LICENSE*', /^extension\/LICENSE(\.[a-z]+)?$/i],
  ['extension/NOTICE', /^extension\/NOTICE$/],
];

/** Labels of required entries missing from `names`. */
export function missingVsixEntries(names) {
  return REQUIRED_VSIX_ENTRIES.filter(([, re]) => !names.some((n) => re.test(n))).map(
    ([label]) => label,
  );
}

/** Entry names from a zip central directory (no ZIP64; VSIX files stay small). */
export function listZipEntries(buf) {
  const EOCD_SIG = 0x06054b50;
  const CEN_SIG = 0x02014b50;
  const EOCD_MIN = 22;
  const stop = Math.max(0, buf.length - EOCD_MIN - 0xffff);
  let eocd = -1;
  for (let i = buf.length - EOCD_MIN; i >= stop; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error('Not a zip archive (no end of central directory record)');
  }
  const count = buf.readUInt16LE(eocd + 10);
  let offset = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || offset === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported');
  }
  const names = [];
  for (let n = 0; n < count; n++) {
    if (offset + 46 > buf.length || buf.readUInt32LE(offset) !== CEN_SIG) {
      throw new Error(`Bad central directory entry at offset ${offset}`);
    }
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    names.push(buf.toString('utf8', offset + 46, offset + 46 + nameLen));
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

function packageVsix(repoRoot, outPath) {
  const r = spawnSync('npx', ['--yes', VSCE, 'package', '--out', outPath], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (r.status !== 0) {
    throw new Error(`vsce package failed (exit ${r.status ?? r.signal ?? r.error?.message})`);
  }
}

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const args = process.argv.slice(2);
  const vsixIdx = args.indexOf('--vsix');
  let tmpDir;
  let vsixPath;
  if (vsixIdx >= 0) {
    if (!args[vsixIdx + 1]) {
      throw new Error('--vsix needs a path');
    }
    vsixPath = resolve(args[vsixIdx + 1]);
  } else {
    tmpDir = mkdtempSync(join(tmpdir(), 'context-vsix-smoke-'));
    vsixPath = join(tmpDir, 'context-tools-smoke.vsix');
    packageVsix(repoRoot, vsixPath);
  }
  try {
    const names = listZipEntries(readFileSync(vsixPath));
    const missing = missingVsixEntries(names);
    if (missing.length > 0) {
      const hint = missing.some((m) => m.includes('/pdfjs/'))
        ? '\nPDF.js is copied from node_modules at compile: run npm install, then retry.'
        : '';
      throw new Error(
        `VSIX smoke failed: ${vsixPath} is missing\n  ${missing.join('\n  ')}${hint}`,
      );
    }
    console.log(
      `VSIX smoke OK (${names.length} entries): ` +
        REQUIRED_VSIX_ENTRIES.map(([label]) => label).join(', '),
    );
  } finally {
    if (tmpDir) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    main();
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }
}
