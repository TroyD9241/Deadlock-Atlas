"use client";

import { useState } from "react";

import { ModelViewer, type ModelPoi } from "./model-viewer";

export type ModelSectionProps = {
  modelUrl: string;
  accent: string;
  fallbackImage: string | null;
  pois: ModelPoi[];
};

export function ModelSection({ modelUrl, accent, fallbackImage, pois }: ModelSectionProps) {
  const [hoveredPoi, setHoveredPoi] = useState<string | null>(null);
  const [activePoi, setActivePoi] = useState<string | null>(null);

  const activePoiData = pois.find((p) => p.anchor === activePoi);

  return (
    <div className="model-layout">
      <div style={{ display: "grid", gap: 12 }}>
        <ModelViewer
          modelUrl={modelUrl}
          accent={accent}
          fallbackImage={fallbackImage}
          pois={pois}
          hoveredPoi={hoveredPoi}
          activePoi={activePoi}
          onPoiHover={setHoveredPoi}
          onPoiClick={(a) => setActivePoi((cur) => (cur === a ? null : a))}
        />
        {activePoiData ? (
          <div className="panel" style={{ padding: 14 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 13, marginBottom: 6, color: "var(--accent)" }}>
              {activePoiData.label}
            </div>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "#b5b7c7", fontFamily: "var(--font-mono)" }}>
              {activePoiData.body}
            </p>
          </div>
        ) : null}
      </div>

      <div className="model-side">
        {pois.length > 0 ? (
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.17em", color: "var(--accent)", fontWeight: 850, fontFamily: "var(--font-display)" }}>
              POINTS OF INTEREST
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }}>
              {pois.map((p) => (
                <li key={p.anchor}>
                  <button
                    type="button"
                    onMouseEnter={() => setHoveredPoi(p.anchor)}
                    onMouseLeave={() => setHoveredPoi((cur) => (cur === p.anchor ? null : cur))}
                    onClick={() => setActivePoi((cur) => (cur === p.anchor ? null : p.anchor))}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      background: activePoi === p.anchor ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "#ffffff05",
                      border: "1px solid var(--line)",
                      borderLeft: hoveredPoi === p.anchor || activePoi === p.anchor ? "2px solid var(--accent)" : "2px solid transparent",
                      borderRadius: 8,
                      padding: "8px 10px",
                      color: "#c7c7d5",
                      fontSize: 12,
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      transition: "border-color 0.15s, background 0.15s",
                    }}
                  >
                    <span style={{ fontFamily: "var(--font-display)", color: "var(--accent)", marginRight: 8 }}>
                      {p.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p style={{ color: "var(--muted)", fontSize: 12 }}>No points of interest defined for this hero.</p>
        )}
      </div>
    </div>
  );
}