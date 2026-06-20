/**
 * Codemod: console.* -> centralized `log` facade.
 *
 * Rewrites:
 *   console.log   -> log.debug
 *   console.debug -> log.debug
 *   console.info  -> log.info
 *   console.warn  -> log.warn
 *   console.error -> log.error
 *
 * Inserts `import { log } from "@/shared/utils/logging";` into any file that
 * gained a `log.*` call and does not already import/bind `log`.
 *
 * Usage:
 *   npx tsx scripts/codemod-console-to-log.ts            # whole src/
 *   npx tsx scripts/codemod-console-to-log.ts src/app/api  # a subtree
 *
 * Skips: the logger module itself, test files, debug/test app routes.
 */

import { Project, SyntaxKind, Node } from "ts-morph";
import * as path from "path";

const MAP: Record<string, string> = {
  log: "debug",
  debug: "debug",
  info: "info",
  warn: "warn",
  error: "error",
};

const IMPORT_MODULE = "@/shared/utils/logging";

const SKIP_PATTERNS = [
  /src[\\/]shared[\\/]utils[\\/]logging[\\/]/,
  /\.test\.[tj]sx?$/,
  /[\\/]tests[\\/]/,
  /src[\\/]app[\\/]debug[\\/]/,
  /src[\\/]app[\\/]test[\\/]/,
];

function shouldSkip(filePath: string): boolean {
  return SKIP_PATTERNS.some((re) => re.test(filePath));
}

const targetArg = process.argv[2];
const rootDir = process.cwd();
const globRoot = targetArg ? path.resolve(rootDir, targetArg) : path.resolve(rootDir, "src");

const project = new Project({
  tsConfigFilePath: path.resolve(rootDir, "tsconfig.json"),
  skipAddingFilesFromTsConfig: true,
});

project.addSourceFilesAtPaths([path.join(globRoot, "**/*.ts"), path.join(globRoot, "**/*.tsx")]);

let filesChanged = 0;
let callsRewritten = 0;
const collisions: string[] = [];

for (const sourceFile of project.getSourceFiles()) {
  const filePath = sourceFile.getFilePath();
  if (shouldSkip(filePath)) continue;

  let fileTouched = false;

  // Collect rewrites first; mutate after to keep node references stable.
  const rewrites: { propAccess: Node; consoleMethod: string }[] = [];

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) return;

    const obj = callee.getExpression();
    if (!Node.isIdentifier(obj) || obj.getText() !== "console") return;

    const method = callee.getName();
    if (!(method in MAP)) return; // leave console.table/group/etc. untouched

    rewrites.push({ propAccess: callee, consoleMethod: method });
  });

  if (rewrites.length === 0) continue;

  for (const { propAccess, consoleMethod } of rewrites) {
    if (Node.isPropertyAccessExpression(propAccess)) {
      // console.X(...)  ->  log.Y(...)
      propAccess.getExpression().replaceWithText("log");
      propAccess.getNameNode().replaceWithText(MAP[consoleMethod]);
      callsRewritten++;
      fileTouched = true;
    }
  }

  if (!fileTouched) continue;

  // Ensure a `log` import exists and there's no conflicting binding.
  const existingLogImport = sourceFile
    .getImportDeclarations()
    .some((decl) =>
      decl.getNamedImports().some((ni) => (ni.getAliasNode()?.getText() ?? ni.getName()) === "log")
    );

  // Detect a non-import local `log` binding that would shadow our import.
  const localLogBinding = !existingLogImport
    ? sourceFile.getDescendantsOfKind(SyntaxKind.Identifier).some((id) => {
        if (id.getText() !== "log") return false;
        const parent = id.getParent();
        return (
          Node.isVariableDeclaration(parent) ||
          Node.isFunctionDeclaration(parent) ||
          Node.isParameterDeclaration(parent)
        );
      })
    : false;

  if (!existingLogImport && !localLogBinding) {
    sourceFile.addImportDeclaration({
      moduleSpecifier: IMPORT_MODULE,
      namedImports: ["log"],
    });
  } else if (localLogBinding) {
    collisions.push(filePath);
  }

  filesChanged++;
}

project.saveSync();

console.log(`\nCodemod complete.`);
console.log(`  files changed:   ${filesChanged}`);
console.log(`  calls rewritten: ${callsRewritten}`);
if (collisions.length) {
  console.log(`\n  ⚠ ${collisions.length} file(s) already bind a local \`log\` identifier;`);
  console.log(`    rewrote calls but did NOT add an import — review manually:`);
  for (const c of collisions) console.log(`      ${path.relative(rootDir, c)}`);
}
