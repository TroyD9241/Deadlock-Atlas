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
 * Each card sets its own --accent and its own swatches, so a grid of cards
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
  /** The card artwork. A 280x380 portrait crop in the API. */
  image: string | null;
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
  image,
  accent,
  palette,
  missingArtwork = false,
}: HeroCardProps) {
  return (
    <Link
      href={`/heroes/${slug}`}
      className="hero-card"
      style={{
        ...themeStyle({ accent, palette }),
        display: "block",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      {image ? (
        <Image
          src={image}
          alt={`${name} artwork`}
          width={280}
          height={380}
          unoptimized
          style={{
            display: "block",
            width: "100%",
            height: 200,
            objectFit: "cover",
            // The API's card art is a portrait crop; show the upper third.
            objectPosition: "center 25%",
            background: "#202431",
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            height: 200,
            background:
              "linear-gradient(140deg, #202638, #10131c)",
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
      )}

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
              color: "#d5c7e2",
              border: "1px solid #ffffff22",
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
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {tagline}
          </p>
        ) : (
          <div style={{ height: 12 + 12 + 5 }} />
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
