"use client";

import { useState } from "react";
import { AnalysisResult } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const t = {
  bg: "#111614", bgCard: "#181f1c", bgElevated: "#1e2a26",
  border: "#2a3830", teal: "#0F6E56", tealLight: "#1D9E75",
  tealDim: "rgba(15,110,86,0.12)", orange: "#EF9F27",
  text: "#e8f0ec", textMuted: "#6b8a7a", textDim: "#3d5a4e",
  success: "#5DCAA5", danger: "#f87171", warning: "#fb923c",
};

interface CoverLetterVersion {
  version: string;
  angle: string;
  content: string;
  word_count: number;
}

interface CoverLetterResult {
  result_id: string;       
  version_a: CoverLetterVersion;
  version_b: CoverLetterVersion;
  tone: string;
  job_title: string;
  company_name: string;
}

interface Props {
  result?: AnalysisResult; // pre-filled when used on results page
}

const TONES = [
  { id: "formal", label: "Formal", desc: "Professional, complete sentences, no contractions" },
  { id: "conversational", label: "Conversational", desc: "Warm, natural language, shows personality" },
  { id: "confident", label: "Confident", desc: "Direct, strong verbs, leads with impact" },
];

function InputField({
  label, value, onChange, placeholder, type = "text"
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: t.textMuted, marginBottom: 6 }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", background: t.bgElevated, border: `1px solid ${focused ? t.tealLight : t.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: t.text, outline: "none", boxSizing: "border-box" as const, fontFamily: "inherit", transition: "border-color 0.2s" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}

function VersionCard({
  version, selected, onSelect, onCopy, onDownload, downloading
}: {
  version: CoverLetterVersion;
  selected: boolean;
  onSelect: () => void;
  onCopy: () => void;
  onDownload: () => void;
  downloading: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(version.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy();
  };

  return (
    <div style={{ background: t.bgCard, border: `1px solid ${selected ? t.teal : t.border}`, borderRadius: 16, overflow: "hidden", transition: "border-color 0.2s" }}>
      {/* Header */}
      <div style={{ padding: "14px 20px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", background: selected ? t.tealDim : "transparent" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 28, height: 28, borderRadius: "50%", background: selected ? t.teal : t.bgElevated, color: selected ? "#fff" : t.textMuted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
            {version.version}
          </span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Version {version.version}</div>
            <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>{version.angle}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: "monospace", color: t.textDim }}>{version.word_count} words</span>
          <button
            onClick={onSelect}
            style={{ padding: "5px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: selected ? t.teal : t.bgElevated, color: selected ? "#fff" : t.textMuted, transition: "all 0.15s" }}
          >
            {selected ? "✓ Selected" : "Select"}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 13, color: t.text, lineHeight: 1.8, whiteSpace: "pre-wrap", fontFamily: "Georgia, serif" }}>
          {version.content}
        </div>
      </div>

      {/* Actions */}
      <div style={{ padding: "12px 20px", borderTop: `1px solid ${t.border}`, display: "flex", gap: 8 }}>
        <button
          onClick={handleCopy}
          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit", color: copied ? t.success : t.textMuted, transition: "all 0.15s" }}
        >
          {copied ? "Copied" : "Copy text"}
        </button>
        <button
          onClick={onDownload}
          disabled={downloading}
          style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: selected ? t.teal : t.bgElevated, fontSize: 12, fontWeight: 500, cursor: downloading ? "not-allowed" : "pointer", fontFamily: "inherit", color: selected ? "#fff" : t.textMuted, display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s" }}
        >
          {downloading
            ? <><span style={{ width: 10, height: 10, border: "1.5px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Exporting...</>
            : "↓ Download .docx"
          }
        </button>
      </div>
    </div>
  );
}

export default function CoverLetter({ result }: Props) {
  // Personal details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [location, setLocation] = useState("");

  // Content — pre-filled if coming from analysis
  const [resumeText, setResumeText] = useState(result?.resume.raw_text || "");
  const [jdText, setJdText] = useState(result?.job.raw_text || "");
  const [jobTitle, setJobTitle] = useState(result?.job.title || "");
  const [companyName, setCompanyName] = useState(result?.job.company || "");

  // Tone
  const [tone, setTone] = useState("formal");

  // State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clResult, setClResult] = useState<CoverLetterResult | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<"A" | "B">("A");
  const [downloading, setDownloading] = useState<"A" | "B" | null>(null);

  const canGenerate = fullName && email && phone && linkedin && location &&
    resumeText.trim().length > 100 && jdText.trim().length > 50;

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setLoading(true);
    setError("");
    setClResult(null);

    try {
      const response = await fetch(`${API_BASE}/cover-letter/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          email, phone, linkedin, location, tone,
          resume_text: resumeText,
          job_description_text: jdText,
          job_title: jobTitle,
          company_name: companyName,
          matched_skills: result?.gap_analysis.present_skills || [],
          missing_skills: result?.gap_analysis.missing_skills.map(g => g.skill) || [],
          analysis_id: result?.analysis_id || null,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || "Generation failed");
      }

      const data: CoverLetterResult = await response.json();
      setClResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

    const handleDownload = async (version: "A" | "B") => {
      console.log("result_id:", clResult?.result_id);
    if (!clResult?.result_id) return;
    setDownloading(version);
    try {
      const response = await fetch(`${API_BASE}/cover-letter/${clResult.result_id}/export/${version}`);
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      a.download = match ? match[1] : `CoverLetter_v${version}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed. Please try again.");
    } finally {
      setDownloading(null);
    }
  };

  const sectionLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: t.textMuted, marginBottom: 14, display: "block" };

  return (
    <div style={{ fontFamily: "system-ui,-apple-system,sans-serif" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}`}</style>

      {!clResult ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* Personal details */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24 }}>
            <span style={sectionLabel}>Your Details</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <InputField label="Full Name" value={fullName} onChange={setFullName} placeholder="Daniel Kwame Amissah" />
              <InputField label="Email" value={email} onChange={setEmail} placeholder="daniel@email.com" type="email" />
              <InputField label="Phone" value={phone} onChange={setPhone} placeholder="+49 123 456 7890" />
              <InputField label="LinkedIn" value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/danielkamissah" />
              <div style={{ gridColumn: "1 / -1" }}>
                <InputField label="Location" value={location} onChange={setLocation} placeholder="Hamburg, Germany" />
              </div>
            </div>
          </div>

          {/* Role details — only show if not pre-filled */}
          {!result && (
            <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24 }}>
              <span style={sectionLabel}>Role Details</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                <InputField label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="ML Engineer" />
                <InputField label="Company" value={companyName} onChange={setCompanyName} placeholder="Aleph Alpha" />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ ...sectionLabel, marginBottom: 6 }}>Resume Text</label>
                  <textarea
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                    placeholder="Paste your resume text here..."
                    rows={6}
                    style={{ width: "100%", background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: t.text, fontFamily: "monospace", lineHeight: 1.7, resize: "vertical" as const, outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ ...sectionLabel, marginBottom: 6 }}>Job Description</label>
                  <textarea
                    value={jdText}
                    onChange={(e) => setJdText(e.target.value)}
                    placeholder="Paste the job description here..."
                    rows={6}
                    style={{ width: "100%", background: t.bgElevated, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: t.text, fontFamily: "monospace", lineHeight: 1.7, resize: "vertical" as const, outline: "none" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Pre-filled confirmation */}
          {result && (
            <div style={{ background: t.tealDim, border: `1px solid ${t.tealLight}`, borderRadius: 12, padding: "12px 16px", fontSize: 13, color: t.tealLight }}>
              ✓ Resume and job description pre-filled from your analysis — {result.job.title}{result.job.company ? ` at ${result.job.company}` : ""}
            </div>
          )}

          {/* Tone selector */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24 }}>
            <span style={sectionLabel}>Tone</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TONES.map((t_item) => (
                <button
                  key={t_item.id}
                  onClick={() => setTone(t_item.id)}
                  style={{ padding: "12px 16px", borderRadius: 10, border: `1px solid ${tone === t_item.id ? t.teal : t.border}`, background: tone === t_item.id ? t.tealDim : t.bgElevated, cursor: "pointer", textAlign: "left" as const, fontFamily: "inherit", transition: "all 0.15s", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${tone === t_item.id ? t.teal : t.border}`, background: tone === t_item.id ? t.teal : "transparent", flexShrink: 0, transition: "all 0.15s" }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>{t_item.label}</div>
                    <div style={{ fontSize: 12, color: t.textMuted }}>{t_item.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.35)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: t.danger }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={!canGenerate || loading}
            style={{ width: "100%", padding: 15, borderRadius: 14, fontWeight: 600, fontSize: 15, border: "none", cursor: canGenerate && !loading ? "pointer" : "not-allowed", background: canGenerate && !loading ? t.teal : t.bgElevated, color: canGenerate && !loading ? "#fff" : t.textDim, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", transition: "all 0.2s" }}
          >
            {loading
              ? <><span style={{ width: 16, height: 16, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" }} />Generating two versions (~30s)...</>
              : "Generate Cover Letter →"
            }
          </button>

          {!canGenerate && (
            <p style={{ textAlign: "center", fontSize: 12, color: t.textDim }}>
              Fill in all personal details to generate
            </p>
          )}
        </div>
      ) : (
        /* Results view */
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Summary bar */}
          <div style={{ background: t.bgCard, border: `1px solid ${t.border}`, borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 10 }}>
            <div>
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>
                {clResult.job_title || "Cover Letter"}{clResult.company_name ? ` — ${clResult.company_name}` : ""}
              </span>
              <span style={{ marginLeft: 10, fontSize: 12, padding: "2px 8px", borderRadius: 20, background: t.tealDim, color: t.tealLight }}>
                {clResult.tone.charAt(0).toUpperCase() + clResult.tone.slice(1)} tone
              </span>
            </div>
            <button
              onClick={() => setClResult(null)}
              style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${t.border}`, background: "transparent", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: t.textMuted }}
            >
              ← Regenerate
            </button>
          </div>

          <p style={{ fontSize: 13, color: t.textMuted }}>
            Two versions generated. Read both, select the one you prefer, then copy or download as Word.
          </p>

          {/* Version A */}
          <VersionCard
            version={clResult.version_a}
            selected={selectedVersion === "A"}
            onSelect={() => setSelectedVersion("A")}
            onCopy={() => {}}
            onDownload={() => handleDownload("A")}
            downloading={downloading === "A"}
          />

          {/* Version B */}
          <VersionCard
            version={clResult.version_b}
            selected={selectedVersion === "B"}
            onSelect={() => setSelectedVersion("B")}
            onCopy={() => {}}
            onDownload={() => handleDownload("B")}
            downloading={downloading === "B"}
          />
        </div>
      )}
    </div>
  );
}