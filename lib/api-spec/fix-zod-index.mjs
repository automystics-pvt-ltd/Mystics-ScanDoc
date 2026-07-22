/**
 * Post-processing script run after orval codegen.
 *
 * Problem: orval generates both a zod schema (const value) and a TypeScript
 * type with the same name for multipart/form-data request bodies
 * (e.g. UploadDocumentBody). Barrel-re-exporting both via `export *` causes
 * TS2308 "already exported a member" errors.
 *
 * Strategy:
 *   1. Collect all VALUE export names from generated/api.ts  (export const X …)
 *   2. For each file in generated/types/:
 *        - If none of its exported names conflict with api.ts values →
 *          emit `export * from "./generated/types/<file>"` (preserves consts/enums)
 *        - If it contains a conflicting name →
 *          emit `export type { ConflictingName } from "./generated/types/<file>"`
 *          (type-only re-export; the value is already covered by api.ts above)
 *   3. Overwrite lib/api-zod/src/index.ts with the result.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..", "..");
const zodSrc = resolve(root, "lib/api-zod/src");

const apiGenPath = resolve(zodSrc, "generated/api.ts");
const typesIndexPath = resolve(zodSrc, "generated/types/index.ts");
const outPath = resolve(zodSrc, "index.ts");

// ── 1. Collect value-export names from generated/api.ts ─────────────────────
const apiContent = readFileSync(apiGenPath, "utf8");
// Matches: export const Foo = …   (zod schemas, default values, etc.)
const apiValueNames = new Set(
  [...apiContent.matchAll(/^export const (\w+)/gm)].map((m) => m[1]),
);

// ── 2. Parse the generated/types barrel to get per-file paths ───────────────
const typesIndexContent = readFileSync(typesIndexPath, "utf8");
// Each line looks like: export * from './auditLog';
const typeFiles = [...typesIndexContent.matchAll(/export \* from '(.+)'/g)].map(
  (m) => m[1], // e.g. './auditLog'
);

// ── 3. For each type file, detect conflicts and build re-export lines ────────
const lines = [
  "// Auto-fixed by lib/api-spec/fix-zod-index.mjs after orval codegen.",
  "// Do not edit manually — re-run `pnpm --filter @workspace/api-spec run codegen` instead.",
  "",
  "// Zod schemas and associated values from generated/api.ts",
  `export * from "./generated/api";`,
  "",
  "// TypeScript types from generated/types/ — files with name collisions use",
  "// `export type { … }` so the zod schema value in api.ts is not shadowed.",
];

for (const relPath of typeFiles) {
  // relPath: './auditLog'  →  absolute: …/generated/types/auditLog.ts
  const absPath = resolve(zodSrc, "generated/types", relPath.replace(/^\.\//, "") + ".ts");
  const stem = relPath.replace(/^\.\//, ""); // 'auditLog'

  let fileContent;
  try {
    fileContent = readFileSync(absPath, "utf8");
  } catch {
    // file missing — skip
    console.warn(`  ⚠ fix-zod-index: could not read ${absPath}, skipping`);
    continue;
  }

  // Collect all exported names from this types file.
  // Handles: export type X, export interface X, export const X
  const fileExportNames = [
    ...fileContent.matchAll(/^export (?:type |interface |const )(\w+)/gm),
  ].map((m) => m[1]);

  // Find any name that conflicts with a value export in api.ts
  const conflicts = fileExportNames.filter((n) => apiValueNames.has(n));

  if (conflicts.length === 0) {
    // No conflicts — safe to barrel-re-export everything (types + values)
    lines.push(`export * from "./generated/types/${stem}";`);
  } else {
    // Conflicts found — only re-export the type/interface declarations,
    // NOT the const values (they're already covered by api.ts above).
    const typeOnlyNames = fileExportNames.filter(
      (n) => apiValueNames.has(n) === false || isTypeOnlyExport(fileContent, n),
    );

    // Re-export non-conflicting names normally
    const safeNames = fileExportNames.filter((n) => !apiValueNames.has(n));
    if (safeNames.length > 0) {
      lines.push(`export type { ${safeNames.join(", ")} } from "./generated/types/${stem}";`);
    }

    // For conflicting names, emit a type-only re-export (keeps the TS type
    // accessible while the zod schema value wins from api.ts above).
    const conflictTypeNames = conflicts.filter((n) => isTypeOnlyExport(fileContent, n));
    if (conflictTypeNames.length > 0) {
      lines.push(
        `export type { ${conflictTypeNames.join(", ")} } from "./generated/types/${stem}"; // type-only: value exported as zod schema above`,
      );
    }

    if (safeNames.length === 0 && conflictTypeNames.length === 0) {
      lines.push(`// Skipped ${stem} — all exports conflict with api.ts values`);
    }
  }
}

lines.push("");

/** Returns true when the given name in fileContent is declared as a type/interface (not a const). */
function isTypeOnlyExport(content, name) {
  // Matches: export type Name = … or export interface Name {
  return new RegExp(`^export (?:type|interface) ${name}[\\s<{=]`, "m").test(content);
}

writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`✅ fix-zod-index: wrote ${outPath} (${lines.length} lines)`);
