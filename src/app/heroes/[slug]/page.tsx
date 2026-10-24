import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HeroBanner } from "@/components/hero/hero-banner";
import { ModelSection } from "@/components/hero/model-section";
import { themeStyle } from "@/lib/theme";
import { getHero, getHeroesByClass } from "@/lib/queries";

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

  return (
    <div className="profile" style={themeStyle({ accent: hero.accent, accentText: hero.accentText, onAccent: hero.onAccent, palette })}>
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
            className={h.slug === slug ? "active" : ""}
            aria-current={h.slug === slug ? "page" : undefined}
          >
            {h.name}
          </Link>
        ))}
      </div>

      {/* Quick stats */}
      <div className="quick-stats">
        <div className="stat">
          <div className="stat-label">COMPLEXITY</div>
          <div className="stat-value">
            {hero.complexity != null ? `${hero.complexity} / 3` : "[not available]"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">TYPE</div>
          <div className="stat-value">
            {(hero.heroType ?? "[not available]").toUpperCase()}
          </div>
        </div>
        <div className="stat">
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
                  <article key={ha.id} className="ability">
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
                      <span className="tiny-tag">SIGNATURE</span>
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
                  <article key={ha.id} className="ability">
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
                      <span className="tiny-tag">INNATE</span>
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
                  <article key={ha.id} className="ability">
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
                      <span className="tiny-tag">UNIVERSAL</span>
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
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#b5b7c7", fontFamily: "var(--font-mono)" }}>
              {hero.officialLore}
            </p>
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
        <div style={{ display: "grid", gap: 9 }}>
          <div className="build">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Lore on the wiki</span>
            <p>[wiki link not available]</p>
          </div>
          <div className="build">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Movement</span>
            <p>[wiki link not available]</p>
          </div>
          <div className="build">
            <span style={{ fontSize: 13, fontWeight: 600 }}>Voice lines</span>
            <p>[wiki link not available]</p>
          </div>
        </div>
      </section>

      {/* Back link */}
      <div style={{ marginTop: 8 }}>
        <Link
          href="/heroes"
          style={{
            fontSize: 12,
            color: "var(--muted)",
            textDecoration: "none",
          }}
        >
          ← Back to hero directory
        </Link>
      </div>
    </div>
  );
}