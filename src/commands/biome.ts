import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, constants } from "node:fs";
import { join } from "node:path";
import { detectPackageManager, type PackageManager } from "../package-manager.js";

const biomePackage = "@biomejs/biome";

interface ProjectPackage {
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export function setupBiome(): void {
  try {
    const projectDirectory = process.cwd();
    const project = readPackageJson(projectDirectory);

    if (hasBiomeDependency(project)) {
      copyBiomeConfig(projectDirectory);
      console.log("@biomejs/biome is already declared. Keeping its version.");
      return;
    }

    // Choose the installer before making changes to the project.
    const packageManager = detectPackageManager(
      projectDirectory,
      project.packageManager,
    );

    copyBiomeConfig(projectDirectory);
    installBiome(projectDirectory, packageManager);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not set up Biome: ${message}`);
    process.exitCode = 1;
  }
}

function readPackageJson(projectDirectory: string): ProjectPackage {
  const file = join(projectDirectory, "package.json");

  if (!existsSync(file)) {
    throw new Error(
      "No package.json found. Initialize your project first, then run sameagain biome from its root.",
    );
  }

  return JSON.parse(readFileSync(file, "utf8"));
}

function hasBiomeDependency(project: ProjectPackage): boolean {
  const dependency = project.dependencies?.[biomePackage];
  const devDependency = project.devDependencies?.[biomePackage];

  return Boolean(dependency || devDependency);
}

function copyBiomeConfig(projectDirectory: string): void {
  const jsonFile = join(projectDirectory, "biome.json");
  const jsoncFile = join(projectDirectory, "biome.jsonc");

  if (existsSync(jsonFile) || existsSync(jsoncFile)) {
    console.log("A Biome config already exists. Keeping it.");
    return;
  }

  // The compiled file lives in dist/commands/, two levels below templates/.
  const template = new URL("../../templates/biome.json", import.meta.url);

  copyFileSync(template, jsonFile, constants.COPYFILE_EXCL);
  console.log("Created biome.json");
}

function installBiome(
  projectDirectory: string,
  packageManager: PackageManager,
): void {
  const installCommand = packageManager === "npm" ? "install" : "add";

  // Save Biome as a development dependency and pin its exact version.
  const args = [installCommand, "-D", "-E", biomePackage];
  const command = `${packageManager} ${args.join(" ")}`;

  console.log(`Installing Biome: ${command}`);

  const result = spawnSync(packageManager, args, {
    cwd: projectDirectory,
    stdio: "inherit",
    // Windows package managers use .cmd launchers, which need a shell.
    shell: process.platform === "win32",
  });

  if (result.error || result.status !== 0) {
    const reason = result.error?.message ?? "The package manager did not finish successfully.";
    throw new Error(
      `Installation failed: ${reason}\nYour config was kept. Retry with: ${command}`,
    );
  }

  console.log("Biome is ready.");
}
