import { copyFileSync, existsSync, constants } from "node:fs";
import { join } from "node:path";

export function setupBiome(): void {
  try {
    const hasConfig = ["biome.json", "biome.jsonc"].some((filename) =>
      existsSync(join(process.cwd(), filename)),
    );

    if (hasConfig) {
      console.log("A Biome config already exists. Skipping.");
      return;
    }

    // This module runs from dist/commands/ in the published package.
    const source = new URL("../../templates/biome.json", import.meta.url);
    const destination = join(process.cwd(), "biome.json");

    copyFileSync(source, destination, constants.COPYFILE_EXCL);
    console.log("Created biome.json");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Could not copy the Biome config: ${message}`);
    process.exitCode = 1;
  }
}
