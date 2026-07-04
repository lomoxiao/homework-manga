import { describe, expect, test } from "vitest";
import { ACCEPTED_IMAGE_TYPES, blobToBase64, MAX_UPLOAD_BYTES } from "../src/upload";

describe("web homework upload helpers", () => {
  test("defines the GAS upload limit and supported types", () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
    expect(ACCEPTED_IMAGE_TYPES).toContain("image/heic");
  });

  test("encodes a blob without corrupting bytes", async () => {
    expect(await blobToBase64(new Blob([new Uint8Array([0, 1, 254, 255])]))).toBe("AAH+/w==");
  });
});
