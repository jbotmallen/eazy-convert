import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readSource(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf-8");
}

test("sonner is mounted and toast state is not used by app pages", () => {
  const appSource = readSource("src/App.tsx");
  assert.match(appSource, /import \{ Toaster \} from "@\/components\/ui\/sonner"/);
  assert.match(appSource, /<Toaster position="bottom-right" richColors \/>/);

  const sourceRoots = ["src/pages", "src/components", "src/hooks"];
  for (const root of sourceRoots) {
    for (const file of fs.readdirSync(path.join(repoRoot, root), { recursive: true })) {
      if (!String(file).endsWith(".tsx") && !String(file).endsWith(".ts")) continue;
      const relativePath = path.join(root, String(file));
      if (relativePath.endsWith(path.join("components", "ui", "simple-toast.tsx"))) continue;
      const source = readSource(relativePath);
      assert.doesNotMatch(source, /SimpleToast/, `${relativePath} should use sonner`);
      assert.doesNotMatch(source, /setToast/, `${relativePath} should not keep toast state`);
    }
  }
});

test("user error helper maps missing output files to plain English", () => {
  const source = readSource("src/lib/utils.ts");
  assert.match(source, /DEFAULT_USER_ERROR_MESSAGE = "An error occurred, try again or restart the app\."/);
  assert.match(source, /Output file not found\. It may have been moved or deleted\./);
  assert.match(source, /showErrorToast/);
  assert.match(source, /toast\.error/);
});
