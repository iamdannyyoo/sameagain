#!/usr/bin/env node

import { setupBiome } from "./commands/biome.js";

const command = process.argv[2];

if (!command || command === "--help" || command === "-h") {
  console.log("Usage: sameagain biome");
} else if (command === "biome") {
  setupBiome();
} else {
  console.error(`Unknown command: ${command}`);
  process.exitCode = 1;
}
