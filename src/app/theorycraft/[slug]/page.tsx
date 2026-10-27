import Link from "next/link";
import { notFound } from "next/navigation";

import { Theorycraft } from "@/components/hero/theorycraft";
import { RankPicker } from "@/components/play-data/rank-picker";
import { themeStyle } from "@/lib/theme";
import { getStatMap } from "@/lib/stat-map.server";
import { parseBuild } from "@/lib/build";
import { getHero, getHeroAbilities, getItemsBySlugs } from "@/lib/queries";
import { getHeroItemPlayData, getHeroMatches } from "@/lib/play-data";
import {
  getAbilityMaxFirst,
  getAbilityMaxFirstSample,
  getAbilityUpgradeTiming,
} from "@/lib/ability-play-data";
import { bracketFromParam } from "@/lib/rank-brackets";

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

export default async function TheorycraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ build?: string; up?: string; rank?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const hero = await getHero(slug);
  if (!hero) notFound();

  const bracket = bracketFromParam(query.rank);

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

  /*
   * The popular picks come from live play data rather than the hero
   * record's stored `popular_items`. The stored figure is a snapshot from
   * ingest time and drifts out of date; this comes through the analytics
   * cache and is filtered by the rank bracket.
   *
   * A failure here leaves the tool intact — it just means no pick rates.
   */
  const heroApiId = hero.apiId;
  const [picks, heroMatches] = heroApiId
    ? await Promise.all([
        getHeroItemPlayData(heroApiId, bracket),
        getHeroMatches(heroApiId, bracket),
      ])
    : [[], 0];

  const popular = [...picks].sort(
    (a, b) => b.pickRatePct - a.pickRatePct,
  );

  /*
   * The ability play data: when each ability's first point is bought, and
   * what level it usually ends up at. This is the "advice" framing of the
   * same figures the hero page shows as social proof.
   */
  const [maxFirst, maxFirstSample, abilityTimings] = heroApiId
    ? await Promise.all([
        getAbilityMaxFirst(heroApiId, bracket),
        getAbilityMaxFirstSample(heroApiId, bracket),
        getAbilityUpgradeTiming(heroApiId, bracket),
      ])
    : [[], 0, []];

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

            {popular.length > 0 ? (
              <div
                className="plate"
                style={{
                  marginTop: 16,
                  padding: 16,
                  display: "grid",
                  gap: 12,
                }}
              >
                <RankPicker
                  current={bracket}
                  pathname={`/theorycraft/${hero.slug}`}
                  otherParams={[
                    ...(query.build ? [["build", query.build] as [string, string]] : []),
                    ...(query.up ? [["up", query.up] as [string, string]] : []),
                  ]}
                />
              </div>
            ) : null}
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
          popular={popular}
          bracketLabel={bracket.label}
          heroMatches={heroMatches}
          maxFirst={maxFirst}
          maxFirstSample={maxFirstSample}
          abilityTimings={abilityTimings}
          statMap={statMap}
        />
      </div>
    </div>
  );
}
