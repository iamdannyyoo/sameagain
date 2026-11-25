#!/usr/bin/env node

import { copyFileSync, existsSync, constants } from "node:fs";
import { join } from "node:path";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log("Usage: sameagain biome");
} else if (command !== "biome") {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
} else {
  try {
    const hasConfig = ["biome.json", "biome.jsonc"].some((filename) =>
      existsSync(join(process.cwd(), filename)),
    );

    if (hasConfig) {
      console.log("A Biome config already exists. Skipping.");
    } else {
      const source = new URL("../templates/biome.json", import.meta.url);
      const destination = join(process.cwd(), "biome.json");

      copyFileSync(source, destination, constants.COPYFILE_EXCL);
      console.log("Created biome.json");
    }
  } catch (error) {
    console.error(`Could not copy the Biome config: ${error.message}`);
    process.exitCode = 1;
  }
}
