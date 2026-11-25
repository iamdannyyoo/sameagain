#!/usr/bin/env node

import { setupBiome } from "./commands/biome.js";

import { setupHusky } from "./commands/husky.js";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log("Usage: sameagain <biome|husky>");
} else if (command === "biome") {
  setupBiome();
} else if (command === "husky") {
  setupHusky();
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
