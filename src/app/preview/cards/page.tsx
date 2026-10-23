import { HeroCard, HeroCardGrid } from "@/components/hero/hero-card";
import { cardTagline, getReleasedHeroes } from "@/lib/queries";

export const metadata = { title: "Card preview" };

/**
 * Next.js 16 Cache Components: this segment reads the database, so it is
 * allowed to block rather than be prerendered.
 */
export const instant = false;

/**
 * Temporary preview of the directory cards, ported from the mock's directory
 * in reference/deadlock-atlas.html. Delete once the directory is built.
 */
export default async function CardPreviewPage() {
  const heroes = await getReleasedHeroes();

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
        Directory cards, ported from the mock. Image is the API&apos;s{" "}
        <code>icon_hero_card</code> cropped to 200px; label is the in-game
        class; the line is Valve&apos;s own <code>playstyle</code>, falling back
        to the first sentence of the lore for the 18 heroes that have no
        playstyle; the five swatches are the hero&apos;s stored palette.
      </p>

      <HeroCardGrid>
        {heroes.map((h) => (
          <HeroCard
            key={h.slug}
            slug={h.slug}
            name={h.name}
            label={(h.heroType ?? "hero").toUpperCase()}
            tagline={cardTagline(h)}
            image={h.artwork?.images?.card ?? null}
            accent={h.accent ?? "#c09fc8"}
            palette={h.palette}
          />
        ))}
      </HeroCardGrid>
    </div>
  );
}
