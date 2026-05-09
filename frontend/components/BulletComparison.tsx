"use client";

import { useState } from "react";
import { BulletRewrites } from "@/lib/api";

export default function BulletComparison({ bulletRewrites }: { bulletRewrites: BulletRewrites }) {
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [rejected, setRejected] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState<number | null>(null);

  const { rewrites, sections_covered } = bulletRewrites;

  const bySection = rewrites.reduce<Record<string, typeof rewrites>>((acc, r) => {
    if (!acc[r.section]) acc[r.section] = [];
    acc[r.section].push(r);
    return acc;
  }, {});

  const accept = (i: number) => {
    setAccepted((p) => new Set([...p, i]));
    setRejected((p) => { const s = new Set(p); s.delete(i); return s; });
  };
  const reject = (i: number) => {
    setRejected((p) => new Set([...p, i]));
    setAccepted((p) => { const s = new Set(p); s.delete(i); return s; });
  };
  const copy = async (text: string, i: number) => {
    await navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Summary */}
      <div style={{ background: "#111", border: "1px solid #222", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontSize: 13, color: "#a0a09a" }}>
          {rewrites.length} bullets rewritten across {sections_covered.length} section{sections_covered.length !== 1 ? "s" : ""}. Accept or reject each one.
        </p>
        <span style={{ fontSize: 13, fontFamily: "monospace", color: "#f5a623" }}>
          {accepted.size}/{rewrites.length} accepted
        </span>
      </div>

      {/* Sections */}
      {Object.entries(bySection).map(([sectionName, sectionRewrites]) => (
        <div key={sectionName}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#a0a09a", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>
            {sectionName}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {sectionRewrites.map((rewrite) => {
              const globalIdx = rewrites.indexOf(rewrite);
              const isAccepted = accepted.has(globalIdx);
              const isRejected = rejected.has(globalIdx);

              return (
                <div key={globalIdx} style={{ background: "#111", border: `1px solid ${isAccepted ? "#4ade80" : "#222"}`, borderRadius: 16, overflow: "hidden", opacity: isRejected ? 0.45 : 1, transition: "all 0.2s" }}>

                  {/* Before / After columns */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ padding: 20, borderRight: "1px solid #222" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#555550", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Original</div>
                      <p style={{ fontSize: 13, color: "#a0a09a", lineHeight: 1.65 }}>{rewrite.original}</p>
                    </div>
                    <div style={{ padding: 20 }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#f5a623", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>Rewritten</div>
                      <p style={{ fontSize: 13, color: "#f5f5f0", lineHeight: 1.65 }}>{rewrite.rewritten}</p>
                    </div>
                  </div>

                  {/* Keywords added */}
                  {rewrite.keywords_added.length > 0 && (
                    <div style={{ padding: "10px 20px", borderTop: "1px solid #1a1a1a", background: "#0e0e0e", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11, color: "#555550" }}>Keywords added:</span>
                      {rewrite.keywords_added.map((kw) => (
                        <span key={kw} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "rgba(245,166,35,0.1)", color: "#f5a623" }}>{kw}</span>
                      ))}
                    </div>
                  )}

                  {/* Explanation */}
                  <div style={{ padding: "10px 20px", borderTop: "1px solid #1a1a1a", background: "#0e0e0e", fontSize: 12, color: "#555550", lineHeight: 1.5 }}>
                    {rewrite.explanation}
                  </div>

                  {/* Actions */}
                  <div style={{ padding: "12px 20px", borderTop: "1px solid #1a1a1a", display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={() => accept(globalIdx)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: isAccepted ? "#4ade80" : "rgba(74,222,128,0.1)", color: isAccepted ? "#000" : "#4ade80", transition: "all 0.15s" }}>
                      {isAccepted ? "✓ Accepted" : "Accept"}
                    </button>
                    <button onClick={() => reject(globalIdx)} style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: isRejected ? "#f87171" : "rgba(248,113,113,0.1)", color: isRejected ? "#000" : "#f87171", transition: "all 0.15s" }}>
                      {isRejected ? "✗ Rejected" : "Reject"}
                    </button>
                    <button onClick={() => copy(rewrite.rewritten, globalIdx)} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 8, border: "1px solid #2a2a2a", background: "transparent", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: copied === globalIdx ? "#4ade80" : "#a0a09a", transition: "all 0.15s" }}>
                      {copied === globalIdx ? "Copied!" : "Copy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}