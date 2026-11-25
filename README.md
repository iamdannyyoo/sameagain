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

## Husky + Biome pre-commit setup

From the Git repository root (also the workspace root for a monorepo):

```sh
npx sameagain husky
```

Sets up Biome using the same recipe as `sameagain biome`, installs Husky and
lint-staged as exact-version development dependencies, and activates the Git
pre-commit hook immediately. Existing dependency versions and Biome configuration
are preserved. Dependencies are installed even when already declared.

Every commit runs Biome on staged files through lint-staged: formatting, import
organization, and safe lint fixes are applied and staged automatically. Remaining
errors block the commit. Unsupported file types are skipped. lint-staged handles
partially staged changes using its default stash behaviour.

The command creates:

- `.husky/pre-commit`, calling the `sameagain:pre-commit` package script.
- `.husky/sameagain.lintstaged.json`, containing the bundled Biome recipe.
- A `sameagain:pre-commit` script that runs lint-staged with that explicit config.
- A `prepare` script that initializes Husky after installs (`postinstall` for Yarn).

Existing lifecycle commands are retained and followed by `husky`. Existing hook
contents are retained after the new check. Existing lint-staged configuration is
untouched; this hook uses its own configuration. Repeat runs do not duplicate the
hook or lifecycle command. Commit the generated configuration and lockfile.

Conflicting custom Git hook paths, recipe files, or `sameagain:pre-commit` scripts
are reported before installation. The command requires an initialized Git repo;
it does not initialize one or support installation from a nested app directory.
`HUSKY=0` must be unset for setup. Installation or activation failures return a
nonzero status; fix the reported issue and rerun the command.

For published Yarn packages, review Husky's
[Yarn lifecycle guidance](https://typicode.github.io/husky/how-to.html) before
shipping a package with the generated `postinstall` script.

## Development

```sh
pnpm install
pnpm build
node dist/cli.js --help
```

`src/cli.ts` routes commands. Setup recipes live in `src/commands/biome.ts` and `src/commands/husky.ts`.
After editing TypeScript, run `pnpm build` to generate JavaScript in `dist/`.
The `prepare` script also builds automatically when installing from source,
packing with npm, or publishing. The published package includes the compiled
JavaScript, so users do not need TypeScript installed.
