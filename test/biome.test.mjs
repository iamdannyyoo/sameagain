import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

function fixture(t, manifest = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "sameagain-biome-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const bin = join(cwd, "bin");
  mkdirSync(bin);
  if (manifest !== null) writeFileSync(join(cwd, "package.json"), JSON.stringify(manifest));
  for (const name of ["npm", "pnpm", "yarn", "bun"]) {
    const script = `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
writeFileSync('install.json', JSON.stringify({manager: '${name}', args: process.argv.slice(2)}));
process.exit(Number(process.env.SAMEAGAIN_TEST_EXIT || 0));
`;
    writeFileSync(join(bin, `${name}.mjs`), script);
    writeFileSync(join(bin, name), script, { mode: 0o755 });
    writeFileSync(join(bin, `${name}.cmd`), `@"${process.execPath}" "%~dp0${name}.mjs" %*\r\n`);
  }
  return {
    cwd,
    run: (exit = 0) => spawnSync(process.execPath, [cli, "biome"], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, PATH: `${bin}${delimiter}${process.env.PATH}`, SAMEAGAIN_TEST_EXIT: String(exit) },
    }),
    installed: () => JSON.parse(readFileSync(join(cwd, "install.json"), "utf8")),
  };
}

test("defaults to npm, copies the template, and installs an exact dev dependency", (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  assert.deepEqual(f.installed(), { manager: "npm", args: ["install", "-D", "-E", "@biomejs/biome"] });
  assert.equal(readFileSync(join(f.cwd, "biome.json"), "utf8"), readFileSync(new URL("../templates/biome.json", import.meta.url), "utf8"));
});

for (const [manager, lock] of [["pnpm", "pnpm-lock.yaml"], ["yarn", "yarn.lock"], ["bun", "bun.lock"], ["bun", "bun.lockb"]]) {
  test(`detects ${lock}`, (t) => {
    const f = fixture(t);
    writeFileSync(join(f.cwd, lock), "");
    assert.equal(f.run().status, 0);
    assert.deepEqual(f.installed(), { manager, args: ["add", "-D", "-E", "@biomejs/biome"] });
  });
}

test("packageManager takes precedence over lockfiles", (t) => {
  const f = fixture(t, { packageManager: "pnpm@10.30.1" });
  writeFileSync(join(f.cwd, "package-lock.json"), "{}");
  assert.equal(f.run().status, 0);
  assert.equal(f.installed().manager, "pnpm");
});

for (const config of ["biome.json", "biome.jsonc"]) {
  test(`preserves ${config} while installing the missing dependency`, (t) => {
    const f = fixture(t);
    writeFileSync(join(f.cwd, config), "{\"custom\":true}");
    assert.equal(f.run().status, 0);
    assert.equal(readFileSync(join(f.cwd, config), "utf8"), "{\"custom\":true}");
    assert.equal(f.installed().manager, "npm");
    if (config.endsWith("jsonc")) assert.equal(existsSync(join(f.cwd, "biome.json")), false);
  });
}

for (const field of ["dependencies", "devDependencies"]) {
  test(`preserves an existing version in ${field}`, (t) => {
    const f = fixture(t, { [field]: { "@biomejs/biome": "2.6.9" } });
    assert.equal(f.run().status, 0);
    assert.equal(existsSync(join(f.cwd, "install.json")), false);
    assert.equal(JSON.parse(readFileSync(join(f.cwd, "package.json"), "utf8"))[field]["@biomejs/biome"], "2.6.9");
  });
}

test("installation failures keep the config and provide a retry command", (t) => {
  const f = fixture(t);
  const result = f.run(1);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Retry with: npm install -D -E @biomejs\/biome/);
  assert.equal(existsSync(join(f.cwd, "biome.json")), true);
  assert.equal(f.run().status, 0);
});

test("requires package.json before changing files", (t) => {
  const f = fixture(t, null);
  assert.equal(f.run().status, 1);
  assert.equal(existsSync(join(f.cwd, "biome.json")), false);
});

test("rejects ambiguous lockfiles before changing files", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.cwd, "package-lock.json"), "{}");
  writeFileSync(join(f.cwd, "pnpm-lock.yaml"), "");
  assert.match(f.run().stderr, /Multiple package manager lockfiles/);
  assert.equal(existsSync(join(f.cwd, "biome.json")), false);
});
