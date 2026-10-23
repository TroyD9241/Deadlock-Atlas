/**
 * Contrast audit for the design tokens (design.md section 8).
 *
 * Run with: npx tsx scripts/check-contrast.ts
 *
 * Text needs 4.5:1, large text 3:1. Themed accents are validated at ingest,
 * but the fixed tokens are checked here so a colour edit that breaks
 * readability is caught before it ships.
 */
import { contrastRatio, readableTextOn } from "../src/lib/theme";

type Case = {
  label: string;
  fg: string;
  bg: string;
  /** "body" needs 4.5:1, "large" needs 3:1 (>=24px, or >=19px bold). */
  size: "body" | "large";
};

const cases: Case[] = [
  { label: "body text on page bg", fg: "#f4f2f8", bg: "#090b12", size: "body" },
  { label: "muted text on page bg", fg: "#a6a9ba", bg: "#090b12", size: "body" },
  { label: "muted text on panel", fg: "#a6a9ba", bg: "#141824", size: "body" },
  { label: "accent on page bg", fg: "#c09fc8", bg: "#090b12", size: "body" },
  { label: "accent on panel", fg: "#c09fc8", bg: "#141824", size: "body" },
  { label: "text on panel", fg: "#f4f2f8", bg: "#141824", size: "body" },
  { label: "footer text on page bg", fg: "#7f8498", bg: "#090b12", size: "body" },
  { label: "nav pill text on page bg", fg: "#c8c7d4", bg: "#090b12", size: "body" },
  { label: "nav pill active text", fg: "#ffffff", bg: "#1e1d28", size: "body" },
  { label: "brand on page bg", fg: "#eee8f6", bg: "#090b12", size: "body" },
  { label: "hero desc on banner", fg: "#b5b7c7", bg: "#1b1826", size: "body" },
  { label: "hero tagline on banner", fg: "#e7dfee", bg: "#1b1826", size: "large" },
];

let failures = 0;
console.log("label                              ratio  needs  result");
console.log("-".repeat(62));

for (const c of cases) {
  const ratio = contrastRatio(c.fg, c.bg);
  const needs = c.size === "body" ? 4.5 : 3;
  const ok = ratio >= needs;
  if (!ok) failures += 1;
  console.log(
    `${c.label.padEnd(34)} ${ratio.toFixed(2).padStart(5)}  ${needs.toFixed(1).padStart(5)}  ${ok ? "pass" : "FAIL"}`,
  );
}

// on-accent must pick the better of the two extremes for the default accent.
console.log("");
const onAccent = readableTextOn("#c09fc8");
const chosen = contrastRatio("#c09fc8", onAccent);
const best = Math.max(
  contrastRatio("#c09fc8", "#17131b"),
  contrastRatio("#c09fc8", "#ffffff"),
);
console.log(
  `readableTextOn(#c09fc8) -> ${onAccent} (${chosen.toFixed(2)}:1, best available ${best.toFixed(2)}:1)`,
);
if (chosen < best - 0.001) {
  console.log("FAIL: did not pick the best contrast");
  failures += 1;
}

console.log("");
if (failures === 0) {
  console.log("All contrast checks passed.");
} else {
  console.log(`${failures} contrast check(s) failed.`);
  process.exit(1);
}