import Link from "next/link";

import { HeroCard, HeroCardGrid } from "@/components/hero/hero-card";
import { cardTagline, getReleasedHeroes } from "@/lib/queries";

export const metadata = { title: "Hero directory" };
export const instant = false;

const CLASSES = ["assassin", "brawler", "marksman", "mystic"] as const;

export default async function HeroesPage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string }>;
}) {
  const { class: classFilter } = await searchParams;
  const allHeroes = await getReleasedHeroes();
  const heroes = classFilter
    ? allHeroes.filter((h) => h.heroType === classFilter)
    : allHeroes;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Characters
        </div>
        <h1 style={{ margin: "0 0 8px", fontSize: 30, letterSpacing: "-0.04em" }}>
          Hero directory
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, maxWidth: "58ch" }}>
          {heroes.length} {classFilter ? classFilter : "released"} heroes
          {classFilter ? "" : " across all classes"}. Choose a character to open their profile.
        </p>
      </section>

      <nav className="class-nav" aria-label="Filter heroes by class">
        <Link
          href="/heroes/classes"
          style={{ textDecoration: "none" }}
        >
          ALL CLASSES
        </Link>
        {CLASSES.map((c) => (
          <Link
            key={c}
            href={`/heroes?class=${c}`}
            className={classFilter === c ? "active" : ""}
            style={{ textDecoration: "none" }}
          >
            {c.toUpperCase()}
          </Link>
        ))}
      </nav>

      <HeroCardGrid>
        {heroes.map((h) => (
          <HeroCard
            key={h.slug}
            slug={h.slug}
            name={h.name}
            label={(h.heroType ?? "hero").toUpperCase()}
            tagline={cardTagline(h)}
            background={h.artwork?.images?.background ?? null}
            portrait={h.artwork?.images?.card ?? null}
            wordmark={h.artwork?.images?.nameImage ?? null}
            accent={h.accent ?? "#c09fc8"}
            accentText={h.accentText ?? null}
            lore={h.officialLore ?? ""}
            palette={h.palette}
          />
        ))}
      </HeroCardGrid>
    </div>
  );
}