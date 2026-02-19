#!/usr/bin/env node
/**
 * Bump ManaSell version (x.x) in manasell.html by incrementing the patch.
 * Usage: node scripts/bump-manasell-version.js
 * Prints new version to stdout for use in commit messages.
 */

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..");
const filePath = path.join(repoRoot, "manasell.html");

let html = fs.readFileSync(filePath, "utf8");
const match = html.match(/<span class="font-normal text-gray-400">\((\d+)\.(\d+)\)<\/span>/);
if (!match) {
  console.error("Could not find version in manasell.html");
  process.exit(1);
}

const major = parseInt(match[1], 10);
const patch = parseInt(match[2], 10) + 1;
const newVersion = `${major}.${patch}`;
const newSpan = `<span class="font-normal text-gray-400">(${newVersion})</span>`;

html = html.replace(match[0], newSpan);
fs.writeFileSync(filePath, html);

console.log(newVersion);
