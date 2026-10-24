import Link from "next/link";

import { HeroCard } from "@/components/hero/hero-card";
import { getReleasedHeroes } from "@/lib/queries";

export const metadata = { title: "Hero classes" };
export const instant = false;

const CLASSES = ["assassin", "brawler", "marksman", "mystic"] as const;
const CLASS_BLURBS: Record<string, string> = {
  assassin: "High mobility, burst damage, picks off isolated targets.",
  brawler: "Frontline pressure, sustained damage, crowd control.",
  marksman: "Ranged DPS, scaling into the late game.",
  mystic: "Spirit damage, control, and team utility.",
};

export default async function HeroClassesPage() {
  const heroes = await getReleasedHeroes();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Characters
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 30, letterSpacing: "-0.04em" }}>
          Hero classes
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, maxWidth: "58ch" }}>
          One example from each class. Browse a full class on the directory.
        </p>
      </section>

      <nav className="class-nav" aria-label="Filter heroes by class">
        <Link href="/heroes" style={{ textDecoration: "none" }}>
          ALL HEROES
        </Link>
        {CLASSES.map((c) => (
          <Link
            key={c}
            href={`/heroes?class=${c}`}
            style={{ textDecoration: "none" }}
          >
            {c.toUpperCase()}
          </Link>
        ))}
      </nav>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
          gap: 14,
        }}
      >
        {CLASSES.map((c) => {
          const example = heroes.find((h) => h.heroType === c);
          if (!example) return null;
          const count = heroes.filter((h) => h.heroType === c).length;
          return (
            <div key={c} style={{ display: "grid", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <h2 style={{ fontSize: 18, letterSpacing: "-0.03em", margin: 0 }}>
                  {c.toUpperCase()}
                </h2>
                <span style={{ fontSize: 11, color: "var(--muted)" }}>
                  {count} heroes
                </span>
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
                {CLASS_BLURBS[c]}
              </p>
              <HeroCard
                slug={example.slug}
                name={example.name}
                label={c.toUpperCase()}
                tagline=""
                background={example.artwork?.images?.background ?? null}
                portrait={example.artwork?.images?.card ?? null}
                wordmark={example.artwork?.images?.nameImage ?? null}
                accent={example.accent ?? "#c09fc8"}
                accentText={example.accentText ?? null}
                lore={example.officialLore ?? ""}
                palette={example.palette}
              />
              <Link
                href={`/heroes?class=${c}`}
                style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}
              >
                Browse all {count} {c} heroes →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}