# sameagain

Set up repositories with my preferred configuration.

## Usage

From the root of a project with a `package.json`:

```sh
npx sameagain biome
```

Copies the bundled Biome configuration into the current directory and installs
`@biomejs/biome` as an exact-version development dependency (`-D -E`).

Uses the project's `packageManager` field, then its lockfile, falling back to npm.
Supports npm, pnpm, Yarn, and Bun; the selected manager must be installed.
Run from the workspace root for a monorepo.

Existing `biome.json` or `biome.jsonc` files are preserved. If Biome is already
declared in dependencies or devDependencies, its version is preserved and
installation is skipped. Run your package manager's install command if those
dependencies have not been downloaded yet. If installation fails, the config is
kept and a retry command is printed.

## Development

```sh
pnpm install
pnpm build
node dist/cli.js --help
```

`src/cli.ts` routes commands. Biome setup lives in `src/commands/biome.ts`.
After editing TypeScript, run `pnpm build` to generate JavaScript in `dist/`.
The `prepare` script also builds automatically when installing from source,
packing with npm, or publishing. The published package includes the compiled
JavaScript, so users do not need TypeScript installed.
