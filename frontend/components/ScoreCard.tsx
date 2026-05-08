"use client";
import { MatchScore } from "@/lib/api";

export default function ScoreCard({ matchScore }: { matchScore: MatchScore }) {
  return (
    <div className="space-y-4">
      {matchScore.sections.map((section) => {
        const color = section.score >= 75 ? "var(--success)" : section.score >= 50 ? "var(--warning)" : "var(--danger)";
        return (
          <div key={section.section} className="rounded-xl p-5" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>{section.section}</span>
              <span className="text-2xl font-bold font-mono" style={{ color }}>{section.score}</span>
            </div>
            <div className="h-1.5 rounded-full mb-4" style={{ background: "var(--bg-elevated)" }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${section.score}%`, background: color }} />
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>{section.explanation}</p>
            <div className="flex flex-wrap gap-4">
              {section.top_matches.length > 0 && <div><div className="text-xs font-medium mb-2" style={{ color: "var(--success)" }}>Matched</div><div className="flex flex-wrap gap-1.5">{section.top_matches.map((kw) => <span key={kw} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--success-dim)", color: "var(--success)" }}>{kw}</span>)}</div></div>}
              {section.top_gaps.length > 0 && <div><div className="text-xs font-medium mb-2" style={{ color: "var(--danger)" }}>Missing</div><div className="flex flex-wrap gap-1.5">{section.top_gaps.map((kw) => <span key={kw} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--danger-dim)", color: "var(--danger)" }}>{kw}</span>)}</div></div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
