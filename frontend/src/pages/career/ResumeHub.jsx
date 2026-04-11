import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ErrorState, LoadingSkeleton } from '../../components/PageStates';
import { analyzeResume, buildApplicationKit, getRoleIntelligence, scanJobDescription } from '../../utils/careerApi';
import { Briefcase, LineChart, ScanSearch, Sparkles } from 'lucide-react';

const GOALS = ['Software Engineer', 'AI/ML Engineer', 'Full Stack', 'Internship'];

export default function ResumeHub() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState(GOALS[0]);
  const [customGoal, setCustomGoal] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [loading, setLoading] = useState('');
  const [err, setErr] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [intel, setIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [jdScan, setJdScan] = useState(null);
  const [appKit, setAppKit] = useState(null);

  const effectiveGoal = goal === 'Custom' ? customGoal.trim() || 'Software Engineer' : goal;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIntelLoading(true);
      const timeout = setTimeout(() => {
        if (!cancelled) {
          setIntel((cur) => cur || { intel: { trends: ['Market intel still loading — check API keys or retry.'], twoWeekRoadmap: [] }, tavilyOk: false });
          setIntelLoading(false);
        }
      }, 12000);
      try {
        const data = await getRoleIntelligence(effectiveGoal);
        if (!cancelled) setIntel(data);
      } catch {
        if (!cancelled) setIntel({ intel: { trends: ['Enable TAVILY_API_KEY and GEMINI_API_KEY for live market scan.'], twoWeekRoadmap: [] }, tavilyOk: false });
      } finally {
        clearTimeout(timeout);
        if (!cancelled) setIntelLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveGoal]);

  const runAnalysis = async () => {
    setErr(null);
    setLoading('analyze');
    try {
      const res = await analyzeResume({ resumeText, goal: effectiveGoal });
      setAnalysis(res.analysis);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Analysis failed. Paste resume text and set GEMINI_API_KEY on backend.');
    } finally {
      setLoading('');
    }
  };

  const runJd = async () => {
    setErr(null);
    setLoading('jd');
    try {
      const res = await scanJobDescription({ jdText, resumeText });
      setJdScan(res.scan);
    } catch (e) {
      setErr(e?.response?.data?.error || 'JD scan failed.');
    } finally {
      setLoading('');
    }
  };

  const runApplicationKit = async () => {
    setErr(null);
    setLoading('kit');
    try {
      const res = await buildApplicationKit({ jdText, resumeText, targetRole: effectiveGoal });
      setAppKit(res.kit);
    } catch (e) {
      setErr(e?.response?.data?.error || 'Application kit generation failed.');
    } finally {
      setLoading('');
    }
  };

  const focusInterview = () => {
    const topics = analysis?.missing?.map((m) => m.detail).filter(Boolean)
      || jdScan?.missingSkills
      || [];
    const q = encodeURIComponent(topics.slice(0, 8).join(', ') || 'review fundamentals');
    navigate(`/career/interview?focus=${q}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Resume Hub</div>
        <h1 className="font-display font-extrabold text-3xl mt-1 text-[var(--career-text)]">Readiness & JD intelligence</h1>
        <p className="text-sm text-[var(--career-muted)] mt-2 max-w-3xl">
          Paste resume text (PDF extraction can be added with Gemini file API). Analysis uses Gemini JSON; JD comparison uses RAG + Gemini; market trends use Tavily when configured.
        </p>
      </div>

      {err && <ErrorState message={err} onRetry={() => setErr(null)} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="career-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--career-accent)]">
            <Briefcase size={18} />
            <span className="text-xs font-extrabold uppercase tracking-[0.28em]">Goal & resume</span>
          </div>
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[12px] px-3 py-2 text-sm text-[var(--career-text)] outline-none"
          >
            {GOALS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
            <option value="Custom">Custom…</option>
          </select>
          {goal === 'Custom' && (
            <input
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
              className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[12px] px-3 py-2 text-sm text-[var(--career-text)] outline-none"
              placeholder="Target role"
            />
          )}
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={12}
            className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[12px] px-3 py-2 text-sm text-[var(--career-text)] outline-none font-mono"
            placeholder="Paste full resume text…"
          />
          <button type="button" className="career-btn" disabled={loading === 'analyze'} onClick={runAnalysis}>
            <Sparkles size={16} /> {loading === 'analyze' ? 'Analyzing…' : 'Run readiness assessment'}
          </button>
        </div>

        <div className="career-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--career-accent2)]">
            <LineChart size={18} />
            <span className="text-xs font-extrabold uppercase tracking-[0.28em]">Role intelligence (Tavily)</span>
          </div>
          {intelLoading && !intel?.intel ? (
            <LoadingSkeleton lines={4} className="rounded-[12px]" />
          ) : null}
          {!intel?.intel && !intelLoading ? (
            <div className="text-sm text-[var(--career-muted)]">No data yet.</div>
          ) : null}
          {intel?.intel ? (
            <div className="space-y-3 text-sm text-[var(--career-text)]">
              <ul className="list-disc pl-5 space-y-1">
                {(intel.intel.trends || []).map((t, i) => <li key={i}>{t}</li>)}
              </ul>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Two-week sprint ideas</div>
              <ul className="space-y-2">
                {(intel.intel.twoWeekRoadmap || []).map((r, i) => (
                  <li key={i} className="border border-[var(--career-border)] rounded-[12px] p-3 bg-[var(--career-surface)]">
                    <div className="font-semibold text-[var(--career-accent)]">{r.skill}</div>
                    <div className="text-xs text-[var(--career-muted)]">{r.days}</div>
                    <ul className="mt-2 text-xs text-[var(--career-muted)] list-disc pl-4">
                      {(r.steps || []).map((s, j) => <li key={j}>{s}</li>)}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {analysis && (
        <div className="career-card p-6 space-y-4">
          <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Readiness</div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="font-display font-extrabold text-4xl text-[var(--career-accent)]">{analysis.readinessScore}</div>
            <div className="career-chip capitalize">{analysis.verdict?.replace('_', ' ')}</div>
          </div>
          <p className="text-sm text-[var(--career-muted)]">{analysis.summary}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-[12px] border border-[var(--career-border)] p-4 bg-[var(--career-surface)]">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--career-muted)] mb-2">Ready roles</div>
              <ul className="text-sm space-y-1 text-[var(--career-text)]">
                {(analysis.readyRoles || []).map((r, i) => (
                  <li key={i}>{r.title} — {r.matchPercent}%</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[12px] border border-[var(--career-border)] p-4 bg-[var(--career-surface)]">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--career-muted)] mb-2">Gaps</div>
              <ul className="text-sm space-y-1 text-[var(--career-text)]">
                {(analysis.missing || []).map((m, i) => (
                  <li key={i}><span className="font-mono text-[var(--career-accent2)]">{m.area}</span>: {m.detail}</li>
                ))}
              </ul>
            </div>
          </div>
          <button type="button" className="career-btn" onClick={focusInterview}>
            Send gaps to Interview Prep
          </button>
        </div>
      )}

      <div className="career-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-[var(--career-accent2)]">
          <ScanSearch size={18} />
          <span className="text-xs font-extrabold uppercase tracking-[0.28em]">JD scanner (RAG + Gemini)</span>
        </div>
        <textarea
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          rows={8}
          className="w-full bg-[var(--career-surface)] border border-[var(--career-border)] rounded-[12px] px-3 py-2 text-sm text-[var(--career-text)] outline-none"
          placeholder="Paste job description…"
        />
        <button type="button" className="career-btn" disabled={loading === 'jd'} onClick={runJd}>
          {loading === 'jd' ? 'Scanning…' : 'Compare to resume'}
        </button>
        <button type="button" className="career-btn" disabled={loading === 'kit'} onClick={runApplicationKit}>
          {loading === 'kit' ? 'Generating…' : 'Generate full application kit'}
        </button>

        {jdScan && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-[var(--career-text)]">
            <div className="rounded-[12px] border border-[rgba(139,92,246,0.3)] p-4 bg-[var(--career-surface)]">
              <div className="font-extrabold text-2xl text-[var(--career-accent)]">{jdScan.matchScore}%</div>
              <div className="mt-2 text-xs text-[var(--career-muted)]">Match score</div>
              <div className="mt-3">
                <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest">Matched</div>
                <ul className="list-disc pl-4 mt-1">{(jdScan.matchedSkills || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
              <div className="mt-3">
                <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest">Missing</div>
                <ul className="list-disc pl-4 mt-1">{(jdScan.missingSkills || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            </div>
            <div className="rounded-[12px] border border-[var(--career-border)] bg-[var(--career-surface)] p-4 space-y-3">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--career-muted)]">STAR rewrites</div>
              {(jdScan.starRewrites || []).map((rw, i) => (
                <div key={i} className="border border-[var(--career-border)] rounded-[12px] p-3 bg-[var(--career-surface)]">
                  <div className="text-xs text-red-600 line-through">Before: {rw.before}</div>
                  <div className="text-xs text-emerald-600 mt-2">After: {rw.after}</div>
                  {rw.rationale && <div className="text-xs text-[var(--career-muted)] mt-2">{rw.rationale}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {appKit && (
          <div className="rounded-[12px] border border-[rgba(139,92,246,0.3)] p-4 md:p-5 bg-[rgba(139,92,246,0.04)] space-y-4 text-sm text-[var(--career-text)]">
            <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--career-muted)]">Application kit</div>

            <div className="space-y-2">
              <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest">Tailored profile summary</div>
              <p>{appKit.profileSummary || 'N/A'}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">ATS keywords</div>
                <ul className="list-disc pl-4 space-y-1">
                  {(appKit.atsKeywords || []).map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
              <div>
                <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">Skills to highlight</div>
                <ul className="list-disc pl-4 space-y-1">
                  {(appKit.skillsToHighlight || []).map((k, i) => <li key={i}>{k}</li>)}
                </ul>
              </div>
            </div>

            <div>
              <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">Experience bullet rewrites</div>
              <ul className="list-disc pl-4 space-y-1">
                {(appKit.experienceBullets || []).map((b, i) => <li key={i}>{b}</li>)}
              </ul>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[var(--career-border)] rounded-[12px] p-3 bg-black/[0.02]">
                <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">Cover letter subject</div>
                <div className="font-semibold">{appKit.coverLetter?.subject || 'N/A'}</div>
                <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mt-3 mb-1">Cover letter body</div>
                <div className="whitespace-pre-wrap">{appKit.coverLetter?.body || 'N/A'}</div>
              </div>
              <div className="space-y-3">
                <div className="border border-[var(--career-border)] rounded-[12px] p-3 bg-black/[0.02]">
                  <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">Email outreach draft</div>
                  <div className="whitespace-pre-wrap">{appKit.outreachDrafts?.email || 'N/A'}</div>
                </div>
                <div className="border border-[var(--career-border)] rounded-[12px] p-3 bg-black/[0.02]">
                  <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">LinkedIn DM draft</div>
                  <div className="whitespace-pre-wrap">{appKit.outreachDrafts?.linkedin || 'N/A'}</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[var(--career-muted)] text-[11px] font-extrabold uppercase tracking-widest mb-1">Interview focus topics</div>
              <div className="flex flex-wrap gap-2">
                {(appKit.interviewFocus || []).map((topic, i) => (
                  <span key={i} className="career-chip">{topic}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
