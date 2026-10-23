/**
 * Reads data/characters/<Hero Name>/ and runs palette extraction.
 *
 * Each folder holds a `.md` of `KEY: URL` wiki links under a heading line with
 * the hero's wiki name, plus one artwork file. The wiki name in the `.md` is
 * the join key to the API, because folder names do not always match: our
 * `Doorman` folder is the API's "The Doorman" (design.md 4.2).
 *
 * Artwork is never copied into the database. The folder path is recorded so
 * palette extraction can be re-run, and so a hero can be traced back to the
 * file its colours came from.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { extractPalette, type ExtractedPalette } from "../extract-palette";

export const CHARACTERS_DIR = path.resolve(process.cwd(), "data/characters");

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]);

export type SourceLinks = {
  lore: string | null;
  movement: string | null;
  voiceLines: string | null;
};

export type CharacterFolder = {
  folder: string;
  /** Hero name from the `.md` heading, e.g. "Deadman_Danny". */
  wikiName: string | null;
  displayName: string | null;
  links: SourceLinks;
  artworkPath: string | null;
  artworkType: "cutout" | "wallpaper" | "splash" | null;
};

const KEY_MAP: Record<string, keyof SourceLinks> = {
  "CHARACTER INFO": "lore",
  MOVEMENT: "movement",
  "VOICE LINES": "voiceLines",
};

/**
 * `Deadman_Danny:` -> "Deadman Danny"
 * `hero_doorman:`   -> "hero doorman" (left as-is if not a wiki name)
 */
function wikiNameToDisplay(name: string): string {
  if (name.startsWith("hero_")) return name; // a class name, not a display name
  let decoded = name;
  try {
    decoded = decodeURIComponent(name);
  } catch {
    // Leave the raw value when it is not valid percent-encoding.
  }
  return decoded.replace(/_/g, " ").trim();
}

function classifyArtwork(file: string): CharacterFolder["artworkType"] {
  const lower = file.toLowerCase();
  // News and video thumbnails are neither cutouts nor wallpapers.
  if (/thumb|maxres|screenshot|ytimg/.test(lower)) return "wallpaper";
  if (/render|card|splash|og-|hero-/.test(lower)) return "splash";
  return "cutout";
}

export async function readCharacterFolder(dir: string): Promise<CharacterFolder | null> {
  const files = await readdir(dir);
  const md = files.find((f) => f.toLowerCase().endsWith(".md"));
  const img = files.find((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()));

  const links: SourceLinks = { lore: null, movement: null, voiceLines: null };
  let wikiName: string | null = null;

  if (md) {
    const text = await readFile(path.join(dir, md), "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;
      const kv = line.match(/^([A-Z ]+):\s*(\S+)\s*$/);
      if (kv) {
        const key = KEY_MAP[kv[1].trim()];
        if (key) links[key] = kv[2];
        continue;
      }
      // First non-empty, non-URL line is the wiki name heading.
      if (!wikiName && !line.includes("://")) {
        wikiName = line.replace(/:$/, "").trim();
      }
    }
  }

  return {
    folder: path.basename(dir),
    wikiName,
    displayName: wikiName ? wikiNameToDisplay(wikiName) : null,
    links,
    artworkPath: img ? path.join(dir, img) : null,
    artworkType: img ? classifyArtwork(img) : null,
  };
}

export async function readAllCharacterFolders(): Promise<CharacterFolder[]> {
  const entries = await readdir(CHARACTERS_DIR, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const out: CharacterFolder[] = [];
  for (const d of dirs) {
    const c = await readCharacterFolder(path.join(CHARACTERS_DIR, d));
    if (c) out.push(c);
  }
  return out;
}

export type FolderPalette = {
  folder: string;
  palette: ExtractedPalette | null;
  error: string | null;
};

export async function extractFolderPalettes(
  folders: CharacterFolder[],
): Promise<Map<string, FolderPalette>> {
  const result = new Map<string, FolderPalette>();
  for (const f of folders) {
    if (!f.artworkPath) {
      result.set(f.folder, { folder: f.folder, palette: null, error: "no artwork" });
      continue;
    }
    try {
      const palette = await extractPalette(f.artworkPath);
      result.set(f.folder, { folder: f.folder, palette, error: null });
    } catch (e) {
      result.set(f.folder, {
        folder: f.folder,
        palette: null,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}