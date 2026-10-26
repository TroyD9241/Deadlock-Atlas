import Link from "next/link";

import { HeroCard, HeroCardGrid } from "@/components/hero/hero-card";
import { cardTagline, getReleasedHeroes } from "@/lib/queries";

export const metadata = {
  title: "Theorycraft",
  description:
    "Build and compare loadouts. Put items in the slots, set ability upgrade levels, and read the stat changes.",
};

export const instant = false;

/**
 * The theorycraft tool's front door.
 *
 * The tool needs a hero: base stats, abilities and popular picks all come
 * from one. So this page picks the hero and hands over to the tool.
 */
export default async function TheorycraftIndexPage() {
  const heroes = await getReleasedHeroes();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Build lab
        </div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 30,
            letterSpacing: "-0.04em",
            fontFamily: "var(--font-display)",
          }}
        >
          Theorycraft
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
          Put items in the slots, set each ability&apos;s upgrade level, and
          read what the build does to your stats. Every number is computed
          from the API&apos;s own stat values — the game applies hidden
          multipliers and thresholds that are not in the data, so treat this
          as a guide rather than an exact answer.
        </p>
      </section>

      <nav className="class-nav" aria-label="Theorycraft">
        <span className="chip active">CHOOSE A HERO</span>
      </nav>

      <HeroCardGrid>
        {heroes.map((h) => (
          <HeroCard
            key={h.slug}
            slug={h.slug}
            href={`/theorycraft/${h.slug}`}
            action="Theorycraft"
            name={h.name}
            label={(h.heroType ?? "hero").toUpperCase()}
            tagline={h.tagline ?? cardTagline(h)}
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

      <p
        style={{
          margin: 0,
          color: "var(--muted)",
          fontSize: 11,
          lineHeight: 1.7,
        }}
      >
        Builds live in the page URL, so a build you share is a link you can
        send. Nothing is stored on a server and there is no account.
        {" "}
        <Link href="/heroes" style={{ color: "var(--accent-text)" }}>
          Browse the hero directory →
        </Link>
      </p>
    </div>
  );
}
