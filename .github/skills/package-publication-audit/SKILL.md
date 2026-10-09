# Package Publication Audit

## Use when

Use when reviewing `package.json`, exports, published files, dependency classification, package scripts, or a release packaging change.

## Sources of truth

- `package.json`
- `scripts/package-smoke.mjs`
- `README.md` packaging section
- `AGENT.md` package invariants

## Procedure

1. Verify package name, version, ESM type, Node engine, license, and repository metadata.
2. Verify the `exports` map has the intended import-only shape.
3. Verify `files` contains the intended published files and excludes development artifacts.
4. Verify runtime dependencies remain empty and test-only packages remain in `devDependencies`.
5. Run `npm run test:package`.
6. Inspect the smoke output for tarball installation, real dependent import, named exports, and suite execution.
7. Report metadata or published-shape discrepancies separately from smoke failures.

## Required output

Return a metadata checklist, published-file checklist, dependency classification, smoke-test result, and blockers.

## Guardrails

Do not add a CommonJS export, runtime dependency, loader hook, or package file without explicit scope. Do not edit `package.json` while auditing.
