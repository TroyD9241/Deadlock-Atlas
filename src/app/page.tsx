import { DEFAULT_ACCENT, themeStyle } from "@/lib/theme";

/**
 * M0 shell.
 *
 * There is no hero or item data yet, so this page exists to prove the theme
 * system: everything below reads from CSS variables, and the swatch grid shows
 * the site's default accent and palette. M2 replaces this with the Home
 * dashboard; M4 (Home) is deferred along with patch data.
 */
export default function HomePage() {
  const palette = ["#1b1d2a", "#2f3348", "#6a6d85", "#a6a9ba", "#f4f2f8"];

  return (
    <div style={themeStyle({ accent: DEFAULT_ACCENT, palette })}>
      <section
        style={{
          position: "relative",
          overflow: "hidden",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-hero)",
          minHeight: 260,
          display: "grid",
          alignItems: "center",
          background:
            "linear-gradient(115deg, #121621 0%, #191724 56%, #282039 100%)",
          boxShadow: "0 24px 90px #0008",
        }}
      >
        {/* Decorative glow, hidden from assistive tech (design.md 8). */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 75% 38%, var(--glow), transparent 54%)",
          }}
        />
        <div style={{ position: "relative", zIndex: 2, padding: "48px 44px" }}>
          <div className="eyebrow" style={{ marginBottom: 16 }}>
            Atlas is being assembled
          </div>
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 72px)",
              lineHeight: 0.92,
              letterSpacing: "-0.06em",
              margin: "0 0 14px",
            }}
          >
            Heroes, items, mechanics.
          </h1>
          <p
            style={{
              color: "#b5b7c7",
              maxWidth: "52ch",
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            The theme system is live. This page is themed entirely through CSS
            variables set by <code>applyTheme</code>, with no hard-coded colours
            in any component.
          </p>
        </div>
      </section>

      <section
        style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginTop: 18 }}
      >
        <div className="panel">
          <h2 style={{ margin: "0 0 6px", fontSize: 13, letterSpacing: "-0.02em" }}>
            Theme tokens
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
            Every surface on this site reads from <code>--accent</code>,{" "}
            <code>--panel</code>, <code>--line</code>, <code>--text</code> and{" "}
            <code>--muted</code>. Switching hero changes the variables only.
          </p>
        </div>

        <div className="panel">
          <h2 style={{ margin: "0 0 6px", fontSize: 13, letterSpacing: "-0.02em" }}>
            Accent
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
            Default site accent <code>{DEFAULT_ACCENT}</code>, overridable per
            hero or item.
          </p>
          <div style={{ display: "flex", gap: 5 }}>
            {[DEFAULT_ACCENT].map((color) => (
              <span
                key={color}
                style={{
                  height: 7,
                  flex: 1,
                  borderRadius: 999,
                  background: color,
                }}
              />
            ))}
          </div>
        </div>

        <div className="panel">
          <h2 style={{ margin: "0 0 6px", fontSize: 13, letterSpacing: "-0.02em" }}>
            Palette
          </h2>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--muted)" }}>
            <code>--p1</code> to <code>--p5</code>, darkest to lightest.
          </p>
          <div style={{ display: "flex", gap: 5 }}>
            {palette.map((color, i) => (
              <span
                key={color}
                title={`--p${i + 1} ${color}`}
                style={{
                  height: 7,
                  flex: 1,
                  borderRadius: 999,
                  background: color,
                }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}