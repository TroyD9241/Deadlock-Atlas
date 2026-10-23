/**
 * extractPalette — TypeScript port of reference/extract_palette.py.
 *
 * Image in, { accent, accentText, onAccent, palette[5] } out. The same function
 * themes heroes and items (design.md section 3.4).
 *
 * Runs at ingest only, never in the browser, so `sharp` is safe to require
 * here. Do not import this from a "use client" file.
 *
 * Deterministic on purpose: fixed seed, fixed k, fixed resize, so the same
 * image always yields the same colours.
 *
 * Usage:
 *   npx tsx scripts/extract-palette.ts <image> [<image>...]
 */
import sharp from "sharp";

/** design.md 2.1 panel colour. Contrast targets are measured against this. */
const PANEL: RGB = [20, 24, 36];
const ON_ACCENT_DARK: RGB = [23, 19, 27]; // --on-accent default, #17131b
const WHITE: RGB = [255, 255, 255];

type RGB = [number, number, number];
type Lab = [number, number, number];

export type ExtractedPalette = {
  accent: string;
  accentText: string;
  onAccent: string;
  palette: string[];
};

/** Downscale target. Matches PIL's thumbnail((160, 160)). */
const TARGET = 160;
const ALPHA_MIN = 128;
const K = 10;
const SEED = 7;

// ── colour space ────────────────────────────────────────────────────────────

/** Same sRGB→XYZ matrices as the Python prototype. */
function srgbToLab(rgb: RGB): Lab {
  const c = rgb.map((v) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  }) as RGB;

  const x = (0.4124564 * c[0] + 0.3575761 * c[1] + 0.1804375 * c[2]) / 0.95047;
  const y = 0.2126729 * c[0] + 0.7151522 * c[1] + 0.072175 * c[2];
  const z = (0.0193339 * c[0] + 0.119192 * c[1] + 0.9503041 * c[2]) / 1.08883;

  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function labToSrgb(lab: Lab): RGB {
  const fy = (lab[0] + 16) / 116;
  const fx = fy + lab[1] / 500;
  const fz = fy - lab[2] / 200;

  const un = (t: number) =>
    t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;

  const xyz: RGB = [
    un(fx) * 0.95047,
    un(fy),
    un(fz) * 1.08883,
  ];

  const c: RGB = [
    3.2404542 * xyz[0] - 1.5371385 * xyz[1] - 0.4985314 * xyz[2],
    -0.969266 * xyz[0] + 1.8760108 * xyz[1] + 0.041556 * xyz[2],
    0.0556434 * xyz[0] - 0.2040259 * xyz[1] + 1.0572252 * xyz[2],
  ];

  return c.map((v) => {
    const x = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(v, 0) ** (1 / 2.4) - 0.055;
    return clamp255(x * 255);
  }) as RGB;
}

function clamp255(v: number) {
  return Math.min(255, Math.max(0, Math.round(v)));
}

