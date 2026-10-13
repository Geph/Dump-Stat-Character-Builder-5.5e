#!/usr/bin/env node
/** Build a UI-free source package from the single maintained library. No art or local fixtures. */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { dirname, relative, resolve, join } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const checkOnly = process.argv.includes("--check")
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
// Export the reviewed index, not uncommitted/untracked source or local fixture files.
const entries = execFileSync("git", ["ls-files", "--stage", "-z", "lib"], { cwd: root, encoding: "utf8" }).split("\0")
  .filter(Boolean).map(entry => { const [metadata, path] = entry.split("\t"); return { path, hash: metadata.split(" ")[1] } })
  .filter(({ path }) => !path.includes("/__tests__/") && !path.includes("/fixtures/") && /\.(ts|tsx|json|mjs)$/.test(path))
if (!entries.length) throw new Error("No library sources found; run from a Git checkout containing staged lib/ sources.")
const batch = execFileSync("git", ["cat-file", "--batch"], { cwd: root, input: entries.map(entry => entry.hash).join("\n") + "\n", maxBuffer: 100 * 1024 * 1024 })
const exported = new Map()
let cursor = 0
for (const entry of entries) {
  const end = batch.indexOf(10, cursor)
  const [, kind, size] = batch.subarray(cursor, end).toString().split(" ")
  if (kind !== "blob") throw new Error(`Missing library blob: ${entry.path}`)
  const length = Number(size)
  exported.set(entry.path, batch.subarray(end + 1, end + 1 + length).toString("utf8"))
  cursor = end + 2 + length
}
const exports = {}
for (const [path, source] of exported) {
  if (/\.json$/.test(path)) { exports[`./${path.slice(4)}`] = `./${path}`; continue }
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true)
  function visit(node) {
    if (ts.isStringLiteralLike(node) && node.text.startsWith("@/") && !node.text.startsWith("@/lib/")) {
      throw new Error(`${path}: shared library depends on application file ${node.text}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(ast)
  const rewritten = source.replace(/(["'])@\/lib\/([^"']+)\1/g, (_, quote, target) => {
    let specifier = relative(dirname(path), `lib/${target}`).replaceAll("\\", "/")
    if (!specifier.startsWith(".")) specifier = `./${specifier}`
    return `${quote}${specifier}${quote}`
  })
  exported.set(path, rewritten)
  const key = `./${path.slice(4).replace(/\.(tsx?|mjs)$/, "")}`
  // Prefer TS to helper-script .mjs siblings, matching the application's resolver.
  if (!exports[key] || /\.tsx?$/.test(path)) exports[key] = `./${path}`
}
if (checkOnly) {
  console.log(`Shared-core boundary passed (${entries.length} library files; no application imports).`)
} else {
  // Unique output avoids stale files without deleting any existing directories.
  const out = join(root, ".shared-core", `build-${Date.now()}`)
  for (const [path, source] of exported) {
    mkdirSync(dirname(join(out, path)), { recursive: true })
    writeFileSync(join(out, path), source)
  }
  writeFileSync(join(out, "package.json"), JSON.stringify({
    name: "@dumpstat/core", version: packageJson.version.split(".").length === 2 ? `${packageJson.version}.0` : packageJson.version, private: true,
    type: "module", exports, files: ["lib", "LICENSE"],
    peerDependencies: packageJson.dependencies,
  }, null, 2) + "\n")
  if (existsSync(join(root, "LICENSE"))) writeFileSync(join(out, "LICENSE"), readFileSync(join(root, "LICENSE")))
  // Verify the copied package independently of the application's alias map.
  writeFileSync(join(out, "tsconfig.json"), JSON.stringify({ compilerOptions: {
    target: "ES2022", lib: ["esnext", "dom", "dom.iterable"], allowJs: true, module: "esnext", moduleResolution: "bundler", strict: true,
    skipLibCheck: true, esModuleInterop: true, resolveJsonModule: true, noEmit: true,
  }, include: ["lib/**/*.ts"], exclude: ["lib/**/*.test.ts"] }, null, 2))
  console.log(out)
}
