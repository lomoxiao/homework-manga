import { describe, expect, test } from "vitest";
import { buildDriveThumbnailUrl, resolveDriveDisplayUrl } from "../src/driveImage";

const fileId = "11-VKmpRPaoqL4Qo0ADs7uXQwWHfnlBr9";

describe("Drive image display URLs", () => {
  test("builds a thumbnail URL for an existing job", () => {
    expect(buildDriveThumbnailUrl(fileId)).toBe(`https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`);
  });

  test("uses a valid display URL from a new job", () => {
    const displayUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w2000`;
    expect(resolveDriveDisplayUrl({ fileId, displayUrl })).toBe(displayUrl);
  });

  test("rejects invalid IDs and untrusted display URLs", () => {
    expect(buildDriveThumbnailUrl("../bad")).toBeUndefined();
    expect(resolveDriveDisplayUrl({ fileId: "../bad", displayUrl: "https://evil.example/image.jpg" })).toBeUndefined();
  });
});
