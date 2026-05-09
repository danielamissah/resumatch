"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAnalysis, AnalysisResult } from "@/lib/api";
import ScoreCard from "@/components/ScoreCard";
import GapAnalysis from "@/components/GapAnalysis";
import BulletComparison from "@/components/BulletComparison";

type Tab = "score" | "gaps" | "bullets";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function ResultsPage() {
  const params = useParams();
  const router = useRouter();
  const analysisId = params.id as string;
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("score");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const cached = sessionStorage.getItem(`analysis_${analysisId}`);
    if (cached) {
      try { setResult(JSON.parse(cached)); setLoading(false); return; } catch {}
    }
    getAnalysis(analysisId)
      .then(setResult)
      .catch(() => router.push("/"))
      .finally(() => setLoading(false));
  }, [analysisId, router]);

  const handleDownloadDocx = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`${API_BASE}/export/${analysisId}/docx`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : "ResuMatch_Redline.docx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Make sure the backend is running.");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "2px solid #f5a623", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "#a0a09a", fontSize: 14 }}>Loading your analysis...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!result) return null;

  const { match_score, gap_analysis, bullet_rewrites, job } = result;
  const verdictColor = match_score.verdict === "Strong Match" ? "#4ade80" : match_score.verdict === "Partial Match" ? "#fb923c" : "#f87171";

  const tabs: { id: Tab; label: string }[] = [
    { id: "score",   label: "Fit Score" },
    { id: "gaps",    label: `Skill Gaps (${gap_analysis.missing_skills.length})` },
    { id: "bullets", label: `Bullet Rewrites (${bullet_rewrites.total_bullets})` },
  ];

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#f5f5f0" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } * { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Header */}
      <header style={{ borderBottom: "1px solid #222", position: "sticky", top: 0, background: "#0a0a0a", zIndex: 10 }}>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#a0a09a", cursor: "pointer", fontSize: 14, flexShrink: 0 }}>
            ← New Analysis
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span style={{ fontSize: 13, color: "#555550" }}>
              {job.title || "Analysis"}{job.company ? ` · ${job.company}` : ""}
            </span>
            <span style={{ fontSize: 11, fontFamily: "monospace", background: "rgba(245,166,35,0.12)", color: "#f5a623", padding: "3px 8px", borderRadius: 6 }}>
              {result.processing_time_ms}ms
            </span>
            {/* Download Word button */}
            <button
              onClick={handleDownloadDocx}
              disabled={downloading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: downloading ? "#1a1a1a" : "#161616", color: downloading ? "#555550" : "#f5f5f0", fontSize: 12, fontWeight: 500, cursor: downloading ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "all 0.15s" }}
              onMouseEnter={(e) => { if (!downloading) e.currentTarget.style.borderColor = "#f5a623"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#2a2a2a"; }}
            >
              {downloading ? (
                <><span style={{ width: 12, height: 12, border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} /> Exporting...</>
              ) : (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download Redline .docx</>
              )}
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* Summary bar */}
        <div style={{ background: "#111", border: "1px solid #222", borderRadius: 20, padding: "28px 32px", marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
              <span style={{ fontSize: 56, fontWeight: 700, fontFamily: "monospace", color: "#f5a623", lineHeight: 1 }}>
                {match_score.overall}
              </span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: verdictColor, marginBottom: 2 }}>{match_score.verdict}</div>
                <div style={{ fontSize: 12, color: "#555550" }}>overall match score</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#a0a09a", lineHeight: 1.6, maxWidth: 520 }}>{match_score.summary}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: "#555550" }}>
              <span style={{ color: "#f87171", fontWeight: 600 }}>{gap_analysis.critical_gaps_count}</span> critical gaps
            </div>
            <div style={{ fontSize: 13, color: "#555550" }}>
              <span style={{ color: "#4ade80", fontWeight: 600 }}>{gap_analysis.present_skills.length}</span> skills matched
            </div>
            <div style={{ fontSize: 13, color: "#555550" }}>
              <span style={{ color: "#f5a623", fontWeight: 600 }}>{bullet_rewrites.total_bullets}</span> bullets rewritten
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#111", border: "1px solid #222", borderRadius: 14, width: "fit-content", marginBottom: 24 }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", background: activeTab === tab.id ? "#f5a623" : "transparent", color: activeTab === tab.id ? "#000" : "#a0a09a", transition: "all 0.15s", fontFamily: "inherit" }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "score"   && <ScoreCard matchScore={match_score} />}
        {activeTab === "gaps"    && <GapAnalysis gapAnalysis={gap_analysis} result={result} />}
        {activeTab === "bullets" && <BulletComparison bulletRewrites={bullet_rewrites} />}
      </div>
    </div>
  );
}