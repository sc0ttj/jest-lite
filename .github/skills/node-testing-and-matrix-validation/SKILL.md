# Node Testing and Matrix Validation

## Use when

Use when validating Node-native behavior, supported Node versions, CI compatibility, or a change that may depend on Node runtime semantics.

## Sources of truth

- `package.json`
- `.github/workflows/test.yml`
- `AGENT.md`
- `jest-lite.test.js`
- `scripts/package-smoke.mjs`

## Procedure

1. Confirm the declared engine requirement is Node `>=22`.
2. Confirm the CI Node matrix is `22.x`, `24.x`, and `26.x`.
3. Run `npm test` on the available local Node version.
4. Run `npm run test:package` when package imports, exports, snapshots, or filesystem behavior are involved.
5. Compare failures against Node version, ESM, filesystem, timer, and native `node:test` assumptions.
6. Report which matrix versions were actually executed and which were only specified by CI.
7. Separate implementation failures from unavailable local runtimes or environment failures.

## Required output

Return a matrix of declared version, locally executed version, command, result, and evidence, followed by Node-specific findings and untested versions.

## Guardrails

This skill is read-only. Do not install or switch Node versions, modify CI, weaken tests, or claim matrix coverage for versions not actually executed.
