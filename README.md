# ConTeXt Tools

VS Code / Cursor extension for ConTeXt (LMTX). It builds your document, shows the PDF with SyncTeX, and adds Project / Document structure views, equation hover preview, optional DigestiF language support, TextMate highlighting, and snippets for the `context` language.

**License:** GNU GPL version 2 only (`GPL-2.0-only`). See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Keyword lists are derived from ConTeXt SciTE data (same GPL-2 regime).

## Requirements

- VS Code or Cursor
- [LMTX / ConTeXt Standalone](https://wiki.contextgarden.net/ConTeXt_Standalone) for build, SyncTeX, and equation hover preview
- MuPDF (`mutool`) or Poppler (`pdftoppm` / `pdftocairo`) for equation hover rasterization
- DigestiF (optional) for completion, command hover, and Explorer Outline enrichment

## Install

**Marketplace / Open VSX.** Search the Extensions view for **ConTeXt Tools** (id `AndresConradoMontoya.context-tools`) once the listing is live. The same extension id is intended for the VS Code Marketplace and Open VSX (Cursor, VSCodium).

**VSIX.** Download a `.vsix` from the [GitHub releases](https://github.com/conradolandia/context-tools/releases) page when available, then use **Extensions: Install from VSIX…**. To build a VSIX from source, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## First run

1. Install LMTX so `context` and `mtxrun` are on your `PATH`, or set `context.root` to the ConTeXt installation root (parent of `tex/`). See [Settings](#settings).
2. Open a ConTeXt source file (`.mkiv`, `.mkxl`, …, or a `.tex` file associated with language id `context`).
3. Run **ConTeXt: Build and Preview** from the Command Palette.

Status bar items show the resolved main (root) file and optional build modes. Build output goes to the **ConTeXt** channel; DigestiF (if used) logs to **ConTeXt DigestiF**.

## Features

### Build and preview

**ConTeXt: Build and Preview** runs `context --synctex=repeat` on the resolved root file, then opens or refreshes the built-in PDF viewer. **ConTeXt: Cancel Build** stops a running job (you can also click the build status bar item while it runs).

Use **ConTeXt: Select Build Modes** (or the Modes status bar item) to choose ConTeXt `--mode` flags from `context.build.modes`. Enabled modes are stored in `context.build.activeModes` and inject `--mode=a,b`. Prefer that over putting `--mode` in `context.build.args`; if both are set, active modes win and the build log warns.

**ConTeXt: Show PDF** opens the last gated PDF without rebuilding. In Explorer, **Open in ConTeXt PDF Viewer** on a job `.pdf` uses a sibling `.synctex` or the active root output when present.

Optional `context.build.onSave` starts a build on save; rapid saves coalesce. While a build runs, the viewer keeps the last good PDF, then reloads after a short stability check and preserves scroll and zoom.

### SyncTeX and PDF viewer

| Action | How |
| --- | --- |
| Forward SyncTeX (source → PDF) | **ConTeXt: Forward SyncTeX** — `Ctrl+Alt+J` (macOS: `Cmd+Alt+J`) |
| Backward SyncTeX (PDF → source) | **Ctrl+click** (macOS: **Cmd+click**) in the PDF |
| Follow PDF links | Plain click (internal dest or external URL). Ctrl/Cmd+click stays SyncTeX |
| Zoom | Toolbar **+/-** / **Fit**, editable `%`, or **Ctrl/Cmd+wheel** |

SyncTeX marks text, not pure image areas; clicks on figures with no text usually show a short toast. Caption and float resolution depend on how ConTeXt wrote the `.synctex` for that job. Turn SyncTeX off with `context.synctex.enabled`.

### Project view

Activity bar **ConTeXt** → **Project**. Shows the file/role graph from English structure commands (`\project`, `\product`, `\component`, `\environment`, `\usepath`, optional `\input`). This is not the sectioning outline.

| Node | Build |
| --- | --- |
| product / document | yes |
| component | yes (via root resolution) |
| environment | no |
| project | refused (offers the first listed product if any) |

Click a node to open. Context actions: Build, Forward SyncTeX, Set as Main (Root) File. Title bar: **New Project Structure…**, **Reveal Active**, **Refresh**.

### Document structure

Activity bar **ConTeXt** → **Document structure**. Sectioning outline (`part` → `chapter` → `section` → …) for the active compile unit (resolved root product, or a single-file document). The outline comes from an extension-owned scan of stock heads (`\startchapter`, `\section`, …). DigestiF is not required; when DigestiF is running and enrichment is on, matching titles may use DigestiF names. Click a head to jump to its line.

Explorer **Outline** uses the same scan when DigestiF is not running; when DigestiF is up, DigestiF owns Explorer Outline (names still normalized by ConTeXt Tools).

### Equation hover preview

Hover over `\startformula`…`\stopformula` (and other `\start…formula` blocks), `$…$` / `$$…$$`, or a non-empty selection that contains the cursor. The extension runs a temporary `\startTEXpage` job (separate from the document build), rasters the PDF, and shows a clamped image. Hover links open a save dialog for PDF, SVG, or PNG at natural size.

Set `context.equationPreview.environment` to the preamble you need (`\environment…`, typescripts, macros). Use **User** settings for a personal default and **Workspace** settings per project (Workspace wins). Empty means stock ConTeXt math only; nothing is inferred from Project / root / auto `\environment`.

Needs LMTX plus MuPDF or Poppler on `PATH` (or reachable via `context.root`). Missing raster tools produce an explicit hover message. DigestiF is not used for equation preview.

### DigestiF (optional)

DigestiF provides completion, command hover, and related LSP features. It never blocks build, preview, SyncTeX, or Document structure. Failures log to **ConTeXt DigestiF** only.

Language id **`context`** (aliases: ConTeXt) covers `.mkiv`, `.mkxl`, `.mkvi`, `.mklx`, `.mkii`. The extension does not claim `*.tex` globally. DigestiF maps `context` → ConTeXt tags and `tex` / `latex` → LaTeX. For `.tex` ConTeXt sources, associate them:

```json
"files.associations": {
  "*.tex": "context"
}
```

Install DigestiF via LuaRocks (`lpeg` / `lfs` required), put it on `PATH`, or set `context.digestifPath`. Resolution order: `context.digestifPath` → `~/.luarocks/bin/digestif` → `digestif` on PATH.

### Project structure wizard

**ConTeXt: New Project Structure…** scaffolds a minimal layout for the job: single document; document + environment; product + components; or project tier (several products — compile each product, not the `\startproject` file).

After create, the wizard writes `.context/structure.json`, opens the compile root, optionally sets `context.rootFile`, refreshes the Project view, and may offer `files.associations["*.tex"] = "context"`. Scaffolds use `.tex` only.

On the names step (tiers other than single), **Directory layout** is **Flat** (default) or **By role** (`environments/`, products at scaffold or series root, `components/` with `\usepath`). For **product** and **project** tiers, an optional checkbox adds a `\startdocument` metadata stub in each product file.

**ConTeXt: Upgrade Project Structure…** moves a scaffold one rung up when `.context/structure.json` is present.

### Snippets and syntax

Built-in snippets for language id **`context`**: structure stubs, sectioning, and common environments. Triggers work with or without a leading `\`. Environment-like `\start…` snippets insert a matching `\stop…`. They appear only when the editor language is `context`. Add your own via **Snippets: Configure User Snippets** → **context**, or a `.vscode/*.code-snippets` file with `"scope": "context"`.

TextMate grammar colors known ConTeXt names from a SciTE keyword snapshot. After an LMTX upgrade, run **ConTeXt: Refresh command keywords** and reload the window. Folding matches `\start<name>` / `\stop<name>` pairs. Build diagnostics appear in the Problems panel.

## Settings

`context.root` is the ConTeXt installation root (parent of `tex/`). Binaries live under `$CONTEXT_ROOT/tex/texmf-<platform>/bin/`. See [wiki Structure](https://wiki.contextgarden.net/ConTeXt_Standalone/Structure).

```text
$CONTEXT_ROOT/                 ← context.root
  tex/
    texmf-<platform>/bin/      ← context, mtxrun, …
    texmf-context/…            ← formats, data, SciTE tables
```

Resolution order: absolute `context.contextPath` / `context.mtxrunPath`, then binaries under `context.root`, then `context` / `mtxrun` on `PATH` (install root inferred by walking parents until `tex/texmf-context` exists). Empty `context.root` is fine when PATH already points into a normal Standalone / LMTX tree. Home installs are often `$HOME/context`; system installs often `/opt/context`.

```json
{
  "context.root": "/opt/context"
}
```

| Setting | Default | Notes |
| --- | --- | --- |
| `context.root` | `""` | ConTeXt installation root (parent of `tex/`) |
| `context.contextPath` | `""` | Absolute `context` binary |
| `context.mtxrunPath` | `""` | Absolute `mtxrun` binary |
| `context.rootFile` | `""` | Main file to compile; empty = auto-detect |
| `context.projectManager.defaultExtension` | `".tex"` | Scaffold extension (`.tex` only) |
| `context.projectManager.usePrefixedNames` | `false` | `product_*` / `component_*` prefixes when true |
| `context.projectManager.setRootFileOnCreate` | `true` | Set `context.rootFile` after create |
| `context.projectView.enabled` | `true` | ConTeXt activity-bar Project TreeView |
| `context.projectView.includeInputs` | `false` | Show `\input` children under products |
| `context.projectView.maxFiles` | `500` | Cap on files visited while expanding the graph |
| `context.projectView.refreshDebounceMs` | `300` | Debounce before rescan after edits/saves |
| `context.documentOutline.enabled` | `true` | ConTeXt activity-bar Document structure TreeView |
| `context.documentOutline.refreshDebounceMs` | `300` | Debounce before rescan of sectioning outline |
| `context.documentOutline.digestifEnrichment` | `true` | Prefer DigestiF titles when DigestiF is running |
| `context.build.args` | `[]` | Extra args after `--synctex=repeat` (not the primary `--mode` switch) |
| `context.build.modes` | `[]` | Catalog of mode names for **Select Build Modes** (workspace) |
| `context.build.activeModes` | `[]` | Enabled modes → inject `--mode=a,b` (workspace) |
| `context.build.onSave` | `false` | Save starts a build; rapid saves coalesce |
| `context.synctex.enabled` | `true` | Toggle SyncTeX |
| `context.viewer.openExistingOnActivate` | `false` | Open existing root PDF+SyncTeX on activate (no rebuild) |
| `context.debugOutput` | `false` | Verbose traces on **ConTeXt debug** |
| `context.digestif.enabled` | `true` | Start DigestiF LSP |
| `context.digestifPath` | `""` | Absolute DigestiF binary; empty = PATH / luarocks |
| `context.texAssociation.dontAsk` | `false` | Never prompt to associate `*.tex` with `context` |
| `context.extensionConflict.dontAsk` | `false` | Never warn about overlapping ConTeXt extensions |
| `context.equationPreview.enabled` | `true` | Hover preview for math under the cursor |
| `context.equationPreview.environment` | `""` | Preamble for the preview job (User or Workspace) |
| `context.equationPreview.format` | `"png"` | Preferred format (`png` \| `svg`); hover display uses PNG |
| `context.equationPreview.maxWidth` | `512` | Max hover image width (px) |
| `context.equationPreview.maxHeight` | `512` | Max hover image height (px) |
| `context.equationPreview.timeoutMs` | `15000` | Timeout for the temporary `context --once` job |
| `context.equationPreview.debounceMs` | `400` | Delay before starting a preview job |
| `context.equationPreview.rasterTool` | `"auto"` | `auto` \| `mutool` \| `pdftoppm` \| `pdftocairo` |
| `context.equationPreview.rasterDpi` | `150` | DPI for PNG raster of the TEXpage PDF |

### Main (root) file

First match wins:

1. `context.rootFile`
2. Magic comment in the first ~20 lines: `% !TEX root = <path>`
3. Structure: active `\startcomponent` → nearby `\product <name>` → `<name>.tex`
4. Active file

Status bar shows `ConTeXt: <rootname>` (click to set or clear). Build / Show PDF use the resolved root’s PDF and synctex; Forward SyncTeX still uses the **active** file and line.

## Overlapping extensions

Other extensions that contribute language id `context`, a grammar for that id, or the same ConTeXt filename extensions (`.mkiv`, `.mkxl`, `.mkvi`, `.mklx`, `.mkii`) can override ConTeXt Tools’ grammar or editor features. On activate (and when opening a ConTeXt-like document), ConTeXt Tools lists those extensions once and asks you to disable them manually in the Extensions view. It never disables other extensions itself. Use **Don't show again** or `context.extensionConflict.dontAsk` to suppress the prompt.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| Build cannot find `context` / `mtxrun` | Set `context.root`, or put the LMTX `bin` directory on `PATH`. Confirm with a terminal `context --version`. |
| PDF does not appear after build | Open the **ConTeXt** output channel for the job log. Confirm the root file and that a `.pdf` was written next to it. Try **Show PDF** after a successful build. |
| SyncTeX does nothing | Confirm `context.synctex.enabled`, that a sibling `.synctex` exists for the gated PDF, and that you Ctrl/Cmd+click text (not empty figure areas). |
| Equation hover fails | Needs LMTX plus `mutool` or Poppler. Read the hover message; set `context.equationPreview.rasterTool` if auto-detect is wrong. |
| No completion / DigestiF idle | DigestiF is optional. Check **ConTeXt DigestiF**, `context.digestif.enabled`, and `context.digestifPath` / PATH. Language id must be `context` (not `latex`) for ConTeXt tags. |
| `.tex` files treated as LaTeX | Set `files.associations` for `*.tex` → `context`, or accept the association prompt when offered. |
| Highlighting looks wrong / another ConTeXt extension wins | See [Overlapping extensions](#overlapping-extensions); disable the other extension manually. |
| Need more internal detail | Set `context.debugOutput` and read **ConTeXt debug**. |

## Contributing

Developer setup, packaging, and Marketplace publish notes: [`CONTRIBUTING.md`](CONTRIBUTING.md). Coding-agent notes: [`AGENTS.md`](AGENTS.md).
