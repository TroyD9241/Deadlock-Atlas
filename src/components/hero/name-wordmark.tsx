/**
 * The hero's own name wordmark.
 *
 * The API's `name_image` is the official in-game name art. For Apollo it is
 * byte-for-byte the same file as the Deadlock Wiki's `Apollo_name.svg`, and
 * every hero has their own distinct typography: Celeste gets a decorative
 * serif with a swash, Mina a spiked one, Deadman Danny a chunky one.
 *
 * The SVG is white with a transparent background, which means it is meant to
 * be tinted. Rendering it as a CSS mask fills the shapes with a colour we
 * control, so the wordmark can take the hero's own accent exactly, with no
 * colour matching and no filter, and stay crisp at any size.
 */
export type NameWordmarkProps = {
  /** The hero's `name_image` URL. */
  src: string | null;
  /**
   * Width of the wordmark frame in pixels.
   *
   * Every wordmark is drawn in the same 1198x605 frame, but the glyphs fill
   * different fractions of it: Celeste's nearly fills it, Abrams' uses about
   * two thirds. Sizing by width keeps every logo the same width, so the
   * difference in apparent size is the artwork's own, exactly as in the game.
   */
  width?: number;
  /** Height of the wordmark frame in pixels. Defaults from the width. */
  height?: number;
  /** The fill colour. Defaults to the surrounding --accent. */
  color?: string;
  /** Align within its box: "left" | "center" | "right". */
  align?: "left" | "center" | "right";
  className?: string;
  style?: React.CSSProperties;
};

/** The shared viewBox every name wordmark is drawn in. */
const FRAME_ASPECT = 1198 / 605;

export function NameWordmark({
  src,
  width = 240,
  height,
  color,
  align = "left",
  className,
  style,
}: NameWordmarkProps) {
  if (!src) return null;

  const boxHeight = height ?? Math.round(width / FRAME_ASPECT);

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        display: "block",
        width,
        height: boxHeight,
        maxWidth: "100%",
        backgroundColor: color ?? "var(--accent)",
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition:
          align === "center" ? "center" : align === "right" ? "right center" : "left center",
        maskPosition:
          align === "center" ? "center" : align === "right" ? "right center" : "left center",
        ...style,
      }}
    />
  );
}
