#!/usr/bin/env node
/**
 * Set git hooks path so pre-push runs from scripts/git-hooks.
 * Run once after clone, or via: npm run setup:hooks
 */

const { execSync } = require("child_process");
const path = require("path");

try {
  execSync("git rev-parse --git-dir", { stdio: "ignore" });
} catch {
  process.exit(0);
}

const repoRoot = path.resolve(__dirname, "..");
const hooksPath = path.relative(repoRoot, path.join(__dirname, "git-hooks"));
execSync(`git config core.hooksPath ${hooksPath}`, { cwd: repoRoot, stdio: "inherit" });
console.log("Git hooks path set to scripts/git-hooks. ManaSell version will bump on each push.");
