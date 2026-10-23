/**
 * Shared placeholder for routes that exist in the site map but whose data
 * milestone has not run yet (design.md 5.1).
 *
 * Each real route replaces its own file. This exists so the header nav never
 * 404s during M0/M1.
 */
export function Placeholder({
  title,
  eyebrow,
  milestone,
}: {
  title: string;
  eyebrow: string;
  milestone: string;
}) {
  return (
    <section
      style={{
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-card)",
        background: "linear-gradient(145deg, #171b28e8, #111520e8)",
        padding: 40,
      }}
    >
      <div className="eyebrow" style={{ marginBottom: 14 }}>
        {eyebrow}
      </div>
      <h1 style={{ margin: "0 0 12px", fontSize: 30, letterSpacing: "-0.04em" }}>
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          maxWidth: "58ch",
          color: "var(--muted)",
          fontSize: 12,
          lineHeight: 1.8,
        }}
      >
        Arriving in <strong>{milestone}</strong>. Nothing here is placeholder
        game data, because no unverified numbers are shown at all.
      </p>
    </section>
  );
}