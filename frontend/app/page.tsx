"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analyzeFile, analyzeText, scrapeJobUrl, ResuMatchApiError } from "@/lib/api";

type InputMode = "file" | "text";
type JobInputMode = "url" | "paste";

const c = {
  page: { background: "#0a0a0a", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif", color: "#f5f5f0" } as React.CSSProperties,
  header: { borderBottom: "1px solid #2a2a2a" } as React.CSSProperties,
  headerInner: { maxWidth: 760, margin: "0 auto", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" } as React.CSSProperties,
  logoWrap: { display: "flex", alignItems: "center", gap: 10 } as React.CSSProperties,
  logoIcon: { width: 32, height: 32, borderRadius: 8, background: "#f5a623", color: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 } as React.CSSProperties,
  logoText: { fontWeight: 600, fontSize: 15 } as React.CSSProperties,
  badge: { fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#1a1a1a", color: "#555550", border: "1px solid #2a2a2a", fontFamily: "monospace" } as React.CSSProperties,
  body: { maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" } as React.CSSProperties,
  hero: { textAlign: "center" as const, marginBottom: 40 } as React.CSSProperties,
  h1: { fontSize: 40, fontWeight: 700, letterSpacing: "-1px", marginBottom: 12, lineHeight: 1.2 } as React.CSSProperties,
  sub: { fontSize: 16, color: "#a0a09a", lineHeight: 1.5 } as React.CSSProperties,
  card: { background: "#111", border: "1px solid #222", borderRadius: 20, padding: "32px", marginBottom: 0 } as React.CSSProperties,
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 } as React.CSSProperties,
  sectionLabel: { fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "#a0a09a" } as React.CSSProperties,
  pills: { display: "flex", gap: 3, padding: 4, borderRadius: 10, background: "#181818" } as React.CSSProperties,
  divider: { height: 1, background: "#222", margin: "28px 0" } as React.CSSProperties,
  dropzone: (active: boolean): React.CSSProperties => ({
    border: `2px dashed ${active ? "#f5a623" : "#333"}`,
    background: active ? "rgba(245,166,35,0.06)" : "#161616",
    borderRadius: 14, padding: "44px 24px", textAlign: "center" as const,
    cursor: "pointer", transition: "all 0.2s",
  }),
  textarea: { width: "100%", background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, padding: "14px 16px", fontSize: 13, color: "#f5f5f0", fontFamily: "monospace", lineHeight: 1.7, resize: "vertical" as const, outline: "none", boxSizing: "border-box" as const, display: "block" } as React.CSSProperties,
  urlRow: { display: "flex", gap: 8, alignItems: "stretch" } as React.CSSProperties,
  urlInput: { flex: 1, background: "#161616", border: "1px solid #2a2a2a", borderRadius: 14, padding: "13px 16px", fontSize: 14, color: "#f5f5f0", outline: "none", minWidth: 0 } as React.CSSProperties,
  previewBtn: { padding: "13px 18px", borderRadius: 14, background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#a0a09a", fontSize: 13, fontWeight: 500, cursor: "pointer", flexShrink: 0 } as React.CSSProperties,
  errBox: { background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.4)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#f87171", marginBottom: 20 } as React.CSSProperties,
  features: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 24 } as React.CSSProperties,
  featCard: { background: "#111", border: "1px solid #222", borderRadius: 14, padding: 20 } as React.CSSProperties,
};

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 12px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: active ? "#f5a623" : "transparent", color: active ? "#000" : "#a0a09a", transition: "all 0.15s" }}>
      {label}
    </button>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [resumeMode, setResumeMode] = useState<InputMode>("file");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [jobMode, setJobMode] = useState<JobInputMode>("url");
  const [jobUrl, setJobUrl] = useState("");
  const [jobText, setJobText] = useState("");
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapePreview, setScrapePreview] = useState("");
  const [scrapeError, setScrapeError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateAndSetFile = (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith(".pdf") && !ext.endsWith(".docx")) { setError("Please upload a PDF or DOCX file."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("File too large. Max 5MB."); return; }
    setResumeFile(file); setError("");
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleScrapePreview = async () => {
    if (!jobUrl.trim()) return;
    setScrapeLoading(true); setScrapeError(""); setScrapePreview("");
    try {
      const r = await scrapeJobUrl(jobUrl);
      if (r.success && r.job_description) {
        setScrapePreview(`✓ ${r.job_description.title || "Job Posting"}${r.job_description.company ? ` at ${r.job_description.company}` : ""}`);
      } else { setScrapeError(r.error || "Could not scrape. Try pasting the JD instead."); }
    } catch { setScrapeError("Could not reach this URL."); }
    finally { setScrapeLoading(false); }
  };

  const canSubmit = () => {
    const r = resumeMode === "file" ? !!resumeFile : resumeText.trim().length > 100;
    const j = jobMode === "url" ? jobUrl.trim().length > 10 : jobText.trim().length > 50;
    return r && j;
  };

  const handleAnalyze = async () => {
    if (!canSubmit()) return;
    setLoading(true); setError("");
    try {
      let result;
      if (resumeMode === "file" && resumeFile) {
        result = await analyzeFile({ file: resumeFile, jobUrl: jobMode === "url" ? jobUrl : undefined, jobDescriptionText: jobMode === "paste" ? jobText : undefined });
      } else {
        result = await analyzeText({ resumeText, jobUrl: jobMode === "url" ? jobUrl : undefined, jobDescriptionText: jobMode === "paste" ? jobText : undefined });
      }
      sessionStorage.setItem(`analysis_${result.analysis_id}`, JSON.stringify(result));
      router.push(`/results/${result.analysis_id}`);
    } catch (err) {
      setError(err instanceof ResuMatchApiError ? err.detail : "Something went wrong. Please try again.");
    } finally { setLoading(false); }
  };

  const ok = canSubmit() && !loading;

  return (
    <div style={c.page}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder, textarea::placeholder { color: #555550; }
        button { font-family: inherit; }
      `}</style>

      <header style={c.header}>
        <div style={c.headerInner}>
          <div style={c.logoWrap}>
            <div style={c.logoIcon}>R</div>
            <span style={c.logoText}>ResuMatch</span>
          </div>
          <span style={c.badge}>v1.0 beta</span>
        </div>
      </header>

      <div style={c.body}>
        <div style={c.hero}>
          <h1 style={c.h1}>Tailor your resume <span style={{ color: "#f5a623" }}>intelligently.</span></h1>
          <p style={c.sub}>RAG-powered analysis. Real skill gaps. Bullet rewrites that actually fit the role.</p>
        </div>

        <div style={c.card}>

          {/* Resume section */}
          <div style={{ marginBottom: 0 }}>
            <div style={c.row}>
              <span style={c.sectionLabel}>01 — Your Resume</span>
              <div style={c.pills}>
                <Pill active={resumeMode === "file"} onClick={() => setResumeMode("file")} label="Upload File" />
                <Pill active={resumeMode === "text"} onClick={() => setResumeMode("text")} label="Paste Text" />
              </div>
            </div>

            {resumeMode === "file" ? (
              <div style={c.dropzone(dragOver)}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}>
                <input id="file-input" type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }} />
                {resumeFile ? (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{resumeFile.name}</div>
                    <div style={{ fontSize: 13, color: "#555550" }}>{(resumeFile.size / 1024).toFixed(1)} KB · Click to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 28, marginBottom: 10, color: "#a0a09a" }}>↑</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Drop your resume here</div>
                    <div style={{ fontSize: 13, color: "#555550" }}>PDF or DOCX · Max 5MB</div>
                  </>
                )}
              </div>
            ) : (
              <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)}
                placeholder="Paste your resume text here..." rows={10} style={c.textarea}
                onFocus={(e) => (e.target.style.borderColor = "#f5a623")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")} />
            )}
          </div>

          <div style={c.divider} />

          {/* Job section */}
          <div style={{ marginBottom: 28 }}>
            <div style={c.row}>
              <span style={c.sectionLabel}>02 — Job Description</span>
              <div style={c.pills}>
                <Pill active={jobMode === "url"} onClick={() => setJobMode("url")} label="Job URL" />
                <Pill active={jobMode === "paste"} onClick={() => setJobMode("paste")} label="Paste JD" />
              </div>
            </div>

            {jobMode === "url" ? (
              <div>
                <div style={c.urlRow}>
                  <input type="url" value={jobUrl} onChange={(e) => { setJobUrl(e.target.value); setScrapePreview(""); setScrapeError(""); }}
                    placeholder="https://jobs.lever.co/company/role..." style={c.urlInput}
                    onFocus={(e) => (e.target.style.borderColor = "#f5a623")}
                    onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")} />
                  <button onClick={handleScrapePreview} disabled={!jobUrl.trim() || scrapeLoading} style={c.previewBtn}>
                    {scrapeLoading ? "..." : "Preview"}
                  </button>
                </div>
                {scrapePreview && <div style={{ fontSize: 13, color: "#4ade80", marginTop: 8 }}>{scrapePreview}</div>}
                {scrapeError && <div style={{ fontSize: 13, color: "#f87171", marginTop: 8 }}>{scrapeError}</div>}
              </div>
            ) : (
              <textarea value={jobText} onChange={(e) => setJobText(e.target.value)}
                placeholder="Paste the full job description here..." rows={8} style={c.textarea}
                onFocus={(e) => (e.target.style.borderColor = "#f5a623")}
                onBlur={(e) => (e.target.style.borderColor = "#2a2a2a")} />
            )}
          </div>

          {error && <div style={c.errBox}>{error}</div>}

          <button onClick={handleAnalyze} disabled={!canSubmit() || loading} style={{ width: "100%", padding: "16px", borderRadius: 14, fontWeight: 600, fontSize: 16, border: "none", cursor: ok ? "pointer" : "not-allowed", background: ok ? "#f5a623" : "#1a1a1a", color: ok ? "#000" : "#555550", transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            {loading
              ? <><span style={{ width: 16, height: 16, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Analysing your resume...</>
              : "Analyse Match →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: "#555550", marginTop: 14 }}>
            Analysis takes 15–30 seconds · Resume never stored without permission
          </p>
        </div>

        {/* Feature cards */}
        <div style={c.features}>
          {[
            { n: "01", t: "Fit Score", d: "Section-by-section match score with plain English explanations" },
            { n: "02", t: "Skill Gaps", d: "Ranked missing skills — why each one matters for this specific role" },
            { n: "03", t: "Bullet Rewrites", d: "Side-by-side rewrites using RAG-retrieved JD keywords" },
          ].map(({ n, t, d }) => (
            <div key={n} style={c.featCard}>
              <div style={{ fontSize: 11, fontFamily: "monospace", color: "#f5a623", marginBottom: 10 }}>{n}</div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, color: "#f5f5f0" }}>{t}</div>
              <div style={{ fontSize: 12, color: "#555550", lineHeight: 1.6 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}