"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { analyzeFile, analyzeText, scrapeJobUrl, ResuMatchApiError } from "@/lib/api";

type InputMode = "file" | "text";
type JobInputMode = "url" | "paste";

const RESUME_LIMIT = 8000;
const JD_LIMIT = 6000;

// ─── Design tokens ────────────────────────────────────────────────────────────
const t = {
  bg:           "#111614",
  bgCard:       "#181f1c",
  bgElevated:   "#1e2a26",
  border:       "#2a3830",
  teal:         "#0F6E56",
  tealLight:    "#1D9E75",
  tealDim:      "rgba(15,110,86,0.12)",
  tealBorder:   "rgba(15,110,86,0.3)",
  orange:       "#EF9F27",
  orangeDim:    "rgba(239,159,39,0.12)",
  text:         "#e8f0ec",
  textMuted:    "#6b8a7a",
  textDim:      "#3d5a4e",
  success:      "#5DCAA5",
  danger:       "#f87171",
  warning:      "#fb923c",
};

function CharCounter({ value, limit }: { value: string; limit: number }) {
  const len = value.length;
  const pct = Math.min(100, (len / limit) * 100);
  const left = Math.max(0, limit - len);
  const over = len - limit;
  const isWarn = pct >= 75 && pct < 95;
  const isOver = pct >= 95;
  const barColor = isOver ? t.danger : isWarn ? t.warning : t.tealLight;
  const textColor = isOver ? t.danger : isWarn ? t.warning : t.textMuted;

  return (
    <div style={{ marginTop: 6, padding: "0 2px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: textColor, whiteSpace: "nowrap" }}>
          {len.toLocaleString()} / {limit.toLocaleString()}
        </span>
        <div style={{ flex: 1, height: 3, background: t.bgElevated, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.3s, background 0.3s" }} />
        </div>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: textColor, whiteSpace: "nowrap" }}>
          {over > 0 ? `${over.toLocaleString()} over` : `${left.toLocaleString()} left`}
        </span>
      </div>
      <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.tealLight, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: t.textDim }}>
          Keep {limit === RESUME_LIMIT ? "resume" : "Job Description"} under {limit.toLocaleString()} chars for best results
        </span>
      </div>
    </div>
  );
}

