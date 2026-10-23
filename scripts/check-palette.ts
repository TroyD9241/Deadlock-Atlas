/**
 * Compares the TypeScript extractPalette against the Python prototype.
 *
 * Run with: npx tsx scripts/check-palette.ts <python-output-file> <ts-output-file>
 *
 * The two cannot be bit-identical: the Python uses numpy's PCG64 generator and
 * the port uses mulberry32, so k-means starts from different centroids and can
 * settle in a different local optimum. What matters is that they agree on the
 * accent to within a small delta, and that both hit the design targets.
 *
 * Also re-checks the design.md section 3.4 table, which was measured against
 * older artwork for at least one hero.
 */
import { readFile } from "node:fs/promises";

import { contrastRatio } from "../src/lib/theme";

const [pyFile, tsFile] = process.argv.slice(2);

if (!pyFile || !tsFile) {
  console.error("usage: npx tsx scripts/check-palette.ts <py.txt> <ts.txt>");
  process.exit(1);
}

/** "Hero Name/img.png {json}" -> { hero, json } */
function parse(file: string) {
  const out = new Map<string, Record<string, unknown>>();
  for (const line of file.split(/\r?\n/)) {
    const brace = line.indexOf("{");
    if (brace === -1) continue;
    const path = line.slice(0, brace).trim().replace(/\\/g, "/");
    const hero = path.split("/").slice(-2)[0];
    try {
      out.set(hero, JSON.parse(line.slice(brace)));
    } catch {
      /* skip malformed */
    }
  }
  return out;
}

function channelDistance(a: string, b: string) {
  const hex = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
  const x = hex(a);
  const y = hex(b);
  return Math.sqrt((x[0] - y[0]) ** 2 + (x[1] - y[1]) ** 2 + (x[2] - y[2]) ** 2);
}

async function main() {
  const py = parse(await readFile(pyFile, "utf8"));
  const ts = parse(await readFile(tsFile, "utf8"));

  const deltas: Delta[] = [];
  const missing: string[] = [];

  for (const [hero, p] of py) {
    const t = ts.get(hero);
    if (!t) {
      missing.push(hero);
      continue;
    }
    deltas.push({
      hero,
      d: channelDistance(String(p.accent), String(t.accent)),
      pyAccent: String(p.accent),
      tsAccent: String(t.accent),
      pyText: String(p.accentText),
      tsText: String(t.accentText),
    });
  }

  deltas.sort((a, b) => b.d - a.d);

  console.log(`heroes compared: ${deltas.length}`);
  if (missing.length) console.log(`missing from TS run: ${missing.join(", ")}`);

  const exact = deltas.filter((x) => x.d === 0).length;
  const under10 = deltas.filter((x) => x.d <= 10).length;
  const under20 = deltas.filter((x) => x.d <= 20).length;
  const under40 = deltas.filter((x) => x.d <= 40).length;

  console.log("");
  console.log(`  identical accents      ${exact}/${deltas.length}`);
  console.log(`  within 10 per channel  ${under10}/${deltas.length}`);
  console.log(`  within 20 per channel  ${under20}/${deltas.length}`);
  console.log(`  within 40 per channel  ${under40}/${deltas.length}`);

  console.log("");
  console.log("largest divergences (RMS channel distance):");
  for (const x of deltas.slice(0, 8)) {
    console.log(`  ${x.hero.padEnd(16)} ${x.d.toFixed(1).padStart(6)}   python ${x.pyAccent}  ts ${x.tsAccent}`);
  }

  console.log("");
  console.log("accentText must reach 4.5:1 on --panel (design.md 3.4):");
  let contrastFail = 0;
  for (const [hero, p] of ts) {
    const ratio = contrastRatio(String(p.accentText), "#141824");
    if (ratio < 4.5) {
      contrastFail += 1;
      console.log(`  FAIL ${hero} accentText ${p.accentText} is ${ratio.toFixed(2)}:1`);
    }
  }
  console.log(
    contrastFail === 0
      ? `  all ${ts.size} TS accentText values reach 4.5:1 on --panel`
      : `  ${contrastFail} accentText value(s) below 4.5:1`,
  );

  console.log("");
  console.log("design.md section 3.4 documented table vs current artwork:");
  const documented: Record<string, string> = {
    Abrams: "#BB7352",
    Mina: "#D43B31",
    Celeste: "#BB8BCC",
    "Deadman Danny": "#EB662C",
  };
  for (const [hero, was] of Object.entries(documented)) {
    const t = ts.get(hero);
    if (!t) {
      console.log(`  ${hero.padEnd(16)} documented ${was}  -> NOT FOUND`);
      continue;
    }
    const d = channelDistance(was, String(t.accent));
    console.log(
      `  ${hero.padEnd(16)} documented ${was}  ->  ts ${t.accent}   d=${d.toFixed(0)}  ${d > 25 ? "STALE" : "ok"}`,
    );
  }

  console.log("");
  if (contrastFail === 0 && missing.length === 0 && under40 >= deltas.length * 0.9) {
    console.log("Palette port agrees with the prototype on the large majority of heroes.");
  } else {
    console.log("Palette port needs review: too many heroes diverge beyond tolerance.");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

type Delta = {
  hero: string;
  d: number;
  pyAccent: string;
  tsAccent: string;
  pyText: string;
  tsText: string;
};