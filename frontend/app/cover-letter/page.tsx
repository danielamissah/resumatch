"use client";

import { useRouter } from "next/navigation";
import CoverLetter from "@/components/CoverLetter";

const t = {
  bg: "#111614", bgCard: "#181f1c", border: "#2a3830",
  teal: "#0F6E56", tealLight: "#1D9E75", orange: "#EF9F27",
  text: "#e8f0ec", textMuted: "#6b8a7a", textDim: "#3d5a4e",
};

export default function CoverLetterPage() {
  const router = useRouter();

  return (
    <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "system-ui,-apple-system,sans-serif", color: t.text }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Header */}
      <header style={{ borderBottom: `1px solid ${t.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => router.push("/")}
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
            >
              <div style={{ width: 32, height: 32, borderRadius: 8, background: t.teal, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>R</div>
              <span style={{ fontWeight: 600, fontSize: 15, color: t.text }}>ResuMatch</span>
            </button>
          </div>
          <span style={{ fontSize: 12, color: t.textMuted }}>Cover Letter Generator</span>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.8px", lineHeight: 1.2, marginBottom: 12, color: t.text }}>
            Write a cover letter that <span style={{ color: t.orange }}>actually fits.</span>
          </h1>
          <p style={{ fontSize: 15, color: t.textMuted, lineHeight: 1.6 }}>
            Two tailored versions, your tone, ready to download as Word.
          </p>
          <p style={{ fontSize: 13, color: t.textDim, marginTop: 8 }}>
            Already ran an analysis?{" "}
            <button
              onClick={() => router.push("/")}
              style={{ background: "none", border: "none", color: t.tealLight, cursor: "pointer", fontSize: 13, textDecoration: "underline", fontFamily: "inherit" }}
            >
              Go back to use your results
            </button>
          </p>
        </div>

        <CoverLetter />
      </div>
    </div>
  );
}