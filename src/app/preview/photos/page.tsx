import Image from "next/image";

import { getReleasedHeroes } from "@/lib/queries";

export const metadata = { title: "Photo preview" };
export const instant = false;

export default async function PhotoPreviewPage() {
  const heroes = await getReleasedHeroes();

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section>
        <h1 style={{ margin: "0 0 8px", fontSize: 30, letterSpacing: "-0.04em", fontFamily: "var(--font-display)" }}>
          Hero photo preview
        </h1>
        <p style={{ margin: 0, color: "var(--muted)", fontSize: 12 }}>
          All {heroes.length} heroes with their available images.
        </p>
      </section>

      {heroes.map((h) => {
        const art = (h.artwork?.images ?? {}) as Record<string, string>;
        return (
          <div
            key={h.slug}
            style={{
              border: "1px solid var(--line)",
              borderRadius: 14,
              padding: 16,
              background: "#ffffff07",
            }}
          >
            <div style={{ marginBottom: 12, display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--accent)" }}>
                {h.name}
              </span>
              <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>
                {(h.heroType ?? "").toUpperCase()} · {h.artwork?.artworkType ?? "unknown"}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {art.background ? (
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em" }}>BACKGROUND</div>
                  <img
                    src={art.background}
                    alt={`${h.name} background`}
                    style={{ width: "100%", height: 120, objectFit: "cover", objectPosition: "center", borderRadius: 8, border: "1px solid var(--line)" }}
                  />
                </div>
              ) : null}

              {art.card ? (
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em" }}>CARD (280×380)</div>
                  <img
                    src={art.card}
                    alt={`${h.name} card`}
                    style={{ width: "100%", height: 180, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", background: "#000" }}
                  />
                </div>
              ) : null}

              {art.vertical ? (
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em" }}>VERTICAL (120×200)</div>
                  <img
                    src={art.vertical}
                    alt={`${h.name} vertical`}
                    style={{ width: "auto", height: 180, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", background: "#000" }}
                  />
                </div>
              ) : null}

              {art.cardGloat ? (
                <div>
                  <div style={{ fontSize: 9, color: "var(--muted)", marginBottom: 4, letterSpacing: "0.1em" }}>CARD GLOAT</div>
                  <img
                    src={art.cardGloat}
                    alt={`${h.name} gloat`}
                    style={{ width: "100%", height: 180, objectFit: "contain", borderRadius: 8, border: "1px solid var(--line)", background: "#000" }}
                  />
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}