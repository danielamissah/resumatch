"use client";

import { GapAnalysis as GapAnalysisType, AnalysisResult } from "@/lib/api";

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  critical:       { label: "Critical",     color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  important:      { label: "Important",    color: "#fb923c", bg: "rgba(251,146,60,0.1)"  },
  "nice-to-have": { label: "Nice to have", color: "#a0a09a", bg: "rgba(160,160,154,0.1)" },
};

// Build a targeted YouTube search URL for a specific skill
function youtubeUrl(skill: string): string {
  const query = encodeURIComponent(`${skill} tutorial for beginners`);
  return `https://www.youtube.com/results?search_query=${query}`;
}

// ─── ATS Density Meter ────────────────────────────────────────────────────────

function AtsDensityMeter({ result }: { result: AnalysisResult }) {
  const resumeText = result.resume.raw_text.toLowerCase();
  const jdText = result.job.raw_text.toLowerCase();

  // Extract meaningful keywords from JD (filter noise words)
  const noiseWords = new Set([
    "the","and","for","are","with","you","will","have","this","that","from",
    "your","our","their","team","role","work","able","also","more","been",
    "they","about","into","which","when","what","such","other","these","those",
    "some","each","only","than","then","well","both","very","just","over",
    "its","can","all","not","but","any","may","has","was","were","had",
    "his","her","him","use","used","using","we","an","in","of","to","a",
    "is","it","at","be","by","or","as","on","if","do","no","so","up",
    "required","preferred","experience","years","strong","skills","ability",
    "knowledge","understanding","working","proven","excellent","good",
  ]);

  // Get unique words from JD that are meaningful (length > 3, not noise)
  const jdWords = [...new Set(
    jdText.split(/\W+/).filter(w => w.length > 3 && !noiseWords.has(w))
  )];

  // Check which JD keywords appear in resume
  const found = jdWords.filter(w => resumeText.includes(w));
  const missing = jdWords.filter(w => !resumeText.includes(w)).slice(0, 20);
  const density = jdWords.length > 0 ? Math.round((found.length / jdWords.length) * 100) : 0;

  const densityColor = density >= 70 ? "#4ade80" : density >= 45 ? "#fb923c" : "#f87171";
  const densityLabel = density >= 70 ? "Strong ATS signal" : density >= 45 ? "Moderate ATS signal" : "Weak ATS signal";

  // Top missing keywords (not already in gap analysis) — most impactful ones
  const topMissing = missing
    .filter(w => w.length > 4)
    .slice(0, 12);

  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 16, overflow: "hidden", marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1a1a1a", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: "#f5f5f0", marginBottom: 2 }}>ATS Keyword Density</div>
          <div style={{ fontSize: 12, color: "#555550" }}>How many JD keywords appear in your resume</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "monospace", color: densityColor, lineHeight: 1 }}>{density}%</div>
          <div style={{ fontSize: 11, color: densityColor, marginTop: 2 }}>{densityLabel}</div>
        </div>
      </div>

      {/* Bar */}
      <div style={{ padding: "14px 20px", borderBottom: "1px solid #1a1a1a" }}>
        <div style={{ height: 6, background: "#1a1a1a", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${density}%`, background: densityColor, borderRadius: 6, transition: "width 0.8s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: "#555550" }}>{found.length} keywords matched</span>
          <span style={{ fontSize: 11, color: "#555550" }}>{jdWords.length} total JD keywords</span>
        </div>
      </div>

      {/* Top missing keywords */}
      {topMissing.length > 0 && (
        <div style={{ padding: "14px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a0a09a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
            Top missing keywords to add
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topMissing.map((kw) => (
              <span key={kw} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)" }}>
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GapAnalysis({
  gapAnalysis,
  result,
}: {
  gapAnalysis: GapAnalysisType;
  result: AnalysisResult;
}) {
  const { missing_skills, present_skills, transferable_skills } = gapAnalysis;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ATS Density Meter — always shown at top */}
      <AtsDensityMeter result={result} />

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
                    <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 20, fontWeight: 600, background: cfg.bg, color: cfg.color }}>
                      {cfg.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "#555550", flexShrink: 0 }}>
                    ×{gap.frequency} in JD
                  </span>
                </div>

                {/* Context */}
                <p style={{ fontSize: 13, color: "#a0a09a", lineHeight: 1.6, marginBottom: 12 }}>
                  {gap.context}
                </p>

                {/* Suggestion */}
                <div style={{ background: "#161616", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#a0a09a", lineHeight: 1.6, marginBottom: 12 }}>
                  <span style={{ color: "#f5a623" }}>→ </span>{gap.suggestion}
                </div>

                {/* YouTube link — unique per skill */}
                <a
                  href={youtubeUrl(gap.skill)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#f5a623", textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(245,166,35,0.25)", background: "rgba(245,166,35,0.06)", transition: "all 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(245,166,35,0.12)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(245,166,35,0.06)")}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                  Learn {gap.skill} on YouTube
                </a>
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
                <span key={skill} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 20, background: "rgba(74,222,128,0.1)", color: "#4ade80" }}>
                  ✓ {skill}
                </span>
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
                <span key={skill} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 20, background: "rgba(245,166,35,0.1)", color: "#f5a623" }}>
                  ~ {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}