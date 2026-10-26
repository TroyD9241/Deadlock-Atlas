import Link from "next/link";
import { notFound } from "next/navigation";

import { Theorycraft } from "@/components/hero/theorycraft";
import { themeStyle } from "@/lib/theme";
import { getStatMap } from "@/lib/stat-map.server";
import { parseBuild } from "@/lib/build";
import { getHero, getHeroAbilities, getItemsBySlugs } from "@/lib/queries";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hero = await getHero(slug);
  if (!hero) return { title: "Theorycraft" };
  return {
    title: `${hero.name} theorycraft`,
    description: `Build and compare loadouts for ${hero.name}.`,
  };
}

/** The API's popular picks for a hero, by match stage. */
function popularBuilds(raw: unknown) {
  const empty = { early: [], mid: [], late: [] } as {
    early: { className: string; pickPct: number; winRatePct: number }[];
    mid: { className: string; pickPct: number; winRatePct: number }[];
    late: { className: string; pickPct: number; winRatePct: number }[];
  };

  if (!raw || typeof raw !== "object") return empty;
  const data = raw as {
    early_game?: unknown;
    mid_game?: unknown;
    late_game?: unknown;
  };

  const read = (list: unknown) => {
    if (!Array.isArray(list)) return [];
    return list
      .map((entry) => {
        const e = entry as {
          class_name?: string;
          pick_pct?: number;
          winrate_pct?: number;
        };
        if (!e?.class_name) return null;
        return {
          className: e.class_name,
          pickPct: typeof e.pick_pct === "number" ? e.pick_pct : 0,
          winRatePct:
            typeof e.winrate_pct === "number" ? e.winrate_pct : 0,
        };
      })
      .filter((x): x is { className: string; pickPct: number; winRatePct: number } => !!x)
      .sort((a, b) => b.pickPct - a.pickPct);
  };

  return {
    early: read(data.early_game),
    mid: read(data.mid_game),
    late: read(data.late_game),
  };
}

export default async function TheorycraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ build?: string; up?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const hero = await getHero(slug);
  if (!hero) notFound();

  /*
   * The build in the URL is read on the server, so the board renders with
   * its items on the first paint rather than filling in a moment later.
   */
  const urlBuild = parseBuild(
    new URLSearchParams(
      query.build || query.up
        ? `build=${query.build ?? ""}&up=${query.up ?? ""}`
        : "",
    ),
  );
  const urlSlugs = urlBuild.items.filter(Boolean);

  const [abilities, statMap, initialItems] = await Promise.all([
    getHeroAbilities(slug),
    getStatMap(),
    getItemsBySlugs(urlSlugs),
  ]);

  return (
    <div
      className="profile theorycraft"
      style={{
        position: "relative",
        ...themeStyle({
          accent: hero.accent,
          accentText: hero.accentText,
          onAccent: hero.onAccent,
        }),
      }}
    >
      <div style={{ position: "relative", zIndex: 1 }}>
        <section className="section" style={{ marginTop: 0 }}>
          <div className="section-head">
            <div>
              <div
                className="eyebrow"
                style={{ marginBottom: 10, display: "flex", gap: 10, alignItems: "center" }}
              >
                <Link
                  href="/theorycraft"
                  style={{ color: "var(--muted)", textDecoration: "none" }}
                >
                  ← Theorycraft
                </Link>
                <span aria-hidden="true" style={{ color: "var(--line)" }}>
                  /
                </span>
                <span>{hero.name}</span>
              </div>
              <h1
                style={{
                  margin: "0 0 8px",
                  fontSize: "clamp(30px, 5vw, 46px)",
                  letterSpacing: "-0.04em",
                  fontFamily: "var(--font-display)",
                }}
              >
                {hero.name} builds
              </h1>
              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: 12,
                  maxWidth: "62ch",
                  lineHeight: 1.7,
                }}
              >
                Put items in the slots, set your abilities&apos; upgrade
                levels, and read the stat changes. Every number is computed
                from the API&apos;s stat values — the game applies hidden
                multipliers and thresholds that are not in the data, so treat
                this as a guide rather than an exact answer.
              </p>
            </div>
          </div>
        </section>

        <Theorycraft
          heroSlug={hero.slug}
          startingStats={hero.startingStats}
          initialBuild={urlBuild}
          initialItems={initialItems}
          hasUrlBuild={Boolean(query.build || query.up)}
          abilities={abilities.map((entry) => ({
            id: entry.id,
            slot: entry.slot,
            displayOrder: entry.displayOrder,
            isInnate: entry.isInnate,
            ability: {
              id: entry.ability.id,
              className: entry.ability.className,
              name: entry.ability.name,
              image: entry.ability.image,
              imageWebp: entry.ability.imageWebp,
              properties: entry.ability.properties,
              upgrades: entry.ability.upgrades,
            },
          }))}
          popular={popularBuilds(hero.popularItems)}
          statMap={statMap}
        />
      </div>
    </div>
  );
}
