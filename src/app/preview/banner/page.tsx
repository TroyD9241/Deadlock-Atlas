import { db } from "@/lib/db";

import { HeroBanner, type HeroArt } from "@/components/hero/hero-banner";

export const metadata = { title: "Banner preview" };

/**
 * Next.js 16 Cache Components: this segment reads the database, which is
 * uncached data, so it must be allowed to block rather than be prerendered.
 * Pages that can be prerendered should use "use cache" instead.
 */
export const instant = false;

/**
 * Temporary preview of the banner composition, so the API art can be checked
 * before M2 builds it for real. Delete this route once the banner is signed
 * off.
 */
export default async function PreviewPage() {
  const heroes = await db.hero.findMany({
    where: { isReleased: true },
    orderBy: { name: "asc" },
    select: {
      slug: true,
      name: true,
      heroType: true,
      accent: true,
      accentText: true,
      onAccent: true,
      apiAccent: true,
      palette: true,
      artwork: true,
      officialPlaystyle: true,
      officialLore: true,
      complexity: true,
    },
  });

  const picks = heroes.filter((h) =>
    ["Celeste", "Infernus", "Mina", "Abrams", "Sinclair", "Baba"].includes(h.name),
  );

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <p style={{ color: "var(--muted)", fontSize: 12, margin: 0 }}>
        Banner preview. Backdrop is the API&apos;s <code>background_image</code>
        (4096x2312, alpha); the figure is <code>icon_hero_card</code> (280x380,
        alpha). Text sits over the empty left of the motif.
      </p>

      {picks.map((h) => {
        const artwork = h.artwork as
          | { images?: HeroArt; folder?: string }
          | null;
        return (
          <HeroBanner
            key={h.slug}
            name={h.name}
            eyebrow={`${h.heroType ?? "HERO"} · ${h.complexity ?? "?"}`}
            tagline={h.officialPlaystyle?.slice(0, 80) ?? ""}
            description={h.officialLore?.slice(0, 180) ?? ""}
            accent={h.accent ?? "#c09fc8"}
            palette={(h.palette as string[]) ?? []}
            art={artwork?.images ?? null}
          />
        );
      })}
    </div>
  );
}
