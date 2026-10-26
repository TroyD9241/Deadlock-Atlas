import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const DB_URL =
  process.env.DATABASE_URL ||
  "postgresql://atlas:atlas@127.0.0.1:5433/deadlock_atlas";

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();

  const statMapRaw = JSON.parse(
    await readFile(path.resolve(process.cwd(), "data/curated/stat-map.json"), "utf8"),
  );
  const conditions = statMapRaw.conditions || {};

  const items = await client.query(
    `select slug, name, properties, description, "tooltipSections" from public."Item" where "slotType" is not null order by slug`,
  );

  const unmapped: Array<{ slug: string; key: string; label?: string; value: unknown }> = [];
  const missingConditions: Array<{ slug: string; key: string; value: unknown }> = [];
  const conditionIssues: Array<{ slug: string; issue: string }> = [];

  for (const item of items.rows) {
    const props = item.properties || {};
    const keys = Object.keys(props);

    for (const key of keys) {
      const p = props[key];
      const hasType = p && p.provided_property_type;
      const css = p?.css_class;
      const val = p?.value;
      const num = typeof val === "number" ? val : typeof val === "string" ? Number(val) : null;
      if (num != null && num !== 0 && !hasType && !css) {
        unmapped.push({ slug: item.slug, key, label: p?.label, value: val });
      }
    }

    // Check for threshold properties without conditions entry
    for (const key of keys) {
      const k = key.toLowerCase();
      if (
        (k.includes("minimum") && k.includes("damage")) ||
        k.includes("damagethreshold") ||
        k.includes("healththreshold") ||
        k.includes("lifethreshold") ||
        k.includes("closerangebonusrange") ||
        k.includes("longrangebonusweaponpowerminrange")
      ) {
        if (!conditions[item.slug]) {
          missingConditions.push({ slug: item.slug, key, value: props[key]?.value });
        }
      }
    }

    const cond = conditions[item.slug];
    if (cond) {
      if (!props[cond.bonusProperty]) {
        conditionIssues.push({ slug: item.slug, issue: `missing bonusProperty ${cond.bonusProperty}` });
      }
      if (cond.thresholdProperty && !props[cond.thresholdProperty]) {
        conditionIssues.push({ slug: item.slug, issue: `missing thresholdProperty ${cond.thresholdProperty}` });
      }
    }
  }

  const report = `# Stat verification report\n\nGenerated: ${new Date().toISOString()}\n\n## Unmapped properties (no provided_property_type, no css_class, non-zero)\n\n${unmapped.length ? unmapped.map((u) => `- ${u.slug}: ${u.key} (${u.label || "no label"}) = ${u.value}`).join("\n") : "None."}\n\n## Threshold items missing conditions entry\n\n${missingConditions.length ? missingConditions.map((m) => `- ${m.slug}: ${m.key} = ${m.value}`).join("\n") : "None."}\n\n## Condition issues\n\n${conditionIssues.length ? conditionIssues.map((c) => `- ${c.slug}: ${c.issue}`).join("\n") : "None."}\n\n## Summary\n\n- Items checked: ${items.rows.length}\n- Unmapped: ${unmapped.length}\n- Missing conditions: ${missingConditions.length}\n- Condition issues: ${conditionIssues.length}\n`;

  await readFile(path.resolve(process.cwd(), "data/curated/stat-verification.md"), "utf8").catch(async () => {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(path.resolve(process.cwd(), "data/curated/stat-verification.md"), report);
  });
  const { writeFile } = await import("node:fs/promises");
  await writeFile(path.resolve(process.cwd(), "data/curated/stat-verification.md"), report);

  console.log(report);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

