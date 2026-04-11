import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  skillscanAtsScore,
  skillscanAnalyzeSkills,
  skillscanChat,
  skillscanJobMatch,
  skillscanLinkedInAnalyze,
  skillscanListApplications,
  skillscanAddApplication,
  skillscanDeleteApplication,
  skillscanPatchApplication,
  skillscanRejectionAnalysis,
  skillscanRecommendCerts,
  skillscanListTrackedCerts,
  skillscanAddTrackedCert,
  skillscanPatchTrackedCert,
  skillscanSalaryIntel,
  skillscanNegotiationScript,
} from '../../utils/careerApi';
import { useAuth } from '../../context/AuthContext';

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.18 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.12 } },
};

function SkeletonCard({ lines = 3 }) {
  return (
    <div className="career-card">
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-40 rounded bg-[var(--career-surface)] border border-[var(--career-border)]" />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-3 w-full rounded bg-[var(--career-surface)] border border-[var(--career-border)]" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="career-card border-red-500/40 text-red-200">
      <div className="font-semibold">Something went wrong</div>
      <div className="text-sm text-[var(--career-muted)] mt-1">{message}</div>
      {onRetry ? (
        <button className="career-btn mt-3" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ title, desc, actionLabel, onAction }) {
  return (
    <div className="career-card">
      <div className="font-semibold">{title}</div>
      <div className="text-sm text-[var(--career-muted)] mt-1">{desc}</div>
      {onAction ? (
        <button className="career-btn mt-3" onClick={onAction}>
          {actionLabel || 'Get started'}
        </button>
      ) : null}
    </div>
  );
}

function TabHeader({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`career-btn ${isActive ? '' : 'opacity-80 hover:opacity-100'}`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function AtsTab() {
  const [resumeText, setResumeText] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await skillscanAtsScore({ resumeText, jobTitle: jobTitle || undefined });
      setResult(data.ats);
    } catch (e) {
      setError(e?.message || 'ATS scan failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">ATS Resume Scanner</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Paste your resume and get an ATS score + concrete fixes.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input
            className="career-input"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            placeholder="Target role (optional) e.g. Frontend Developer"
          />
          <textarea
            className="career-input min-h-[180px]"
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            placeholder="Paste resume text here…"
          />
          <button className="career-btn" disabled={loading || !resumeText.trim()} onClick={run}>
            {loading ? 'Scanning…' : 'Scan ATS'}
          </button>
        </div>
      </div>

      {loading ? <SkeletonCard lines={6} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}
      {result ? (
        <div className="career-card">
          <div className="flex items-end justify-between gap-3 flex-wrap">
            <div>
              <div className="career-kicker">ATS Score</div>
              <div className="font-display font-extrabold text-3xl mt-1">{result.ats_score}%</div>
              <div className="text-sm text-[var(--career-muted)] mt-1">{result.summary}</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Missing keywords</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(result.missing_keywords || []).slice(0, 18).map((k) => (
                  <span key={k} className="px-2 py-1 text-xs rounded bg-[var(--career-surface)] border border-[var(--career-border)] border border-[var(--career-border)]">
                    {k}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Top issues</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-2">
                {(result.issues || []).slice(0, 8).map((it, idx) => (
                  <li key={idx}>
                    <span className="font-semibold text-white/85">{it.category}</span>: {it.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SkillGapTab() {
  const [jobTitle, setJobTitle] = useState('');
  const [skills, setSkills] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('Entry');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  const run = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const arr = skills
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 40)
        .map((name) => ({ name, proficiency: 'intermediate', category: 'general' }));
      const data = await skillscanAnalyzeSkills({ jobTitle, experienceLevel, skills: arr });
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e?.message || 'Skill analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">AI Career Gap Analyzer</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Compare your skills vs the market for your target role.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input className="career-input" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Target role e.g. Data Analyst" />
          <input className="career-input" value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} placeholder="Experience level e.g. Fresher / Entry / Junior" />
          <textarea className="career-input min-h-[120px]" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Your skills (comma separated) e.g. React, SQL, Python" />
          <button className="career-btn" disabled={loading || !jobTitle.trim() || skills.trim().length < 2} onClick={run}>
            {loading ? 'Analyzing…' : 'Analyze gap'}
          </button>
        </div>
      </div>

      {loading ? <SkeletonCard lines={7} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}
      {analysis ? (
        <div className="career-card">
          <div className="career-kicker">Readiness</div>
          <div className="font-display font-extrabold text-3xl mt-1">{analysis.readiness_score}/100</div>
          <div className="text-sm text-[var(--career-muted)] mt-2">{analysis.overall_feedback}</div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Quick wins</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-2">
                {(analysis.top_3_quick_wins || []).map((w) => (
                  <li key={w.skill}>
                    <span className="font-semibold text-white/85">{w.skill}</span> — {w.days_to_learn} days, +{w.score_boost} score
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Critical missing skills</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-2">
                {(analysis.missing_skills || []).slice(0, 8).map((s) => (
                  <li key={s.name}>
                    <span className="font-semibold text-white/85">{s.name}</span> — {s.priority} ({s.learning_time_days} days)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function JobMatchTab() {
  const [jdText, setJdText] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [match, setMatch] = useState(null);

  const run = async () => {
    setLoading(true);
    setError('');
    setMatch(null);
    try {
      const data = await skillscanJobMatch({ jdText, resumeText, targetRole });
      setMatch(data.match);
    } catch (e) {
      setError(e?.message || 'Job match failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">Job Match Score</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Paste a JD → get match % + missing skills list.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input className="career-input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Target role (optional)" />
          <textarea className="career-input min-h-[140px]" value={jdText} onChange={(e) => setJdText(e.target.value)} placeholder="Paste Job Description…" />
          <textarea className="career-input min-h-[120px]" value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste Resume text (optional but recommended)…" />
          <button className="career-btn" disabled={loading || !jdText.trim()} onClick={run}>
            {loading ? 'Scoring…' : 'Compute match'}
          </button>
        </div>
      </div>
      {loading ? <SkeletonCard lines={5} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}
      {match ? (
        <div className="career-card">
          <div className="career-kicker">Match</div>
          <div className="font-display font-extrabold text-3xl mt-1">{match.match_score}%</div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Missing skills</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(match.missing_skills || []).slice(0, 18).map((k) => (
                  <span key={k} className="px-2 py-1 text-xs rounded bg-[var(--career-surface)] border border-[var(--career-border)] border border-[var(--career-border)]">{k}</span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Projected after roadmap</div>
              <div className="mt-1 text-2xl font-bold text-[var(--career-text)] text-opacity-90">{match.projected_match_after_roadmap}%</div>
              <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-1">
                {(match.notes || []).slice(0, 6).map((n, idx) => <li key={idx}>- {n}</li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LinkedInTab() {
  const [profileText, setProfileText] = useState('');
  const [targetRole, setTargetRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);

  const run = async () => {
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const data = await skillscanLinkedInAnalyze({ profileText, targetRole });
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e?.message || 'LinkedIn analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">LinkedIn Analyzer</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Score each section and get exact rewrites.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input className="career-input" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="Target role (optional)" />
          <textarea className="career-input min-h-[160px]" value={profileText} onChange={(e) => setProfileText(e.target.value)} placeholder="Paste your LinkedIn text (headline/about/experience/skills)…" />
          <button className="career-btn" disabled={loading || profileText.trim().length < 20} onClick={run}>
            {loading ? 'Analyzing…' : 'Analyze LinkedIn'}
          </button>
        </div>
      </div>

      {loading ? <SkeletonCard lines={7} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}
      {analysis ? (
        <div className="career-card">
          <div className="career-kicker">Score</div>
          <div className="font-display font-extrabold text-3xl mt-1">{analysis.overall_score}/100</div>
          <div className="text-sm text-[var(--career-muted)] mt-2">Recruiter click probability: {analysis.recruiter_click_probability}%</div>
          <div className="mt-4 rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
            <div className="font-semibold">Top priority actions</div>
            <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-2">
              {(analysis.priority_actions || []).slice(0, 6).map((a, idx) => (
                <li key={idx}>
                  <span className="font-semibold text-white/85">{a.priority.toUpperCase()}</span> — {a.action} ({a.time_minutes} min)
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SalaryTab() {
  const [role, setRole] = useState('Software Engineer');
  const [experience, setExperience] = useState('Fresher');
  const [skills, setSkills] = useState('');
  const [missingSkills, setMissingSkills] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [intel, setIntel] = useState(null);

  const [currentOffer, setCurrentOffer] = useState('');
  const [targetSalary, setTargetSalary] = useState('');
  const [strongestSkill, setStrongestSkill] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [script, setScript] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setIntel(null);
    try {
      const data = await skillscanSalaryIntel({
        role,
        experience,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        missingSkills: missingSkills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setIntel(data.intel);
    } catch (e) {
      setError(e?.message || 'Salary intelligence failed.');
    } finally {
      setLoading(false);
    }
  };

  const genScript = async () => {
    setScriptLoading(true);
    setScript('');
    try {
      const data = await skillscanNegotiationScript({ role, city: 'Bangalore', currentOffer, targetSalary, strongestSkill, yearsExperience });
      setScript(data.script);
    } catch (e) {
      setError(e?.message || 'Script generation failed.');
    } finally {
      setScriptLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">Salary Intelligence</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Estimate your current vs projected package, plus negotiation help.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input className="career-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
          <input className="career-input" value={experience} onChange={(e) => setExperience(e.target.value)} placeholder="Experience e.g. Fresher" />
          <input className="career-input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Your skills (comma separated)" />
          <input className="career-input" value={missingSkills} onChange={(e) => setMissingSkills(e.target.value)} placeholder="Missing skills (comma separated)" />
          <button className="career-btn" disabled={loading || !role.trim()} onClick={run}>
            {loading ? 'Analyzing…' : 'Analyze salary'}
          </button>
        </div>
      </div>

      {loading ? <SkeletonCard lines={6} /> : null}
      {error ? <ErrorState message={error} onRetry={run} /> : null}
      {intel ? (
        <div className="career-card">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">Current</div>
              <div className="text-2xl font-bold mt-1">₹{intel.current_range?.min} – ₹{intel.current_range?.max} LPA</div>
            </div>
            <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
              <div className="font-semibold">After roadmap</div>
              <div className="text-2xl font-bold mt-1">₹{intel.projected_range?.min} – ₹{intel.projected_range?.max} LPA</div>
              <div className="text-sm text-[var(--career-muted)] mt-1">ROI: {intel.roi_percentage}%</div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">
            <div className="font-semibold">Negotiation talking points</div>
            <ul className="mt-2 text-sm text-[var(--career-muted)] space-y-1">
              {(intel.negotiation_talking_points || []).slice(0, 6).map((t, idx) => <li key={idx}>- {t}</li>)}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="career-card">
        <div className="font-semibold">Negotiation script</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Generate a 3–4 paragraph script you can paste into email/HR call.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input className="career-input" value={currentOffer} onChange={(e) => setCurrentOffer(e.target.value)} placeholder="Current offer (LPA) e.g. 6.5" />
          <input className="career-input" value={targetSalary} onChange={(e) => setTargetSalary(e.target.value)} placeholder="Target salary (LPA) e.g. 9" />
          <input className="career-input" value={strongestSkill} onChange={(e) => setStrongestSkill(e.target.value)} placeholder="Strongest skill (optional)" />
          <input className="career-input" value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="Years of project experience (optional)" />
          <button className="career-btn" disabled={scriptLoading || !currentOffer || !targetSalary} onClick={genScript}>
            {scriptLoading ? 'Generating…' : 'Generate script'}
          </button>
          {script ? <pre className="whitespace-pre-wrap text-sm text-[var(--career-text)] text-opacity-80 rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4">{script}</pre> : null}
        </div>
      </div>
    </div>
  );
}

function ApplicationsTab() {
  const { user } = useAuth();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ company: '', role: '', status: 'applied', match_score: 0 });
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await skillscanListApplications();
      setApps(data.applications || []);
    } catch (e) {
      setError(e?.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  const add = async () => {
    try {
      await skillscanAddApplication(form);
      setForm({ company: '', role: '', status: 'applied', match_score: 0 });
      await load();
    } catch (e) {
      setError(e?.message || 'Failed to add application.');
    }
  };

  const del = async (id) => {
    try {
      await skillscanDeleteApplication(id);
      await load();
    } catch (e) {
      setError(e?.message || 'Delete failed.');
    }
  };

  const runAnalysis = async () => {
    setAnalysisLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const data = await skillscanRejectionAnalysis();
      setAnalysis(data.analysis);
    } catch (e) {
      setError(e?.message || 'Analysis failed.');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const rejectedCount = apps.filter((a) => a.status === 'rejected').length;

  return (
    <div className="space-y-4">
      {!user ? <ErrorState message="You must be signed in." /> : null}

      <div className="career-card">
        <div className="font-semibold">Smart Application Tracker</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Track applications and let AI detect rejection patterns.</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="career-btn" onClick={load} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          <button className="career-btn" onClick={runAnalysis} disabled={analysisLoading || rejectedCount < 2}>
            {analysisLoading ? 'Analyzing…' : 'Analyze rejections'}
          </button>
        </div>
      </div>

      <div className="career-card">
        <div className="font-semibold">Add application</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
          <input className="career-input" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Company" />
          <input className="career-input" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Role" />
          <select className="career-input" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="offer">Offer</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className="career-btn" onClick={add} disabled={!form.company || !form.role}>
            Add
          </button>
        </div>
      </div>

      {loading ? <SkeletonCard lines={4} /> : null}
      {error ? <ErrorState message={error} onRetry={load} /> : null}

      {apps?.length ? (
        <div className="career-card">
          <div className="font-semibold">Applications ({apps.length})</div>
          <div className="mt-3 space-y-2">
            {apps.slice(0, 12).map((a) => (
              <div key={a.id} className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{a.company} — {a.role}</div>
                  <div className="text-xs text-[var(--career-muted)] mt-1">{a.status} · {a.date_applied} · {a.match_score}% match</div>
                </div>
                <button className="career-btn" onClick={() => del(a.id)}>Delete</button>
              </div>
            ))}
          </div>
          {apps.length > 12 ? <div className="text-xs text-[var(--career-muted)] mt-3">Showing latest 12.</div> : null}
        </div>
      ) : (
        <EmptyState title="No applications yet" desc="Add your first application to unlock rejection pattern analysis." />
      )}

      {analysis ? (
        <div className="career-card">
          <div className="font-semibold">Rejection pattern insights</div>
          <div className="text-sm text-[var(--career-muted)] mt-1">{analysis.top_recommendation}</div>
          <ul className="mt-3 text-sm text-[var(--career-muted)] space-y-2">
            {(analysis.patterns || []).slice(0, 6).map((p, idx) => (
              <li key={idx}>
                <span className="font-semibold text-white/85">{p.pattern}</span> — {p.recommendation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function CertificationsTab() {
  const [role, setRole] = useState('Software Engineer');
  const [skills, setSkills] = useState('');
  const [missingSkills, setMissingSkills] = useState('');
  const [budget, setBudget] = useState('any');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rec, setRec] = useState(null);
  const [tracked, setTracked] = useState([]);

  const loadTracked = async () => {
    try {
      const data = await skillscanListTrackedCerts();
      setTracked(data.tracked || []);
    } catch {
      // optional
    }
  };

  const recommend = async () => {
    setLoading(true);
    setError('');
    setRec(null);
    try {
      const data = await skillscanRecommendCerts({
        role,
        budget,
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        missingSkills: missingSkills.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setRec(data.recommendations);
      await loadTracked();
    } catch (e) {
      setError(e?.message || 'Failed to recommend.');
    } finally {
      setLoading(false);
    }
  };

  const add = async (c) => {
    setError('');
    try {
      await skillscanAddTrackedCert({
        name: c.name,
        platform: c.platform,
        status: 'not_started',
        completion_percent: 0,
        cost: c.cost || '',
        duration: c.duration || '',
        salary_impact: c.salary_impact_lpa || 0,
        gaps_closed: c.gaps_closed || [],
        url: c.url || '',
      });
      await loadTracked();
    } catch (e) {
      setError(e?.message || 'Failed to add to tracker.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">Certification Recommender</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Get certifications ranked by ROI and track progress.</div>
        <div className="mt-4 grid grid-cols-1 gap-3">
          <input className="career-input" value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role" />
          <input className="career-input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Current skills (comma separated)" />
          <input className="career-input" value={missingSkills} onChange={(e) => setMissingSkills(e.target.value)} placeholder="Missing skills (comma separated)" />
          <input className="career-input" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget (any/free/under 5000 INR)" />
          <button className="career-btn" disabled={loading || !role.trim()} onClick={recommend}>
            {loading ? 'Finding…' : 'Get recommendations'}
          </button>
        </div>
      </div>

      {loading ? <SkeletonCard lines={6} /> : null}
      {error ? <ErrorState message={error} onRetry={recommend} /> : null}

      {rec?.certifications?.length ? (
        <div className="career-card">
          <div className="font-semibold">Top certifications</div>
          <div className="mt-3 space-y-2">
            {rec.certifications.slice(0, 5).map((c) => (
              <div key={c.name} className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-[var(--career-muted)] mt-1">{c.platform} · {c.duration} · {c.cost} · +₹{c.salary_impact_lpa} LPA</div>
                </div>
                <button className="career-btn" onClick={() => add(c)}>Track</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState title="No recommendations yet" desc="Fill role + skills and generate recommendations." />
      )}

      <div className="career-card">
        <div className="font-semibold">Your tracked certifications</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="career-btn" onClick={loadTracked}>Refresh tracker</button>
        </div>
        <div className="mt-3 space-y-2">
          {tracked.length ? tracked.slice(0, 10).map((t) => (
            <div key={t.id} className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{t.name}</div>
                <div className="text-xs text-[var(--career-muted)] mt-1">{t.platform} · {t.status} · {t.completion_percent}%</div>
              </div>
            </div>
          )) : <div className="text-sm text-[var(--career-muted)]">No tracked certifications yet.</div>}
        </div>
      </div>
    </div>
  );
}

function ChatTab() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const data = await skillscanChat({ messages: next });
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setError(e?.message || 'Chat failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="career-card">
        <div className="font-semibold">AI Career Advisor</div>
        <div className="text-sm text-[var(--career-muted)] mt-1">Ask anything about roles, hiring, skills, interview prep.</div>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="career-card">
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--career-border)] bg-[var(--career-surface)] p-4 min-h-[240px]">
            {messages.length ? (
              <div className="space-y-3">
                {messages.slice(-10).map((m, idx) => (
                  <div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
                    <div className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.role === 'user' ? 'bg-[var(--career-surface)] border border-[var(--career-border)] border border-[var(--career-border)]' : 'bg-[var(--career-surface)] border border-[var(--career-border)]'}`}>
                      <div className="whitespace-pre-wrap text-white/85">{m.content}</div>
                    </div>
                  </div>
                ))}
                {loading ? <div className="text-sm text-[var(--career-muted)]">Thinking…</div> : null}
              </div>
            ) : (
              <div className="text-sm text-[var(--career-muted)]">Start by asking: “What should I learn first for {`{role}`}?”</div>
            )}
          </div>
          <div className="flex gap-2">
            <input className="career-input flex-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question…" />
            <button className="career-btn" disabled={loading || !input.trim()} onClick={send}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SkillScanTabs() {
  const tabs = [
    { id: 'skill-gap', label: 'Gap Analyzer' },
    { id: 'ats', label: 'ATS Resume' },
    { id: 'job-match', label: 'Job Match' },
    { id: 'linkedin', label: 'LinkedIn' },
    { id: 'salary', label: 'Salary' },
    { id: 'applications', label: 'Applications' },
    { id: 'certs', label: 'Certifications' },
    { id: 'chat', label: 'AI Chat' },
  ];

  const [active, setActive] = useState('skill-gap');

  return (
    <div className="space-y-4">
      <TabHeader tabs={tabs} active={active} onChange={setActive} />
      <AnimatePresence mode="wait">
        <motion.div key={active} {...fade}>
          {active === 'skill-gap' ? <SkillGapTab /> : null}
          {active === 'ats' ? <AtsTab /> : null}
          {active === 'job-match' ? <JobMatchTab /> : null}
          {active === 'linkedin' ? <LinkedInTab /> : null}
          {active === 'salary' ? <SalaryTab /> : null}
          {active === 'applications' ? <ApplicationsTab /> : null}
          {active === 'certs' ? <CertificationsTab /> : null}
          {active === 'chat' ? <ChatTab /> : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

