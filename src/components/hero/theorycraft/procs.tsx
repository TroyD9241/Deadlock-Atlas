"use client";

import type { ConditionOutcome } from "@/lib/damage";

type Props = {
  outcomes: ConditionOutcome[];
};

export function Procs({ outcomes }: Props) {
  if (outcomes.length === 0) return null;

  return (
    <section className="plate" style={{ padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
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
          Procs
        </div>
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 8 }} />
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
          Net damage deltas for conditional items. Damage numbers are computed from
          API base values and scale coefficients, not in-game exact.
        </div>
        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
          Bullet damage is not modelled; only spirit damage is computed.
        </div>
      </header>

      <div style={{ display: "grid", gap: 12 }}>
        {outcomes.map((outcome, idx) => (
          <div
            key={idx}
            style={{
              padding: 12,
              border: "1px solid var(--border)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.01)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "baseline",
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-body)" }}>
                  {outcome.condition.label}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {outcome.condition.condition}
                  {outcome.threshold != null ? ` (${outcome.threshold})` : ""}
                  {outcome.bonus != null
                    ? ` · +${outcome.bonus} ${outcome.condition.bonusLabel || "bonus"}`
                    : ""}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: outcome.applies ? "var(--accent)" : "var(--muted)",
                }}
              >
                {outcome.applies ? "Applies" : "Not met"}
              </div>
            </div>

            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {outcome.abilities.slice(0, 8).map((a, aIdx) => (
                <a
                  key={aIdx}
                  href={`#ability-${a.ability.abilityId || a.ability.abilityName}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12 }}>
                      {a.ability.abilityName}
                      <span style={{ color: "var(--muted)" }}>
                        {" "}
                        · {a.ability.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                      {a.ability.scalable
                        ? `${a.ability.base.toFixed(1)} → ${a.damage.toFixed(1)}`
                        : a.ability.damageType === "bullet"
                          ? "Bullet damage not modelled"
                          : "Not computable"}
                      {outcome.threshold != null && a.margin != null
                        ? a.meetsCondition
                          ? ` · clears ${outcome.threshold} by ${Math.abs(a.margin).toFixed(1)}`
                          : ` · below ${outcome.threshold} by ${Math.abs(a.margin).toFixed(1)}`
                        : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      fontSize: 11,
                      color: a.bonusApplied != null ? "var(--accent)" : "var(--muted)",
                    }}
                  >
                    {a.bonusApplied != null ? `+${a.bonusApplied} applied` : "Not met"}
                  </div>
                </a>
              ))}
              {outcome.abilities.length > 8 ? (
                <div style={{ fontSize: 10, color: "var(--muted)" }}>
                  +{outcome.abilities.length - 8} more abilities · links to ability rows
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
