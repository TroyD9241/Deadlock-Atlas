/**
 * Verifies the theme system (design.md section 3) without a browser.
 *
 * Run with: npx tsx scripts/check-theme.ts
 *
 * This is the M0 acceptance check: switching theme must only change CSS
 * variables on a scope element, never component classes.
 */
import {
  DEFAULT_ACCENT,
  applyTheme,
  contrastRatio,
  hexToRgb,
  normalizeHex,
  readableTextOn,
  themeStyle,
} from "../src/lib/theme";

/** Minimal stand-in for HTMLElement that records what was written. */
function fakeEl() {
  const set = new Map<string, string>();
  const removed: string[] = [];
  return {
    style: {
      setProperty: (k: string, v: string) => set.set(k, v),
      removeProperty: (k: string) => {
        removed.push(k);
        set.delete(k);
      },
    },
    set,
    removed,
  };
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(
    `${ok ? "pass" : "FAIL"}  ${label.padEnd(46)} ${
      ok ? "" : `got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`
    }`,
  );
}

console.log("--- normalizeHex ---");
check("lowercase 6-digit", normalizeHex("#C09FC8"), "#c09fc8");
check("expand 3-digit", normalizeHex("#abc"), "#aabbcc");
check("no leading hash", normalizeHex("c09fc8"), "#c09fc8");
check("reject garbage", normalizeHex("rebeccapurple"), null);
check("reject empty", normalizeHex(""), null);
check("reject null", normalizeHex(null), null);

console.log("");
console.log("--- hexToRgb ---");
check("site default", hexToRgb("#c09fc8"), "192, 159, 200");
check("black", hexToRgb("#000000"), "0, 0, 0");
check("white", hexToRgb("#ffffff"), "255, 255, 255");

console.log("");
console.log("--- applyTheme sets every variable ---");
const el = fakeEl();
applyTheme(el as unknown as HTMLElement, {
  accent: "#BE7052",
  palette: ["#2b1d18", "#4a2f24", "#8a5540", "#c98a6e", "#f2d5c4"],
  onAccent: "#17131b",
});
check("--accent", el.set.get("--accent"), "#be7052");
check("--accent-rgb", el.set.get("--accent-rgb"), "190, 112, 82");
check("--on-accent", el.set.get("--on-accent"), "#17131b");
const accentText = el.set.get("--accent-text") ?? "";
check(
  "--accent-text clears 4.5:1 on --panel",
  contrastRatio(accentText, "#141824") >= 4.5,
  true,
);
check("--glow has alpha", /^#[0-9a-f]{8}$/.test(el.set.get("--glow") ?? ""), true);
check("--p1", el.set.get("--p1"), "#2b1d18");
check("--p5", el.set.get("--p5"), "#f2d5c4");
check("set exactly 10 properties", el.set.size, 10);

console.log("");
console.log("--- applyTheme scope isolation ---");
// A second card with a different hero must not disturb the first.
const other = fakeEl();
applyTheme(other as unknown as HTMLElement, { accent: "#C83A31" });
check("card A unchanged by card B", el.set.get("--accent"), "#be7052");
check("card B has its own accent", other.set.get("--accent"), "#c83a31");

console.log("");
console.log("--- applyTheme fallbacks ---");
const bare = fakeEl();
applyTheme(bare as unknown as HTMLElement, {});
check("no accent -> site default", bare.set.get("--accent"), DEFAULT_ACCENT);

const apiOnly = fakeEl();
applyTheme(apiOnly as unknown as HTMLElement, { apiAccent: "#E05151" });
check("extraction wins over style_hex", el.set.get("--accent"), "#be7052");
check("style_hex used when no extraction", apiOnly.set.get("--accent"), "#e05151");

const partial = fakeEl();
applyTheme(partial as unknown as HTMLElement, {
  accent: "#c09fc8",
  palette: ["#111111", "#222222"],
});
check("partial palette: --p1 set", partial.set.get("--p1"), "#111111");
check("partial palette: --p2 set", partial.set.get("--p2"), "#222222");
check("partial palette: --p3 removed", partial.set.has("--p3"), false);
check("partial palette: removed list", partial.removed, ["--p3", "--p4", "--p5"]);

console.log("");
console.log("--- readableTextOn picks the best contrast ---");
for (const accent of ["#c09fc8", "#BE7052", "#C83A31", "#6fcf97", "#090b12"]) {
  const chosen = readableTextOn(accent);
  const got = contrastRatio(accent, chosen);
  const best = Math.max(
    contrastRatio(accent, "#17131b"),
    contrastRatio(accent, "#ffffff"),
  );
  check(`${accent} -> ${chosen}`, Math.abs(got - best) < 0.001, true);
}

console.log("");
console.log("--- themeStyle matches applyTheme (server parity) ---");
const style = themeStyle({ accent: "#BE7052", palette: ["#1a1a1a", "#2b2b2b", "#3c3c3c", "#4d4d4d", "#5e5e5e"] });
const dom = fakeEl();
applyTheme(dom as unknown as HTMLElement, { accent: "#BE7052", palette: ["#1a1a1a", "#2b2b2b", "#3c3c3c", "#4d4d4d", "#5e5e5e"] });
check("--accent parity", style["--accent"], dom.set.get("--accent"));
check("--accent-rgb parity", style["--accent-rgb"], dom.set.get("--accent-rgb"));
check("--p5 parity", style["--p5"], dom.set.get("--p5"));
check("same property count", Object.keys(style).length, dom.set.size);

console.log("");
if (failures === 0) {
  console.log("All theme checks passed.");
} else {
  console.log(`${failures} theme check(s) failed.`);
  process.exit(1);
}