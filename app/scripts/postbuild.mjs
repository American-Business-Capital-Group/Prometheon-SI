// Post-build: copy the static export (out/) into ../docs for GitHub Pages,
// and write the Pages + gateway-discovery files the coordinator maintains.
import { cpSync, rmSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(appDir, "out");
const docsDir = join(appDir, "..", "docs");

if (!existsSync(outDir)) {
  console.error("out/ missing — next build did not produce an export");
  process.exit(1);
}

rmSync(docsDir, { recursive: true, force: true });
mkdirSync(docsDir, { recursive: true });
cpSync(outDir, docsDir, { recursive: true });

writeFileSync(join(docsDir, "CNAME"), "prometheon.si");
writeFileSync(join(docsDir, ".nojekyll"), "");
writeFileSync(
  join(docsDir, "gateway-config.js"),
  [
    "// Prometheon SI gateway discovery candidates, tried in order.",
    "// The coordinator rewrites the funnel entry once the gateway report lands.",
    "window.PROMETHEON_GATEWAYS = [",
    '  "https://FUNNEL_URL_PENDING",',
    '  "http://100.89.231.37:8811"',
    "];",
    "",
  ].join("\n"),
);

console.log("Static export copied to ../docs with CNAME, .nojekyll, gateway-config.js");