function Pill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{ padding: "5px 13px", borderRadius: 7, border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer", background: active ? t.teal : "transparent", color: active ? "#fff" : t.textMuted, transition: "all 0.15s", fontFamily: "inherit" }}>
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
    } catch { setScrapeError("Could not reach this URL. Try pasting instead."); }
    finally { setScrapeLoading(false); }
  };

  const canSubmit = () => {
    const hasResume = resumeMode === "file" ? !!resumeFile : resumeText.trim().length > 100;
    const hasJob = jobMode === "url" ? jobUrl.trim().length > 10 : jobText.trim().length > 50;
    return hasResume && hasJob;
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
  const inputBase: React.CSSProperties = { width: "100%", background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 14, padding: "13px 16px", fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" };

  return (
    <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", color: t.text }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box;margin:0;padding:0}input::placeholder,textarea::placeholder{color:${t.textDim}}button{font-family:inherit}`}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: t.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>R</div>
            <span style={{ fontWeight: 600, fontSize: 15 }}>ResuMatch</span>
          </div>
          <span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: t.bgElevated, color: t.textMuted, border: `1px solid ${t.border}`, fontFamily: "monospace" }}>v1.0 beta</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1px", lineHeight: 1.15, marginBottom: 12 }}>
            Tailor your resume <span style={{ color: t.orange }}>intelligently.</span>
          </h1>
          <p style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.6 }}>
            RAG-powered analysis. Real skill gaps. Bullet rewrites that fit the role.
          </p>
        </div>

        {/* Card */}
        <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 20, padding: 28 }}>

          {/* Resume section */}
          <div style={{ marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: t.textMuted }}>01 — Your Resume</span>
              <div style={{ display: "flex", gap: 3, padding: 4, borderRadius: 10, background: t.bgElevated }}>
                <Pill active={resumeMode === "file"} onClick={() => setResumeMode("file")} label="Upload file" />
                <Pill active={resumeMode === "text"} onClick={() => setResumeMode("text")} label="Paste text" />
              </div>
            </div>

            {resumeMode === "file" ? (
              <div
                style={{ border: `2px dashed ${dragOver ? t.tealLight : t.border}`, background: dragOver ? t.tealDim : t.bgElevated, borderRadius: 14, padding: "44px 24px", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <input id="file-input" type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); }} />
                {resumeFile ? (
                  <>
                    <div style={{ fontSize: 26, marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{resumeFile.name}</div>
                    <div style={{ fontSize: 13, color: t.textDim }}>{(resumeFile.size / 1024).toFixed(1)} KB · Click to change</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 26, color: t.textMuted, marginBottom: 10 }}>↑</div>
                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Drop your resume here</div>
                    <div style={{ fontSize: 13, color: t.textDim }}>PDF or DOCX · Max 5 MB</div>
                  </>
                )}
              </div>
            ) : (
              <>
                <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your full resume text here..." rows={9}
                  style={{ ...inputBase, fontFamily: "monospace", lineHeight: 1.7, resize: "vertical" as const }}
                  onFocus={(e) => (e.target.style.borderColor = t.tealLight)}
                  onBlur={(e) => (e.target.style.borderColor = t.border)} />
                <CharCounter value={resumeText} limit={RESUME_LIMIT} />
              </>
            )}
          </div>

          <div style={{ height: 1, background: t.border, margin: "24px 0" }} />

          {/* Job section */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: t.textMuted }}>02 — Job Description</span>
              <div style={{ display: "flex", gap: 3, padding: 4, borderRadius: 10, background: t.bgElevated }}>
                <Pill active={jobMode === "url"} onClick={() => setJobMode("url")} label="Job URL" />
                <Pill active={jobMode === "paste"} onClick={() => setJobMode("paste")} label="Paste JD" />
              </div>
            </div>

            {jobMode === "url" ? (
              <div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="url" value={jobUrl} onChange={(e) => { setJobUrl(e.target.value); setScrapePreview(""); setScrapeError(""); }}
                    placeholder="https://jobs.lever.co/company/role..."
                    style={{ ...inputBase, flex: 1, fontFamily: "inherit" }}
                    onFocus={(e) => (e.target.style.borderColor = t.tealLight)}
                    onBlur={(e) => (e.target.style.borderColor = t.border)} />
                  <button onClick={handleScrapePreview} disabled={!jobUrl.trim() || scrapeLoading}
                    style={{ padding: "13px 18px", borderRadius: 14, background: t.bgElevated, border: `1px solid ${t.border}`, color: scrapeLoading ? t.textDim : t.textMuted, fontSize: 13, fontWeight: 500, cursor: scrapeLoading ? "not-allowed" : "pointer", flexShrink: 0, transition: "all 0.15s" }}>
                    {scrapeLoading ? "..." : "Preview"}
                  </button>
                </div>
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, paddingLeft: 2 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: t.tealLight, display: "inline-block" }} />
                  <span style={{ fontSize: 11, color: t.textDim }}>Supports Lever, Greenhouse, LinkedIn & most job boards</span>
                </div>
                {scrapePreview && <div style={{ fontSize: 13, color: t.success, marginTop: 8 }}>{scrapePreview}</div>}
                {scrapeError && <div style={{ fontSize: 13, color: t.danger, marginTop: 8 }}>{scrapeError}</div>}
              </div>
            ) : (
              <>
                <textarea value={jobText} onChange={(e) => setJobText(e.target.value)} placeholder="Paste the full job description here..." rows={7}
                  style={{ ...inputBase, fontFamily: "monospace", lineHeight: 1.7, resize: "vertical" as const }}
                  onFocus={(e) => (e.target.style.borderColor = t.tealLight)}
                  onBlur={(e) => (e.target.style.borderColor = t.border)} />
                <CharCounter value={jobText} limit={JD_LIMIT} />
              </>
            )}
          </div>

          {error && <div style={{ background: "rgba(248,113,113,0.08)", border: `1px solid rgba(248,113,113,0.35)`, borderRadius: 12, padding: "12px 16px", fontSize: 13, color: t.danger, marginBottom: 20 }}>{error}</div>}

          <button onClick={handleAnalyze} disabled={!canSubmit() || loading}
            style={{ width: "100%", padding: 15, borderRadius: 14, fontWeight: 600, fontSize: 15, border: "none", cursor: ok ? "pointer" : "not-allowed", background: ok ? t.teal : t.bgElevated, color: ok ? "#fff" : t.textDim, transition: "all 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading
              ? <><span style={{ width: 16, height: 16, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Analysing your resume...</>
              : "Analyse Match →"}
          </button>

          <p style={{ textAlign: "center", fontSize: 12, color: t.textDim, marginTop: 14 }}>
            Resume never stored without permission
          </p>
        </div>

        {/* Feature cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 20 }}>
          {[
            { n: "01", title: "Fit Score",      desc: "Section-by-section match with plain English explanations" },
            { n: "02", title: "Skill Gaps",     desc: "Priority-ranked gaps with YouTube learning links per skill" },
            { n: "03", title: "Redline .docx",  desc: "Download rewrites as a Word track-changes document" },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 10, fontFamily: "monospace", color: t.tealLight, marginBottom: 8 }}>{n}</div>
              <div style={{ fontWeight: 600, fontSize: 13, color: t.text, marginBottom: 4 }}>{title}</div>
              <div style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}