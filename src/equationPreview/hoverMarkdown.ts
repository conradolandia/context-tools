import * as vscode from 'vscode';
import { constrainHoverImageSize } from '../links/figureHoverMarkdown';
import { escapeHtmlAttr } from '../links/figureHoverMarkdown';
import { readImageSize } from '../links/imageSize';

export const SAVE_PDF_COMMAND = 'context.equationPreview.savePdf';
export const SAVE_SVG_COMMAND = 'context.equationPreview.saveSvg';
export const SAVE_PNG_COMMAND = 'context.equationPreview.savePng';

function commandUri(command: string, args: unknown[]): string {
  return `command:${command}?${encodeURIComponent(JSON.stringify(args))}`;
}

/**
 * Trusted MarkdownString: clamped PNG preview + Save PDF / SVG / PNG command links.
 */
export function buildEquationHoverMarkdown(options: {
  imagePath: string;
  cacheKey: string;
  maxWidth: number;
  maxHeight: number;
  statusLine?: string;
}): vscode.MarkdownString {
  const uri = vscode.Uri.file(options.imagePath);
  const natural = readImageSize(options.imagePath);
  const size = natural
    ? constrainHoverImageSize(natural.width, natural.height, options.maxWidth, options.maxHeight)
    : { width: options.maxWidth, height: Math.round((options.maxWidth * 3) / 4) };

  const img =
    `<img src="${escapeHtmlAttr(uri.toString())}" alt="equation preview" ` +
    `width="${size.width}" height="${size.height}" ` +
    `style="max-width:${options.maxWidth}px;max-height:${options.maxHeight}px;` +
    `width:auto;height:auto;object-fit:contain;" />`;

  const pdfLink = `[Save PDF](${commandUri(SAVE_PDF_COMMAND, [options.cacheKey])})`;
  const svgLink = `[Save SVG](${commandUri(SAVE_SVG_COMMAND, [options.cacheKey])})`;
  const pngLink = `[Save PNG](${commandUri(SAVE_PNG_COMMAND, [options.cacheKey])})`;

  const lines = [
    img,
    '',
    `${pdfLink} · ${svgLink} · ${pngLink}`,
  ];
  if (options.statusLine) {
    lines.push('', options.statusLine);
  }

  const md = new vscode.MarkdownString(lines.join('\n'));
  md.isTrusted = {
    enabledCommands: [SAVE_PDF_COMMAND, SAVE_SVG_COMMAND, SAVE_PNG_COMMAND],
  };
  md.supportHtml = true;
  return md;
}

export function buildEquationHoverMessage(message: string): vscode.MarkdownString {
  const md = new vscode.MarkdownString(message);
  md.isTrusted = false;
  return md;
}
