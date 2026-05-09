"use client";

import { GapAnalysis as GapAnalysisType } from "@/lib/api";

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical:       { label: "Critical",      color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  important:      { label: "Important",     color: "#fb923c", bg: "rgba(251,146,60,0.1)"  },
  "nice-to-have": { label: "Nice to have",  color: "#a0a09a", bg: "rgba(160,160,154,0.1)" },
};

export default function GapAnalysis({ gapAnalysis }: { gapAnalysis: GapAnalysisType }) {
  const { missing_skills, present_skills, transferable_skills } = gapAnalysis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* Missing skills */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#a0a09a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
          Missing Skills — {missing_skills.length} gaps found
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {missing_skills.length === 0 ? (
            <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: 20, textAlign: "center", color: "#4ade80", fontSize: 14 }}>
              No significant skill gaps detected.
            </div>
          ) : missing_skills.map((gap, i) => {
            const cfg = priorityConfig[gap.priority] || priorityConfig["nice-to-have"];
            return (
              <div key={i} style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 20 }}>

                {/* Top row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 15, color: "#f5f5f0" }}>{gap.skill}</span>
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 600, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#555550", flexShrink: 0 }}>×{gap.frequency} in JD</span>
                </div>

                {/* Context */}
                <p style={{ fontSize: 13, color: "#a0a09a", lineHeight: 1.6, marginBottom: 12 }}>{gap.context}</p>

                {/* Suggestion */}
                <div style={{ background: "#161616", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#a0a09a", lineHeight: 1.6 }}>
                  <span style={{ color: "#f5a623" }}>→ </span>{gap.suggestion}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Present skills */}
      {present_skills.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a0a09a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Skills You Already Have
          </div>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {present_skills.map((skill) => (
                <span key={skill} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 20, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>✓ {skill}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Transferable skills */}
      {transferable_skills.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a0a09a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            Transferable Skills
          </div>
          <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {transferable_skills.map((skill) => (
                <span key={skill} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 20, background: "rgba(245,166,35,0.1)", color: "#f5a623" }}>~ {skill}</span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}