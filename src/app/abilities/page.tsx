import Image from "next/image";
import Link from "next/link";

import { getAllAbilities } from "@/lib/queries";

export const metadata = { title: "Ability index" };
export const instant = false;

function abilityQuip(desc: unknown): string {
  if (!desc || typeof desc !== "object") return "";
  const d = desc as { quip?: string };
  return d.quip ?? "";
}

export default async function AbilitiesPage() {
  const abilities = await getAllAbilities();

  // Group by kind
  const universal = abilities.filter((a) => a.kind === "universal");
  const others = abilities.filter((a) => a.kind !== "universal");

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Mechanics
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 30, letterSpacing: "-0.04em", fontFamily: "var(--font-display)" }}>
          Ability index
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, maxWidth: "58ch" }}>
          {abilities.length} abilities across all heroes. Universal abilities are
          shared by every hero.
        </p>
      </section>

      {universal.length > 0 ? (
        <section>
          <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: "0 0 12px" }}>
            Universal abilities
          </h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            {universal.map((a) => (
              <div
                key={a.id}
                className="plate"
                style={{
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "40px 1fr",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: "#ffffff0a",
                    display: "grid",
                    placeItems: "center",
                    clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                  }}
                >
                  {a.image ? (
                    <Image
                      src={a.image}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      style={{ width: 40, height: 40, objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 9, color: "var(--muted)" }}>—</span>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                    {abilityQuip(a.description) || "[no description]"}
                  </div>
                  <span className="tag" style={{ marginTop: 4 }}>UNIVERSAL</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 style={{ fontSize: 21, letterSpacing: "-0.03em", margin: "0 0 12px" }}>
          Hero abilities
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 10,
          }}
        >
          {others.map((a) => {
            const heroes = a.heroes.map((h) => h.hero);
            return (
              <div
                key={a.id}
                className="plate"
                style={{
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "40px 1fr",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    background: "#ffffff0a",
                    display: "grid",
                    placeItems: "center",
                    clipPath: "polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)",
                  }}
                >
                  {a.image ? (
                    <Image
                      src={a.image}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      style={{ width: 40, height: 40, objectFit: "cover" }}
                    />
                  ) : (
                    <span style={{ fontSize: 9, color: "var(--muted)" }}>—</span>
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5 }}>
                    {abilityQuip(a.description) || "[no description]"}
                  </div>
                  {heroes.length > 0 ? (
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        marginTop: 4,
                      }}
                    >
                      {heroes
                        .slice(0, 5)
                        .map((h) => (
                          <Link
                            key={h.slug}
                            href={`/heroes/${h.slug}`}
                            style={{ color: "var(--accent)", textDecoration: "none" }}
                          >
                            {h.name}
                          </Link>
                        ))
                        .reduce<React.ReactNode[]>(
                          (acc, el, i) => (i === 0 ? [el] : [...acc, ", ", el]),
                          [],
                        )}
                      {heroes.length > 5 ? ` +${heroes.length - 5}` : ""}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}