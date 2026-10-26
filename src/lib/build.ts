/**
 * The build model for the theorycraft tool.
 *
 * A build is the items in the 12 slots plus each ability's upgrade level.
 * It lives in the URL first (so a theorycraft link is shareable) and in
 * localStorage second (so the last build survives a reload). There are no
 * accounts and nothing is stored on the server.
 */

export const TOTAL_SLOTS = 12;
/** The slots a hero starts with; teams unlock the other three. */
export const BASE_SLOTS = 9;

/** The upgrade levels an ability can be at. Level 0 is the base ability. */
export type AbilityLevel = {
  /** The HeroAbility slot, e.g. "signature1". */
  slot: string;
  /** 0 = base, 1..3 = upgrade tiers. */
  level: number;
};

export type Build = {
  /** Item slugs, in slot order. Empty strings are empty slots. */
  items: string[];
  /** Each ability's upgrade level. */
  abilityLevels: AbilityLevel[];
};

export function emptyBuild(): Build {
  return { items: Array.from({ length: TOTAL_SLOTS }, () => ""), abilityLevels: [] };
}

/**
 * Parse a build from the URL.
 *
 * `?build=slug1,slug2,…` fills the slots in order, and
 * `?up=signature1:3,signature2:2` sets the ability levels.
 */
export function parseBuild(params: URLSearchParams): Build {
  const build = emptyBuild();

  const raw = params.get("build");
  if (raw) {
    const slugs = raw.split(",").map((s) => s.trim()).filter(Boolean);
    slugs.slice(0, TOTAL_SLOTS).forEach((slug, i) => {
      build.items[i] = slug;
    });
  }

  const levels = params.get("up");
  if (levels) {
    for (const entry of levels.split(",")) {
      const [slot, level] = entry.split(":").map((s) => s.trim());
      const value = Number(level);
      if (!slot || !Number.isInteger(value) || value < 0) continue;
      build.abilityLevels.push({ slot, level: value });
    }
  }

  return build;
}

/** The URL search string for a build. */
export function buildParams(build: Build): URLSearchParams {
  const params = new URLSearchParams();
  const slugs = build.items.filter(Boolean);
  if (slugs.length) params.set("build", slugs.join(","));
  if (build.abilityLevels.length) {
    params.set(
      "up",
      build.abilityLevels
        .filter((l) => l.level > 0)
        .map((l) => `${l.slot}:${l.level}`)
        .join(","),
    );
  }
  return params;
}

/** The storage key for a hero's saved build. */
export function storageKey(heroSlug: string): string {
  return `deadlock-atlas:build:${heroSlug}`;
}

/** Read a hero's saved build from localStorage, when there is one. */
export function readStoredBuild(heroSlug: string): Build | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(heroSlug));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Build>;
    const build = emptyBuild();
    if (Array.isArray(parsed.items)) {
      parsed.items
        .slice(0, TOTAL_SLOTS)
        .forEach((slug, i) => {
          build.items[i] = typeof slug === "string" ? slug : "";
        });
    }
    if (Array.isArray(parsed.abilityLevels)) {
      build.abilityLevels = parsed.abilityLevels.filter(
        (l) => typeof l?.slot === "string" && Number.isInteger(l?.level),
      );
    }
    return build;
  } catch {
    return null;
  }
}

/** Save a hero's build. Failures (private mode, quota) are ignored. */
export function writeStoredBuild(heroSlug: string, build: Build): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(heroSlug), JSON.stringify(build));
  } catch {
    // Storage is not available; the URL still carries the build.
  }
}

/** The number of souls a build costs. */
export function buildCost(
  build: Build,
  costs: Record<string, number | null>,
): number {
  return build.items.reduce((sum, slug) => {
    if (!slug) return sum;
    const cost = costs[slug];
    return sum + (typeof cost === "number" ? cost : 0);
  }, 0);
}

/**
 * The shop's per-tier purchase cap check.
 *
 * Every hero has `item_slot_info.max_purchases_for_tier: [6, 6, 6]` — how
 * many tier-1/2/3 items of each slot type can be bought in one match. It
 * does not limit what a loadout may contain, but a build that needs more
 * than that cannot be bought in a single match.
 */
export type PurchaseCap = {
  maxPerTier: number;
  /** The slot type and tier that are over the cap. */
  over: { slotType: string; tier: number; count: number }[];
};

export function purchaseCapCheck(
  build: Build,
  items: { slug: string; slotType: string | null; tier: number | null }[],
  maxPerTier = 6,
): PurchaseCap {
  const counts = new Map<string, number>();
  for (const slug of build.items) {
    if (!slug) continue;
    const item = items.find((i) => i.slug === slug);
    if (!item?.slotType || item.tier == null) continue;
    // Tier 5 has no purchase tier in the cap array (it is the last tier).
    if (item.tier < 1 || item.tier > 3) continue;
    const key = `${item.slotType}:${item.tier}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const over: PurchaseCap["over"] = [];
  for (const [key, count] of counts) {
    if (count <= maxPerTier) continue;
    const [slotType, tier] = key.split(":");
    over.push({ slotType, tier: Number(tier), count });
  }

  return { maxPerTier, over };
}
