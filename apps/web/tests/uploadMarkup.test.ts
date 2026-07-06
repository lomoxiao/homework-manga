import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iPhone photo selection", () => {
  const source = readFileSync(new URL("../src/parent/UploadCard.tsx", import.meta.url), "utf8");
  it("does not force the web upload input into camera capture mode", () => {
    expect(source).toContain('id="web-photo-input"');
    expect(source).toContain('type="file"');
    expect(source).toContain("image/heic");
    expect(source).not.toContain("capture=");
  });
});
