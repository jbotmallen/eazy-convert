import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  assertBackgroundRemovalOutputFormat,
  getBackgroundRemovalInputMimeType,
  getBackgroundRemovalOutputPath,
  getBackgroundRemovalPublicPath,
  parseBackgroundRemovalOptions,
} from "../dist-electron/utils/imageBackgroundRemoval.js";

test("parseBackgroundRemovalOptions defaults to PNG output", () => {
  assert.deepEqual(parseBackgroundRemovalOptions(undefined), { outputFormat: "png" });
});

test("parseBackgroundRemovalOptions accepts WebP output", () => {
  assert.deepEqual(parseBackgroundRemovalOptions({ outputFormat: "webp" }), { outputFormat: "webp" });
});

test("assertBackgroundRemovalOutputFormat rejects unsupported output", () => {
  assert.throws(() => assertBackgroundRemovalOutputFormat("jpg"), /Invalid background removal output format/);
});

test("getBackgroundRemovalOutputPath appends no-bg timestamp beside source", () => {
  const outputPath = getBackgroundRemovalOutputPath(
    path.join("D:\\", "Images", "shirt.photo.jpg"),
    "png",
    new Date("2026-05-13T04:05:06"),
  );

  assert.equal(outputPath, path.join("D:\\", "Images", "shirt.photo_no-bg_20260513-040506.png"));
});

test("getBackgroundRemovalPublicPath points at package dist as file URL", () => {
  const publicPath = getBackgroundRemovalPublicPath(
    path.join("D:\\", "app", "node_modules", "@imgly", "background-removal-node", "dist", "index.cjs"),
    (filePath) => filePath.replace("app.asar", "app.asar.unpacked"),
  );

  assert.match(publicPath, /^file:\/\/\/D:\/app\/node_modules\/@imgly\/background-removal-node\/dist\/$/);
});

test("getBackgroundRemovalInputMimeType maps supported image inputs", () => {
  assert.equal(getBackgroundRemovalInputMimeType(".png"), "image/png");
  assert.equal(getBackgroundRemovalInputMimeType(".jpeg"), "image/jpeg");
  assert.equal(getBackgroundRemovalInputMimeType(".jpg"), "image/jpeg");
  assert.equal(getBackgroundRemovalInputMimeType(".webp"), "image/webp");
  assert.equal(getBackgroundRemovalInputMimeType(".tiff"), null);
});
