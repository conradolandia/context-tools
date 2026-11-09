import type { EquationPreviewArtifacts } from './pipeline';

/** In-memory map of cacheKey → artifacts for save commands from hover links. */
const registry = new Map<string, EquationPreviewArtifacts>();

export function rememberEquationArtifacts(artifacts: EquationPreviewArtifacts): void {
  registry.set(artifacts.cacheKey, artifacts);
}

export function lookupEquationArtifacts(cacheKey: string): EquationPreviewArtifacts | undefined {
  return registry.get(cacheKey);
}
