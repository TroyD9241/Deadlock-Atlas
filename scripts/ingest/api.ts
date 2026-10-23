/**
 * Deadlock API client for the assets group.
 *
 * Reference: https://api.deadlock-api.com/docs#tag-group/assets
 * Spec:      https://api.deadlock-api.com/openapi.json
 *
 * Every response is cached under data/raw/<clientVersion>/ so ingests are
 * reproducible and an API outage cannot block work (Plan section 3).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const API_BASE = "https://api.deadlock-api.com";

/**
 * `language` takes a full language name, not a code. `language=en` returns a
 * 400 listing every valid value.
 */
export const LANGUAGE = "english";

export const RAW_DIR = path.resolve(process.cwd(), "data/raw");

/** Assets endpoints that need no path parameter. */
const SIMPLE_ENDPOINTS = [
  "accolades",
  "build-tags",
  "client-versions",
  "colors",
  "convars",
  "fonts",
  "generic-data",
  "heroes",
  "heroes-active",
  "icons",
  "images",
  "items",
  "loot-tables",
  "map",
  "misc-entities",
  "models",
  "modifiers",
  "npc-units",
  "ranks",
  "ranked-seasons",
  "sounds",
  "steam-info",
  "steam-info/all",
] as const;

/**
 * Endpoints needing path parameters, plus whether we cache the body.
 *
 * The bucket indexes (sounds alone is ~18 MB) are a CDN file listing rather
 * than game data we read, so they are surveyed but not cached.
 */
const EXPANDED: Array<{ name: string; path: (cv: number) => string; cache: string | null }> = [
  {
    name: "items-by-type:ability",
    path: (cv) => `items/by-type/ability?language=${LANGUAGE}&client_version=${cv}`,
    cache: "items-by-type-ability.json",
  },
  {
    name: "items-by-type:weapon",
    path: (cv) => `items/by-type/weapon?language=${LANGUAGE}&client_version=${cv}`,
    cache: "items-by-type-weapon.json",
  },
  {
    name: "items-by-type:upgrade",
    path: (cv) => `items/by-type/upgrade?language=${LANGUAGE}&client_version=${cv}`,
    cache: "items-by-type-upgrade.json",
  },
  {
    name: "items-by-slot:weapon",
    path: (cv) => `items/by-slot-type/weapon?language=${LANGUAGE}&client_version=${cv}`,
    cache: "items-by-slot-weapon.json",
  },
  {
    name: "items-by-slot:vitality",
    path: (cv) => `items/by-slot-type/vitality?language=${LANGUAGE}&client_version=${cv}`,
    cache: "items-by-slot-vitality.json",
  },
  {
    name: "items-by-slot:spirit",
    path: (cv) => `items/by-slot-type/spirit?language=${LANGUAGE}&client_version=${cv}`,
    cache: "items-by-slot-spirit.json",
  },
];

const SIMPLE_CACHE: Record<string, string | null> = {
  accolades: "accolades.json",
  "build-tags": "build-tags.json",
  "client-versions": "client-versions.json",
  colors: "colors.json",
  convars: "convars.json",
  "generic-data": "generic-data.json",
  heroes: "heroes.json",
  "heroes-active": "heroes-active.json",
  items: "items.json",
  map: "map.json",
  "misc-entities": "misc-entities.json",
  modifiers: "modifiers.json",
  "npc-units": "npc-units.json",
  ranks: "ranks.json",
  "ranked-seasons": "ranked-seasons.json",
  "steam-info/all": "steam-info-all.json",
  // Surveyed but not cached: these are CDN bucket listings, not game data.
  fonts: null,
  icons: null,
  images: null,
  models: null,
  sounds: null,
  "steam-info": null,
  "loot-tables": null,
};

export type EndpointResult = {
  name: string;
  url: string;
  status: number;
  bytes: number;
  rows: number | null;
  cached: string | null;
  error: string | null;
};

export type Sweep = {
  clientVersion: number;
  totalBuilds: number;
  fetchedAt: string;
  results: EndpointResult[];
  directory: string;
};

/** Newest known game build. This is the version key for everything we store. */
export async function latestClientVersion(): Promise<{
  clientVersion: number;
  total: number;
}> {
  const res = await fetch(`${API_BASE}/v1/assets/client-versions`);
  if (!res.ok) throw new Error(`client-versions failed: HTTP ${res.status}`);
  const versions = (await res.json()) as number[];
  return { clientVersion: Math.max(...versions), total: versions.length };
}

/**
 * Hit every assets endpoint once and cache the bodies we care about.
 *
 * Sequential on purpose: the API sheds load and returns 503 with Retry-After
 * when hit in parallel from one client.
 */
export async function sweepAssets(opts?: {
  clientVersion?: number;
  onResult?: (r: EndpointResult) => void;
}): Promise<Sweep> {
  const { clientVersion, total } = opts?.clientVersion
    ? { clientVersion: opts.clientVersion, total: 0 }
    : await latestClientVersion();

  const dir = path.join(RAW_DIR, String(clientVersion));
  await mkdir(dir, { recursive: true });

  const results: EndpointResult[] = [];

  const targets: Array<{ name: string; path: string; cache: string | null }> = [
    ...SIMPLE_ENDPOINTS.map((e) => {
      // Heroes and items need a language and a build to be meaningful.
      const needsVersion =
        e === "heroes" || e === "heroes-active" || e === "items";
      // `only_active=true` is the API's own definition of released. Its
      // `in_development` flag lags, and still marks Baba and Violet as in
      // development when both are live and playable.
      const extra =
        e === "heroes-active" ? "&only_active=true" : "";
      return {
        name: e,
        path: needsVersion
          ? `assets/${e.replace("-active", "")}?language=${LANGUAGE}&client_version=${clientVersion}${extra}`
          : `assets/${e}`,
        cache: SIMPLE_CACHE[e] ?? null,
      };
    }),
    ...EXPANDED.map((e) => ({
      name: e.name,
      path: `assets/${e.path(clientVersion)}`,
      cache: e.cache,
    })),
  ];

  for (const t of targets) {
    const url = `${API_BASE}/v1/${t.path}`;
    const result: EndpointResult = {
      name: t.name,
      url,
      status: 0,
      bytes: 0,
      rows: null,
      cached: null,
      error: null,
    };

    try {
      const res = await fetch(url);
      const text = await res.text();
      result.status = res.status;
      result.bytes = Buffer.byteLength(text);

      if (!res.ok) {
        result.error = `HTTP ${res.status}`;
      } else {
        try {
          const parsed: unknown = JSON.parse(text);
          result.rows = Array.isArray(parsed) ? parsed.length : null;
          if (t.cache) {
            await writeFile(path.join(dir, t.cache), text, "utf8");
            result.cached = t.cache;
          }
        } catch {
          result.error = "response was not JSON";
        }
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
    }

    results.push(result);
    opts?.onResult?.(result);
  }

  const sweep: Sweep = {
    clientVersion,
    totalBuilds: total,
    fetchedAt: new Date().toISOString(),
    results,
    directory: path.relative(process.cwd(), dir),
  };

  await writeFile(
    path.join(dir, "_sweep.json"),
    JSON.stringify(sweep, null, 2),
    "utf8",
  );

  return sweep;
}

export function endpointNames(): string[] {
  return [...SIMPLE_ENDPOINTS, ...EXPANDED.map((e) => e.name)];
}