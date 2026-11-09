# Contributing to ConTeXt Tools

Developer workflow. End-user install and settings: [`README.md`](README.md). Agent invariants: [`AGENTS.md`](AGENTS.md).

## Setup

```bash
git clone https://github.com/conradolandia/context-tools.git
cd context-tools   # or your local checkout name
npm install
```

If you push both to Cursor / Origin and to public GitHub, keep remotes distinct (`origin` vs `upstream`). Public GitHub is [`conradolandia/context-tools`](https://github.com/conradolandia/context-tools) (renamed from `context-lab`). Use `$HOME/context`, `/opt/context`, or `$CONTEXT_ROOT` in docs and examples — not personal machine paths.

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

## Publish (Marketplace)

CI publish uses [Trusted Publishing](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#publish-with-github-actions-and-trusted-publishing) (`npx @vscode/vsce publish --oidc`, vsce ≥ 4.1.0). No long-lived Marketplace PAT in repository secrets.

**Where Actions run.** Trusted Publishing is GitHub Actions OIDC only. The workflow file is [`.github/workflows/publish-marketplace.yml`](.github/workflows/publish-marketplace.yml). It must run on **GitHub** at `conradolandia/context-tools`. Cursor Origin (`andr-s-montoya/ConTeXt-lab` or similar) does not provide Marketplace OIDC. If Origin is the day-to-day remote, mirror or push the same commit (including the workflow) to GitHub before publishing.

**Triggers (not on every push to `main`).**

- GitHub Release published (`release: types: [published]`), with tag `vX.Y.Z` or `X.Y.Z` matching `package.json` `version`
- Manual **Actions → Publish Marketplace → Run workflow**, with `confirm_version` equal to `package.json` `version`

**One-time Marketplace setup (publisher `AndresConradoMontoya`).**

1. Open [Visual Studio Marketplace publisher management](https://marketplace.visualstudio.com/manage).
2. Open publisher **AndresConradoMontoya** → **Trusted Publishing** → **Create**.
3. Enter:

| Field | Value |
| --- | --- |
| Policy name | e.g. `Publish Marketplace` |
| Repository owner | `conradolandia` |
| Repository | `context-tools` |
| Workflow | `publish-marketplace.yml` |
| Environment | leave empty (workflow does not set a GitHub Environment) |

4. Save. Do not rename the workflow file without updating this policy.
5. Optional later: add a GitHub Environment with required reviewers, set `environment:` on the publish job, and put that exact name in the Marketplace **Environment** field.

**Secrets.** None required for Trusted Publishing. Do not add `VSCE_PAT` for this workflow.

Open VSX publish is out of scope for this workflow.

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
