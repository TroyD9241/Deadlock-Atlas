import { themeStyle } from "@/lib/theme";

import { NameWordmark } from "./name-wordmark";

/**
 * The image URLs the API gives a hero.
 *
 * `background` is the wide 4096x2312 hero motif with an alpha channel: art on
 * the right, empty space on the left, which is where the banner text goes.
 * `card` is the 280x380 character cutout. Both come from the API's own CDN,
 * so no Valve artwork is stored in this repository.
 */
export type HeroArt = {
  background: string | null;
  card: string | null;
  cardCritical: string | null;
  cardGloat: string | null;
  small: string | null;
  vertical: string | null;
  nameImage: string | null;
};

export type HeroBannerProps = {
  name: string;
  /** Eyebrow line. The hero's in-game class, e.g. "MYSTIC". */
  eyebrow: string;
  /** Our own one-liner. */
  tagline: string;
  /** The body copy. */
  description: string;
  /** The hero's accent, from colors.style_hex in the API. */
  accent: string;
  /** The hero's five-colour palette, darkest to lightest. */
  palette: string[];
  art: HeroArt | null;
};

/**
 * Hero banner — design.md section 2.2, ported from
 * reference/deadlock-atlas.html.
 *
 * The mock puts the name and description on the left and a contained cutout on
 * the right, over a gradient base with a radial accent glow. The API's
 * background_image has the same shape: a wide motif with the art on the right
 * and clear space on the left, so the text sits over that instead.
 */
export function HeroBanner({
  name,
  eyebrow,
  tagline,
  description,
  accent,
  palette,
  art,
}: HeroBannerProps) {
  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-hero)",
        minHeight: 460,
        display: "grid",
        gridTemplateColumns: "1fr",
        background: "linear-gradient(115deg, #121621 0%, #191724 56%, #282039 100%)",
        boxShadow: "0 24px 90px #0008",
        ...themeStyle({ accent, palette }),
      }}
    >
      {/* The hero's own motif, full bleed. This is the main hero image. */}
      {art?.background ? (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${art.background})`,
            backgroundSize: "cover",
            backgroundPosition: "center right",
            opacity: 1,
            // Fade the left edge so the text always has a dark field to sit on.
            // Less aggressive fade to show more of the character's body.
            maskImage:
              "linear-gradient(to right, transparent 0%, transparent 8%, #000 40%)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent 0%, transparent 8%, #000 40%)",
          }}
        />
      ) : null}

      {/* Radial glow, in the accent (design.md 2.2). Decorative. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at 75% 38%, var(--glow), transparent 54%)",
        }}
      />

      {/* Dark gradient on the left for text readability over the background. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, #0b0e17 0%, #0b0e1799 25%, transparent 50%)",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "clamp(28px,5vw,60px)",
          alignSelf: "center",
          maxWidth: 520,
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 17, fontFamily: "var(--font-display)" }}>
          {eyebrow}
        </div>
        {/*
          The hero's official name art, tinted with the hero's accent. It is
          an image, so the accessible name is carried by the heading text
          below it for screen readers.
        */}
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: "clamp(44px,7vw,82px)",
            lineHeight: 0.9,
            letterSpacing: "-0.065em",
          }}
        >
          <span className="visually-hidden">{name}</span>
          <NameWordmark
            src={art?.nameImage ?? null}
            width={340}
            color="var(--accent)"
          />
        </h1>
        <div
          style={{
            fontSize: 8,
            letterSpacing: "0.16em",
            color: "var(--accent-text)",
            fontWeight: 800,
            opacity: 0.7,
            marginBottom: 6,
          }}
        >
          OFFICIAL IN-GAME TEXT
        </div>
        <div
          style={{
            fontSize: "clamp(18px,2vw,24px)",
            color: "#e7dfee",
            marginBottom: 14,
            fontFamily: "var(--font-display)",
          }}
        >
          {tagline}
        </div>
        <p
          style={{
            color: "#b5b7c7",
            maxWidth: 470,
            lineHeight: 1.8,
            margin: 0,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          {description}
        </p>
        <div className="hero-buttons">
          <a className="primary" href="#abilities">
            EXPLORE ABILITIES ↓
          </a>
          <a className="secondary" href="#palette">
            VIEW COLOR STUDY
          </a>
        </div>
      </div>

      {/* Character cutout removed — the background motif is now the main image. */}
    </section>
  );
}
