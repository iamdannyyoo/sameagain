import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectPackageManager } from "../package-manager.js";
import { ensureBiome } from "./biome.js";

interface ProjectPackage {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

const marker = "# sameagain: biome staged checks";
const configName = "sameagain.lintstaged.json";
const hookCommand = `lint-staged --config .husky/${configName}`;
const stagedConfig = `${JSON.stringify({
  "*": "biome check --write --no-errors-on-unmatched --files-ignore-unknown=true",
}, null, 2)}\n`;

export function setupHusky(): void {
  try {
    const cwd = process.cwd();
    const manifest = join(cwd, "package.json");
    if (!existsSync(manifest)) {
      throw new Error("No package.json found. Run sameagain husky from the repository root.");
    }
    // A worktree has a .git file; a regular repository has a .git directory.
    if (!existsSync(join(cwd, ".git"))) {
      throw new Error("Run sameagain husky from the Git repository root (initialize Git first if needed).");
    }
    const readProject = (): ProjectPackage => JSON.parse(readFileSync(manifest, "utf8"));
    let project = readProject();
    if (project.scripts?.["sameagain:pre-commit"] && project.scripts["sameagain:pre-commit"] !== hookCommand) {
      throw new Error("Existing sameagain:pre-commit script conflicts with this recipe. Keep or rename it, then retry.");
    }
    const manager = detectPackageManager(cwd, project.packageManager);
    const git = spawnSync("git", ["config", "--get", "core.hooksPath"], { cwd, encoding: "utf8" });
    if (git.error || (git.status !== 0 && git.status !== 1)) {
      throw new Error("Could not inspect Git hooks configuration.");
    }
    const hooksPath = git.stdout.trim();
    if (hooksPath && hooksPath !== ".husky/_" && hooksPath !== ".husky") {
      throw new Error(`Existing core.hooksPath is ${hooksPath}. Keeping it; resolve this custom hook setup before retrying.`);
    }
    const directory = join(cwd, ".husky");
    const config = join(directory, configName);
    if (existsSync(config) && readFileSync(config, "utf8") !== stagedConfig) {
      throw new Error(`Existing .husky/${configName} differs from the bundled recipe. Keeping it; resolve this conflict before retrying.`);
    }
    if (process.env.HUSKY === "0") {
      throw new Error("HUSKY=0 disables activation. Unset it and retry.");
    }

    ensureBiome();
    project = readProject();
    const missing = ["husky", "lint-staged"].filter(
      name => !project.dependencies?.[name] && !project.devDependencies?.[name],
    );
    if (missing.length) {
      run(manager, [manager === "npm" ? "install" : "add", "-D", "-E", ...(manager === "pnpm" && existsSync(join(cwd, "pnpm-workspace.yaml")) ? ["-w"] : []), ...missing]);
    } else {
      // Declared dependencies may not have been downloaded yet.
      run(manager, ["install"]);
    }

    // Re-read after installation so package-manager changes are retained.
    project = readProject();
    const lifecycle = manager === "yarn" ? "postinstall" : "prepare";
    project.scripts ??= {};
    const previous = project.scripts[lifecycle];
    const alreadyInitializes = previous?.split("&&").some(part => part.trim() === "husky");
    if (!alreadyInitializes) {
      project.scripts[lifecycle] = previous ? `${previous} && husky` : "husky";
    }
    writeFileSync(manifest, `${JSON.stringify(project, null, 2)}\n`);

    mkdirSync(directory, { recursive: true });
    writeFileSync(config, stagedConfig);
    const hookPath = join(directory, "pre-commit");
    const previousHook = existsSync(hookPath) ? readFileSync(hookPath, "utf8") : "";
    if (!previousHook.includes(marker)) {
      const command = `${manager} run sameagain:pre-commit`;
      // Prepend checks so an existing hook's exit statement cannot bypass them.
      const shebang = previousHook.startsWith("#!") ? previousHook.split("\n")[0] + "\n" : "";
      const remainder = previousHook.slice(shebang.length);
      writeFileSync(hookPath, `${shebang}${marker}\n${command} || exit $?\n\n${remainder}`, { mode: 0o755 });
    }
    project.scripts["sameagain:pre-commit"] = hookCommand;
    writeFileSync(manifest, `${JSON.stringify(project, null, 2)}\n`);

    // Invoke the local binary without rerunning unrelated lifecycle scripts.
    run(manager, manager === "npm" ? ["exec", "--", "husky"] : manager === "pnpm" ? ["exec", "husky"] : ["run", "husky"]);
    const active = spawnSync("git", ["config", "--get", "core.hooksPath"], { encoding: "utf8" });
    if (active.status !== 0 || active.stdout.trim() !== ".husky/_" || !existsSync(join(directory, "_", "pre-commit"))) {
      throw new Error("Husky did not activate the pre-commit hook. Check the installed Husky version and retry.");
    }
    console.log("Husky is ready. Commits run Biome safe fixes and checks on staged files.");
  } catch (error) {
    console.error(`Could not set up Husky: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

function run(command: string, args: string[]): void {
  console.log(`Running: ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed: ${result.error?.message ?? result.status}. Fix the error and rerun sameagain husky.`);
  }
}
