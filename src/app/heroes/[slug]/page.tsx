import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HeroBanner } from "@/components/hero/hero-banner";
import { ModelSection } from "@/components/hero/model-section";
import { BuildSummary } from "@/components/hero/build-summary";
import { AbilityIconField, type FieldIcon } from "@/components/hero/ability-icon-field";
import { themeStyle } from "@/lib/theme";
import { getStatMap } from "@/lib/stat-map.server";
import { getHero, getHeroesByClass, getItemIndex } from "@/lib/queries";

export const instant = false;

const CLASSES = ["assassin", "brawler", "marksman", "mystic"] as const;

function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function maxHealth(stats: unknown): string {
  if (!stats || typeof stats !== "object") return "[not available]";
  const s = stats as Record<string, { value?: number }>;
  const hp = s.max_health?.value;
  if (typeof hp !== "number") return "[not available]";
  return String(hp);
}

function abilityQuip(desc: unknown): string {
  if (!desc || typeof desc !== "object") return "";
  const d = desc as { quip?: string };
  return d.quip ?? "";
}

function abilityUpgrades(desc: unknown): string[] {
  if (!desc || typeof desc !== "object") return [];
  const d = desc as { t1_desc?: string; t2_desc?: string; t3_desc?: string };
  return [d.t1_desc, d.t2_desc, d.t3_desc].filter(Boolean) as string[];
}

function taglineFor(hero: { officialRole: string | null; officialPlaystyle: string | null; officialLore: string | null }): string {
  if (hero.officialRole) return hero.officialRole;
  if (hero.officialPlaystyle) {
    const m = hero.officialPlaystyle.match(/^(.+?[.!?])(\s|$)/);
    return (m ? m[1] : hero.officialPlaystyle).trim();
  }
  if (hero.officialLore) {
    const m = hero.officialLore.match(/^(.+?[.!?])(\s|$)/);
    return (m ? m[1] : hero.officialLore).trim();
  }
  return "[not available]";
}

function descriptionFor(hero: { officialPlaystyle: string | null }): string | null {
  return hero.officialPlaystyle ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hero = await getHero(slug);
  if (!hero) return { title: "Hero profile" };
  return {
    title: hero.name,
    description: hero.officialRole ?? hero.officialPlaystyle ?? undefined,
  };
}

