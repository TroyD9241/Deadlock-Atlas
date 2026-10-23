import Image from "next/image";
import Link from "next/link";

import { themeStyle } from "@/lib/theme";

/**
 * Hero card — the directory card from reference/deadlock-atlas.html.
 *
 * The mock used a <button> because it was a single-page mock with no routes.
 * Here a card is a real link to the hero's page: design.md section 6 requires
 * that every clickable thing is a real link or button, and a link is also
 * crawlable.
 *
 * Artwork. The API's `icon_hero_card` is a 280x380 portrait crop and the mock
 * crops its image to a 200px landscape band, which cuts most of the character
 * off. So the card uses the wide `background_image` motif as the backdrop and
 * layers the portrait over it, sized to fit the band and fully visible.
 *
 * Each card sets its own --accent, --p1..--p5 and --glow, so a grid of cards
 * keeps every hero's colours (design.md 3.6). The page around them keeps the
 * site theme.
 */
export type HeroCardProps = {
  slug: string;
  name: string;
  /** The hero's in-game class, shown as the label: MYSTIC, BRAWLER, ... */
  label: string;
  /** One line under the name. */
  tagline: string;
  /** The wide motif, 4096x2312 with an alpha channel. */
  background: string | null;
  /** The 280x380 character portrait. */
  portrait: string | null;
  /** The hero's accent. */
  accent: string;
  /** Five colours, darkest to lightest. */
  palette: string[];
  /** True when the hero has no verified artwork yet. */
  missingArtwork?: boolean;
};

export function HeroCard({
  slug,
  name,
  label,
  tagline,
  background,
  portrait,
  accent,
  palette,
  missingArtwork = false,
}: HeroCardProps) {
  const p1 = palette[0];

  return (
    <Link
      href={`/heroes/${slug}`}
      className="hero-card"
      style={{
        ...themeStyle({ accent, palette }),
        display: "block",
        textDecoration: "none",
        color: "inherit",
        // The card body carries the hero's darkest palette colour, so the
        // whole card is themed rather than just its accent.
        background: p1
          ? `linear-gradient(160deg, ${p1} 0%, #171b27 62%)`
          : "#171b27",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 200,
          overflow: "hidden",
          background: "#202431",
        }}
      >
        {/* The hero's own wide motif, filling the band. Dimmed so a busy
            motif never competes with the portrait in front of it. */}
        {background ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${background})`,
              backgroundSize: "cover",
              backgroundPosition: "right center",
              opacity: 0.8,
            }}
          />
        ) : null}

        {/* A tint from the hero's palette, so the band reads as themed even
            where the motif is empty. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to right, ${p1 ?? "#141824"} 0%, transparent 58%)`,
            opacity: 0.9,
          }}
        />

        {/* A soft accent glow along the bottom, tying the portrait to the band. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "55%",
            background:
              "radial-gradient(ellipse at 78% 100%, var(--glow), transparent 70%)",
            opacity: 0.7,
          }}
        />

        {/* The character portrait, fully visible and sized to the band. */}
        {portrait ? (
          <Image
            src={portrait}
            alt={`${name} artwork`}
            width={280}
            height={380}
            unoptimized
            style={{
              position: "absolute",
              right: 6,
              bottom: 0,
              height: 190,
              width: "auto",
              maxWidth: "62%",
              objectFit: "contain",
              objectPosition: "center bottom",
              filter: "drop-shadow(0 12px 26px #000b)",
            }}
          />
        ) : null}

        {!background && !portrait ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            No artwork
          </div>
        ) : null}
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <h3 style={{ fontSize: 16, margin: 0 }}>{name}</h3>
          <span
            style={{
              fontSize: 10,
              color: "var(--accent)",
              border: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              borderRadius: 999,
              padding: "4px 7px",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        </div>

        {tagline ? (
          <p
            style={{
              fontSize: 12,
              color: "var(--muted)",
              margin: "5px 0 12px",
              minHeight: 36,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tagline}
          </p>
        ) : (
          <div style={{ height: 53 }} />
        )}

        {/* The hero's palette, darkest to lightest. */}
        <div style={{ display: "flex", gap: 5 }} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              title={palette[i] ? `--p${i + 1} ${palette[i]}` : undefined}
              style={{
                height: 7,
                flex: 1,
                borderRadius: 999,
                background: palette[i] ?? "transparent",
                border: palette[i] ? "none" : "1px solid var(--line)",
              }}
            />
          ))}
        </div>

        {missingArtwork ? (
          <span
            style={{
              display: "block",
              marginTop: 8,
              fontSize: 10,
              color: "var(--muted)",
            }}
          >
            [artwork not verified]
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/**
 * The card grid. The mock uses three columns, dropping to two under 780px
 * and one under 480px (design.md section 7).
 */
export function HeroCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}
