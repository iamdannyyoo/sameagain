# sameagain

Set up repositories with my preferred configuration.

## Usage

From the root of the repository you want to configure:

```sh
npx sameagain biome
```

Copies the bundled Biome configuration into the current directory. Skips copying
if `biome.json` or `biome.jsonc` already exists. Install Biome separately.

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
