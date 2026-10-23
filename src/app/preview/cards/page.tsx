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
        Directory cards, ported from the mock. The backdrop is the hero&apos;s own
        wide motif (<code>background_image</code>) and the figure is{" "}
        <code>icon_hero_card</code>, sized to fit the 200px band so the whole
        portrait shows. The label is the in-game class; the line is Valve&apos;s
        own <code>playstyle</code>, falling back to the first sentence of the
        lore for the 18 heroes that have no playstyle; the five swatches are
        the hero&apos;s stored palette.
      </p>

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
            accent={h.accent ?? "#c09fc8"}
            accentText={h.accentText ?? null}
            palette={h.palette}
          />
        ))}
      </HeroCardGrid>
    </div>
  );
}
