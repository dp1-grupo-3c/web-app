import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Carga un módulo real de src/ transpilado con TypeScript (mismo enfoque que
 * actions.test.mjs). Cada llamada usa una caché nueva: estado limpio por prueba.
 */
export function load(entry) {
  const cache = new Map();
  function req(file) {
    if (cache.has(file)) return cache.get(file);
    const exports = {};
    cache.set(file, exports);
    const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    });
    const requireLocal = (name) => req(
      (name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name)) + ".ts",
    );
    new Function("require", "exports", outputText)(requireLocal, exports);
    return exports;
  }
  return req(resolve(root, entry));
}
