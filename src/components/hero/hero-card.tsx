import Image from "next/image";
import Link from "next/link";

import { themeStyle } from "@/lib/theme";

import { NameWordmark } from "./name-wordmark";

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
 * off. So the card uses the wide `background_image` as a backdrop with the
 * portrait laid over it, both centred.
 *
 * Each card sets its own --accent, --accent-text, --on-accent, --p1..--p5 and
 * --glow, so a grid of cards keeps every hero's colours (design.md 3.6). The
 * page around them keeps the site theme.
 */
export type HeroCardProps = {
  slug: string;
  name: string;
  /** The hero's in-game class, shown as the label: MYSTIC, BRAWLER, ... */
  label: string;
  /** One line under the name. */
  tagline: string;
  /** The full lore text for hover expansion. */
  lore: string;
  /** The wide motif, 4096x2312 with an alpha channel. */
  background: string | null;
  /** The 280x380 character portrait. */
  portrait: string | null;
  /** The hero's official name wordmark. */
  wordmark?: string | null;
  /** The hero's accent. */
  accent?: string | null;
  /** Readable variant of the accent, for accent-coloured text. */
  accentText?: string | null;
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
  lore,
  background,
  portrait,
  wordmark,
  accent,
  accentText,
  palette,
  missingArtwork = false,
}: HeroCardProps) {
  const p1 = palette[0];
  const p2 = palette[1];

  return (
    <Link
      href={`/heroes/${slug}`}
      className="hero-card"
      style={{
        ...themeStyle({ accent, accentText, palette }),
        display: "block",
        textDecoration: "none",
        color: "inherit",
        position: "relative",
        // The card body carries the hero's darkest palette colours, so the
        // whole card is themed rather than just its accent.
        background: p1
          ? `linear-gradient(165deg, ${p1} 0%, ${p2 ?? "#171b27"} 44%, #12151f 100%)`
          : "#171b27",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 200,
          overflow: "hidden",
          background: "#141824",
        }}
      >
        {/* The hero's own wide motif, zoomed so its art sits behind the
            character rather than off to one side. Dimmed to a texture. */}
        {background ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${background})`,
              backgroundSize: "230% auto",
              backgroundPosition: "76% 42%",
              opacity: 0.5,
            }}
          />
        ) : null}

        {/* The accent glow, centred on the character. This is the hero's
            colour scheme, and it is what gives the card its theme. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 62% 88% at 50% 68%, var(--glow), transparent 72%)",
          }}
        />

        {/* A wash of the hero's own palette from the bottom, tying the art
            into the body. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, ${p1 ?? "#141824"} 2%, transparent 58%)`,
            opacity: 0.85,
          }}
        />

        {/* The character portrait, centred and fully visible. */}
        {portrait ? (
          <Image
            src={portrait}
            alt={`${name} artwork`}
            width={280}
            height={380}
            unoptimized
            style={{
              position: "absolute",
              left: "50%",
              bottom: 0,
              transform: "translateX(-50%)",
              height: 196,
              width: "auto",
              maxWidth: "78%",
              objectFit: "contain",
              objectPosition: "center bottom",
              filter: "drop-shadow(0 16px 30px #000b)",
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

        {/* An accent hairline along the top of the band. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background:
              "linear-gradient(to right, transparent, var(--accent), transparent)",
            opacity: 0.75,
          }}
        />
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            minHeight: 40,
          }}
        >
          {/*
            The hero's own name wordmark, tinted with their accent, exactly as
            on the banner. It is an image, so the accessible name is carried
            by hidden text in the same heading.
          */}
          <h3 style={{ margin: 0, flex: "1 1 auto", minWidth: 0 }}>
            <span className="visually-hidden">{name}</span>
            {wordmark ? (
              <NameWordmark
                src={wordmark}
                width={168}
                color="var(--accent-text)"
              />
            ) : (
              <span
                style={{
                  fontSize: 16,
                  color: "var(--accent-text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {name}
              </span>
            )}
          </h3>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: "0.08em",
              color: "var(--on-accent)",
              background: "var(--accent)",
              borderRadius: 999,
              padding: "4px 8px",
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

      {/*
        Expanded lore overlay on hover: replaces the bottom content with the
        full lore text, filling the available space.
      */}
      <div
        className="hero-card-lore"
        style={{
          position: "absolute",
          left: 14,
          right: 14,
          bottom: 14,
          maxHeight: 0,
          opacity: 0,
          overflow: "hidden",
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-card)",
          padding: 12,
          fontSize: 11,
          color: "var(--text)",
          lineHeight: 1.6,
          transition: "max-height 0.25s ease, opacity 0.2s ease",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        {lore}
      </div>

      <style>{`
        .hero-card:hover .hero-card-lore {
          max-height: 200px;
          opacity: 1;
          top: 60px;
          bottom: 14;
        }
      `}</style>
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
