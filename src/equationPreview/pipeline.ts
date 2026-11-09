import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnContextBuild } from '../build/spawnContext';
import { killProcessTree } from '../build/killProcessTree';
import type { Toolchain } from '../toolchain/discover';
import { equationPreviewCacheKey } from './cacheKey';
import {
  isRasterError,
  rasterPdfToPng,
  rasterPdfToSvg,
} from './raster';
import type { EquationPreviewSettings } from './settings';
import { buildEquationTexpageSource } from './texpageSource';

export interface EquationPreviewArtifacts {
  cacheKey: string;
  cacheDir: string;
  pdfPath: string;
  /** PNG used for hover (always produced when compile succeeds). */
  pngPath: string;
  /** SVG when format=svg or after a successful SVG export; may be absent. */
  svgPath?: string;
  /** Hover display path (PNG; SVG setting falls back to PNG in Markdown hover). */
  hoverImagePath: string;
  hoverFormat: 'png' | 'svg';
}

export type EquationPreviewOutcome =
  | { ok: true; artifacts: EquationPreviewArtifacts }
  | { ok: false; message: string };

const inflight = new Map<string, Promise<EquationPreviewOutcome>>();

export function equationPreviewStorageRoot(storageUriFsPath: string): string {
  return path.join(storageUriFsPath, 'equation-preview');
}

function artifactPaths(cacheDir: string): {
  pdfPath: string;
  pngPath: string;
  svgPath: string;
  metaPath: string;
} {
  return {
    pdfPath: path.join(cacheDir, 'equation.pdf'),
    pngPath: path.join(cacheDir, 'equation.png'),
    svgPath: path.join(cacheDir, 'equation.svg'),
    metaPath: path.join(cacheDir, 'meta.json'),
  };
}

function cacheHit(cacheDir: string, wantSvg: boolean): EquationPreviewArtifacts | undefined {
  const paths = artifactPaths(cacheDir);
  if (!fs.existsSync(paths.pdfPath) || !fs.existsSync(paths.pngPath)) {
    return undefined;
  }
  const svgOk = wantSvg && fs.existsSync(paths.svgPath);
  // Hover always uses PNG — VS Code MarkdownString img for SVG is unreliable.
  return {
    cacheKey: path.basename(cacheDir),
    cacheDir,
    pdfPath: paths.pdfPath,
    pngPath: paths.pngPath,
    svgPath: svgOk ? paths.svgPath : undefined,
    hoverImagePath: paths.pngPath,
    hoverFormat: 'png',
  };
}

async function compileTexpage(options: {
  toolchain: Toolchain;
  source: string;
  workDir: string;
  timeoutMs: number;
}): Promise<{ pdfPath: string } | { message: string }> {
  const texPath = path.join(options.workDir, 'equation.tex');
  await fsp.writeFile(texPath, options.source, 'utf8');
  const args = ['--once', '--batch', '--noconsole', texPath];
  const handle = spawnContextBuild({
    contextPath: options.toolchain.contextPath,
    sourcePath: texPath,
    cwd: options.workDir,
    args,
    env: process.env,
  });

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    void killProcessTree(handle.child);
  }, options.timeoutMs);

  try {
    const result = await handle.promise;
    clearTimeout(timer);
    if (timedOut) {
      return { message: `Equation preview timed out after ${options.timeoutMs}ms.` };
    }
    if (result.exitCode !== 0) {
      const tail = (result.stdout || result.stderr || '').trim().split(/\r?\n/).slice(-8).join('\n');
      return {
        message: `ConTeXt equation job failed (exit ${result.exitCode}).${tail ? `\n${tail}` : ''}`,
      };
    }
    if (!fs.existsSync(result.pdfPath) || fs.statSync(result.pdfPath).size === 0) {
      return { message: 'ConTeXt equation job finished but produced no PDF.' };
    }
    return { pdfPath: result.pdfPath };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    return { message: `Failed to run context for equation preview: ${msg}` };
  }
}

/**
 * Compile snippet + environment into cached PDF/PNG/(SVG). Separate from the document build queue.
 */
