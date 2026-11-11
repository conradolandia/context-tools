# Contributing to ConTeXt Tools

Developer workflow for humans changing this repository.

- **End users** (install, features, settings, troubleshooting): [`README.md`](README.md)
- **Coding agents** (architecture map, invariants, caution): [`AGENTS.md`](AGENTS.md)

Keep those roles separate. Do not put F5 / vsce / Trusted Publishing / architecture / agent invariants in the README. Do not duplicate the README’s user guide here.

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

- GitHub Release published (`release: types: [published]`), with tag `vX.Y.Z` or `X.Y.Z` matching `package.json` `version`. A GitHub Release marked **pre-release** passes `vsce publish --oidc --pre-release` (Marketplace pre-release). A non-pre-release GitHub Release publishes as a normal Marketplace release.
- Manual **Actions → Publish Marketplace → Run workflow**, with `confirm_version` equal to `package.json` `version`. Optional `pre_release` input (default false) controls Marketplace pre-release vs release.

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

## Publish (Open VSX)

CI publish uses [Open VSX Trusted Publishing](https://github.com/eclipse-openvsx/openvsx/wiki/Trusted-Publishing) (`npx ovsx publish --trusted-publishing`). No long-lived Open VSX PAT in repository secrets.

**Where Actions run.** Same constraint as Marketplace: OIDC only on GitHub Actions at `conradolandia/context-tools`. The workflow file is [`.github/workflows/publish-openvsx.yml`](.github/workflows/publish-openvsx.yml). Mirror or push from Origin to GitHub before publishing.

**Triggers (not on every push to `main`).**

- GitHub Release published (`release: types: [published]`), with tag `vX.Y.Z` or `X.Y.Z` matching `package.json` `version`.
- Manual **Actions → Publish Open VSX → Run workflow**, with `confirm_version` equal to `package.json` `version`.

This workflow does not pass pre-release flags. Pre-releases are not used for Open VSX.

**One-time Open VSX setup (namespace `AndresConradoMontoya`).**

Prerequisite: at least one active version on Open VSX (0.1.64 was published with a PAT). You must own the namespace (contributor is not enough) and have signed the Publisher Agreement.

1. Open [Open VSX Trusted Publishers](https://open-vsx.org/user-settings/trusted-publishers).
2. Pick namespace **AndresConradoMontoya** and extension **context-tools**.
3. Choose GitHub Actions and enter:

| Field | Value |
| --- | --- |
| Organization or User name | `conradolandia` |
| Repository name | `context-tools` |
| Workflow filename | `publish-openvsx.yml` |
| Environment name | leave empty (workflow does not set a GitHub Environment) |

4. Confirm. Do not rename the workflow file without deleting and recreating this registration.
5. Optional later: add a GitHub Environment with required reviewers, set `environment:` on the publish job, and put that exact name in the Open VSX **Environment name** field.

**Secrets.** None required for Trusted Publishing. Do not add `OVSX_PAT` for this workflow. An `OVSX_PAT` in the job environment would take precedence over Trusted Publishing.

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