export default async function HeroProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hero = await getHero(slug);

  if (!hero) notFound();

  const art = hero.artwork?.images ?? null;
  const palette = hero.palette ?? [];
  const abilities = hero.abilities ?? [];

  const signatureAbilities = abilities
    .filter((a) => a.slot.startsWith("signature"))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const innateAbilities = abilities
    .filter((a) => a.slot.startsWith("ability_innate"))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const universalAbilities = abilities
    .filter(
      (a) =>
        a.slot.startsWith("ability_") &&
        !a.slot.startsWith("ability_innate"),
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const classHeroes = hero.heroType
    ? await getHeroesByClass(hero.heroType)
    : [];

  // The build summary needs each item's properties to compute the deltas.
  const itemIndex = await getItemIndex();

  // The curated modifier map, read on the server.
  const statMap = await getStatMap();

  /*
   * The hero's own ability icons, for the banner's background texture.
   * The API gives every hero ability class its own art, so Mina's banner
   * carries her bat icons. Signature and innate abilities are the hero's
   * own and read large; the shared universal ones stay small and faint.
   */
  const abilityIcons: FieldIcon[] = [];
  const seenIcons = new Set<string>();
  for (const ha of hero.abilities ?? []) {
    const src = ha.ability.imageWebp ?? ha.ability.image;
    if (!src || seenIcons.has(src)) continue;
    seenIcons.add(src);
    abilityIcons.push({
      src,
      emphasis: ha.slot.startsWith("signature") || ha.slot.startsWith("ability_innate") ? 1 : 0,
    });
  }
  abilityIcons.sort((a, b) => (b.emphasis ?? 0) - (a.emphasis ?? 0));

  return (
    <div
      className="profile"
      style={{
        position: "relative",
        ...themeStyle({ accent: hero.accent, accentText: hero.accentText, onAccent: hero.onAccent, palette }),
      }}
    >
      {/*
        The page background: a hero-tinted wash over the site's own gradient,
        with the hero's ability icons scattered through it. The layer is
        viewport-sized and sticky, so the icons drift behind the sections as
        the page scrolls. Decorative only.
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <div style={{ position: "sticky", top: 0, height: "100vh", overflow: "hidden" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 92% 62% at 50% 0%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 72%)",
            }}
          />
          <AbilityIconField
            icons={abilityIcons}
            seed={hero.slug}
            opacity={0.45}
            style={{
              maskImage: "linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 72%, transparent 100%)",
            }}
          />
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
      {/* Hero banner */}
      <HeroBanner
        name={hero.name}
        eyebrow={(hero.heroType ?? "hero").toUpperCase()}
        tagline={taglineFor(hero)}
        summary={hero.summary}
        description={descriptionFor(hero)}
        accent={hero.accent ?? "#c09fc8"}
        palette={palette}
        art={art}
        abilityIcons={abilityIcons}
      />

      {/* Character model */}
      {hero.model ? (
        <section className="section" id="model">
          <div className="section-head">
            <div>
              <h2>Character model</h2>
              <p>Interactive 3D view. Drag to rotate. Hover a point of interest to highlight it.</p>
            </div>
          </div>
          <ModelSection
            modelUrl={hero.model.modelUrl}
            accent={hero.accent ?? "#c09fc8"}
            fallbackImage={hero.artwork?.images?.card ?? null}
            pois={hero.pois.map((p) => ({ anchor: p.anchor, label: p.label, body: p.body }))}
          />
        </section>
      ) : (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Character model</h2>
              <p>Not available for this hero.</p>
            </div>
          </div>
        </section>
      )}



      {/* Profile switcher */}
      <div className="profile-switcher" aria-label="Switch hero profile">
        {classHeroes.map((h) => (
          <Link
            key={h.slug}
            href={`/heroes/${h.slug}`}
            className={`chip${h.slug === slug ? " active" : ""}`}
            aria-current={h.slug === slug ? "page" : undefined}
          >
            {h.name}
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="quick-stats">
        <div className="stat plate">
          <div className="stat-label">COMPLEXITY</div>
          <div className="stat-value">
            {hero.complexity != null ? `${hero.complexity} / 3` : "[not available]"}
          </div>
        </div>
        <div className="stat plate">
          <div className="stat-label">TYPE</div>
          <div className="stat-value">
            {(hero.heroType ?? "[not available]").toUpperCase()}
          </div>
        </div>
        <div className="stat plate">
          <div className="stat-label">MAX HEALTH</div>
          <div className="stat-value">{maxHealth(hero.startingStats)}</div>
        </div>
      </div>

      {/* Abilities & playstyle */}
      <section className="section" id="abilities">
        <div className="section-head">
          <div>
            <h2>Abilities &amp; playstyle</h2>
            <p>Verified hero data from the Deadlock API.</p>
          </div>
        </div>

        <div className="content-grid">
          {/* Ability overview */}
          <div className="panel">
            <h3>Ability overview</h3>
            <div className="ability-list">
              {signatureAbilities.map((ha) => {
                const a = ha.ability;
                const desc = a.description;
                const quip = abilityQuip(desc);
                const upgrades = abilityUpgrades(desc);
                return (
                  <article key={ha.id} className="ability plate">
                    <div className="ability-num">
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt=""
                          width={34}
                          height={34}
                          unoptimized
                          style={{ width: 34, height: 34, objectFit: "cover" }}
                        />
                      ) : (
                        <span>{ha.slot.replace("signature", "S")}</span>
                      )}
                    </div>
                    <div>
                      <h4>{a.name}</h4>
                      <p>{quip || "[no description]"}</p>
                      {upgrades.length > 0 ? (
                        <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
                          {upgrades.map((u, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 10,
                                color: "var(--accent)",
                                fontWeight: 600,
                              }}
                            >
                              T{i + 1}: {cleanHtml(u)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <span className="tag">SIGNATURE</span>
                    </div>
                  </article>
                );
              })}

              {innateAbilities.map((ha) => {
                const a = ha.ability;
                const desc = a.description;
                const quip = abilityQuip(desc);
                const upgrades = abilityUpgrades(desc);
                return (
                  <article key={ha.id} className="ability plate">
                    <div className="ability-num">
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt=""
                          width={34}
                          height={34}
                          unoptimized
                          style={{ width: 34, height: 34, objectFit: "cover" }}
                        />
                      ) : (
                        <span>IN</span>
                      )}
                    </div>
                    <div>
                      <h4>{a.name}</h4>
                      <p>{quip || "[no description]"}</p>
                      {upgrades.length > 0 ? (
                        <div style={{ marginTop: 6, display: "grid", gap: 2 }}>
                          {upgrades.map((u, i) => (
                            <span
                              key={i}
                              style={{
                                fontSize: 10,
                                color: "var(--accent)",
                                fontWeight: 600,
                              }}
                            >
                              T{i + 1}: {cleanHtml(u)}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      <span className="tag">INNATE</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Universal abilities */}
          <div className="panel">
            <h3>Universal abilities</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 12px" }}>
              Shared by every hero.
            </p>
            <div className="ability-list">
              {universalAbilities.map((ha) => {
                const a = ha.ability;
                const desc = a.description;
                const quip = abilityQuip(desc);
                return (
                  <article key={ha.id} className="ability plate">
                    <div className="ability-num">
                      {a.image ? (
                        <Image
                          src={a.image}
                          alt=""
                          width={34}
                          height={34}
                          unoptimized
                          style={{ width: 34, height: 34, objectFit: "cover" }}
                        />
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div>
                      <h4>{a.name}</h4>
                      <p>{quip || "[no description]"}</p>
                      <span className="tag">UNIVERSAL</span>
                    </div>
                  </article>
                );
              })}
            </div>

            <h3 style={{ marginTop: 20 }}>Suggested build paths</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
              Build paths are not available yet (deferred to a later milestone).
            </p>
          </div>
        </div>
      </section>

      {/* Build summary — the full tool lives on its own page */}
      <BuildSummary
        heroSlug={hero.slug}
        heroName={hero.name}
        startingStats={hero.startingStats}
        abilities={abilities}
        itemIndex={itemIndex}
        statMap={statMap}
      />

      {/* Looks & cosmetics */}
      <section className="section">
        <div className="section-head">
          <div>
            <h2>Looks &amp; cosmetics</h2>
            <p>Visual placeholders for skin artwork and unlock details.</p>
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          Cosmetics are not available yet.
        </p>
      </section>

      {/* Character color study */}
      <section className="section" id="palette">
        <div className="section-head">
          <div>
            <h2>Character color study</h2>
            <p>Artwork-derived colors used to theme this page.</p>
          </div>
        </div>
        <div className="palette-grid">
          {palette.map((color, i) => (
            <div key={i} className="palette-color">
              <div className="paint" style={{ "--paint": color } as React.CSSProperties} />
              <code>{color}</code>
            </div>
          ))}
        </div>
        <p className="footnote">
          Palette source: {hero.accentSource === "api" ? "API style_hex" : hero.accentSource}.
          {hero.needsReview ? " [needs review]" : ""}
        </p>
      </section>

      {/* Official lore (role and playstyle are shown in the banner above) */}
      {hero.officialLore ? (
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Official lore</h2>
              <p>Valve&apos;s own in-game text, clearly labelled.</p>
            </div>
          </div>
          <div className="panel">
            <div className="lore-text">
              {hero.officialLore.split(/\n\n+/).map((p, i) => (
                <p key={i}>{p.trim()}</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Sources */}
      <section className="section">
        <div className="section-head">
          <div>
            <h2>Sources</h2>
            <p>Credited links to the Deadlock Wiki.</p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 9 }}>
          <div className="plate" style={{ padding: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Lore on the wiki</div>
            <span className="tag-muted">wiki link not available</span>
          </div>
          <div className="plate" style={{ padding: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Movement</div>
            <span className="tag-muted">wiki link not available</span>
          </div>
          <div className="plate" style={{ padding: 12 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Voice lines</div>
            <span className="tag-muted">wiki link not available</span>
          </div>
        </div>
      </section>

      {/* Back link */}
      <div style={{ marginTop: 8 }}>
        <Link
          href="/heroes"
          className="back-link"
        >
          ← Back to hero directory
        </Link>
      </div>
      </div>
    </div>
  );
}