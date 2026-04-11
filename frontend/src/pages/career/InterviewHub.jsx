import { useEffect, useMemo, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ErrorState } from '../../components/PageStates';
import api from '../../utils/api';
import {
  Brain,
  Building2,
  Clock,
  Gauge,
  MessageSquare,
  Send,
  Sparkles,
  Timer,
  Wand2,
  ClipboardList,
  Users,
  PanelsTopLeft,
} from 'lucide-react';

const DURATION_PRESETS = [
  { id: 'short', label: '10 min (~5 Qs)', questions: 5, seconds: 600 },
  { id: 'medium', label: '20 min (~8 Qs)', questions: 8, seconds: 1200 },
  { id: 'long', label: '30 min (~12 Qs)', questions: 12, seconds: 1800 },
];

const DIFFICULTY = [
  { id: 'fresher', label: 'Fresher' },
  { id: 'mid', label: 'Mid-Level' },
  { id: 'senior', label: 'Senior' },
];

const COMPANY = [
  { id: 'general', label: 'General' },
  { id: 'faang', label: 'FAANG-style' },
  { id: 'startup', label: 'Startup' },
  { id: 'mnc', label: 'MNC' },
  { id: 'consulting', label: 'Consulting' },
];

const INTERVIEW_TYPES = [
  { id: 'technical', label: 'Technical Interview', icon: Brain, sub: 'DSA, system design, CS fundamentals.' },
  { id: 'behavioral', label: 'HR / Behavioral', icon: MessageSquare, sub: 'Past stories, strengths, situations.' },
  { id: 'domain', label: 'Domain-Specific', icon: ClipboardList, sub: 'Based on your primary subject or stack.' },
  { id: 'mock', label: 'Mock Placement', icon: PanelsTopLeft, sub: 'Mixed tech + aptitude, most realistic.' },
  { id: 'group', label: 'Group Discussion', icon: Users, sub: 'Opinion, structure, spoken clarity.' },
  { id: 'case', label: 'Case Study', icon: Building2, sub: 'Business/engineering scenarios, problem solving.' },
];

const DOMAIN_TAGS = [
  'OS',
  'DBMS',
  'CN',
  'DS',
  'AOA',
  'OOP',
  'SE',
  'ML',
  'AI',
  'Web',
  'Cloud',
  'Security',
  'TOC',
  'CD',
  'DE',
  'CA',
];

async function startInterview(body) {
  const { data } = await api.post('/career/interview/start', body);
  return data;
}

async function interviewTurn(sessionId, answer) {
  const { data } = await api.post('/career/interview/turn', { sessionId, answer });
  return data;
}

async function finalizeInterview(sessionId) {
  const { data } = await api.post('/career/interview/final', { sessionId });
  return data;
}

