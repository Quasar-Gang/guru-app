import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const ignoredDirectories = new Set([".git", ".next", ".wrangler", "dist", "node_modules", "work"]);
const textExtensions = new Set(["", ".css", ".env", ".example", ".html", ".js", ".json", ".md", ".mjs", ".svg", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
const frontendDisplayFiles = new Set(["app/page.tsx", "app/layout.tsx", "app/components/GuruApp.tsx"]);
const suppliedReferences = new Set(["docs-guru-api-integration.md"]);
const hanPattern = /\p{Script=Han}/u;
const hanGlobalPattern = /\p{Script=Han}/gu;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(path));
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
  if (suppliedReferences.has(projectPath)) continue;
  const source = await readFile(path, "utf8");
  if (frontendDisplayFiles.has(projectPath)) {
    const comments = source.matchAll(/(?:^|\s)\/\/[^\n]*|\/\*[\s\S]*?\*\//gm);
    for (const match of comments) {
      if (hanPattern.test(match[0])) violations.push(`${projectPath}:${lineNumberAt(source, match.index)} contains Han characters in a code comment`);
    }
    continue;
  }
  for (const match of source.matchAll(hanGlobalPattern)) {
    violations.push(`${projectPath}:${lineNumberAt(source, match.index)} contains a Han character`);
    break;
  }
}

if (violations.length) {
  console.error("English-only project content check failed:");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log("English-only project content check passed.");
}
