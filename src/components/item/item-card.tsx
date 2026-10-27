import Image from "next/image";
import Link from "next/link";

import { themeStyle } from "@/lib/theme";
import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemEffectText, itemText, itemStats, itemUpgrades } from "@/lib/item-text";
import { PlayDataLine } from "@/components/play-data/figures";

import type { ItemPlayData } from "@/lib/play-data-format";
import type { ItemDetail, ItemSummary } from "@/lib/queries";

/**
 * Item card — the list row from design.md 5.5.
 *
 * A real link to the item's page, with the item's own colour as the theme
 * (the slot's official colour, from the API's colors.json). The icon is the
 * in-game art: the coloured shop image when the API has one, otherwise the
 * monochrome upgrade icon.
 */

/**
 * The item's art.
 *
 * The API gives two images: `image` is the in-game upgrade icon (monochrome
 * line art on a transparent background, like the ability icons) and
 * `shopImage` is the shop tile (full-colour art on an opaque pale
 * background). The pale tile reads as a white square on this dark site, so
 * the transparent icon is what the site uses; the slot colour carries the
 * theme instead.
 */
export function itemImage(item: Pick<ItemSummary, "image" | "imageWebp" | "shopImage">) {
  return item.imageWebp ?? item.image;
}

export function ItemCard({
  item,
  playData,
}: {
  item: ItemSummary;
  /** The item's play data, when the page fetched it. */
  playData?: ItemPlayData;
}) {
  const src = itemImage(item);

  return (
    <Link
      href={`/items/${item.slug}`}
      className="plate item-card"
      style={{
        ...themeStyle({
          accent: item.accent,
          accentText: item.accentText,
          onAccent: item.onAccent,
        }),
        textDecoration: "none",
        color: "inherit",
        padding: 14,
        display: "grid",
        gap: 10,
        alignContent: "start",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          display: "grid",
          placeItems: "center",
          background: "color-mix(in srgb, var(--accent) 14%, transparent)",
          clipPath:
            "polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px)",
        }}
      >
        {src ? (
          <Image
            src={src}
            alt=""
            width={56}
            height={56}
            unoptimized
            style={{ width: 44, height: 44, objectFit: "contain" }}
          />
        ) : (
          <span style={{ fontSize: 10, color: "var(--muted)" }}>—</span>
        )}
      </div>

      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 13,
            letterSpacing: "0.02em",
            lineHeight: 1.25,
            color: "#fff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {item.name}
        </div>
        {item.nameSource !== "api" ? (
          <div
            style={{
              fontSize: 9,
              color: "var(--muted)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginTop: 3,
            }}
          >
            [name not verified]
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span className="tag">{slotLabel(item.slotType)}</span>
        {item.tier ? <span className="tag-muted">Tier {item.tier}</span> : null}
        {item.cost != null ? (
          <span className="tag-muted">{costLabel(item.cost)}</span>
        ) : null}
      </div>

      {playData ? (
        <div
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 8,
            marginTop: 2,
          }}
        >
          <PlayDataLine data={playData} />
        </div>
      ) : null}
    </Link>
  );
}

/**
 * The item's card grid. The mock uses three columns, dropping to two under
 * 780px and one under 480px (design.md section 7).
 */
export function ItemCardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

/**
 * The contents of the hover popout: name, category, cost, effect, key stats
 * and a link to the page (design.md 5.5).
 */
export function ItemPopoverContent({ item }: { item: ItemDetail }) {
  const effect = itemEffectText(item.description, item.tooltipSections);
  const upgrades = itemUpgrades(item.upgrades);
  const stats = itemStats(item.properties).slice(0, 4);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            letterSpacing: "0.02em",
            color: "#fff",
          }}
        >
          {item.name}
        </div>
        {item.cost != null ? (
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--accent-text)" }}>
            {costLabel(item.cost)}
          </div>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <span className="tag">{slotLabel(item.slotType)}</span>
        {item.tier ? <span className="tag-muted">Tier {item.tier}</span> : null}
      </div>

      {effect ? (
        <p
          className="item-effect"
          style={{
            margin: 0,
            fontSize: 11,
            lineHeight: 1.6,
            color: "#c3c5d4",
            maxHeight: "7.5em",
            overflowY: "auto",
          }}
        >
          {itemText(effect)}
        </p>
      ) : upgrades.length > 0 ? (
        /* No prose: the API states the effect as property upgrades. */
        <div style={{ display: "grid", gap: 3 }}>
          {upgrades.map((u) => (
            <div
              key={u.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 11,
                color: "#c3c5d4",
              }}
            >
              <span>{u.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-text)" }}>
                {u.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: "var(--muted)" }}>
          [no description]
        </p>
      )}

      {stats.length > 0 ? (
        <div style={{ display: "grid", gap: 3 }}>
          {stats.map((stat) => (
            <div
              key={stat.key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 10,
                color: "var(--muted)",
              }}
            >
              <span>{stat.label}</span>
              <span style={{ fontFamily: "var(--font-mono)", color: "#d8d9e6" }}>
                {stat.value}
                {stat.postfix}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
