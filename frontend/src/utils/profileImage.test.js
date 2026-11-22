import test from "node:test";
import assert from "node:assert/strict";
import { validateProfileImage } from "./profileImage.js";

test("accepts supported image types within the upload limit", () => {
  assert.equal(validateProfileImage({ type: "image/png", size: 1024 }), "");
  assert.equal(validateProfileImage({ type: "image/webp", size: 5 * 1024 * 1024 }), "");
});

test("rejects unsupported, empty, and oversized profile images", () => {
  assert.match(validateProfileImage(null), /Choose an image/);
  assert.match(validateProfileImage({ type: "image/gif", size: 1024 }), /JPEG, PNG, or WebP/);
  assert.match(
    validateProfileImage({ type: "image/jpeg", size: 5 * 1024 * 1024 + 1 }),
    /5 MB or smaller/,
  );
});
