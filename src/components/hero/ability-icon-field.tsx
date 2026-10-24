/**
 * Ability icon field — the hero's own ability art scattered through a
 * background gradient as texture (design.md 2.2).
 *
 * The API gives every hero ability class its own icon (Mina's are
 * `abilities/vampirebat/vampirebat_*.png`), so the field is specific to the
 * hero on the page: Mina's banner carries her bat icons, Dynamo's his.
 *
 * Layout is deterministic. Positions come from a PRNG seeded with the hero
 * slug, so a hero always gets the same arrangement and the server-rendered
 * markup matches the client. Nothing here is interactive and nothing is read
 * out: the field is aria-hidden and never takes pointer events.
 */

export type FieldIcon = {
  /** Image URL. */
  src: string;
  /**
   * 1 = hero-specific signature or innate art: large and stronger.
   * 0 = shared filler (universal abilities): small and faint.
   */
  emphasis?: number;
};

type Props = {
  icons: FieldIcon[];
  /** Stable seed, e.g. the hero slug. */
  seed: string;
  /** Multiplies every icon's opacity. */
  opacity?: number;
  style?: React.CSSProperties;
};

/** FNV-1a, so the same slug always seeds the same layout. */
function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: small, fast, deterministic. */
function mulberry32(a: number) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLUMNS = 5;
const ROWS = 3;
/** The band the field occupies, as a percentage of the container. */
const BAND = { left: 28, right: 99, top: -4, bottom: 86 };

export function AbilityIconField({ icons, seed, opacity = 1, style }: Props) {
  if (icons.length === 0) return null;

  const rand = mulberry32(hashSeed(seed));

  // A jittered grid rather than a strict one, so it reads as scattered art
  // instead of a table.
  const cells: { x: number; y: number }[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLUMNS; col += 1) {
      const spanX = (BAND.right - BAND.left) / COLUMNS;
      const spanY = (BAND.bottom - BAND.top) / ROWS;
      cells.push({
        x: BAND.left + spanX * (col + 0.5) + (rand() - 0.5) * spanX * 0.7,
        y: BAND.top + spanY * (row + 0.5) + (rand() - 0.5) * spanY * 0.7,
      });
    }
  }

  // Shuffle the cells, then take them in order, so the icon order does not
  // line up with a visible row.
  for (let i = cells.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  // Hero-specific art gets the roomier cells; filler fills the rest.
  const primary = icons.filter((i) => (i.emphasis ?? 0) > 0);
  const filler = icons.filter((i) => (i.emphasis ?? 0) === 0);

  const placed: Array<{ src: string; x: number; y: number; size: number; alpha: number; rotate: number }> = [];

  const takeCell = (index: number) => cells[index % cells.length];

  primary.forEach((icon, i) => {
    const cell = takeCell(i * 2 + 1);
    placed.push({
      src: icon.src,
      x: cell.x,
      y: cell.y,
      size: 10 + rand() * 4.5,
      alpha: 0.075 + rand() * 0.06,
      rotate: -18 + rand() * 36,
    });
  });

  filler.forEach((icon, i) => {
    const cell = takeCell(primary.length + i);
    placed.push({
      src: icon.src,
      x: cell.x,
      y: cell.y,
      size: 4.2 + rand() * 2.8,
      alpha: 0.035 + rand() * 0.035,
      rotate: -14 + rand() * 28,
    });
  });

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        // Keep the field out of the headline's column and off the corners.
        maskImage:
          "radial-gradient(135% 110% at 68% 42%, #000 28%, rgba(0,0,0,0.5) 62%, transparent 86%)",
        WebkitMaskImage:
          "radial-gradient(135% 110% at 68% 42%, #000 28%, rgba(0,0,0,0.5) 62%, transparent 86%)",
        ...style,
      }}
    >
      {placed.map((icon, i) => (
        <img
          key={`${icon.src}-${i}`}
          src={icon.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          decoding="async"
          style={{
            position: "absolute",
            left: `${icon.x}%`,
            top: `${icon.y}%`,
            width: `${icon.size}%`,
            height: "auto",
            opacity: icon.alpha * opacity,
            transform: `translate(-50%, -50%) rotate(${icon.rotate}deg)`,
            filter: "grayscale(1) brightness(1.7)",
          }}
        />
      ))}
    </div>
  );
}
