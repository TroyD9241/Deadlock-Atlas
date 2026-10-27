import Link from "next/link";

/**
 * The hero selector for an item's purchase flow.
 *
 * The flow is per hero — what a Mystic buys after a Mystic Vulnerability is
 * not what a Bebop buys — so the item's page reads the hero from the URL
 * and the flow is fetched for that one.
 *
 * A link, not a client-side state change, like every other filter on the
 * site: the flow is a server fetch, so the server has to know which hero.
 */

export type FlowHero = {
  apiId: number;
  slug: string;
  name: string;
};

type Props = {
  heroes: FlowHero[];
  /** The hero whose flow is shown. */
  current: FlowHero | null;
  pathname: string;
  /** The other query parameters to carry across. */
  otherParams?: Array<[string, string]>;
};

export function FlowHeroPicker({
  heroes,
  current,
  pathname,
  otherParams = [],
}: Props) {
  if (heroes.length === 0) return null;

  const hrefFor = (hero: FlowHero) => {
    const params = new URLSearchParams(otherParams);
    params.set("hero", String(hero.apiId));
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--accent)",
        }}
      >
        Hero
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {heroes.map((hero) => (
          <Link
            key={hero.apiId}
            href={hrefFor(hero)}
            scroll={false}
            aria-current={current?.apiId === hero.apiId ? "true" : undefined}
            className={`chip${current?.apiId === hero.apiId ? " active" : ""}`}
            style={{
              cursor: "pointer",
              minHeight: 44,
              fontSize: 10,
              letterSpacing: "0.1em",
            }}
          >
            {hero.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
