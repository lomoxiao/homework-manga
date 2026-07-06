import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("iPhone photo selection", () => {
  const source=readFileSync(new URL("../src/main.ts",import.meta.url),"utf8");
  it("does not force the web upload input into camera capture mode", () => {
    const input=source.match(/<input id="web-photo-input"[^>]+>/)?.[0]??"";
    expect(input).toContain('type="file"');expect(input).toContain("image/heic");expect(input).not.toContain("capture=");
  });
});
