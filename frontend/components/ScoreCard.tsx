"use client";

import { MatchScore } from "@/lib/api";

export default function ScoreCard({ matchScore }: { matchScore: MatchScore }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {matchScore.sections.map((section) => {
        const color = section.score >= 75 ? "#4ade80" : section.score >= 50 ? "#fb923c" : "#f87171";
        return (
          <div key={section.section} style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 24 }}>

            {/* Section header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 15, color: "#f5f5f0" }}>{section.section}</span>
              <span style={{ fontSize: 28, fontWeight: 700, fontFamily: "monospace", color }}>{section.score}</span>
            </div>

            {/* Score bar */}
            <div style={{ height: 4, background: "#222", borderRadius: 4, marginBottom: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${section.score}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
            </div>

            {/* Explanation */}
            <p style={{ fontSize: 13, color: "#a0a09a", lineHeight: 1.6, marginBottom: 16 }}>{section.explanation}</p>

            {/* Keywords */}
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              {section.top_matches.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Matched</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {section.top_matches.map((kw) => (
                      <span key={kw} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>{kw}</span>
                    ))}
                  </div>
                </div>
              )}
              {section.top_gaps.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#f87171", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Missing</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {section.top_gaps.map((kw) => (
                      <span key={kw} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "rgba(248,113,113,0.1)", color: "#f87171" }}>{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}