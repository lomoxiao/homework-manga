import { describe, expect, test } from "vitest";
import { remoteJobProgress } from "../src/remoteJobStatus";

describe("remote job progress", () => {
  test("distinguishes queued from active analysis", () => {
    expect(remoteJobProgress("queued")).not.toEqual(remoteJobProgress("analyzing"));
  });

  test.each(["queued", "downloading", "analyzing", "validating"])("returns display text for %s", (status) => {
    const progress = remoteJobProgress(status);
    expect(progress.title.length).toBeGreaterThan(0);
    expect(progress.detail.length).toBeGreaterThan(0);
  });
});
