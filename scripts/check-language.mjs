/**
 * English-only project content check.
 *
 * The product interface is Traditional Chinese; the project itself is English.
 * So Han characters are allowed in exactly two places — the display components
 * that render user-facing copy, and the fixture module that holds that copy —
 * and nowhere else, including inside comments in those files.
 *
 * The vendored design system under `app/styles/` is excluded: it is copied from
 * upstream and must stay byte-identical so it can be re-copied on update.
 */
import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".vinext",
  ".wrangler",
  "design",
  "dist",
  "node_modules",
]);

const textExtensions = new Set([
  "",
  ".css",
  ".env",
  ".example",
  ".html",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".svg",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

/** Copied verbatim from the design system. Not ours to translate. */
const vendoredPrefixes = ["app/styles/"];

/** Files allowed to carry Traditional Chinese product copy, including the
 *  tests that assert on it. Comments in these files must still be English. */
const displayPrefixes = [
  "app/",
  "lib/api/client.ts",
  "lib/api/snapshot-adapter.ts",
  "lib/attribution.ts",
  "lib/dispatch.ts",
  "lib/horizon.ts",
  "lib/mock/",
  "lib/reconcile.ts",
  "lib/role-model.ts",
  "tests/",
];

const hanPattern = /\p{Script=Han}/u;
const commentPattern = /(?:^|[^:])\/\/[^\n]*|\/\*[\s\S]*?\*\//g;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else if (entry.isFile() && textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

const violations = [];

for (const path of await collectFiles(root)) {
  const projectPath = relative(root, path);
  if (vendoredPrefixes.some((prefix) => projectPath.startsWith(prefix))) continue;

  const source = await readFile(path, "utf8");
  const isDisplayFile = displayPrefixes.some((prefix) => projectPath.startsWith(prefix));

  if (isDisplayFile) {
    for (const match of source.matchAll(commentPattern)) {
      if (hanPattern.test(match[0])) {
        violations.push(`${projectPath}:${lineNumberAt(source, match.index)} Han characters in a code comment`);
      }
    }
    continue;
  }

  const found = source.match(hanPattern);
  if (found) {
    violations.push(`${projectPath}:${lineNumberAt(source, source.indexOf(found[0]))} Han character outside a display file`);
  }
}

if (violations.length > 0) {
  console.error("English-only project content check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("English-only project content check passed.");
}
