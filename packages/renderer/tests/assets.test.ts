import catalog from "../assets/metadata.json";
import { assetCatalogSchema, selectAsset } from "../src/assets";

describe("asset catalog", () => {
  const parsed = assetCatalogSchema.parse(catalog);

  it("has unique asset ids", () => {
    const ids = parsed.assets.map((asset) => asset.assetId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("selects a character deterministically from semantic metadata", () => {
    const selected = selectAsset(parsed.assets, { category: "character", character: "hero", emotion: "confused", action: "thinking", storyBeat: "question" });
    expect(selected?.assetId).toBe("hero-confused-medium-front");
  });
});
