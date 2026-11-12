# Contributing to ConTeXt Tools

Developer workflow for humans changing this repository.

- **End users** (install, features, settings, troubleshooting): [`README.md`](README.md)
- **Coding agents** (architecture map, invariants, caution): [`AGENTS.md`](AGENTS.md)

Keep those roles separate. Do not put F5 / vsce / packaging / architecture / agent invariants in the README. Do not duplicate the README’s user guide here.

## Setup

```bash
git clone <repository-url>
cd context-tools   # or your local checkout name
npm install
```

## Build, lint, test

```bash
npm run compile          # esbuild → dist/
npm run lint             # tsc --noEmit
npm test                 # compile + unit + grammar tests
npm run test:grammar     # TextMate fixtures only
npm run watch            # rebuild on change
```

Unit and grammar tests do not need a ConTeXt install. Optional DigestiF handshake:

```bash
CONTEXT_ROOT=$HOME/context npm run handshake:context
```

## Extension Development Host (F5)

Open this folder → `npm install && npm run compile` → **F5** (**Run Extension**). DigestiF start failure must not block Build and Preview.

## Package a VSIX

```bash
npm run compile
npx @vscode/vsce package
```

Output is a `.vsix` in the repo root (do not commit it).

`npm run smoke:vsix` packages to a temp dir and fails unless the VSIX contains `dist/extension.js`, `media/viewer/pdfjs/`, `LICENSE`, and `NOTICE` (`-- --vsix <file>` checks an existing package; needs Node 22+ for vsce 4).

## Refresh command keywords

```bash
CONTEXT_ROOT=$HOME/context npm run generate:keywords
```

Or **ConTeXt: Refresh command keywords** in the editor, then reload. Commit `syntaxes/context-keywords.json` and any regenerated rules in `syntaxes/context.tmLanguage.json`. See [`NOTICE`](NOTICE).

After an intentional grammar change, update snapshots:

```bash
npx vscode-tmgrammar-snap -u \
  -g src/test/grammar/stubs/lua.tmLanguage.json \
  -g src/test/grammar/stubs/xml.tmLanguage.json \
  "src/test/grammar/snap/*.mkiv"
```

## Pull requests

- Target `main`; keep scope focused.
- Run `npm run lint` and `npm test` before review.
- Language id stays `context`; do not claim `*.tex` globally.
- Overlapping extensions (language id / ConTeXt file extensions): soft-warn only; never disable other extensions from code.
- License: GPL-2.0-only; keep [`NOTICE`](NOTICE) accurate when regenerating keywords.
