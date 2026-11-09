import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { whichOnPath } from '../toolchain/execPath';
import type { EquationRasterTool } from './settings';

export type RasterKind = 'png' | 'svg';

export interface RasterResult {
  kind: RasterKind;
  outputPath: string;
  tool: string;
}

export interface RasterError {
  message: string;
  missingTools?: string[];
}

function run(
  command: string,
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      reject(new Error(`Timed out after ${timeoutMs}ms: ${command}`));
    }, timeoutMs);
    child.stdout?.on('data', (c: Buffer) => {
      stdout += c.toString();
    });
    child.stderr?.on('data', (c: Buffer) => {
      stderr += c.toString();
    });
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code ?? 1, stdout, stderr });
    });
  });
}

function resolveToolOrder(preference: EquationRasterTool): string[] {
  if (preference === 'auto') {
    return ['mutool', 'pdftoppm', 'pdftocairo'];
  }
  if (preference === 'mutool') {
    return ['mutool'];
  }
  if (preference === 'pdftoppm') {
    return ['pdftoppm', 'pdftocairo', 'mutool'];
  }
  return ['pdftocairo', 'pdftoppm', 'mutool'];
}

async function tryMutoolPng(
  pdfPath: string,
  outPath: string,
  dpi: number,
  timeoutMs: number,
): Promise<boolean> {
  const bin = whichOnPath('mutool');
  if (!bin) {
    return false;
  }
  const cwd = path.dirname(pdfPath);
  const result = await run(bin, ['draw', '-F', 'png', '-r', String(dpi), '-o', outPath, pdfPath], cwd, timeoutMs);
  return result.exitCode === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
}

async function tryMutoolSvg(
  pdfPath: string,
  outPath: string,
  timeoutMs: number,
): Promise<boolean> {
  const bin = whichOnPath('mutool');
  if (!bin) {
    return false;
  }
  const cwd = path.dirname(pdfPath);
  const result = await run(bin, ['draw', '-F', 'svg', '-o', outPath, pdfPath], cwd, timeoutMs);
  return result.exitCode === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
}

async function tryPdftoppmPng(
  pdfPath: string,
  outPath: string,
  dpi: number,
  timeoutMs: number,
): Promise<boolean> {
  const bin = whichOnPath('pdftoppm');
  if (!bin) {
    return false;
  }
  const cwd = path.dirname(pdfPath);
  const prefix = path.join(cwd, `eqprev-${process.pid}-${Date.now()}`);
  const result = await run(bin, ['-png', '-r', String(dpi), '-singlefile', pdfPath, prefix], cwd, timeoutMs);
  const produced = `${prefix}.png`;
  if (result.exitCode !== 0 || !fs.existsSync(produced)) {
    return false;
  }
  fs.renameSync(produced, outPath);
  return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
}

async function tryPdftocairoPng(
  pdfPath: string,
  outPath: string,
  dpi: number,
  timeoutMs: number,
): Promise<boolean> {
  const bin = whichOnPath('pdftocairo');
  if (!bin) {
    return false;
  }
  const cwd = path.dirname(pdfPath);
  const prefix = outPath.replace(/\.png$/i, '');
  const result = await run(
    bin,
    ['-png', '-r', String(dpi), '-singlefile', pdfPath, prefix],
    cwd,
    timeoutMs,
  );
  const produced = `${prefix}.png`;
  if (result.exitCode !== 0 || !fs.existsSync(produced)) {
    return false;
  }
  if (path.resolve(produced) !== path.resolve(outPath)) {
    fs.renameSync(produced, outPath);
  }
  return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
}

async function tryPdftocairoSvg(
  pdfPath: string,
  outPath: string,
  timeoutMs: number,
): Promise<boolean> {
  const bin = whichOnPath('pdftocairo');
  if (!bin) {
    return false;
  }
  const cwd = path.dirname(pdfPath);
  const prefix = outPath.replace(/\.svg$/i, '');
  const result = await run(bin, ['-svg', pdfPath, prefix], cwd, timeoutMs);
  const produced = `${prefix}.svg`;
  if (result.exitCode !== 0 || !fs.existsSync(produced)) {
    return false;
  }
  if (path.resolve(produced) !== path.resolve(outPath)) {
    fs.renameSync(produced, outPath);
  }
  return fs.existsSync(outPath) && fs.statSync(outPath).size > 0;
}

/**
 * Convert PDF → PNG using mutool, then pdftoppm, then pdftocairo.
 */
export async function rasterPdfToPng(options: {
  pdfPath: string;
  outputPath: string;
  dpi: number;
  rasterTool: EquationRasterTool;
  timeoutMs: number;
}): Promise<RasterResult | RasterError> {
  const order = resolveToolOrder(options.rasterTool);
  const tried: string[] = [];
  for (const tool of order) {
    tried.push(tool);
    try {
      let ok = false;
      if (tool === 'mutool') {
        ok = await tryMutoolPng(options.pdfPath, options.outputPath, options.dpi, options.timeoutMs);
      } else if (tool === 'pdftoppm') {
        ok = await tryPdftoppmPng(options.pdfPath, options.outputPath, options.dpi, options.timeoutMs);
      } else if (tool === 'pdftocairo') {
        ok = await tryPdftocairoPng(options.pdfPath, options.outputPath, options.dpi, options.timeoutMs);
      }
      if (ok) {
        return { kind: 'png', outputPath: options.outputPath, tool };
      }
    } catch {
      // try next
    }
  }
  const available = order.filter((t) => whichOnPath(t));
  if (available.length === 0) {
    return {
      message:
        'No PDF raster tool found (mutool, pdftoppm, or pdftocairo). Install MuPDF or Poppler to show equation hover previews.',
      missingTools: order,
    };
  }
  return {
    message: `PDF raster failed with ${tried.join(', ')}. Check the ConTeXt output channel for details.`,
    missingTools: [],
  };
}

/**
 * Convert PDF → SVG (mutool preferred, then pdftocairo).
 */
export async function rasterPdfToSvg(options: {
  pdfPath: string;
  outputPath: string;
  rasterTool: EquationRasterTool;
  timeoutMs: number;
}): Promise<RasterResult | RasterError> {
  const preferCairo = options.rasterTool === 'pdftocairo' || options.rasterTool === 'pdftoppm';
  const order = preferCairo ? ['pdftocairo', 'mutool'] : ['mutool', 'pdftocairo'];
  const tried: string[] = [];
  for (const tool of order) {
    tried.push(tool);
    try {
      let ok = false;
      if (tool === 'mutool') {
        ok = await tryMutoolSvg(options.pdfPath, options.outputPath, options.timeoutMs);
      } else {
        ok = await tryPdftocairoSvg(options.pdfPath, options.outputPath, options.timeoutMs);
      }
      if (ok) {
        return { kind: 'svg', outputPath: options.outputPath, tool };
      }
    } catch {
      // try next
    }
  }
  const available = order.filter((t) => whichOnPath(t));
  if (available.length === 0) {
    return {
      message:
        'No PDF→SVG tool found (mutool or pdftocairo). Install MuPDF or Poppler to export SVG.',
      missingTools: order,
    };
  }
  return {
    message: `PDF→SVG failed with ${tried.join(', ')}.`,
    missingTools: [],
  };
}

export function isRasterError(value: RasterResult | RasterError): value is RasterError {
  return 'message' in value && !('outputPath' in value);
}
