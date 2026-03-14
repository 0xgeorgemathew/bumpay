import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const rootDir = path.resolve(import.meta.dirname, "..");
const codegenDir = path.join(rootDir, "node_modules", "@react-native", "codegen");
const braceExpansionEntry = path.join(
  codegenDir,
  "node_modules",
  "brace-expansion",
  "index.js",
);
const compatDir = path.join(
  codegenDir,
  "node_modules",
  "balanced-match",
);
const compatPackageJson = path.join(compatDir, "package.json");
const compatIndex = path.join(compatDir, "index.js");

if (!fs.existsSync(braceExpansionEntry)) {
  process.exit(0);
}

const requireFromBraceExpansion = createRequire(braceExpansionEntry);

const resolvedBefore = requireFromBraceExpansion.resolve("balanced-match");
const loadedBefore = requireFromBraceExpansion("balanced-match");

if (typeof loadedBefore === "function") {
  console.log(
    `[deps] react-native codegen already resolves compatible balanced-match at ${resolvedBefore}`,
  );
  process.exit(0);
}

fs.mkdirSync(compatDir, { recursive: true });
fs.writeFileSync(
  compatPackageJson,
  `${JSON.stringify(
    {
      name: "balanced-match",
      version: "1.0.2-codex.0",
      private: true,
      main: "index.js",
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(
  compatIndex,
  [
    '"use strict";',
    "",
    "const mod = require('../../../../balanced-match');",
    "const balanced = typeof mod === 'function' ? mod : mod.balanced;",
    "",
    "if (typeof balanced !== 'function') {",
    "  throw new TypeError('Expected balanced-match to export a function');",
    "}",
    "",
    "module.exports = balanced;",
    "module.exports.range = mod.range;",
    "",
  ].join("\n"),
);

const resolvedAfter = createRequire(braceExpansionEntry).resolve("balanced-match");
console.log(
  `[deps] installed balanced-match compatibility shim for react-native codegen: ${resolvedBefore} -> ${resolvedAfter}`,
);