function toHex(rgb: RGB): string {
  return `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

// ── contrast (WCAG) ─────────────────────────────────────────────────────────

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as RGB;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ── k-means ─────────────────────────────────────────────────────────────────

/**
 * Deterministic PRNG (mulberry32). The Python prototype uses numpy's PCG64,
 * which cannot be reproduced exactly, so the initial centroids differ. The
 * algorithm is the specification, not the particular seed draw; scripts/
 * check-palette.ts measures the resulting drift against the Python output.
 */
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Weighted sample without replacement, mirroring rng.choice(..., p=w). */
function weightedPick(weights: number[], rand: () => number): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let target = rand() * total;
  for (let i = 0; i < weights.length; i += 1) {
    target -= weights[i];
    if (target <= 0) return i;
  }
  return weights.length - 1;
}

function kmeans(
  points: Lab[],
  weights: number[],
  k: number,
  iters = 14,
): { centers: Lab[]; assign: number[] } {
  const rand = makeRng(SEED);
  const n = points.length;

  const centers: Lab[] = [];
  centers.push([...points[weightedPick(weights, rand)]] as Lab);

  while (centers.length < k) {
    // Squared distance from each point to its nearest centre, weighted.
    const d = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i += 1) {
      let best = Infinity;
      for (const c of centers) {
        const sum =
          (points[i][0] - c[0]) ** 2 +
          (points[i][1] - c[1]) ** 2 +
          (points[i][2] - c[2]) ** 2;
        if (sum < best) best = sum;
      }
      d[i] = best * weights[i];
    }
    centers.push([...points[weightedPick(d, rand)]] as Lab);
  }

  const assign = new Array<number>(n).fill(0);
  for (let it = 0; it < iters; it += 1) {
    for (let i = 0; i < n; i += 1) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c += 1) {
        const sum =
          (points[i][0] - centers[c][0]) ** 2 +
          (points[i][1] - centers[c][1]) ** 2 +
          (points[i][2] - centers[c][2]) ** 2;
        if (sum < bestD) {
          bestD = sum;
          best = c;
        }
      }
      assign[i] = best;
    }
    // Weighted centroid per cluster.
    for (let c = 0; c < centers.length; c += 1) {
      let w = 0;
      const acc: Lab = [0, 0, 0];
      for (let i = 0; i < n; i += 1) {
        if (assign[i] !== c) continue;
        w += weights[i];
        acc[0] += points[i][0] * weights[i];
        acc[1] += points[i][1] * weights[i];
        acc[2] += points[i][2] * weights[i];
      }
      if (w > 0) {
        centers[c] = [acc[0] / w, acc[1] / w, acc[2] / w];
      }
    }
  }

  return { centers, assign };
}

// ── extraction ──────────────────────────────────────────────────────────────

export async function extractPalette(input: Buffer | string): Promise<ExtractedPalette> {
  // `fit: inside` + `withoutEnlargement` mirrors PIL's thumbnail((160,160)).
  // `cubic` matches PIL's default thumbnail resampling closely; sharp defaults
  // to Lanczos3, which shifts pixels enough to move cluster boundaries.
  const { data, info } = await sharp(input, { failOn: "none" })
    .ensureAlpha()
    .resize(TARGET, TARGET, {
      fit: "inside",
      withoutEnlargement: true,
      kernel: "cubic",
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const ch = info.channels;
  const keep: RGB[] = [];

  for (let i = 0; i < data.length; i += ch) {
    if (data[i + 3] < ALPHA_MIN) continue; // ignore transparent pixels
    keep.push([data[i], data[i + 1], data[i + 2]]);
  }

  if (keep.length === 0) {
    throw new Error("no opaque pixels to sample");
  }

  const labs = keep.map(srgbToLab);
  const chroma = labs.map((l) => Math.hypot(l[1], l[2]));

  // Drop near-black, then weight saturated pixels above flat backgrounds.
  const points: Lab[] = [];
  const weights: number[] = [];
  for (let i = 0; i < labs.length; i += 1) {
    if (labs[i][0] <= 6) continue;
    points.push(labs[i]);
    weights.push(0.25 + chroma[i] / 40);
  }

  if (points.length < K) {
    throw new Error(`too few usable pixels (${points.length}) for k=${K}`);
  }

  const { centers, assign } = kmeans(points, weights, K);

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const share = centers.map((_, c) => {
    let w = 0;
    for (let i = 0; i < points.length; i += 1) if (assign[i] === c) w += weights[i];
    return w / totalWeight;
  });
  const centerChroma = centers.map((c) => Math.hypot(c[1], c[2]));

  // Accent: colourful, mid-lightness, reasonably present.
  const score = centers.map((c, i) => {
    const present = share[i] >= 0.015 && c[0] > 35 && c[0] < 88;
    if (!present) return 0;
    return Math.sqrt(share[i]) * centerChroma[i] * (1 - Math.abs(c[0] - 62) / 70);
  });

  let accentIndex = 0;
  let best = -Infinity;
  for (let i = 0; i < score.length; i += 1) {
    if (score[i] > best) {
      best = score[i];
      accentIndex = i;
    }
  }
  if (best <= 0) {
    // Low-chroma art: fall back to the most present cluster. The caller flags
    // this for review (design.md 3.4).
    let bestShare = -Infinity;
    for (let i = 0; i < share.length; i += 1) {
      if (share[i] > bestShare) {
        bestShare = share[i];
        accentIndex = i;
      }
    }
  }

  const accent = labToSrgb(centers[accentIndex]);

  // Palette: accent plus the four most distinct present clusters, dark to light.
  const candidates: number[] = [];
  for (let i = 0; i < K; i += 1) {
    if (share[i] >= 0.01 && i !== accentIndex) candidates.push(i);
  }
  const chosen = [accentIndex];
  while (chosen.length < 5 && candidates.length > 0) {
    let bestIdx = -1;
    let bestDist = -Infinity;
    for (const c of candidates) {
      let nearest = Infinity;
      for (const p of chosen) {
        const dist = Math.hypot(
          centers[c][0] - centers[p][0],
          centers[c][1] - centers[p][1],
          centers[c][2] - centers[p][2],
        );
        if (dist < nearest) nearest = dist;
      }
      if (nearest > bestDist) {
        bestDist = nearest;
        bestIdx = c;
      }
    }
    chosen.push(bestIdx);
    candidates.splice(candidates.indexOf(bestIdx), 1);
  }
  chosen.sort((a, b) => centers[a][0] - centers[b][0]);

  // accentText: lighten in Lab until 4.5:1 against the panel colour.
  const accentTextLab: Lab = [...centers[accentIndex]] as Lab;
  let accentText = labToSrgb(accentTextLab);
  while (contrast(accentText, PANEL) < 4.5 && accentTextLab[0] < 98) {
    accentTextLab[0] += 2;
    accentText = labToSrgb(accentTextLab);
  }

  const onAccent =
    contrast(accent, ON_ACCENT_DARK) >= contrast(accent, WHITE)
      ? toHex(ON_ACCENT_DARK)
      : toHex(WHITE);

  return {
    accent: toHex(accent),
    accentText: toHex(accentText),
    onAccent,
    palette: chosen.map((i) => toHex(labToSrgb(centers[i]))),
  };
}

// ── CLI ─────────────────────────────────────────────────────────────────────

const invokedDirectly =
  process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/extract-palette.ts");

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: npx tsx scripts/extract-palette.ts <image> [...]");
    process.exit(1);
  }
  for (const f of files) {
    const result = await extractPalette(f);
    const name = f.replace(/\\/g, "/").split("/").slice(-2).join("/");
    console.log(name, JSON.stringify(result));
  }
}

if (invokedDirectly) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}