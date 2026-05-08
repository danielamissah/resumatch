const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ResumeSection { title: string; content: string; bullets: string[]; }
export interface ParsedResume { raw_text: string; sections: ResumeSection[]; skills: string[]; format: "pdf"|"docx"|"text"; word_count: number; }
export interface JobDescription { raw_text: string; title: string; company: string; required_skills: string[]; preferred_skills: string[]; responsibilities: string[]; source_url: string|null; }
export interface SectionScore { section: string; score: number; explanation: string; top_matches: string[]; top_gaps: string[]; }
export interface MatchScore { overall: number; sections: SectionScore[]; verdict: "Strong Match"|"Partial Match"|"Weak Match"; summary: string; }
export interface SkillGap { skill: string; priority: "critical"|"important"|"nice-to-have"; frequency: number; context: string; suggestion: string; }
export interface GapAnalysis { missing_skills: SkillGap[]; present_skills: string[]; transferable_skills: string[]; critical_gaps_count: number; }
export interface BulletRewrite { original: string; rewritten: string; keywords_added: string[]; explanation: string; section: string; }
export interface BulletRewrites { rewrites: BulletRewrite[]; total_bullets: number; sections_covered: string[]; }
export interface AnalysisResult { analysis_id: string; status: string; resume: ParsedResume; job: JobDescription; match_score: MatchScore; gap_analysis: GapAnalysis; bullet_rewrites: BulletRewrites; created_at: string; processing_time_ms: number; }
export interface ScrapeResult { success: boolean; job_description?: JobDescription; error?: string; raw_text?: string; }

export class ResuMatchApiError extends Error {
  constructor(public statusCode: number, public detail: string) { super(detail); this.name = "ResuMatchApiError"; }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try { const err = await response.json(); detail = err.detail || detail; } catch {}
    throw new ResuMatchApiError(response.status, detail);
  }
  return response.json() as Promise<T>;
}

export async function analyzeText({ resumeText, jobDescriptionText, jobUrl }: { resumeText: string; jobDescriptionText?: string; jobUrl?: string }): Promise<AnalysisResult> {
  return handleResponse(await fetch(`${API_BASE}/analyze/text`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resume_text: resumeText, job_description_text: jobDescriptionText ?? null, job_url: jobUrl ?? null }) }));
}

export async function analyzeFile({ file, jobDescriptionText, jobUrl }: { file: File; jobDescriptionText?: string; jobUrl?: string }): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append("resume_file", file);
  if (jobDescriptionText) formData.append("job_description_text", jobDescriptionText);
  if (jobUrl) formData.append("job_url", jobUrl);
  return handleResponse(await fetch(`${API_BASE}/analyze/file`, { method: "POST", body: formData }));
}

export async function scrapeJobUrl(url: string): Promise<ScrapeResult> {
  return handleResponse(await fetch(`${API_BASE}/scrape`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) }));
}

export async function getAnalysis(analysisId: string): Promise<AnalysisResult> {
  return handleResponse(await fetch(`${API_BASE}/analyze/${analysisId}`));
}
