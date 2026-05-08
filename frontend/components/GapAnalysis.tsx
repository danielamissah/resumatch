"use client";
import { GapAnalysis as GapAnalysisType } from "@/lib/api";

const priorityConfig = {
  critical: { label: "Critical", color: "var(--danger)", bg: "var(--danger-dim)" },
  important: { label: "Important", color: "var(--warning)", bg: "var(--warning-dim)" },
  "nice-to-have": { label: "Nice to have", color: "var(--text-muted)", bg: "var(--bg-elevated)" },
};

export default function GapAnalysis({ gapAnalysis }: { gapAnalysis: GapAnalysisType }) {
  const { missing_skills, present_skills, transferable_skills } = gapAnalysis;
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>Missing Skills — {missing_skills.length} gaps found</h3>
        {missing_skills.map((gap, i) => {
          const config = priorityConfig[gap.priority as keyof typeof priorityConfig] || priorityConfig["nice-to-have"];
          return (
            <div key={i} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
              <div className="flex items-start justify-between mb-3 gap-4">
                <div className="flex items-center gap-3">
                  <span className="font-semibold" style={{ color: "var(--text-primary)" }}>{gap.skill}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: config.bg, color: config.color }}>{config.label}</span>
                </div>
                <span className="text-xs font-mono shrink-0" style={{ color: "var(--text-muted)" }}>x{gap.frequency} in JD</span>
              </div>
              <p className="text-sm mb-3" style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>{gap.context}</p>
              <div className="rounded-lg p-3 text-xs" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}><span style={{ color: "var(--accent)" }}>→ </span>{gap.suggestion}</div>
            </div>
          );
        })}
      </div>
      {present_skills.length > 0 && <div><h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>Skills You Already Have</h3><div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}><div className="flex flex-wrap gap-2">{present_skills.map((skill) => <span key={skill} className="text-sm px-3 py-1 rounded-full" style={{ background: "var(--success-dim)", color: "var(--success)" }}>✓ {skill}</span>)}</div></div></div>}
      {transferable_skills.length > 0 && <div><h3 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>Transferable Skills</h3><div className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}><div className="flex flex-wrap gap-2">{transferable_skills.map((skill) => <span key={skill} className="text-sm px-3 py-1 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>~ {skill}</span>)}</div></div></div>}
    </div>
  );
}
