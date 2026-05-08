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

  const handleAccept = (i: number) => { setAccepted((p) => new Set([...p, i])); setRejected((p) => { const s = new Set(p); s.delete(i); return s; }); };
  const handleReject = (i: number) => { setRejected((p) => new Set([...p, i])); setAccepted((p) => { const s = new Set(p); s.delete(i); return s; }); };
  const handleCopy = async (text: string, i: number) => { await navigator.clipboard.writeText(text); setCopied(i); setTimeout(() => setCopied(null), 2000); };

  return (
    <div className="space-y-6">
      <div className="rounded-xl p-4 flex items-center justify-between" style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>{rewrites.length} bullets rewritten across {sections_covered.length} sections.</p>
        <span className="text-sm font-mono" style={{ color: "var(--accent)" }}>{accepted.size}/{rewrites.length} accepted</span>
      </div>
      {Object.entries(bySection).map(([sectionName, sectionRewrites]) => (
        <div key={sectionName}>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--text-secondary)" }}>{sectionName}</h3>
          <div className="space-y-4">
            {sectionRewrites.map((rewrite, localIdx) => {
              const globalIdx = rewrites.indexOf(rewrite);
              const isAccepted = accepted.has(globalIdx);
              const isRejected = rejected.has(globalIdx);
              return (
                <div key={localIdx} className="rounded-xl overflow-hidden transition-all" style={{ border: `1px solid ${isAccepted ? "var(--success)" : isRejected ? "var(--border-subtle)" : "var(--border)"}`, background: isAccepted ? "rgba(74,222,128,0.03)" : "var(--bg-card)", opacity: isRejected ? 0.5 : 1 }}>
                  <div className="grid grid-cols-2">
                    <div className="p-4 border-r" style={{ borderColor: "var(--border)" }}>
                      <div className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>Original</div>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{rewrite.original}</p>
                    </div>
                    <div className="p-4">
                      <div className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: "var(--accent)" }}>Rewritten</div>
                      <p className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>{rewrite.rewritten}</p>
                    </div>
                  </div>
                  {rewrite.keywords_added.length > 0 && <div className="px-4 py-2 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}><span className="text-xs" style={{ color: "var(--text-muted)" }}>Keywords added:</span>{rewrite.keywords_added.map((kw) => <span key={kw} className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--accent-dim)", color: "var(--accent)" }}>{kw}</span>)}</div>}
                  <div className="px-4 py-2 border-t text-xs" style={{ borderColor: "var(--border)", color: "var(--text-muted)", background: "var(--bg-elevated)" }}>{rewrite.explanation}</div>
                  <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
                    <button onClick={() => handleAccept(globalIdx)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: isAccepted ? "var(--success)" : "var(--success-dim)", color: isAccepted ? "#000" : "var(--success)" }}>{isAccepted ? "✓ Accepted" : "Accept"}</button>
                    <button onClick={() => handleReject(globalIdx)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ background: isRejected ? "var(--danger)" : "var(--danger-dim)", color: isRejected ? "#fff" : "var(--danger)" }}>{isRejected ? "✗ Rejected" : "Reject"}</button>
                    <button onClick={() => handleCopy(rewrite.rewritten, globalIdx)} className="ml-auto text-xs px-3 py-1.5 rounded-lg" style={{ background: "var(--bg-elevated)", color: copied === globalIdx ? "var(--success)" : "var(--text-muted)", border: "1px solid var(--border)" }}>{copied === globalIdx ? "Copied!" : "Copy"}</button>
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
