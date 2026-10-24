import Link from "next/link";

import { ItemCard, ItemCardGrid } from "@/components/item/item-card";
import { ItemPopover } from "@/components/item/item-popover";
import { ITEM_SLOTS, slotLabel } from "@/lib/item-colors";
import { getItems, getItemSlotCounts } from "@/lib/queries";

export const metadata = { title: "Items" };
export const instant = false;

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ slot?: string }>;
}) {
  const { slot } = await searchParams;
  const [items, counts] = await Promise.all([getItems(), getItemSlotCounts()]);

  const activeSlot = ITEM_SLOTS.includes(slot as (typeof ITEM_SLOTS)[number])
    ? (slot as (typeof ITEM_SLOTS)[number])
    : null;

  const visible = activeSlot
    ? items.filter((i) => i.slotType === activeSlot)
    : items;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section>
        <div className="eyebrow" style={{ marginBottom: 14 }}>
          Loadout
        </div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: 30,
            letterSpacing: "-0.04em",
            fontFamily: "var(--font-display)",
          }}
        >
          Items
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, maxWidth: "58ch" }}>
          {items.length} items from the Deadlock shop, split by the slot they
          occupy. Each item is themed with the colour the game uses for its
          category.
        </p>
      </section>

      <nav className="class-nav" aria-label="Filter items by slot">
        <Link
          href="/items"
          className={`chip${!activeSlot ? " active" : ""}`}
        >
          All
        </Link>
        {ITEM_SLOTS.map((s) => (
          <Link
            key={s}
            href={`/items?slot=${s}`}
            className={`chip${activeSlot === s ? " active" : ""}`}
          >
            {slotLabel(s)}
            <span
              style={{
                marginLeft: 7,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                opacity: 0.6,
              }}
            >
              {counts[s] ?? 0}
            </span>
          </Link>
        ))}
      </nav>

      <ItemCardGrid>
        {visible.map((item) => (
          <ItemPopover
            key={item.slug}
            slug={item.slug}
            accent={item.accent}
            accentText={item.accentText}
            onAccent={item.onAccent}
          >
            <ItemCard item={item} />
          </ItemPopover>
        ))}
      </ItemCardGrid>

      {visible.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 12 }}>No items in this slot.</p>
      ) : null}
    </div>
  );
}
