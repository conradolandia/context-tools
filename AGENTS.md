# Agent guidance (ConTeXt Tools)

Coding-agent notes for this repo. Human contributor setup: [`CONTRIBUTING.md`](CONTRIBUTING.md). End-user docs: [`README.md`](README.md).

`README.md` is for extension users only (install, features, settings, troubleshooting). Put F5 / vsce / packaging in CONTRIBUTING. Put architecture, invariants, and edit caution here. Do not grow the README with agent or LLM-oriented guidance. Do not put Marketplace / Open VSX publish runbooks in CONTRIBUTING; those live in the workflow files under `.github/workflows/` only.

If you push both to Cursor / Origin and to public GitHub, keep remotes distinct (`origin` vs `upstream`). Use `$HOME/context`, `/opt/context`, or `$CONTEXT_ROOT` in docs and examples — not personal machine paths.

## Architecture map

```text
src/extension.ts              Activation wiring (commands live under src/extension/)
src/extension/                Root / PDF / SyncTeX command modules + shared state
src/toolchain/                Discover context/mtxrun from context.root / PATH
src/build/                    Spawn build, queue, log parse, diagnostics, PDF gate
src/viewer/                   PDF webview panel, range server, PDF.js worker
src/synctex/                  mtxrun synctex CLI, box parse, coordinate mapping
src/lsp/                      DigestiF launch, client, env (DIGESTIF_TEXMF)
src/project/                  Root file, structure scan, path resolve, Project TreeView
src/outline/                  Document structure (stock head scan + optional DigestiF title enrich)
src/projectManager/           New Project Structure wizard
src/links/                    Document links + figure hover
src/folding/                  \start…/\stop… folding + mismatch diagnostics
src/syntax/                   Refresh keywords command
src/compat/                   Overlapping-extension conflict soft-warn (manual disable only)
media/viewer/                 Webview HTML/JS/CSS (PDF.js)
syntaxes/                     TextMate grammar + keyword snapshot
scripts/                      generate-context-keywords, digestif handshake
```

Build path: `buildController` → `spawnContextBuild` → artifact gate → viewer reload. SyncTeX uses the last gated PDF + `.synctex` pair. DigestiF starts fire-and-forget on activate; build / Document structure never await it.

## Invariants

1. **stdin ignore on `context` / `mtxrun` spawn.** Always `stdio: ['ignore', 'pipe', 'pipe']` (`src/build/spawnContext.ts`, `runMtx` in `src/synctex/mtxSynctex.ts`). An open stdin pipe can hang LuaMetaTeX. POSIX builds also use `detached: true` so cancel can signal the process group (`context` + `luametatex`).
2. **DigestiF must not block build or Document structure.** Launch is async; failures log to the DigestiF channel. Build / preview / SyncTeX / outline scan proceed regardless. DigestiF titles are optional enrichment only.
3. **Language id `context` for DigestiF ConTeXt mode.** DigestiF maps `tex`/`latex` → LaTeX tags.
4. **Do not claim `*.tex` globally** in `contributes.languages`. Offer workspace `files.associations` via the existing prompt only.
5. **Extension conflict: soft-warn only.** Detect overlapping language / file-extension / grammar contributions; list them for manual disable. Never disable other extensions from code. Skip the modal in `ExtensionMode.Development`.
6. **No user PII in docs or examples.** Prefer `$CONTEXT_ROOT`, `$HOME/context`, `/opt/context`, or OS temp dirs.
7. **GPL-2.0-only.** Keep [`NOTICE`](NOTICE) accurate when regenerating keywords.

## Checks

```bash
npm run lint && npm test
```

Relevant unit areas: `buildDigestifIsolation`, `extensionConflict`, `digestif*`, `mtxSynctex`, `projectModel`, `headScan`, `outlineAggregate`, `parseLog`, grammar fixtures under `src/test/grammar/`. Optional: `CONTEXT_ROOT=… npm run handshake:context`.

## Caution

| Area | Caution |
| --- | --- |
| `src/build/spawnContext.ts` stdio | Keep stdin `'ignore'`; POSIX `detached` for cancel group kill |
| DigestiF vs build queue | No await of DigestiF from build/preview/SyncTeX |
| `package.json` languages / grammars | Language id `context`; no global `*.tex` |
| `src/compat/extensionConflict*` | Soft-warn + manual disable only; no auto-disable |
| `syntaxes/context-keywords.json` | Regenerate via `npm run generate:keywords` |
| `media/viewer/` | Easy to regress large-PDF first-page latency |

Tree-sitter remains on hold; TextMate is the shipped highlighter. Prefer minimal diffs that match existing TypeScript style in `src/`. There is no in-repo `plans/` tree; longer design notes may live in the Cursor Project store outside git.