export async function getEquationPreview(options: {
  snippet: string;
  settings: EquationPreviewSettings;
  toolchain: Toolchain;
  storageRoot: string;
}): Promise<EquationPreviewOutcome> {
  const { snippet, settings, toolchain, storageRoot } = options;
  const cacheKey = equationPreviewCacheKey({
    snippet,
    environment: settings.environment,
    format: settings.format,
    maxWidth: settings.maxWidth,
    maxHeight: settings.maxHeight,
    rasterDpi: settings.rasterDpi,
  });
  const cacheDir = path.join(storageRoot, cacheKey);
  const hit = cacheHit(cacheDir, settings.format === 'svg');
  if (hit) {
    return { ok: true, artifacts: hit };
  }

  const existing = inflight.get(cacheKey);
  if (existing) {
    return existing;
  }

  const work = (async (): Promise<EquationPreviewOutcome> => {
    await fsp.mkdir(cacheDir, { recursive: true });
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'context-eqprev-'));
    try {
      const source = buildEquationTexpageSource(settings.environment, snippet);
      const compiled = await compileTexpage({
        toolchain,
        source,
        workDir,
        timeoutMs: settings.timeoutMs,
      });
      if ('message' in compiled) {
        return { ok: false, message: compiled.message };
      }

      const paths = artifactPaths(cacheDir);
      await fsp.copyFile(compiled.pdfPath, paths.pdfPath);

      const png = await rasterPdfToPng({
        pdfPath: paths.pdfPath,
        outputPath: paths.pngPath,
        dpi: settings.rasterDpi,
        rasterTool: settings.rasterTool,
        timeoutMs: Math.min(settings.timeoutMs, 30000),
      });
      if (isRasterError(png)) {
        return { ok: false, message: png.message };
      }

      let svgPath: string | undefined;
      if (settings.format === 'svg') {
        const svg = await rasterPdfToSvg({
          pdfPath: paths.pdfPath,
          outputPath: paths.svgPath,
          rasterTool: settings.rasterTool,
          timeoutMs: Math.min(settings.timeoutMs, 30000),
        });
        if (!isRasterError(svg)) {
          svgPath = svg.outputPath;
        }
        // Hover still uses PNG when SVG conversion fails or for Markdown reliability.
      }

      await fsp.writeFile(
        paths.metaPath,
        JSON.stringify(
          {
            cacheKey,
            format: settings.format,
            createdAt: new Date().toISOString(),
          },
          null,
          2,
        ),
        'utf8',
      );

      return {
        ok: true,
        artifacts: {
          cacheKey,
          cacheDir,
          pdfPath: paths.pdfPath,
          pngPath: paths.pngPath,
          svgPath,
          hoverImagePath: paths.pngPath,
          hoverFormat: 'png',
        },
      };
    } finally {
      try {
        await fsp.rm(workDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  })();

  inflight.set(cacheKey, work);
  try {
    return await work;
  } finally {
    inflight.delete(cacheKey);
  }
}

/**
 * Ensure natural-size artifacts exist for save (reuse cache; generate SVG/PNG on demand).
 */
export async function ensureSaveArtifact(options: {
  artifacts: EquationPreviewArtifacts;
  format: 'pdf' | 'png' | 'svg';
  settings: EquationPreviewSettings;
}): Promise<{ path: string } | { message: string }> {
  const { artifacts, format, settings } = options;
  if (format === 'pdf') {
    if (fs.existsSync(artifacts.pdfPath)) {
      return { path: artifacts.pdfPath };
    }
    return { message: 'Cached equation PDF is missing; hover the formula again.' };
  }
  if (format === 'png') {
    if (fs.existsSync(artifacts.pngPath)) {
      return { path: artifacts.pngPath };
    }
    const png = await rasterPdfToPng({
      pdfPath: artifacts.pdfPath,
      outputPath: artifacts.pngPath,
      dpi: settings.rasterDpi,
      rasterTool: settings.rasterTool,
      timeoutMs: Math.min(settings.timeoutMs, 30000),
    });
    if (isRasterError(png)) {
      return { message: png.message };
    }
    return { path: png.outputPath };
  }
  // svg
  if (artifacts.svgPath && fs.existsSync(artifacts.svgPath)) {
    return { path: artifacts.svgPath };
  }
  const svgPath = path.join(artifacts.cacheDir, 'equation.svg');
  const svg = await rasterPdfToSvg({
    pdfPath: artifacts.pdfPath,
    outputPath: svgPath,
    rasterTool: settings.rasterTool,
    timeoutMs: Math.min(settings.timeoutMs, 30000),
  });
  if (isRasterError(svg)) {
    return { message: svg.message };
  }
  return { path: svg.outputPath };
}
