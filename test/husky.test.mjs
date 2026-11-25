import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
function fixture(t, manager = "npm", extra = {}) {
  const cwd = mkdtempSync(join(tmpdir(), "sameagain-husky-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  assert.equal(spawnSync("git", ["init", cwd]).status, 0);
  writeFileSync(join(cwd, "package.json"), JSON.stringify({ packageManager: `${manager}@1.0.0`, ...extra }));
  const bin = join(cwd, "bin");
  mkdirSync(bin);
  const script = `#!/usr/bin/env node
const fs = require('node:fs');
const {spawnSync} = require('node:child_process');
const args = process.argv.slice(2);
fs.appendFileSync('calls.jsonl', JSON.stringify(args) + '\\n');
if (process.env.FAIL_INSTALL && ['install','add'].includes(args[0])) process.exit(1);
if (['install','add'].includes(args[0])) {
  const p = JSON.parse(fs.readFileSync('package.json'));
  p.devDependencies ??= {};
  for (const name of args.slice(1).filter(x => !x.startsWith('-'))) p.devDependencies[name] = '9.0.0';
  fs.writeFileSync('package.json', JSON.stringify(p));
} else if (args.includes('husky') && !process.env.SKIP_ACTIVATION) {
  fs.mkdirSync('.husky/_', {recursive: true});
  fs.writeFileSync('.husky/_/pre-commit', 'shim');
  process.exit(spawnSync('git', ['config', 'core.hooksPath', '.husky/_']).status);
}
`;
  writeFileSync(join(bin, manager), script, { mode: 0o755 });
  writeFileSync(join(bin, `${manager}.cjs`), script);
  writeFileSync(join(bin, `${manager}.cmd`), `@"${process.execPath}" "%~dp0${manager}.cjs" %*\r\n`);
  return {
    cwd,
    read: path => readFileSync(join(cwd, path), "utf8"),
    write: (path, content) => writeFileSync(join(cwd, path), content),
    run: (env = {}) => spawnSync(process.execPath, [cli, "husky"], { cwd, encoding: "utf8", env: { ...process.env, HUSKY: "1", PATH: `${bin}${delimiter}${process.env.PATH}`, ...env } }),
  };
}
for (const manager of ["npm", "pnpm", "yarn", "bun"]) {
  test(`complete ${manager} setup and repeat runs`, t => {
    const f = fixture(t, manager);
    let result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(f.read("package.json"));
    assert.ok(manifest.devDependencies.husky);
    assert.ok(manifest.devDependencies["lint-staged"]);
    assert.ok(manifest.devDependencies["@biomejs/biome"]);
    assert.equal(manifest.scripts[manager === "yarn" ? "postinstall" : "prepare"], "husky");
    assert.match(f.read(".husky/pre-commit"), new RegExp(`${manager} run sameagain:pre-commit`));
    assert.ok(existsSync(join(f.cwd, "biome.json")));
    const hook = f.read(".husky/pre-commit");
    result = f.run();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(f.read(".husky/pre-commit"), hook);
    assert.deepEqual(JSON.parse(f.read("package.json")), manifest);
  });
}
test("preserves user hook, lifecycle, Biome config, versions, and lint-staged config", t => {
  const f = fixture(t, "npm", { scripts: { prepare: "echo existing" }, devDependencies: { "@biomejs/biome": "2.0.0", husky: "9.1.7", "lint-staged": "16.0.0" }, "lint-staged": { "*.md": "custom" } });
  mkdirSync(join(f.cwd, ".husky"));
  f.write(".husky/pre-commit", "#!/bin/sh\necho existing\nexit 0\n");
  f.write("biome.jsonc", "// custom\n{}");
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const p = JSON.parse(f.read("package.json"));
  assert.equal(p.scripts.prepare, "echo existing && husky");
  assert.equal(p.devDependencies.husky, "9.1.7");
  assert.deepEqual(p["lint-staged"], { "*.md": "custom" });
  assert.equal(f.read("biome.jsonc"), "// custom\n{}");
  assert.match(f.read(".husky/pre-commit"), /^#!\/bin\/sh\n# sameagain:[\s\S]*echo existing\nexit 0\n$/);
});
test("stops when Biome installation fails and can retry", t => {
  const f = fixture(t);
  assert.equal(f.run({ FAIL_INSTALL: "1" }).status, 1);
  assert.equal(existsSync(join(f.cwd, ".husky")), false);
  assert.equal(f.run().status, 0);
});
test("does not claim activation when Husky did not enable hooks", t => {
  const f = fixture(t);
  const result = f.run({ SKIP_ACTIVATION: "1" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /did not activate/);
});
for (const conflict of ["git", "script", "config", "disabled", "no-git"]) {
  test(`rejects ${conflict} before installing or changing the manifest`, t => {
    const f = fixture(t, "npm", conflict === "script" ? { scripts: { "sameagain:pre-commit": "custom" } } : {});
    if (conflict === "git") spawnSync("git", ["config", "core.hooksPath", "custom"], { cwd: f.cwd });
    if (conflict === "no-git") rmSync(join(f.cwd, ".git"), { recursive: true });
    if (conflict === "config") {
      mkdirSync(join(f.cwd, ".husky"));
      f.write(".husky/sameagain.lintstaged.json", "{}");
    }
    const before = f.read("package.json");
    assert.equal(f.run(conflict === "disabled" ? { HUSKY: "0" } : {}).status, 1);
    assert.equal(f.read("package.json"), before);
    assert.equal(existsSync(join(f.cwd, "calls.jsonl")), false);
  });
}
