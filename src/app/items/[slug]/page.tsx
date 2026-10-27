import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { itemImage } from "@/components/item/item-card";
import { PlayDataPanel } from "@/components/play-data/figures";
import { BuyBandPanel, TransitionsPanel } from "@/components/play-data/flow-panels";
import { FlowHeroPicker } from "@/components/play-data/flow-hero-picker";
import { RankPicker } from "@/components/play-data/rank-picker";
import { themeStyle } from "@/lib/theme";
import { costLabel } from "@/lib/item-filter-shared";
import { slotLabel } from "@/lib/item-colors";
import { itemEffectText, itemStats, itemUpgrades, sanitizeItemHtml, splitItemParagraphs } from "@/lib/item-text";
import { getItem } from "@/lib/queries";
import { db } from "@/lib/db";
import { getItemPlayData } from "@/lib/play-data";
import {
  buildBuyBands,
  buildTransitions,
  getFlowItemNames,
  getItemFlow,
} from "@/lib/item-flow";
import { bracketFromParam } from "@/lib/rank-brackets";

export const instant = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await getItem(slug);
  if (!item) return { title: "Item" };
  return {
    title: item.name,
    description: `${slotLabel(item.slotType)} item from the Deadlock shop.`,
  };
}

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ rank?: string; hero?: string }>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const item = await getItem(slug);
  if (!item) notFound();

  const bracket = bracketFromParam(query.rank);

  /*
   * The item's own play data. The API's rows are keyed by numeric id and
   * the site has no numeric id on an item, so the row is matched by the
   * item's API id.
   */
  const playRows = await getItemPlayData(bracket);
  const apiId = item.apiId ? Number(item.apiId) : null;
  const playData = apiId
    ? (playRows.find((row) => row.apiId === apiId) ?? null)
    : null;

  /*
   * The purchase flow is per hero, and it is a large response — about 3 MB
   * for one hero — so it is fetched for one hero at a time and read from
   * the URL. The hero chosen in the URL wins; otherwise the first
   * released hero is used.
   */
  const flowHeroes = await db.hero.findMany({
    where: { isReleased: true, apiId: { not: null } },
    orderBy: { name: "asc" },
    select: { apiId: true, slug: true, name: true },
  });

  const flowHeroId = Number(query.hero);
  const chosenHero =
    flowHeroes.find((h) => h.apiId === flowHeroId) ?? flowHeroes[0] ?? null;

  const heroFlow = chosenHero?.apiId
    ? await getItemFlow(chosenHero.apiId, bracket)
    : null;

  const flowNames = heroFlow
    ? await getFlowItemNames([
        ...heroFlow.nodes.map((n) => n.item_id),
        ...heroFlow.edges.map((e) => e.to_item_id),
      ])
    : new Map<string, { slug: string; name: string }>();

  const bands = heroFlow ? buildBuyBands(heroFlow, flowNames) : [];
  const band = apiId ? (bands.find((b) => b.apiId === apiId) ?? null) : null;
  const transitions =
    apiId && heroFlow ? buildTransitions(heroFlow, apiId, flowNames) : [];

  const art = itemImage(item);
  const effect = itemEffectText(item.description, item.tooltipSections);
  const upgrades = itemUpgrades(item.upgrades);
  const stats = itemStats(item.properties);

  return (
    <div
      className="profile"
      style={{
        position: "relative",
        ...themeStyle({
          accent: item.accent,
          accentText: item.accentText,
          onAccent: item.onAccent,
        }),
      }}
    >
      {/*
        The page background: the item's own colour washed over the site's
        gradient, with the item art ghosted through it (design.md 2.6).
      */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 90% 60% at 50% 0%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 72%)",
          }}
        />
        {art ? (
          <img
            src={art}
            alt=""
            aria-hidden="true"
            decoding="async"
            style={{
              position: "absolute",
              top: "-8%",
              right: "-3%",
              width: "40%",
              height: "auto",
              opacity: 0.05,
              transform: "rotate(-8deg)",
              filter: "grayscale(0.4) brightness(1.6)",
            }}
          />
        ) : null}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Item header */}
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-hero)",
            minHeight: 260,
            display: "grid",
            gridTemplateColumns: "auto 1fr",
            alignItems: "center",
            gap: "clamp(20px, 4vw, 44px)",
            padding: "clamp(24px, 4vw, 44px)",
            background:
              "linear-gradient(115deg, color-mix(in srgb, var(--accent) 10%, #121621) 0%, #191724 60%, color-mix(in srgb, var(--accent) 16%, #282039) 100%)",
            boxShadow: "0 24px 90px #0008",
          }}
        >
          <div
            style={{
              width: 132,
              height: 132,
              display: "grid",
              placeItems: "center",
              background: "color-mix(in srgb, var(--accent) 12%, transparent)",
              clipPath:
                "polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)",
            }}
          >
            {art ? (
              <Image
                src={art}
                alt=""
                width={132}
                height={132}
                unoptimized
                style={{ width: 108, height: 108, objectFit: "contain" }}
              />
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
            )}
          </div>

          <div style={{ minWidth: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 12 }}>
              {slotLabel(item.slotType)}
              {item.tier ? ` · Tier ${item.tier}` : ""}
            </div>
            <h1
              style={{
                margin: "0 0 10px",
                fontSize: "clamp(30px, 5vw, 52px)",
                lineHeight: 0.95,
                letterSpacing: "-0.05em",
                color: "#fff",
              }}
            >
              {item.name}
            </h1>
            {item.nameSource !== "api" ? (
              <div
                style={{
                  fontSize: 9,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--muted)",
                  marginBottom: 10,
                }}
              >
                [name not verified]
              </div>
            ) : null}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="tag">{slotLabel(item.slotType)}</span>
              {item.tier ? <span className="tag-muted">Tier {item.tier}</span> : null}
              {item.cost != null ? (
                <span className="tag-muted">{costLabel(item.cost)}</span>
              ) : null}
              {item.shopable ? <span className="tag-muted">In shop</span> : null}
            </div>
          </div>
        </section>

        {/* Quick stats */}
        <div className="quick-stats">
          <div className="stat plate">
            <div className="stat-label">COST</div>
            <div className="stat-value">
              {item.cost != null ? item.cost : "[not available]"}
            </div>
          </div>
          <div className="stat plate">
            <div className="stat-label">TIER</div>
            <div className="stat-value">
              {item.tier != null ? item.tier : "[not available]"}
            </div>
          </div>
          <div className="stat plate">
            <div className="stat-label">SLOT</div>
            <div className="stat-value">{(item.slotType ?? "[not available]").toUpperCase()}</div>
          </div>
        </div>

        {/* Play data */}
        {playData || band ? (
          <section className="section">
            <div className="section-head">
              <div>
                <h2>Play data</h2>
                <p>What players actually do with this item.</p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              <div className="plate" style={{ padding: 16 }}>
                <RankPicker
                  current={bracket}
                  pathname={`/items/${item.slug}`}
                  otherParams={query.hero ? [["hero", query.hero]] : []}
                />
              </div>
              {playData ? <PlayDataPanel data={playData} /> : null}
              {heroFlow ? (
                <div className="plate" style={{ padding: 16 }}>
                  <FlowHeroPicker
                    heroes={flowHeroes
                      .filter((h): h is { apiId: number; slug: string; name: string } =>
                        h.apiId != null,
                      )
                      .map((h) => ({ apiId: h.apiId, slug: h.slug, name: h.name }))}
                    current={
                      chosenHero && chosenHero.apiId != null
                        ? {
                            apiId: chosenHero.apiId,
                            slug: chosenHero.slug,
                            name: chosenHero.name,
                          }
                        : null
                    }
                    pathname={`/items/${item.slug}`}
                    otherParams={bracket.id === "all" ? [] : [["rank", bracket.id]]}
                  />
                  <p
                    style={{
                      margin: "12px 0 0",
                      fontSize: 10,
                      color: "var(--muted)",
                      lineHeight: 1.6,
                    }}
                  >
                    The purchase flow for {chosenHero?.name}. It shows what
                    that hero&apos;s players buy and in what order.
                  </p>
                </div>
              ) : null}
              {band ? <BuyBandPanel band={band} /> : null}
              {transitions.length > 0 ? (
                <TransitionsPanel
                  transitions={transitions}
                  fromName={item.name}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {/* Effect */}
        <section className="section" id="effect">
          <div className="section-head">
            <div>
              <h2>Effect</h2>
              <p>Valve&apos;s own in-game text, clearly labelled.</p>
            </div>
          </div>
          <div className="panel">
            {effect ? (
              <div className="item-effect lore-text">
                {splitItemParagraphs(sanitizeItemHtml(effect)).map((chunk, i) => (
                  <p key={i} dangerouslySetInnerHTML={{ __html: chunk }} />
                ))}
              </div>
            ) : upgrades.length > 0 ? (
              /* No prose: the API states the effect as property upgrades. */
              <div style={{ display: "grid", gap: 6 }}>
                {upgrades.map((u) => (
                  <div
                    key={u.name}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "9px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 10,
                      background: "#ffffff06",
                      fontSize: 12,
                      color: "#c3c5d4",
                    }}
                  >
                    <span>{u.label}</span>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--accent-text)",
                      }}
                    >
                      {u.value}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
                [no description]
              </p>
            )}
          </div>
        </section>

        {/* Stats */}
        <section className="section" id="stats">
          <div className="section-head">
            <div>
              <h2>Stats</h2>
              <p>Modifiers carried by this item.</p>
            </div>
          </div>
          {stats.length > 0 ? (
            <div className="build-list">
              {stats.map((stat) => (
                <div key={stat.key} className="build plate">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {stat.icon ? (
                      <Image
                        src={stat.icon}
                        alt=""
                        width={24}
                        height={24}
                        unoptimized
                        style={{ width: 24, height: 24, objectFit: "contain" }}
                      />
                    ) : null}
                    <h4 style={{ margin: 0, fontSize: 13 }}>{stat.label}</h4>
                    <span
                      style={{
                        marginLeft: "auto",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--accent-text)",
                      }}
                    >
                      {stat.value}
                      {stat.postfix}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: "var(--muted)", fontSize: 12 }}>
              No stat modifiers are listed for this item.
            </p>
          )}
        </section>

        {/* Sources */}
        <section className="section">
          <div className="section-head">
            <div>
              <h2>Sources</h2>
              <p>Credited links to the Deadlock Wiki.</p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 9,
            }}
          >
            <div className="plate" style={{ padding: 12 }}>
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginBottom: 8,
                }}
              >
                Item on the wiki
              </div>
              <span className="tag-muted">wiki link not available</span>
            </div>
          </div>
        </section>

        {/* Back link */}
        <div style={{ marginTop: 8 }}>
          <Link href="/items" className="back-link">
            ← Back to items
          </Link>
        </div>
      </div>
    </div>
  );
}
