import * as vscode from 'vscode';

export type EquationPreviewFormat = 'png' | 'svg';
export type EquationRasterTool = 'auto' | 'mutool' | 'pdftoppm' | 'pdftocairo';

export interface EquationPreviewSettings {
  enabled: boolean;
  environment: string;
  format: EquationPreviewFormat;
  maxWidth: number;
  maxHeight: number;
  timeoutMs: number;
  debounceMs: number;
  rasterTool: EquationRasterTool;
  rasterDpi: number;
}

const DEFAULTS: EquationPreviewSettings = {
  enabled: true,
  environment: '',
  format: 'png',
  maxWidth: 512,
  maxHeight: 512,
  timeoutMs: 15000,
  debounceMs: 400,
  rasterTool: 'auto',
  rasterDpi: 150,
};

function clampPositiveInt(value: unknown, fallback: number, min = 1, max = 4096): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function readEquationPreviewSettings(
  cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('context'),
): EquationPreviewSettings {
  const formatRaw = cfg.get<string>('equationPreview.format', DEFAULTS.format);
  const format: EquationPreviewFormat = formatRaw === 'svg' ? 'svg' : 'png';

  const toolRaw = cfg.get<string>('equationPreview.rasterTool', DEFAULTS.rasterTool);
  const rasterTool: EquationRasterTool =
    toolRaw === 'mutool' || toolRaw === 'pdftoppm' || toolRaw === 'pdftocairo'
      ? toolRaw
      : 'auto';

  const environment = cfg.get<string>('equationPreview.environment', DEFAULTS.environment);
  return {
    enabled: cfg.get<boolean>('equationPreview.enabled', DEFAULTS.enabled) !== false,
    environment: typeof environment === 'string' ? environment : '',
    format,
    maxWidth: clampPositiveInt(cfg.get('equationPreview.maxWidth'), DEFAULTS.maxWidth, 32, 2048),
    maxHeight: clampPositiveInt(cfg.get('equationPreview.maxHeight'), DEFAULTS.maxHeight, 32, 2048),
    timeoutMs: clampPositiveInt(cfg.get('equationPreview.timeoutMs'), DEFAULTS.timeoutMs, 1000, 120000),
    debounceMs: clampPositiveInt(cfg.get('equationPreview.debounceMs'), DEFAULTS.debounceMs, 0, 5000),
    rasterTool,
    rasterDpi: clampPositiveInt(cfg.get('equationPreview.rasterDpi'), DEFAULTS.rasterDpi, 36, 600),
  };
}
