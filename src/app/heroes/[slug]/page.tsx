import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HeroBanner } from "@/components/hero/hero-banner";
import { getHero } from "@/lib/queries";

export const metadata = { title: "Hero profile" };
export const instant = false;

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

  // Group abilities by slot type for display
  const signatureAbilities = abilities.filter((a) => a.slot.startsWith("signature"));
  const innateAbilities = abilities.filter((a) => a.slot.startsWith("ability_innate"));

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Hero banner */}
      <HeroBanner
        name={hero.name}
        eyebrow={(hero.heroType ?? "hero").toUpperCase()}
        tagline={hero.officialPlaystyle ? hero.officialPlaystyle.split(".")[0] + "." : ""}
        description={hero.officialPlaystyle ?? hero.officialLore ?? ""}
        accent={hero.accent ?? "#c09fc8"}
        palette={palette}
        art={art}
      />

      {/* Quick stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        <div
          className="stat"
          style={{
            border: "1px solid var(--line)",
            background: "#ffffff07",
            borderRadius: 14,
            padding: "15px 17px",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.17em",
              color: "var(--accent)",
              fontWeight: 850,
            }}
          >
            COMPLEXITY
          </div>
          <div style={{ fontSize: 14, marginTop: 5 }}>
            {hero.complexity != null ? `${hero.complexity} / 3` : "[not available]"}
          </div>
        </div>
        <div
          style={{
            border: "1px solid var(--line)",
            background: "#ffffff07",
            borderRadius: 14,
            padding: "15px 17px",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.17em",
              color: "var(--accent)",
              fontWeight: 850,
            }}
          >
            TYPE
          </div>
          <div style={{ fontSize: 14, marginTop: 5 }}>
            {(hero.heroType ?? "[not available]").toUpperCase()}
          </div>
        </div>
        <div
          style={{
            border: "1px solid var(--line)",
            background: "#ffffff07",
            borderRadius: 14,
            padding: "15px 17px",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "0.17em",
              color: "var(--accent)",
              fontWeight: 850,
            }}
          >
            MAX HEALTH
          </div>
          <div style={{ fontSize: 14, marginTop: 5 }}>
            {maxHealth(hero.startingStats)}
          </div>
        </div>
      </div>

      {/* Abilities & playstyle */}
      <section style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            marginBottom: 15,
          }}
        >
          <div>
            <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: 0 }}>
              Abilities & playstyle
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Profile layout is ready for verified hero data.
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr .8fr",
            gap: 14,
          }}
        >
          {/* Ability overview */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 18,
              background: "linear-gradient(145deg, #171b28e8, #111520e8)",
              padding: 20,
              minWidth: 0,
            }}
          >
            <h3 style={{ margin: "0 0 14px" }}>Ability overview</h3>
            <div style={{ display: "grid", gap: 9 }}>
              {signatureAbilities.map((ha) => {
                const a = ha.ability;
                const desc = a.description;
                const quip = abilityQuip(desc);
                const upgrades = abilityUpgrades(desc);
                return (
                  <article
                    key={ha.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px 1fr",
                      gap: 12,
                      padding: 13,
                      borderRadius: 12,
                      background: "#ffffff06",
                      border: "1px solid #ffffff0c",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 10,
                        background: `color-mix(in srgb, var(--accent) 20%, transparent)`,
                        color: "var(--accent)",
                        fontWeight: 850,
                        overflow: "hidden",
                      }}
                    >
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
                        <span style={{ fontSize: 10 }}>
                          {ha.slot.replace("signature", "S")}
                        </span>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px", fontSize: 13 }}>
                        {a.name}
                      </h4>
                      <p style={{ margin: 0, color: "#aeb2c3", fontSize: 12, lineHeight: 1.65 }}>
                        {quip || "[no description]"}
                      </p>
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
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 6,
                          fontSize: 8,
                          letterSpacing: "0.12em",
                          color: "var(--accent)",
                          fontWeight: 800,
                        }}
                      >
                        SIGNATURE
                      </span>
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
                  <article
                    key={ha.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "38px 1fr",
                      gap: 12,
                      padding: 13,
                      borderRadius: 12,
                      background: "#ffffff06",
                      border: "1px solid #ffffff0c",
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        display: "grid",
                        placeItems: "center",
                        borderRadius: 10,
                        background: `color-mix(in srgb, var(--accent) 20%, transparent)`,
                        color: "var(--accent)",
                        fontWeight: 850,
                        overflow: "hidden",
                      }}
                    >
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
                        <span style={{ fontSize: 10 }}>IN</span>
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: "0 0 4px", fontSize: 13 }}>
                        {a.name}
                      </h4>
                      <p style={{ margin: 0, color: "#aeb2c3", fontSize: 12, lineHeight: 1.65 }}>
                        {quip || "[no description]"}
                      </p>
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
                      <span
                        style={{
                          display: "inline-block",
                          marginTop: 6,
                          fontSize: 8,
                          letterSpacing: "0.12em",
                          color: "var(--accent)",
                          fontWeight: 800,
                        }}
                      >
                        INNATE
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Suggested build paths */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 18,
              background: "linear-gradient(145deg, #171b28e8, #111520e8)",
              padding: 20,
              minWidth: 0,
            }}
          >
            <h3 style={{ margin: "0 0 14px" }}>Suggested build paths</h3>
            <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
              Build paths are not available yet (deferred to a later milestone).
            </p>
          </div>
        </div>
      </section>

      {/* Looks & cosmetics */}
      <section style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            marginBottom: 15,
          }}
        >
          <div>
            <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: 0 }}>
              Looks & cosmetics
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Visual placeholders for skin artwork and unlock details.
            </p>
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 12 }}>
          Cosmetics are not available yet.
        </p>
      </section>

      {/* Character color study */}
      <section style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            marginBottom: 15,
          }}
        >
          <div>
            <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: 0 }}>
              Character color study
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Artwork-derived colors used to theme this page.
            </p>
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {palette.map((color, i) => (
            <div
              key={i}
              style={{
                overflow: "hidden",
                border: "1px solid #ffffff16",
                borderRadius: 12,
                background: "#ffffff05",
              }}
            >
              <div
                style={{
                  height: 70,
                  background: color,
                }}
              />
              <code
                style={{
                  display: "block",
                  padding: "8px 7px",
                  fontSize: 10,
                  textAlign: "center",
                  color: "#d9d8e5",
                }}
              >
                {color}
              </code>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#82889c", marginTop: 12 }}>
          Palette source: {hero.accentSource === "api" ? "API style_hex" : hero.accentSource}.
          {hero.needsReview ? " [needs review]" : ""}
        </p>
      </section>

      {/* Official game content */}
      <section style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            marginBottom: 15,
          }}
        >
          <div>
            <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: 0 }}>
              Official game content
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Valve&apos;s own in-game text, clearly labelled.
            </p>
          </div>
        </div>
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 18,
            background: "linear-gradient(145deg, #171b28e8, #111520e8)",
            padding: 20,
          }}
        >
          {hero.officialRole ? (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.17em",
                  color: "var(--accent)",
                  fontWeight: 850,
                  marginBottom: 4,
                }}
              >
                ROLE
              </div>
              <p style={{ margin: 0, fontSize: 14 }}>{hero.officialRole}</p>
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 16px" }}>
              [no official role]
            </p>
          )}

          {hero.officialPlaystyle ? (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.17em",
                  color: "var(--accent)",
                  fontWeight: 850,
                  marginBottom: 4,
                }}
              >
                PLAYSTYLE
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#b5b7c7" }}>
                {hero.officialPlaystyle}
              </p>
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 16px" }}>
              [no official playstyle]
            </p>
          )}

          {hero.officialLore ? (
            <div>
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.17em",
                  color: "var(--accent)",
                  fontWeight: 850,
                  marginBottom: 4,
                }}
              >
                LORE
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "#b5b7c7" }}>
                {hero.officialLore}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* Link cards */}
      <section style={{ marginTop: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 16,
            marginBottom: 15,
          }}
        >
          <div>
            <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: 0 }}>
              Sources
            </h2>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              Credited links to the Deadlock Wiki.
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gap: 9 }}>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 14,
              background: "#ffffff05",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Lore on the wiki</span>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              [wiki link not available]
            </p>
          </div>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 14,
              background: "#ffffff05",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Movement</span>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              [wiki link not available]
            </p>
          </div>
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 14,
              background: "#ffffff05",
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600 }}>Voice lines</span>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>
              [wiki link not available]
            </p>
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