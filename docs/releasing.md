# Releasing Moura

Moura v0.1 uses a deliberately manual release process. Never publish merely
because the checks below pass; npm publication requires explicit maintainer
authorization.

1. Confirm `main` and its public quality-report deployment are green.
2. Check that `package.json` and `moura --version` both report `0.1.0`.
3. From a clean checkout on Node 24, run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm format:check
   pnpm typecheck
   pnpm test
   pnpm test:coverage
   pnpm test:allure
   pnpm report:allure
   pnpm build
   node dist/cli.js validate .
   node dist/cli.js check .
   pnpm report:moura
   node dist/cli.js check test/fixtures/passing-project
   pnpm pack --dry-run
   pnpm test:package
   pnpm quality:site
   ```

4. Inspect the dry-run manifest. It should contain only `dist/`, `README.md`,
   `LICENSE`, and `package.json`; report output, fixtures, and test sources must
   not be shipped.
5. Tag the reviewed commit with `v0.1.0` and push the tag.
6. Create a GitHub Release from that tag.
7. Run `pnpm publish` to publish `@specxai/moura` only after package ownership,
   registry authentication, and publication have been explicitly authorized by
   a maintainer. The package's `publishConfig.access` makes the scoped package
   public.

The package smoke test creates a tarball, installs it in a temporary consumer
project, invokes the installed `moura` binary for version/help/validate/check,
and removes the temporary directory. It does not publish anything.

The repository must have **Settings → Pages → Build and deployment → Source**
set to **GitHub Actions**. This one-time repository setting is required before
the `deploy-pages` job can publish the quality site.
