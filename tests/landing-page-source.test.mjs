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

test("public landing page includes supplied product links and contact channels", () => {
  const source = readSource("src/pages/LandingPage.tsx");

  assert.match(source, /https:\/\/github\.com\/jbotmallen\/eazy-convert\/releases\/tag\/v1\.0\.0/);
  assert.match(source, /https:\/\/github\.com\/jbotmallen\/eazy-convert/);
  assert.match(source, /mailto:markosallenus@gmail\.com/);
  assert.match(source, /https:\/\/www\.linkedin\.com\/in\/mark-allen-jugalbot-b60a5a1b6\//);
  assert.match(source, /Future Roadmap/);
  assert.match(source, /Next local tools after desktop v1/);
  assert.match(source, /Reusable compression and trim presets/);
  assert.doesNotMatch(source, /Cloud-safe web demo mode/);
  assert.match(source, /Contact Me/);
});

test("desktop tool launcher remains available on a separate app route", () => {
  const appSource = readSource("src/App.tsx");
  const navbarSource = readSource("src/components/Navbar.tsx");

  assert.match(appSource, /AppHomePage/);
  assert.match(appSource, /path="\/app"/);
  assert.match(navbarSource, /to="\/app"/);
});

test("navbar GitHub source control opens in the default browser", () => {
  const navbarSource = readSource("src/components/Navbar.tsx");

  assert.match(navbarSource, /window\.api\.openExternal\("https:\/\/github\.com\/jbotmallen\/eazy-convert"\)/);
  assert.doesNotMatch(navbarSource, /to="https:\/\/github\.com\/jbotmallen\/eazy-convert"/);
});

test("landing-only web mode hides app chrome and redirects every route to landing", () => {
  const appSource = readSource("src/App.tsx");

  assert.match(appSource, /VITE_LANDING_ONLY/);
  assert.match(appSource, /landingOnly/);
  assert.match(appSource, /path="\*"/);
  assert.match(appSource, /<LandingPage landingOnly/);
});
