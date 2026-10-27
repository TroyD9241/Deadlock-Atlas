import Link from "next/link";

import { RANK_BRACKETS } from "@/lib/rank-brackets";

import type { RankBracket } from "@/lib/rank-brackets";

/**
 * The rank-bracket picker.
 *
 * A link, not a client-side state change: the bracket lives in the URL
 * (`?rank=…`), the same way the items filter rail works. That makes a
 * filtered view shareable, keeps the back button working, and needs no
 * client router round trip — the server reads the bracket and the play
 * data comes back already filtered.
 *
 * The picker preserves whatever else is in the query string, so switching
 * bracket on `/items?tier=4` does not throw the tier filter away.
 *
 * The measured share is shown next to each bracket. It is a snapshot of the
 * API's own badge distribution, and it is deliberately **not** a "top 5%" /
 * "top 25%" label: those numbers do not match the real distribution, and
 * the API filters on the average badge of both teams, so a narrow bracket
 * still contains lower-badge players.
 */

type Props = {
  /** The bracket currently in effect. */
  current: RankBracket;
  /** The path the picker links to. */
  pathname: string;
  /**
   * The query string to carry across when the bracket changes.
   *
   * Passed in from the server rather than read from `window.location`: during
   * a client navigation the browser's URL can be out of step with the page
   * on screen, and carrying the wrong value would drop filters.
   */
  otherParams?: Array<[string, string]>;
};

export function RankPicker({ current, pathname, otherParams = [] }: Props) {
  const hrefFor = (bracket: RankBracket) => {
    const params = new URLSearchParams(otherParams);
    /*
     * "All ranks" is spelled out rather than left as an absent parameter,
     * because the default bracket is now Initiate – Sentinel — leaving the
     * parameter off would land on that, not on all ranks.
     */
    params.set("rank", bracket.id);
    const search = params.toString();
    return search ? `${pathname}?${search}` : pathname;
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
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
        Rank bracket
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {RANK_BRACKETS.map((bracket) => {
          const on = bracket.id === current.id;
          return (
            <Link
              key={bracket.id}
              href={hrefFor(bracket)}
              scroll={false}
              aria-current={on ? "true" : undefined}
              className={`chip${on ? " active" : ""}`}
              style={{
                cursor: "pointer",
                gap: 8,
                minHeight: 44,
                fontSize: 10,
                letterSpacing: "0.1em",
              }}
            >
              {bracket.label}
              {bracket.id === "all" ? null : (
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    opacity: 0.65,
                    letterSpacing: 0,
                  }}
                >
                  {bracket.sharePct}%
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 10,
          color: "var(--muted)",
          lineHeight: 1.6,
          maxWidth: "58ch",
        }}
      >
        {current.id === "all"
          ? "All ranks. Every match in the sample, regardless of badge."
          : `Matches where both teams average ${current.label} (${current.sharePct}% of players).`}
      </p>
    </div>
  );
}
