import { execFileSync } from "node:child_process"
const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean)
const bad = files.filter(p => /\.(png|jpe?g|webp|avif|gif|pdf)$/i.test(p) || p.startsWith("public/images/") || /scripts\/[^/]+-sources\//.test(p))
if (bad.length) throw new Error(`Compact repository contains forbidden art/source assets: ${bad.join(", ")}`)
console.log("Compact asset boundary passed.")
