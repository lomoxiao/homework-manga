import { z } from "zod";

export const assetMetadataSchema = z.object({
  assetId: z.string().min(1),
  category: z.enum(["character", "background", "prop", "effect"]),
  filePath: z.string().min(1),
  character: z.enum(["hero", "teacher", "friend"]).optional(),
  role: z.enum(["student", "teacher", "support"]).optional(),
  emotion: z.string().optional(),
  emotionIntensity: z.number().int().min(1).max(3).optional(),
  pose: z.string().optional(),
  action: z.string().optional(),
  gaze: z.string().optional(),
  facing: z.enum(["left", "right", "front"]).optional(),
  shot: z.enum(["close", "medium", "wide"]).optional(),
  cameraAngle: z.enum(["eye-level", "high", "low"]).optional(),
  location: z.string().optional(),
  time: z.string().optional(),
  mood: z.string().optional(),
  subjectTags: z.array(z.string()),
  storyBeatTags: z.array(z.string()),
  recommendedPositions: z.array(z.string()),
  speechBubbleSafeAreas: z.array(z.string()),
  compatibleCharacters: z.array(z.string()).optional(),
  transparent: z.boolean(),
  mirrorAllowed: z.boolean(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  license: z.string().min(1)
});

export const assetCatalogSchema = z.object({ schemaVersion: z.literal("1.0"), assets: z.array(assetMetadataSchema) });
export type AssetMetadata = z.infer<typeof assetMetadataSchema>;

export type AssetQuery = {
  category: AssetMetadata["category"];
  character?: string;
  emotion?: string;
  emotionIntensity?: number;
  action?: string;
  facing?: string;
  shot?: string;
  location?: string;
  storyBeat?: string;
  preferredPosition?: string;
};

export function selectAsset(catalog: AssetMetadata[], query: AssetQuery): AssetMetadata | null {
  let candidates = catalog.filter((asset) => asset.category === query.category);
  const sameCharacter = query.character ? candidates.filter((asset) => asset.character === query.character) : [];
  if (sameCharacter.length) candidates = sameCharacter;
  if (!candidates.length) return null;
  return candidates.map((asset) => ({ asset, score: scoreAsset(asset, query) }))
    .sort((a, b) => b.score - a.score || a.asset.assetId.localeCompare(b.asset.assetId))[0].asset;
}

export function scoreAsset(asset: AssetMetadata, query: AssetQuery): number {
  if (asset.category !== query.category) return Number.NEGATIVE_INFINITY;
  let score = 0;
  if (query.character && asset.character === query.character) score += 100;
  if (query.emotion && asset.emotion === query.emotion) score += 30;
  if (query.action && (asset.action === query.action || asset.pose === query.action)) score += 25;
  if (query.storyBeat && asset.storyBeatTags.includes(query.storyBeat)) score += 20;
  if (query.shot && asset.shot === query.shot) score += 10;
  if (query.facing && asset.facing === query.facing) score += 10;
  if (query.preferredPosition && asset.recommendedPositions.includes(query.preferredPosition)) score += 5;
  if (query.location && asset.location === query.location) score += 30;
  if (query.emotionIntensity && asset.emotionIntensity) score -= Math.abs(query.emotionIntensity - asset.emotionIntensity) * 3;
  return score;
}