function formatMmSs(sec) {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

function RadarMini({ radar }) {
  const keys = [
    { k: 'technical', label: 'Technical' },
    { k: 'communication', label: 'Comms' },
    { k: 'confidence', label: 'Confidence' },
    { k: 'structure', label: 'Structure' },
    { k: 'realtime', label: 'Realtime' },
  ];
  const pts = keys.map(({ k }, i) => {
    const v = (Number(radar?.[k]) || 0) / 100;
    const angle = (Math.PI * 2 * i) / keys.length - Math.PI / 2;
    const r = 48 * v;
    return [50 + r * Math.cos(angle), 50 + r * Math.sin(angle)];
  });
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

  return (
    <div className="flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" className="w-44 h-44 text-[var(--career-accent)]">
        <polygon fill="rgba(139,92,246,0.15)" stroke="currentColor" strokeWidth="1" points="50,2 95,38 78,88 22,88 5,38" />
        <path d={d} fill="rgba(6,182,212,0.25)" stroke="#06B6D4" strokeWidth="1.5" />
      </svg>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono text-[var(--career-muted)] w-full max-w-[200px]">
        {keys.map(({ k, label }) => (
          <span key={k} className="flex justify-between">
            <span>{label}</span>
            <span className="text-[var(--career-accent2)]">{Number(radar?.[k]) || 0}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function InterviewHub() {
  const [searchParams] = useSearchParams();
  const focusHint = searchParams.get('focus') || '';

  const [uiPhase, setUiPhase] = useState('setup');
  const [track, setTrack] = useState('dsa');
  const [typeId, setTypeId] = useState('technical');
  const [difficulty, setDifficulty] = useState('mid');
  const [durationId, setDurationId] = useState('short');
  const [companyStyle, setCompanyStyle] = useState('general');
  const [domains, setDomains] = useState(() => new Set());

  const [session, setSession] = useState(null);
  const [targetQuestions, setTargetQuestions] = useState(5);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [err, setErr] = useState(null);
  const [lastMetrics, setLastMetrics] = useState(null);
  const [turnIndex, setTurnIndex] = useState(1);
  const [sessionComplete, setSessionComplete] = useState(false);

  const [timeLeft, setTimeLeft] = useState(600);

  const preset = useMemo(() => DURATION_PRESETS.find((d) => d.id === durationId) || DURATION_PRESETS[0], [durationId]);

  useEffect(() => {
    if (uiPhase !== 'session' || sessionComplete || assessment) return;
    setTimeLeft(preset.seconds);
    const t = setInterval(() => setTimeLeft((x) => (x <= 0 ? 0 : x - 1)), 1000);
    return () => clearInterval(t);
  }, [uiPhase, session?.sessionId, preset.seconds, sessionComplete, assessment]);

  const answeredCount = useMemo(() => history.filter((m) => m.role === 'user').length, [history]);

  const begin = async () => {
    setErr(null);
    setAssessment(null);
    setSessionComplete(false);
    setLastMetrics(null);
    setLoading(true);
    try {
      const focusFromQuery = focusHint ? decodeURIComponent(focusHint) : '';
      const focusFromDomains = Array.from(domains).join(', ');
      const focusTopics = [focusFromQuery, focusFromDomains].filter(Boolean).join(' | ');
      const s = await startInterview({
        track,
        typeId,
        focusTopics,
        targetQuestions: preset.questions,
        difficulty,
        companyStyle,
      });
      setSession({ sessionId: s.sessionId });
      setTargetQuestions(s.targetQuestions || preset.questions);
      setHistory([{ role: 'assistant', content: s.question }]);
      setTurnIndex(1);
      setUiPhase('session');
      setTimeLeft(preset.seconds);
    } catch {
      setErr('Failed to start interview. Set GROQ_API_KEY on the backend.');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!session || !input.trim() || sessionComplete) return;
    const answer = input.trim();
    setInput('');
    setLoading(true);
    setHistory((h) => [...h, { role: 'user', content: answer }]);
    try {
      const t = await interviewTurn(session.sessionId, answer);
      if (t.complete) {
        setLastMetrics(t.metrics || null);
        setSessionComplete(true);
        setHistory((h) => [...h, { role: 'assistant', content: t.closingMessage || 'Session complete.' }]);
      } else {
        setHistory((h) => [...h, { role: 'assistant', content: t.question }]);
        setLastMetrics(t.metrics || null);
        if (typeof t.turnIndex === 'number') setTurnIndex(t.turnIndex);
      }
    } catch {
      setErr('Interview turn failed.');
    } finally {
      setLoading(false);
    }
  };

  const end = async () => {
    if (!session) return;
    setLoading(true);
    try {
      const r = await finalizeInterview(session.sessionId);
      setAssessment(r.assessment || null);
      setUiPhase('report');
    } catch {
      setErr('Failed to generate final report. Set GEMINI_API_KEY for structured reports.');
    } finally {
      setLoading(false);
    }
  };

  const resetAll = useCallback(() => {
    setUiPhase('setup');
    setSession(null);
    setHistory([]);
    setAssessment(null);
    setSessionComplete(false);
    setLastMetrics(null);
    setErr(null);
    setTypeId('technical');
    setDomains(new Set());
  }, []);

  const title = useMemo(() => {
    if (track === 'system') return 'System Design';
    if (track === 'behavioral') return 'Behavioral';
    return 'DSA / Technical';
  }, [track]);

  if (uiPhase === 'setup') {
    return (
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Interview Lab</div>
          <h1 className="font-display font-extrabold text-3xl mt-1 text-[var(--career-text)]">Configure your mock interview</h1>
          <p className="text-sm text-[var(--career-muted)] mt-2 max-w-3xl">
            Groq drives live Q&amp;A with per-answer scoring; Gemini builds your final radar, grade, and improvement plan.
            {focusHint ? (
              <span className="block mt-2 text-[var(--career-accent2)] font-semibold">
                Focus: {decodeURIComponent(focusHint)}
              </span>
            ) : null}
          </p>
        </div>

        {err && <ErrorState message={err} onRetry={() => setErr(null)} />}

        <div className="career-card p-6 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[2fr,3fr] gap-6">
            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Choose interview type</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INTERVIEW_TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTypeId(t.id)}
                    className={`text-left rounded-[12px] border px-4 py-4 transition-all ${
                      typeId === t.id
                        ? 'border-[rgba(139,92,246,0.65)] bg-[rgba(139,92,246,0.16)]'
                        : 'border-[var(--career-border)] bg-[var(--career-surface)] hover:bg-black/[0.02]'
                    }`}
                  >
                    <div className="font-extrabold text-[var(--career-text)] flex items-center gap-2">
                      <t.icon size={16} />
                      {t.label}
                    </div>
                    <div className="text-xs text-[var(--career-muted)] mt-1">{t.sub}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Select your domain</div>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {DOMAIN_TAGS.map((tag) => {
                  const active = domains.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setDomains((prev) => {
                          const next = new Set(prev);
                          if (next.has(tag)) next.delete(tag);
                          else next.add(tag);
                          return next;
                        });
                      }}
                      className={`text-[10px] font-mono rounded-full px-2 py-1 border transition ${
                        active
                          ? 'border-[rgba(6,182,212,0.7)] bg-[rgba(6,182,212,0.12)] text-[var(--career-text)]'
                          : 'border-[var(--career-border)] text-[var(--career-muted)] hover:border-[rgba(6,182,212,0.4)] hover:bg-black/[0.02]'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="career-card p-6 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-2">
              <Gauge size={16} /> Difficulty
            </div>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTY.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`career-btn !py-2 !px-3 ${difficulty === d.id ? '' : 'opacity-60'}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="career-card p-6 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-2">
              <Clock size={16} /> Duration
            </div>
            <div className="flex flex-col gap-2">
              {DURATION_PRESETS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDurationId(d.id)}
                  className={`text-left rounded-[12px] border px-4 py-3 text-sm ${
                    durationId === d.id ? 'border-[rgba(6,182,212,0.45)] bg-[rgba(6,182,212,0.08)]' : 'border-[var(--career-border)] bg-[var(--career-surface)]'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="career-card p-6 space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] flex items-center gap-2">
              <Building2 size={16} /> Company style
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPANY.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCompanyStyle(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                    companyStyle === c.id
                      ? 'border-[rgba(139,92,246,0.5)] bg-[rgba(139,92,246,0.15)] text-[var(--career-text)]'
                      : 'border-[var(--career-border)] text-[var(--career-muted)]'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={begin} disabled={loading} className="career-btn">
            <Wand2 size={16} /> {loading ? 'Starting…' : 'Start interview'}
          </button>
        </div>
      </div>
    );
  }

  if (uiPhase === 'session') {
    const progress = Math.min(100, Math.round((answeredCount / Math.max(1, targetQuestions)) * 100));
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Live session · {title}</div>
            <h1 className="font-display font-extrabold text-2xl mt-1 text-[var(--career-text)]">Question {Math.min(turnIndex, targetQuestions)} / {targetQuestions}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="career-chip flex items-center gap-2">
              <Timer size={14} />
              {formatMmSs(timeLeft)}
            </div>
            <button type="button" onClick={end} disabled={loading} className="career-btn">
              <Sparkles size={16} /> {loading ? 'Reporting…' : 'End & Report'}
            </button>
          </div>
        </div>

        {err && <ErrorState message={err} onRetry={() => setErr(null)} />}

        <div className="career-card p-4 space-y-2">
          <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-[var(--career-muted)]">
            <span>Session progress</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[var(--career-border)] bg-opacity-50 overflow-hidden border border-[var(--career-border)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--career-accent), var(--career-accent2))',
              }}
            />
          </div>
        </div>

        {lastMetrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              ['Confidence', lastMetrics.confidence],
              ['Technical', lastMetrics.technical],
              ['Structure', lastMetrics.structure],
              ['Communication', lastMetrics.communication],
            ].map(([label, val]) => (
              <div key={label} className="career-card p-4 !py-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--career-muted)]">{label}</div>
                <div className="font-display font-extrabold text-2xl text-[var(--career-accent2)] mt-1">{val}%</div>
              </div>
            ))}
          </div>
        )}

        {lastMetrics?.tip && (
          <div className="rounded-[12px] border border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)] px-4 py-3 text-sm text-[var(--career-text)]">
            <span className="font-extrabold text-[var(--career-accent2)]">Coach tip: </span>
            {lastMetrics.tip}
          </div>
        )}

        <div className="career-card p-0 overflow-hidden">
          <div className="px-6 py-3 border-b border-[var(--career-border)] flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Transcript</span>
            {sessionComplete && <span className="career-chip text-[10px]">Complete — generate report</span>}
          </div>
          <div className="p-6 space-y-4 max-h-[50vh] overflow-auto">
            {history.map((m, i) => (
              <div
                key={i}
                className={`border rounded-[12px] p-4 ${
                  m.role === 'user'
                    ? 'border-[rgba(6,182,212,0.25)] bg-[rgba(6,182,212,0.06)]'
                    : 'border-[rgba(139,92,246,0.25)] bg-[rgba(139,92,246,0.06)]'
                }`}
              >
                <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)] mb-2">
                  {m.role === 'user' ? 'You' : 'Interviewer'}
                </div>
                <div className="text-sm text-[var(--career-text)] whitespace-pre-wrap">{m.content}</div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-[var(--career-border)] bg-[var(--career-surface)]">
            <div className="flex items-center gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={sessionComplete || loading}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
                className="flex-1 bg-black/[0.02] border border-[var(--career-border)] rounded-[12px] px-4 py-3 text-sm text-[var(--career-text)] outline-none disabled:opacity-50"
                placeholder={sessionComplete ? 'Session finished — use End & Report' : 'Type your answer…'}
              />
              <button type="button" className="career-btn" onClick={send} disabled={sessionComplete || loading}>
                <Send size={16} /> Send
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* report */
  if (err && !assessment) return <ErrorState message={err} onRetry={() => setErr(null)} />;

  const radar = assessment?.radar || {};
  const weekTitles = { week1: 'Week 1', week2: 'Week 2', week3: 'Week 3' };
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-extrabold uppercase tracking-[0.28em] text-[var(--career-muted)]">Interview report</div>
          <h1 className="font-display font-extrabold text-3xl mt-1 text-[var(--career-text)]">Performance summary</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" className="career-btn" onClick={resetAll}>
            New session
          </button>
        </div>
      </div>

      {!assessment ? (
        <div className="career-card p-8 text-center text-[var(--career-muted)] text-sm">
          No report yet. Run a session and tap <strong className="text-[var(--career-text)]">End &amp; Report</strong>.
        </div>
      ) : null}

      {assessment && (
        <>
          <div className="career-card p-6 flex flex-wrap gap-8 items-center">
            <div className="relative w-36 h-36 rounded-full border-4 border-[rgba(139,92,246,0.35)] flex items-center justify-center bg-[var(--career-surface)]">
              <div className="text-center">
                <div className="font-display font-extrabold text-3xl text-[var(--career-accent2)]">{assessment.overallScore}</div>
                <div className="text-[10px] font-mono uppercase text-[var(--career-muted)]">/ 100</div>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="font-display font-extrabold text-2xl text-[var(--career-text)]">{assessment.verdict}</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {assessment.grade && <span className="career-chip">Grade {assessment.grade}</span>}
                {assessment.placementReadiness && (
                  <span className="career-chip border-[rgba(6,182,212,0.35)]">{assessment.placementReadiness}</span>
                )}
              </div>
              {assessment.report && (
                <p className="text-sm text-[var(--career-muted)] mt-3 whitespace-pre-wrap">{assessment.report}</p>
              )}
            </div>
            <RadarMini radar={radar} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(assessment.categoryScores || []).map((c) => (
              <div key={c.name} className="career-card p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold text-[var(--career-text)]">{c.name}</div>
                  <div className="career-chip">{c.score}%</div>
                </div>
                <div className="mt-3 h-2 rounded-full bg-[var(--career-border)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, c.score))}%`,
                      background: 'linear-gradient(90deg, var(--career-accent), var(--career-accent2))',
                    }}
                  />
                </div>
                {c.notes && <div className="text-sm text-[var(--career-muted)] mt-3">{c.notes}</div>}
              </div>
            ))}
          </div>

          {(assessment.questionReviews?.length > 0) && (
            <div className="career-card p-6">
              <div className="career-kicker mb-3">Question review</div>
              <div className="space-y-3">
                {assessment.questionReviews.map((q) => (
                  <div key={q.index} className="border border-[var(--career-border)] rounded-[12px] p-4 bg-[var(--career-surface)]">
                    <div className="flex justify-between gap-4">
                      <span className="text-xs font-extrabold text-[var(--career-accent2)]">Q{q.index}</span>
                      <span className="career-chip">{q.score}/10</span>
                    </div>
                    <p className="text-sm text-[var(--career-text)] mt-2">{q.prompt}</p>
                    <p className="text-xs text-[var(--career-muted)] mt-2">{q.feedback}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {assessment.improvementPlan && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['week1', 'week2', 'week3'].map((w) =>
                assessment.improvementPlan[w] ? (
                  <div key={w} className="career-card p-5">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--career-muted)]">{weekTitles[w]}</div>
                    <p className="text-sm text-[var(--career-text)] mt-2">{assessment.improvementPlan[w]}</p>
                  </div>
                ) : null,
              )}
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="career-card p-5">
              <div className="career-kicker mb-2">Strengths</div>
              <ul className="text-sm text-[var(--career-text)] space-y-1">
                {(assessment.strengths || []).map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
            <div className="career-card p-5">
              <div className="career-kicker mb-2">Growth areas</div>
              <ul className="text-sm text-[var(--career-text)] space-y-1">
                {(assessment.improvements || []).map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
            <div className="career-card p-5">
              <div className="career-kicker mb-2">Next topics</div>
              <ul className="text-sm text-[var(--career-text)] space-y-1">
                {(assessment.nextTopics || []).map((s, i) => (
                  <li key={i}>• {s}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
