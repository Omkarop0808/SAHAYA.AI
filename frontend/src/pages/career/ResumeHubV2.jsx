import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, LoadingSkeleton } from '../../components/PageStates';
import {
  analyzeResume,
  buildApplicationKit,
  completeRecruiterSim,
  getRoleIntelligence,
  getRoleIntelligencePersonalized,
  getSavedResumeProfile,
  scanJobDescription,
  startRecruiterSim,
  uploadResumePdf,
} from '../../utils/careerApi';
import { Briefcase, CalendarClock, CheckCircle2, LineChart, ScanSearch, Sparkles, UploadCloud, UserRoundSearch } from 'lucide-react';

const GOALS = ['Software Engineer', 'AI/ML Engineer', 'Full Stack', 'Internship'];

function TabButton({ active, onClick, icon: Icon, label }) {
  return (
    <button type="button" className={`career-btn ${active ? '' : 'opacity-75'}`} onClick={onClick}>
      <Icon size={15} /> {label}
    </button>
  );
}

export default function ResumeHubV2() {
  const [goal, setGoal] = useState(GOALS[0]);
  const [customGoal, setCustomGoal] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeProfile, setResumeProfile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [jdText, setJdText] = useState('');
  const [tab, setTab] = useState('resume');
  const [loading, setLoading] = useState('');
  const [err, setErr] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [intel, setIntel] = useState(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [jdScan, setJdScan] = useState(null);
  const [appKit, setAppKit] = useState(null);
  const [sim, setSim] = useState({ sessionId: '', questions: [], answers: ['', '', '', '', ''], feedback: null });

  const effectiveGoal = goal === 'Custom' ? customGoal.trim() || 'Software Engineer' : goal;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getSavedResumeProfile();
        if (cancelled) return;
        if (data?.profile) {
          setResumeProfile(data.profile);
          setResumeText((prev) => prev || data.profile.extractedText || '');
        }
      } catch {
        // non-blocking
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIntelLoading(true);
      try {
        const data = await getRoleIntelligence(effectiveGoal);
        if (!cancelled) setIntel(data);
      } catch {
        if (!cancelled) setIntel({ intel: { trends: ['Could not load role intelligence. Try again.'], twoWeekRoadmap: [] }, tavilyOk: false });
      } finally {
        if (!cancelled) setIntelLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effectiveGoal]);

  const runAnalysis = async () => {
    setErr(null);
    setLoading('analyze');
    try {
      const res = await analyzeResume({ resumeText, goal: effectiveGoal });
      setAnalysis(res.analysis);
      if (res?.profile) setResumeProfile(res.profile);
      try {
        const intelRes = await getRoleIntelligencePersonalized({
          goal: effectiveGoal,
          missingSkills: (res?.analysis?.missing || []).map((m) => m.detail),
          resumeSkills: (res?.analysis?.alreadyReadyFor || []).map((r) => r.title),
          jdSkills: jdScan?.missingSkills || [],
        });
        setIntel(intelRes);
      } catch {
        // non-blocking
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'Readiness analysis failed.');
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
      try {
        const intelRes = await getRoleIntelligencePersonalized({
          goal: effectiveGoal,
          missingSkills: res?.scan?.missingSkills || res?.scan?.red || [],
          resumeSkills: res?.scan?.matchedSkills || res?.scan?.green || [],
          jdSkills: [
            ...(res?.scan?.matchedSkills || []),
            ...(res?.scan?.missingSkills || []),
          ],
        });
        setIntel(intelRes);
      } catch {
        // non-blocking
      }
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

  const onUploadFile = async (file) => {
    if (!file) return;
    if (!String(file.type || '').includes('pdf')) {
      setErr('Please upload a PDF file.');
      return;
    }
    setErr(null);
    setLoading('pdf');
    try {
      const data = await uploadResumePdf(file);
      const profile = data?.resume;
      if (profile) {
        setResumeProfile(profile);
        setResumeText(profile.extractedText || '');
      }
    } catch (e) {
      setErr(e?.response?.data?.error || 'PDF extraction failed. You can still paste resume text manually.');
    } finally {
      setLoading('');
      setDragActive(false);
    }
  };

  const onStartSim = async () => {
    setErr(null);
    setLoading('sim-start');
    try {
      const data = await startRecruiterSim({ resumeText, goal: effectiveGoal });
      setSim({ sessionId: data.sessionId, questions: data.questions || [], answers: ['', '', '', '', ''], feedback: null });
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not start recruiter simulation.');
    } finally {
      setLoading('');
    }
  };

  const onFinishSim = async () => {
    setErr(null);
    setLoading('sim-end');
    try {
      const data = await completeRecruiterSim({ sessionId: sim.sessionId, answers: sim.answers });
      setSim((prev) => ({ ...prev, feedback: data.feedback }));
    } catch (e) {
      setErr(e?.response?.data?.error || 'Could not complete recruiter simulation.');
    } finally {
      setLoading('');
    }
  };

  const [actionDone, setActionDone] = useState({});

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/55">Resume Hub</div>
        <h1 className="font-display font-extrabold text-3xl mt-1">Readiness & JD intelligence</h1>
        <p className="text-sm text-white/65 mt-2 max-w-3xl">
          Upload a PDF or paste text, run personalized readiness analysis, compare real JDs, and simulate recruiter screening calls.
        </p>
      </div>

      {err && <ErrorState message={err} onRetry={() => setErr(null)} />}

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === 'resume'} onClick={() => setTab('resume')} icon={Briefcase} label="Resume + Readiness" />
        <TabButton active={tab === 'intel'} onClick={() => setTab('intel')} icon={LineChart} label="Role Intelligence" />
        <TabButton active={tab === 'jd'} onClick={() => setTab('jd')} icon={ScanSearch} label="JD Scanner" />
        <TabButton active={tab === 'sim'} onClick={() => setTab('sim')} icon={UserRoundSearch} label="Recruiter Sim" />
      </div>

      {tab === 'resume' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="career-card p-6 space-y-4">
            <div className="flex items-center gap-2 text-[var(--career-accent)]">
              <Briefcase size={18} />
              <span className="text-xs font-extrabold uppercase tracking-[0.28em]">Goal & resume</span>
            </div>
            <select value={goal} onChange={(e) => setGoal(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-[12px] px-3 py-2 text-sm text-white outline-none">
              {GOALS.map((g) => <option key={g} value={g}>{g}</option>)}
              <option value="Custom">Custom…</option>
            </select>
            {goal === 'Custom' && (
              <input value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-[12px] px-3 py-2 text-sm text-white outline-none" placeholder="Target role" />
            )}
            <div
              className={`rounded-[12px] border-2 border-dashed p-5 text-center transition-colors ${dragActive ? 'border-cyan-300 bg-cyan-300/10' : 'border-white/20 bg-white/[0.03]'}`}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); onUploadFile(e.dataTransfer.files?.[0]); }}
            >
              <UploadCloud size={20} className="mx-auto text-[var(--career-accent2)]" />
              <div className="text-sm text-white/75 mt-2">Drag & drop resume PDF here</div>
              <div className="text-xs text-white/55 mt-1">or</div>
              <label className="career-btn mt-2 cursor-pointer inline-flex">
                Choose PDF
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => onUploadFile(e.target.files?.[0])} />
              </label>
              {loading === 'pdf' ? <div className="text-xs text-white/60 mt-2">Extracting with local parser…</div> : null}
            </div>
            {resumeProfile ? (
              <div className="rounded-[12px] border border-white/10 p-4 bg-white/[0.03] text-sm text-white/80">
                <div className="font-semibold">{resumeProfile.fileName || 'resume.pdf'}</div>
                <div className="text-xs text-white/55 mt-1">Pages: {resumeProfile.pageCount || 'unknown'} · Saved for reuse</div>
                <div className="text-xs text-white/60 mt-2 whitespace-pre-wrap line-clamp-6">{resumeProfile.extractedPreview || ''}</div>
              </div>
            ) : <EmptyState title="No uploaded resume yet" hint="Upload PDF or paste text below." icon="📄" />}
            <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} rows={12} className="w-full bg-black/30 border border-white/10 rounded-[12px] px-3 py-2 text-sm text-white outline-none font-mono" placeholder="Paste full resume text… (auto-filled from uploaded PDF)" />
            <button type="button" className="career-btn" disabled={loading === 'analyze'} onClick={runAnalysis}>
              <Sparkles size={16} /> {loading === 'analyze' ? 'Analyzing…' : 'Run readiness assessment'}
            </button>
          </div>

          <div className="career-card p-6 space-y-4">
            {analysis ? (
              <>
                <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-white/55">Readiness verdict</div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="font-display font-extrabold text-4xl text-[var(--career-accent)]">{analysis.readinessScore}</div>
                  <div className="career-chip capitalize">{analysis.verdict?.replace('_', ' ')}</div>
                </div>
                <p className="text-sm text-white/75">{analysis.summary}</p>
                <div className="grid grid-cols-1 gap-4">
                  <div className="rounded-[12px] border border-white/10 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45 mb-2">Ready now</div>
                    <ul className="text-sm space-y-1">{(analysis.readyNow || analysis.readyRoles || []).map((r, i) => <li key={i}>{r.title} — {r.matchPercent}%</li>)}</ul>
                  </div>
                  <div className="rounded-[12px] border border-white/10 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45 mb-2">Reachable in 4 weeks</div>
                    <ul className="text-sm space-y-1">{(analysis.reachableIn4Weeks || []).map((r, i) => <li key={i}>{r.title} — {r.matchPercent}%</li>)}</ul>
                  </div>
                  <div className="rounded-[12px] border border-white/10 p-4">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45 mb-2">Top 3 skills to learn first</div>
                    <ul className="text-sm space-y-1">
                      {(analysis.prioritySkills || []).slice(0, 3).map((m, i) => (
                        <li key={i}>{m.skill} · ~{m.hours} hrs · <a href={m.resource} target="_blank" rel="noreferrer" className="underline text-cyan-300">resource</a></li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="rounded-[12px] border border-white/10 p-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45 mb-2">Weekly execution checklist</div>
                  <div className="space-y-2">
                    {(analysis.prioritySkills || []).slice(0, 4).map((m, i) => {
                      const k = `resume-${i}-${m.skill}`;
                      return (
                        <label key={k} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" checked={Boolean(actionDone[k])} onChange={(e) => setActionDone((s) => ({ ...s, [k]: e.target.checked }))} />
                          <span>{m.skill} ({m.hours}h)</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <>
                {loading === 'analyze' ? <LoadingSkeleton lines={6} className="rounded-[12px]" /> : null}
                {!loading && <EmptyState title="No readiness report yet" hint="Run readiness assessment to see role fit and learning priorities." icon="🎯" />}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'intel' && (
        <div className="career-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--career-accent2)]">
            <LineChart size={18} />
            <span className="text-xs font-extrabold uppercase tracking-[0.28em]">What recruiters want right now</span>
          </div>
          <div className="text-xs text-white/55 flex items-center gap-2">
            <CalendarClock size={14} />
            {intel?.fetchedAt ? `Last updated: ${new Date(intel.fetchedAt).toLocaleString()}${intel.cached ? ' (cached)' : ' (live)'}` : 'Not fetched yet'}
          </div>
          {intelLoading ? <LoadingSkeleton lines={5} className="rounded-[12px]" /> : null}
          {!intelLoading && !intel?.intel ? <EmptyState title="No role intelligence yet" hint="Choose a goal and wait for market scan." icon="📈" /> : null}
          {intel?.intel && (
            <div className="space-y-3 text-sm text-white/80">
              {intel.personalized ? (
                <div className="rounded-[10px] border border-cyan-300/30 bg-cyan-500/10 p-3 text-xs text-cyan-100">
                  Personalized using your latest resume/JD scan.
                </div>
              ) : null}
              <ul className="list-disc pl-5 space-y-1">{(intel.intel.trends || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">What you should do now</div>
              <ul className="space-y-2">
                {(intel.intel.whatToDoNow || []).map((x, i) => (
                  <li key={i} className="border border-white/10 rounded-[12px] p-3 bg-white/[0.03]">
                    <div className="font-semibold">{x.action}</div>
                    <div className="text-xs text-white/65 mt-1">{x.why}</div>
                    <div className="text-[11px] mt-1 text-[var(--career-accent2)]">Impact: {x.impact}</div>
                  </li>
                ))}
              </ul>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-white/45">Trending skills with 2-week plan</div>
              <ul className="space-y-2">
                {(intel.intel.recruiterWantsNow || intel.intel.twoWeekRoadmap || []).map((r, i) => (
                  <li key={i} className="border border-white/10 rounded-[12px] p-3 bg-white/[0.03]">
                    <div className="font-semibold text-[var(--career-accent)]">{r.skill}</div>
                    <div className="text-xs text-white/70 mt-1">{r.reason || r.days}</div>
                    {r.twoWeekPlan ? <div className="text-xs text-white/60 mt-1">{r.twoWeekPlan}</div> : null}
                    <div className="mt-2 text-xs text-white/55">Tip: add one project bullet using this skill this week.</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'jd' && (
        <div className="career-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--career-accent2)]">
            <ScanSearch size={18} />
            <span className="text-xs font-extrabold uppercase tracking-[0.28em]">JD scanner (personalized)</span>
          </div>
          <textarea value={jdText} onChange={(e) => setJdText(e.target.value)} rows={8} className="w-full bg-black/30 border border-white/10 rounded-[12px] px-3 py-2 text-sm text-white outline-none" placeholder="Paste job description…" />
          <div className="flex gap-2 flex-wrap">
            <button type="button" className="career-btn" disabled={loading === 'jd'} onClick={runJd}>{loading === 'jd' ? 'Scanning…' : 'Compare to resume'}</button>
            <button type="button" className="career-btn" disabled={loading === 'kit'} onClick={runApplicationKit}>{loading === 'kit' ? 'Generating…' : 'Generate full application kit'}</button>
            <button
              type="button"
              className="career-btn"
              onClick={() => setTab('sim')}
            >
              <CheckCircle2 size={16} /> Practice these gaps in Recruiter Sim
            </button>
          </div>

          {loading === 'jd' ? <LoadingSkeleton lines={6} className="rounded-[12px]" /> : null}
          {!loading && !jdScan ? <EmptyState title="No JD scan yet" hint="Paste JD and compare against your resume." icon="🧾" /> : null}
          {jdScan && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/80">
              <div className="rounded-[12px] border border-[rgba(139,92,246,0.3)] p-4">
                <div className="font-extrabold text-2xl text-[var(--career-accent)]">{jdScan.matchScore}%</div>
                <div className="mt-2 text-xs text-white/55">Match score</div>
                <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-400" style={{ width: `${Math.max(0, Math.min(100, jdScan.matchScore || 0))}%` }} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-2">
                  <div className="rounded border border-emerald-300/40 bg-emerald-500/10 p-3"><div className="font-semibold text-emerald-200">Green (match)</div><ul className="list-disc pl-4 mt-1">{(jdScan.green || jdScan.matchedSkills || []).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="rounded border border-yellow-300/40 bg-yellow-500/10 p-3"><div className="font-semibold text-yellow-200">Yellow (partial)</div><ul className="list-disc pl-4 mt-1">{(jdScan.yellow || jdScan.partialSkills || []).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                  <div className="rounded border border-red-300/40 bg-red-500/10 p-3"><div className="font-semibold text-red-200">Red (missing)</div><ul className="list-disc pl-4 mt-1">{(jdScan.red || jdScan.missingSkills || []).map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                </div>
              </div>
              <div className="rounded-[12px] border border-white/10 p-4 space-y-3">
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45">STAR rewrites</div>
                {(jdScan.starRewrites || []).map((rw, i) => (
                  <div key={i} className="border border-white/10 rounded-[12px] p-3 bg-white/[0.03]">
                    <div className="text-xs text-red-200/90 line-through">Before: {rw.before}</div>
                    <div className="text-xs text-emerald-200 mt-2">After: {rw.after}</div>
                    {rw.rationale && <div className="text-xs text-white/55 mt-2">{rw.rationale}</div>}
                  </div>
                ))}
                <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45">Free resources</div>
                <ul className="text-xs space-y-2">
                  {(jdScan.resources || []).map((r, i) => <li key={i}><span className="font-semibold">{r.skill}:</span> <a href={r.url} target="_blank" rel="noreferrer" className="underline text-cyan-300">{r.title || r.url}</a></li>)}
                </ul>
              </div>
            </div>
          )}
          {appKit && (
            <div className="rounded-[12px] border border-[rgba(139,92,246,0.3)] p-4 bg-[rgba(139,92,246,0.04)] space-y-3 text-sm text-white/85">
              <div className="text-[11px] font-extrabold uppercase tracking-widest text-white/45">Application kit</div>
              <p>{appKit.profileSummary || 'N/A'}</p>
              <div className="flex flex-wrap gap-2">{(appKit.interviewFocus || []).map((topic, i) => <span key={i} className="career-chip">{topic}</span>)}</div>
            </div>
          )}
        </div>
      )}

      {tab === 'sim' && (
        <div className="career-card p-6 space-y-4">
          <div className="flex items-center gap-2 text-[var(--career-accent2)]">
            <UserRoundSearch size={18} />
            <span className="text-xs font-extrabold uppercase tracking-[0.28em]">Recruiter Sim</span>
          </div>
          {!sim.sessionId ? (
            <>
              <button type="button" className="career-btn" disabled={loading === 'sim-start' || !resumeText.trim()} onClick={onStartSim}>
                {loading === 'sim-start' ? 'Starting…' : 'Start recruiter simulation'}
              </button>
              {!resumeText.trim() ? <EmptyState title="Resume required" hint="Upload PDF or paste resume text in Resume tab first." icon="🧠" /> : null}
            </>
          ) : (
            <>
              <div className="space-y-3">
                {sim.questions.map((q, i) => (
                  <div key={i} className="rounded-[12px] border border-white/10 p-4 bg-white/[0.03]">
                    <div className="font-semibold">Q{i + 1}. {q}</div>
                    <textarea value={sim.answers[i] || ''} onChange={(e) => { const next = [...sim.answers]; next[i] = e.target.value; setSim((prev) => ({ ...prev, answers: next })); }} rows={3} className="w-full mt-2 bg-black/30 border border-white/10 rounded-[12px] px-3 py-2 text-sm text-white outline-none" placeholder="Your answer…" />
                  </div>
                ))}
              </div>
              {!sim.feedback ? (
                <button type="button" className="career-btn" disabled={loading === 'sim-end' || sim.answers.some((a) => !String(a || '').trim())} onClick={onFinishSim}>
                  {loading === 'sim-end' ? 'Evaluating…' : 'Complete sim (+75 XP)'}
                </button>
              ) : (
                <div className="rounded-[12px] border border-cyan-300/30 p-4 bg-cyan-500/10 text-sm text-white/85 space-y-3">
                  <div className="font-semibold">Recruiter feedback</div>
                  <div><div className="text-xs uppercase tracking-widest text-white/50 mb-1">What impressed</div><ul className="list-disc pl-4">{(sim.feedback.whatImpressed || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  <div><div className="text-xs uppercase tracking-widest text-white/50 mb-1">What raised doubts</div><ul className="list-disc pl-4">{(sim.feedback.whatRaisedDoubts || []).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
                  <div><div className="text-xs uppercase tracking-widest text-white/50 mb-1">Resume fixes</div><ul className="list-disc pl-4">{(sim.feedback.resumeFixes || []).map((x, i) => <li key={i}>{x.issue} {'->'} {x.fix}</li>)}</ul></div>
                  <div>
                    <div className="text-xs uppercase tracking-widest text-white/50 mb-1">How to improve your answers</div>
                    <div className="space-y-2">
                      {(sim.feedback.answerImprovements || []).map((x, i) => (
                        <div key={i} className="rounded-[10px] border border-white/15 p-3 bg-white/[0.04]">
                          <div className="text-xs text-white/60">Q: {x.question}</div>
                          <div className="text-xs text-red-200 mt-1">Your answer: {x.yourAnswer}</div>
                          <div className="text-xs text-emerald-200 mt-1">Improved: {x.improvedAnswer}</div>
                          <div className="text-xs text-white/60 mt-1">{x.why}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-white/90 font-semibold">{sim.feedback.overallVerdict}</div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

