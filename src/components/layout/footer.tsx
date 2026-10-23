const WIKI = "https://deadlock.wiki";

/**
 * Site footer — design.md 4.2 and 9.
 *
 * The Valve disclaimer appears on every page. The wiki credit is required on
 * any page that links to the Deadlock Wiki; it is on every page because the
 * hero profiles do.
 */
export function Footer() {
  return (
    <footer
      style={{
        marginTop: 42,
        paddingTop: 18,
        borderTop: "1px solid var(--line)",
        fontSize: 11,
        color: "#7f8498",
        display: "grid",
        gap: 8,
      }}
    >
      <p style={{ margin: 0, maxWidth: "70ch", lineHeight: 1.7 }}>
        Fan project. Not affiliated with Valve. Deadlock and related assets
        belong to Valve.
      </p>

      <p style={{ margin: 0, maxWidth: "70ch", lineHeight: 1.7 }}>
        Ability, build and cosmetic entries are editorial placeholders until
        verified against reliable game data.{" "}
        <a
          href={WIKI}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}
        >
          Source: The Deadlock Wiki
        </a>
        , text licensed{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)" }}
        >
          CC BY-SA 4.0
        </a>
        . Game content and voice lines are Valve&rsquo;s and are linked, never
        reproduced.
      </p>
    </footer>
  );
}