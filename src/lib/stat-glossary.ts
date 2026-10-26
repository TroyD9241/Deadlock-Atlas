import glossaryData from "../../data/curated/stat-glossary.json";

export type GlossaryEntry = { what: string; affects?: string; label?: string };

export type StatGlossary = {
  groups: Record<string, string>;
  stats: Record<string, GlossaryEntry>;
  modifiers: Record<string, string>;
  abilityProperties: Record<string, GlossaryEntry>;
  columns: Record<string, GlossaryEntry>;
  cssClasses?: Record<string, string>;
  heroStats?: Record<string, GlossaryEntry>;
  readOnlyProperties?: Record<string, GlossaryEntry>;
};

export function statGlossary(): StatGlossary {
  return glossaryData as StatGlossary;
}

export function modifierDescription(
  modifierType: string | null,
  group: string,
  glossary: StatGlossary,
  cssClass?: string | null,
): string | null {
  if (modifierType && glossary.modifiers[modifierType]) {
    return glossary.modifiers[modifierType];
  }
  if (cssClass && glossary.cssClasses?.[cssClass]) {
    return glossary.cssClasses[cssClass];
  }
  if (glossary.groups[group]) {
    return glossary.groups[group];
  }
  if (group === "unmapped") {
    return "This property could not be matched to a known stat in the Atlas.";
  }
  return null;
}

export function statDescription(
  railId: string,
  glossary: StatGlossary,
): GlossaryEntry | null {
  return glossary.stats[railId] ?? glossary.heroStats?.[railId] ?? null;
}

export function abilityPropertyDescription(
  key: string,
  glossary: StatGlossary,
): GlossaryEntry | null {
  return glossary.abilityProperties[key] ?? glossary.readOnlyProperties?.[key] ?? null;
}

export function columnDescription(
  column: string,
  glossary: StatGlossary,
): GlossaryEntry | null {
  return glossary.columns[column] ?? null;
}
