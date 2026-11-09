# ConTeXt Tools

VS Code / Cursor extension for ConTeXt (LMTX): SyncTeX PDF preview, equation hover preview, DigestiF language server, Project view, Document structure outline, project-structure scaffolding, TextMate grammar, and snippets for the `context` language.

**License:** GNU GPL version 2 only (`GPL-2.0-only`). See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE). Keyword lists are derived from ConTeXt SciTE data (same GPL-2 regime).

## Requirements

- VS Code or Cursor
- LMTX / ConTeXt Standalone for build, SyncTeX, and equation hover preview
- MuPDF (`mutool`) or Poppler (`pdftoppm` / `pdftocairo`) for equation hover rasterization
- DigestiF (optional) for completion, command hover, and Explorer Outline enrichment

## Install

**Marketplace / Open VSX.** Search the Extensions view for **ConTeXt Tools** (id `AndresConradoMontoya.context-tools`) once the listing is live. The VS Code Marketplace and Open VSX (Cursor, VSCodium) get the same build.

**VSIX.** Download one from the [repository](https://github.com/conradolandia/context-lab) release assets, or build it:

```bash
npm install && npm run compile && npx @vscode/vsce package
```

Then **Extensions: Install from VSIX…** and pick the `.vsix`.

**First run.** Set `context.root` if `context` / `mtxrun` are not on `PATH` (see [Settings](#settings)), open a ConTeXt source, and run **ConTeXt: Build and Preview**.

## Settings

`context.root` is the ConTeXt installation root (parent of `tex/`). Binaries are under `$CONTEXT_ROOT/tex/texmf-<platform>/bin/` (`context`, `mtxrun`, `luametatex`, …). See [wiki Structure](https://wiki.contextgarden.net/ConTeXt_Standalone/Structure).

```text
$CONTEXT_ROOT/                 ← context.root
  tex/
    texmf-<platform>/bin/      ← context, mtxrun, …
    texmf-context/…            ← formats, data, SciTE tables
```

Resolution: absolute `context.contextPath` / `context.mtxrunPath` overrides, then binaries under `context.root`, then `context` / `mtxrun` on `PATH` (install root inferred by walking parents until `tex/texmf-context` exists). Empty `context.root` is fine when PATH already points into a normal Standalone / LMTX tree.

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
| `context.documentOutline.digestifEnrichment` | `true` | Prefer DigestiF titles when DigestiF is running (scan still works without it) |
| `context.build.args` | `[]` | Extra args after `--synctex=repeat` (not the primary `--mode` switch) |
| `context.build.modes` | `[]` | Catalog of mode names for **Select Build Modes** (workspace) |
| `context.build.activeModes` | `[]` | Enabled modes → inject `--mode=a,b` (workspace; overrides `--mode` in `build.args` with a warning) |
| `context.build.onSave` | `false` | Save starts a build; rapid saves coalesce |
| `context.synctex.enabled` | `true` | Toggle SyncTeX |
| `context.viewer.openExistingOnActivate` | `false` | Open existing root PDF+SyncTeX on activate (no rebuild). Default off; use **Show PDF** or Explorer menu |
| `context.debugOutput` | `false` | Verbose traces on **ConTeXt debug** (viewer, gate, SyncTeX dumps) |
| `context.digestif.enabled` | `true` | Start DigestiF LSP |
| `context.digestifPath` | `""` | Absolute DigestiF binary; empty = PATH / luarocks |
| `context.texAssociation.dontAsk` | `false` | Never prompt to associate `*.tex` with `context` (also set by the prompt's **Don't ask again**) |
| `context.extensionConflict.dontAsk` | `false` | Never warn about other extensions overlapping ConTeXt language id / `.mkiv`… associations (also set by the warning's **Don't show again**) |
| `context.equationPreview.enabled` | `true` | Hover preview for math under the cursor |
| `context.equationPreview.environment` | `""` | Preamble for the preview job (User or Workspace; not inferred from Project) |
| `context.equationPreview.format` | `"png"` | Preferred format (`png` \| `svg`); hover display uses PNG |
| `context.equationPreview.maxWidth` | `512` | Max hover image width (px) |
| `context.equationPreview.maxHeight` | `512` | Max hover image height (px) |
| `context.equationPreview.timeoutMs` | `15000` | Timeout for the temporary `context --once` job |
| `context.equationPreview.debounceMs` | `400` | Delay before starting a preview job |
| `context.equationPreview.rasterTool` | `"auto"` | `auto` \| `mutool` \| `pdftoppm` \| `pdftocairo` |
| `context.equationPreview.rasterDpi` | `150` | DPI for PNG raster of the TEXpage PDF |

```json
{
  "context.root": "/opt/context"
}
```

Home installs are often `$HOME/context`.

### Equation hover preview

Hover over `\startformula`…`\stopformula` (and other `\start…formula` blocks), `$…$` / `$$…$$`, or a non-empty selection that contains the cursor. The extension runs a temporary `\startTEXpage` job with `context --once --batch --noconsole` (separate from the document build queue), rasters the PDF, and shows a clamped image in the hover. Links in the hover open a save dialog for PDF, SVG, or PNG at natural size.

`context.equationPreview.environment` is the only preamble: put `\environment…`, typescripts, macros, and setups there by hand. Use **User** settings for a personal default and **Workspace** settings per project (Workspace wins). Empty means stock ConTeXt math only; nothing is read from Project / root / auto `\environment`.

Needs LMTX (`context`) plus MuPDF or Poppler on `PATH` (or reachable via `context.root`). Missing raster tools produce an explicit hover message.

### Main (root) file

First match wins:

1. `context.rootFile`
2. Magic comment in the first ~20 lines: `% !TEX root = <path>`
3. Structure: active `\startcomponent` → nearby `\product <name>` → `<name>.tex`
4. Active file

Status bar shows `ConTeXt: <rootname>` (click to set or clear). Build / Show PDF use the resolved root’s PDF and synctex; Forward SyncTeX still uses the **active** file and line.

## Commands and SyncTeX

| Action | Command / binding |
| --- | --- |
| Build then open/refresh viewer | **ConTeXt: Build and Preview** |
| Cancel a running build | **ConTeXt: Cancel Build** (also: click the build status bar while running) |
| Select ConTeXt `--mode` flags | **ConTeXt: Select Build Modes** (`context.selectBuildModes`; also: click the Modes status bar) |
| Show last gated PDF (no rebuild) | **ConTeXt: Show PDF** (also editor context on ConTeXt/TeX); Explorer → **Open in ConTeXt PDF Viewer** on a job `.pdf` (sibling `.synctex` or active root output) |
| Forward SyncTeX (source → PDF) | **ConTeXt: Forward SyncTeX** — `Ctrl+Alt+J` (macOS: `Cmd+Alt+J`) |
| Backward SyncTeX (PDF → source) | **Ctrl+click** (macOS: **Cmd+click**) in the PDF webview |
| Follow PDF links | Plain click on a link in the PDF webview (internal dest or external URL). Ctrl/Cmd+click stays SyncTeX |
| Zoom PDF | Toolbar **+/-** / **Fit**, editable `%`, **Ctrl/Cmd+wheel** (pointer-anchored) |
| Refresh TextMate keywords from LMTX | **ConTeXt: Refresh command keywords** (then reload the window) |

Build uses `context --synctex=repeat`, then `context.build.args`, then `--mode=a,b` when `context.build.activeModes` is non-empty. Prefer **Select Build Modes** (or the Modes status bar) over putting `--mode` in `build.args`; if both are set, active modes win and the build logs a warning. Clearing the multi-select removes the `--mode` flag. The viewer keeps the last good PDF while a build runs, then reloads after a stability gate and preserves the current scroll position and zoom (it does not replay the last Forward SyncTeX jump).

SyncTeX marks text, not pure image areas; clicks on figures with no text usually show a short toast. Caption clicks can still resolve coarsely on ConTeXt before the start/stop float SyncTeX wrap, and with one-shot `\placefigure`; that is not the default expectation on current LMTX. When Forward SyncTeX lands in a thin header/footer band, it prefers a same-line (then nearby-line) box outside that band closest to the mtx hit; it does not paint an unreplaced edge-band box or a page-sized vbox.

## DigestiF

Optional. DigestiF never blocks build, preview, SyncTeX, or Document structure. Logs go to the **ConTeXt DigestiF** output channel; build logs stay on **ConTeXt**. Set `context.debugOutput` to send viewer / gate / SyncTeX internal traces to **ConTeXt debug**.

Language id **`context`** (aliases: ConTeXt) covers `.mkiv`, `.mkxl`, `.mkvi`, `.mklx`, `.mkii`. The extension does not claim `*.tex` globally. DigestiF maps `context` → ConTeXt tags and `tex` / `latex` → LaTeX. For `.tex` ConTeXt sources, associate them:

```json
"files.associations": {
  "*.tex": "context"
}
```

Install DigestiF via LuaRocks (`lpeg` / `lfs` required), put it on `PATH`, or set `context.digestifPath`. Launch order: `context.digestifPath` → `~/.luarocks/bin/digestif` → `digestif` on PATH.

## Project view

Activity bar **ConTeXt** → **Project**. Scans English structure commands (`\project`, `\product`, `\component`, `\environment`, `\usepath`, optional `\input`). `\usemodule` and `\externalfigure` stay on document links only. This view is the file/role graph, not sectioning.

| Node | Build |
| --- | --- |
| product / document | yes |
| component | yes (via root resolution) |
| environment | no |
| project | refused (offers first listed product if any) |

Click a node to open. Actions: Build, Forward SyncTeX, Set as Main (Root) File. Title bar: **New Project Structure…**, **Reveal Active**, **Refresh**. Focusing a `.tex` file does not switch to this view; use **Reveal Active** when you want that.

## Document structure

Activity bar **ConTeXt** → **Document structure**. Sectioning outline (`part` → `chapter` → `section` → …) for the **active compile unit** (resolved root product, or a single-file document). Primary source is an extension-owned scan of stock `\startchapter` / `\startsection` / … (and short forms `\chapter`, `\section`, …). DigestiF is not required; when DigestiF is running and `context.documentOutline.digestifEnrichment` is on, matching titles may be replaced with DigestiF names. Environments are skipped. Click a head to open at its line. Title bar: **Refresh**.

Explorer **Outline** uses the same scan via a `DocumentSymbolProvider` when DigestiF is not running; when DigestiF is up, DigestiF owns Explorer Outline (names still normalized by ConTeXt Tools middleware).

## Project structure wizard

**ConTeXt: New Project Structure…** scaffolds the simplest structure that matches the job (wiki *Project and file management* §1): single document; document + environment; product + components; or project tier (several products — compile each product, not the `\startproject` file).

After create: writes `.context/structure.json` (tier, optional `layout`, optional `documentStub` / `documentMetadata`, compile root), opens the compile root, sets `context.rootFile` when enabled, refreshes the Project view, and may offer `files.associations["*.tex"] = "context"`. Scaffolds use `.tex` only and do not insert `% !TEX root`.

On the names step (tiers other than single), **Directory layout** is **Flat** (default, wiki §4/§5) or **By role** (`environments/`, product `.tex` at scaffold root or product folders at series root, `components/` with `\usepath`). Absent `layout` means flat; upgrade preserves it.

For **product** and **project** tiers, an optional checkbox includes a `\startdocument` metadata stub in each product file (components stay between `\startdocument` / `\stopdocument`). Metadata is entered as `key=value` lines. Off by default; hidden for `single` / `env-doc` (those already use `\startdocument`).

**ConTeXt: Upgrade Project Structure…** moves a scaffold one rung up when `.context/structure.json` is present.

## Snippets

Built-in snippets for language id **`context`**: structure stubs (`startproduct`, `startcomponent`, …), sectioning (`startdocument`, `startchapter`, …), and common environments (`startitemize`, `startplaceformula`, `starttyping`, …). Each trigger is registered with and without a leading `\`, so accepting after typing `\` does not leave a doubled backslash. Environment-like `\start…` snippets insert a matching `\stop…` with the cursor between them. Load commands (`component`, `environment`) stay one-liners. They appear only when the editor language is `context`.

User/workspace snippets: **Snippets: Configure User Snippets** → **context**, or `.vscode/<name>.code-snippets` with `"scope": "context"`.

## Syntax highlighting

TextMate grammar colors known ConTeXt names from a committed SciTE keyword snapshot. After an LMTX upgrade, run **ConTeXt: Refresh command keywords** and reload, or regenerate from the command line (see [`CONTRIBUTING.md`](CONTRIBUTING.md)). Folding matches `\start<name>` / `\stop<name>` pairs. Build diagnostics appear in the Problems panel.

## Overlapping extensions

Other extensions that contribute language id `context`, a grammar for that id, or the same ConTeXt filename extensions (`.mkiv`, `.mkxl`, `.mkvi`, `.mklx`, `.mkii`) can override ConTeXt Tools’ grammar or editor features. On activate (and when opening a ConTeXt-like document), ConTeXt Tools lists those extensions once and asks you to disable them manually in the Extensions view. It never disables other extensions itself. Use **Don't show again** or `context.extensionConflict.dontAsk` to suppress the prompt.

## Develop

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Coding agents: [`AGENTS.md`](AGENTS.md).
