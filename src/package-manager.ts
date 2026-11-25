import { existsSync } from "node:fs";
import { join } from "node:path";

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

const packageManagers: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

const lockfiles: Record<PackageManager, string[]> = {
  npm: ["package-lock.json", "npm-shrinkwrap.json"],
  pnpm: ["pnpm-lock.yaml"],
  yarn: ["yarn.lock"],
  bun: ["bun.lock", "bun.lockb"],
};

export function detectPackageManager(
  projectDirectory: string,
  declaredPackageManager?: string,
): PackageManager {
  // Prefer an explicit choice, such as "pnpm@10.30.1" in package.json.
  if (declaredPackageManager) {
    const name = declaredPackageManager.split("@")[0];

    for (const manager of packageManagers) {
      if (manager === name) return manager;
    }

    throw new Error(`Unsupported package manager: ${declaredPackageManager}`);
  }

  // Otherwise, look for a package manager's lockfile in the project root.
  const matches: PackageManager[] = [];

  for (const manager of packageManagers) {
    for (const filename of lockfiles[manager]) {
      if (existsSync(join(projectDirectory, filename))) {
        matches.push(manager);
        break;
      }
    }
  }

  if (matches.length > 1) {
    throw new Error(
      "Multiple package manager lockfiles found. Set packageManager in package.json to choose one.",
    );
  }

  // New projects without a lockfile use npm.
  return matches[0] ?? "npm";
}
