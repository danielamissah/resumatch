"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAnalysis, AnalysisResult } from "@/lib/api";
import ScoreCard from "@/components/ScoreCard";
import GapAnalysis from "@/components/GapAnalysis";
import BulletComparison from "@/components/BulletComparison";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const analysisId = params.id as string;
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"score"|"gaps"|"bullets">("score");

  useEffect(() => {
    const cached = sessionStorage.getItem(`analysis_${analysisId}`);
    if (cached) { try { setResult(JSON.parse(cached)); setLoading(false); return; } catch {} }
    getAnalysis(analysisId).then(setResult).catch(() => router.push("/")).finally(() => setLoading(false));
  }, [analysisId, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}><div className="text-center"><div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: "var(--accent)", borderTopColor: "transparent" }} /><p style={{ color: "var(--text-secondary)" }}>Loading your analysis...</p></div></div>;
  if (!result) return null;

  const { match_score, gap_analysis, bullet_rewrites, job } = result;
  const verdictColor = { "Strong Match": "var(--success)", "Partial Match": "var(--warning)", "Weak Match": "var(--danger)" }[match_score.verdict] || "var(--text-secondary)";

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <header className="border-b sticky top-0 z-10" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={() => router.push("/")} className="text-sm transition-colors" style={{ color: "var(--text-secondary)" }}>← New Analysis</button>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>{job.title || "Job Analysis"}{job.company ? ` · ${job.company}` : ""}</span>
            <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{result.processing_time_ms}ms</span>
          </div>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="rounded-2xl p-6 mb-8 flex items-center justify-between flex-wrap gap-4" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-5xl font-bold font-mono" style={{ color: "var(--accent)" }}>{match_score.overall}</span>
              <div><div className="text-sm font-semibold" style={{ color: verdictColor }}>{match_score.verdict}</div><div className="text-xs" style={{ color: "var(--text-muted)" }}>overall match score</div></div>
            </div>
            <p className="text-sm max-w-xl" style={{ color: "var(--text-secondary)", lineHeight: "1.6" }}>{match_score.summary}</p>
          </div>
          <div className="flex flex-col gap-2 text-right">
            <div className="text-sm" style={{ color: "var(--text-muted)" }}><span style={{ color: "var(--danger)" }}>{gap_analysis.critical_gaps_count}</span> critical gaps</div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}><span style={{ color: "var(--success)" }}>{gap_analysis.present_skills.length}</span> skills matched</div>
            <div className="text-sm" style={{ color: "var(--text-muted)" }}><span style={{ color: "var(--accent)" }}>{bullet_rewrites.total_bullets}</span> bullets rewritten</div>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl mb-8 w-fit" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
          {([{ id: "score" as const, label: "Fit Score" }, { id: "gaps" as const, label: `Skill Gaps (${gap_analysis.missing_skills.length})` }, { id: "bullets" as const, label: `Bullet Rewrites (${bullet_rewrites.total_bullets})` }]).map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="px-4 py-2 rounded-lg text-sm font-medium transition-all" style={{ background: activeTab === tab.id ? "var(--accent)" : "transparent", color: activeTab === tab.id ? "#000" : "var(--text-secondary)" }}>{tab.label}</button>
          ))}
        </div>
        {activeTab === "score" && <ScoreCard matchScore={match_score} />}
        {activeTab === "gaps" && <GapAnalysis gapAnalysis={gap_analysis} />}
        {activeTab === "bullets" && <BulletComparison bulletRewrites={bullet_rewrites} />}
      </div>
    </main>
  );
}
